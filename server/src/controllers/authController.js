const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const signToken = (user) => {
  return jwt.sign(
    { user_id: user._id.toString(), role: user.role },
    process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || process.env.JWT_EXPIRES_IN || "15m" }
  );
};

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { user_name, email, password } = req.body;

    if (!user_name || !email || !password) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ họ tên, email và mật khẩu" });
    }

    if (user_name.trim().length < 2) {
      return res.status(400).json({ message: "Họ tên phải có ít nhất 2 ký tự" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Định dạng email không hợp lệ (ví dụ: name@example.com)" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Mật khẩu phải có tối thiểu 6 ký tự để đảm bảo an toàn" });
    }

    const emailLower = String(email).toLowerCase().trim();
    const existed = await User.findOne({ email: emailLower });
    if (existed) return res.status(409).json({ message: "Email này đã được đăng ký. Bạn có muốn đăng nhập không?" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      user_name: user_name.trim(),
      email: emailLower,
      password_hash: hashedPassword,
      role: "standard",
    });

    const token = signToken(user);

    return res.status(201).json({
      message: "Chào mừng bạn gia nhập! Đăng ký thành công.",
      token,
      user: {
        id: user._id,
        user_name: user.user_name,
        email: user.email,
        role: user.role,
        vip_expire_at: user.vip_expire_at,
        gamification_data: user.gamification_data,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Lỗi hệ thống khi đăng ký", error: err.message });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ email và mật khẩu" });

    const emailLower = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: emailLower });
    
    if (!user) return res.status(401).json({ message: "Email này chưa được đăng ký trong hệ thống" });

    if (user.lock_until && user.lock_until > new Date()) {
      return res.status(423).json({ message: "Tài khoản tạm khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau vài phút." });
    }

    // nếu hết hạn VIP thì tự hạ xuống standard
    if (user.role === "vip" && user.vip_expire_at && user.vip_expire_at < new Date()) {
      user.role = "standard";
      user.vip_expire_at = null;
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "Mật khẩu không chính xác. Vui lòng kiểm tra lại." });
    
    user.failed_login_attempts = 0;
    user.lock_until = null;
    user.last_login_at = new Date();
    await user.save();

    const token = signToken(user);

    return res.json({
      message: "Đăng nhập thành công",
      token,
      user: {
        id: user._id,
        user_name: user.user_name,
        email: user.email,
        role: user.role,
        vip_expire_at: user.vip_expire_at,
        gamification_data: user.gamification_data,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

// POST /api/auth/refresh
exports.refresh = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
    
    if (!token) {
      return res.status(401).json({ message: "Không tìm thấy token" });
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET);
    const user = await User.findById(decoded.user_id);

    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    // Check VIP expiry
    if (user.role === "vip" && user.vip_expire_at && user.vip_expire_at < new Date()) {
      user.role = "standard";
      user.vip_expire_at = null;
      await user.save();
    }

    const newToken = signToken(user);

    return res.json({
      message: "Làm mới token thành công",
      token: newToken,
      user: {
        id: user._id,
        user_name: user.user_name,
        email: user.email,
        role: user.role,
        vip_expire_at: user.vip_expire_at,
        gamification_data: user.gamification_data,
      },
    });
  } catch (err) {
    return res.status(401).json({ message: "Token không hợp lệ", error: err.message });
  }
};

// POST /api/auth/logout
exports.logout = async (req, res) => {
  try {
    // For JWT, we can't invalidate token on server side
    // Client should remove token from storage
    return res.json({ message: "Đăng xuất thành công" });
  } catch (err) {
    return res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

// POST /api/auth/logout-all
exports.logoutAll = async (req, res) => {
  try {
    // This would require a session management system
    // For now, just return success message
    return res.json({ message: "Đăng xuất khỏi tất cả thiết bị thành công" });
  } catch (err) {
    return res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};
// POST /api/auth/change-password
exports.changePassword = async (req, res) => {
  try {
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) {
      return res.status(400).json({ message: "Vui lòng nhập mật khẩu cũ và mới" });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ message: "Mật khẩu mới tối thiểu 6 ký tự" });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "Người dùng không tồn tại" });

    // Check old password
    const ok = await bcrypt.compare(old_password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "Mật khẩu cũ không chính xác" });

    // Update new password
    const salt = await bcrypt.genSalt(10);
    user.password_hash = await bcrypt.hash(new_password, salt);
    await user.save();

    return res.json({ success: true, message: "Đổi mật khẩu thành công" });
  } catch (err) {
    return res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};
