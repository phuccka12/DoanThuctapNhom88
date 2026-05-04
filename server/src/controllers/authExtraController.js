const User = require("../models/User");
const Session = require("../models/Session");
const UserToken = require("../models/UserToken");
const bcrypt = require("bcryptjs");
const { sendEmail } = require("../services/emailService");
const { createRawToken, hashRawToken } = require("../utils/userToken");

// POST /api/auth/verify-email/request  (auth)
exports.requestVerifyEmail = async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ message: "Không tìm thấy user" });
  if (user.email_verified) return res.json({ message: "Email đã được xác minh" });

  const raw = createRawToken();
  const tokenHash = hashRawToken(raw);

  await UserToken.create({
    user_id: user._id,
    type: "verify_email",
    token_hash: tokenHash,
    expires_at: new Date(Date.now() + 15 * 60 * 1000), // 15 phút
    ip: req.ip || "",
    user_agent: req.headers["user-agent"] || "",
  });

  const base = process.env.APP_BASE_URL || "http://localhost:5173";
  const link = `${base}/verify-email?token=${raw}`;

  await sendEmail({
    to: user.email,
    subject: "Xác minh email",
    html: `Click để xác minh email: <a href="${link}">${link}</a>`,
  });

  return res.json({ message: "Đã gửi email xác minh" });
};

// POST /api/auth/verify-email/confirm  (public)
exports.confirmVerifyEmail = async (req, res) => {
  const { token } = req.body;
  const tokenHash = hashRawToken(token);

  const record = await UserToken.findOne({
    type: "verify_email",
    token_hash: tokenHash,
    used_at: null,
    expires_at: { $gt: new Date() },
  });

  if (!record) return res.status(400).json({ message: "Token không hợp lệ hoặc hết hạn" });

  const user = await User.findById(record.user_id);
  if (!user) return res.status(404).json({ message: "Không tìm thấy user" });

  user.email_verified = true;
  await user.save();

  record.used_at = new Date();
  await record.save();

  return res.json({ message: "Xác minh email thành công" });
};

// POST /api/auth/forgot-password  (public)
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const emailLower = String(email).toLowerCase().trim();

  // Tìm user theo email
  const user = await User.findOne({ email: emailLower });
  if (!user) return res.status(404).json({ message: "Địa chỉ email này chưa được đăng ký trong hệ thống. Vui lòng kiểm tra lại!" });

  const raw = createRawToken();
  const tokenHash = hashRawToken(raw);

  await UserToken.create({
    user_id: user._id,
    type: "reset_password",
    token_hash: tokenHash,
    expires_at: new Date(Date.now() + 15 * 60 * 1000),
    ip: req.ip || "",
    user_agent: req.headers["user-agent"] || "",
  });

  const base = process.env.APP_BASE_URL || "http://localhost:5173";
  const link = `${base}/reset-password?token=${raw}`;

  await sendEmail({
    to: user.email,
    subject: "Đặt lại mật khẩu",
    html: `Click để đặt lại mật khẩu: <a href="${link}">${link}</a>`,
  });

  return res.json({ message: `Hệ thống đã gửi link đặt lại mật khẩu vào hòm thư ${emailLower}. Vui lòng kiểm tra!` });
};

// POST /api/auth/reset-password  (public)
exports.resetPassword = async (req, res) => {
  const { token, new_password } = req.body;
  const tokenHash = hashRawToken(token);

  const record = await UserToken.findOne({
    type: "reset_password",
    token_hash: tokenHash,
    used_at: null,
    expires_at: { $gt: new Date() },
  });

  if (!record) return res.status(400).json({ message: "Token không hợp lệ hoặc hết hạn" });

  const user = await User.findById(record.user_id);
  if (!user) return res.status(404).json({ message: "Không tìm thấy user" });

  user.password_hash = await bcrypt.hash(new_password, 10);
  user.failed_login_attempts = 0;
  user.lock_until = null;
  await user.save();

  record.used_at = new Date();
  await record.save();

  // Bảo mật: reset pass xong thì logout tất cả thiết bị
  await Session.updateMany(
    { user_id: user._id, revoked_at: null },
    { $set: { revoked_at: new Date() } }
  );

  return res.json({ message: "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại." });
};
