const mongoose = require('mongoose');
const User = require('../models/User');
const Notification = require('../models/Notification');

const ALLOWED_TYPES = new Set(['system', 'reward', 'plan', 'reminder']);
const ALLOWED_ROLES = new Set(['standard', 'vip', 'admin']);

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function normalizeText(value, fallback = '', maxLen = 500) {
  const text = String(value ?? fallback).trim();
  return text.slice(0, maxLen);
}

function buildRecipientQuery({ targetType, userId, role }) {
  if (targetType === 'single') {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return { error: 'userId không hợp lệ cho chế độ gửi 1 người dùng' };
    }
    return { query: { _id: userId } };
  }

  if (targetType === 'role') {
    if (!ALLOWED_ROLES.has(role)) {
      return { error: 'role không hợp lệ. Chỉ chấp nhận: standard, vip, admin' };
    }
    return { query: { role, status: 'active' } };
  }

  if (targetType === 'all') {
    return { query: { status: 'active' } };
  }

  return { error: 'targetType không hợp lệ. Chỉ chấp nhận: single, role, all' };
}

exports.getRecipientStats = async (req, res) => {
  try {
    const [allActive, standard, vip, admin] = await Promise.all([
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ status: 'active', role: 'standard' }),
      User.countDocuments({ status: 'active', role: 'vip' }),
      User.countDocuments({ status: 'active', role: 'admin' }),
    ]);

    return res.json({
      success: true,
      data: {
        all: allActive,
        byRole: { standard, vip, admin },
      },
    });
  } catch (error) {
    console.error('[AdminNotifications] getRecipientStats error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi lấy thống kê người nhận' });
  }
};

exports.getSendHistory = async (req, res) => {
  try {
    const limit = clampInt(req.query.limit, 1, 50, 20);

    const docs = await Notification.find({ 'meta.source': 'admin_manual' })
      .sort({ created_at: -1 })
      .limit(limit)
      .populate('userId', 'user_name email role status')
      .lean();

    return res.json({ success: true, data: { items: docs } });
  } catch (error) {
    console.error('[AdminNotifications] getSendHistory error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi lấy lịch sử gửi thông báo' });
  }
};

exports.sendNotification = async (req, res) => {
  try {
    const {
      targetType = 'single',
      userId,
      role,
      type = 'system',
      title,
      message = '',
      link = '',
    } = req.body || {};

    const cleanTitle = normalizeText(title, '', 120);
    const cleanMessage = normalizeText(message, '', 500);
    const cleanLink = normalizeText(link, '', 200);
    const cleanType = ALLOWED_TYPES.has(type) ? type : 'system';

    if (!cleanTitle) {
      return res.status(400).json({ success: false, message: 'Tiêu đề thông báo là bắt buộc' });
    }

    const { query, error } = buildRecipientQuery({ targetType, userId, role });
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    const recipients = await User.find(query).select('_id user_name email role').lean();
    if (!recipients.length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người nhận phù hợp' });
    }

    const sender = await User.findById(req.userId).select('user_name email role').lean();
    const senderName = sender?.user_name || sender?.email || 'Admin';
    const senderRole = sender?.role || 'admin';

    const now = new Date();
    const docs = recipients.map((u) => ({
      userId: u._id,
      type: cleanType,
      title: cleanTitle,
      message: cleanMessage,
      link: cleanLink,
      isRead: false,
      meta: {
        source: 'admin_manual',
        sentBy: req.userId,
        senderName,
        senderRole,
        targetType,
        role: targetType === 'role' ? role : undefined,
        sentAt: now,
      },
    }));

    const batchSize = 1000;
    let insertedCount = 0;
    for (let i = 0; i < docs.length; i += batchSize) {
      const chunk = docs.slice(i, i + batchSize);
      const inserted = await Notification.insertMany(chunk, { ordered: false });
      insertedCount += inserted.length;
    }

    return res.status(201).json({
      success: true,
      message: `Đã gửi thông báo cho ${insertedCount} người dùng`,
      data: {
        insertedCount,
        targetType,
        role: targetType === 'role' ? role : null,
      },
    });
  } catch (error) {
    console.error('[AdminNotifications] sendNotification error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi gửi thông báo' });
  }
};
