'use strict';

const mongoose = require('mongoose');
const Notification = require('../models/Notification');

function resolveSenderInfo(item) {
  const senderName = item?.meta?.senderName || (item?.meta?.source === 'admin_manual' ? 'Admin' : 'Hệ thống');
  const senderRole = item?.meta?.senderRole || (item?.meta?.source === 'admin_manual' ? 'admin' : 'system');
  return { senderName, senderRole };
}

function clampLimit(value, min = 1, max = 50, fallback = 15) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

async function countUnread(userId) {
  return Notification.countDocuments({ userId, isRead: false });
}

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.userId;
    const limit = clampLimit(req.query.limit, 1, 100, 20);

    const [rawItems, unread] = await Promise.all([
      Notification.find({ userId })
        .sort({ created_at: -1 })
        .limit(limit)
        .lean(),
      countUnread(userId),
    ]);

    const items = rawItems.map((item) => {
      const sender = resolveSenderInfo(item);
      return {
        ...item,
        senderName: sender.senderName,
        senderRole: sender.senderRole,
      };
    });

    return res.json({ success: true, data: { items, unread } });
  } catch (err) {
    console.error('[Notification] getNotifications error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi lấy thông báo' });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const unread = await countUnread(req.userId);
    return res.json({ success: true, data: { unread } });
  } catch (err) {
    console.error('[Notification] getUnreadCount error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi lấy số thông báo chưa đọc' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID thông báo không hợp lệ' });
    }

    const doc = await Notification.findOne({ _id: id, userId: req.userId });
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo' });
    }

    if (!doc.isRead) {
      doc.isRead = true;
      doc.readAt = new Date();
      await doc.save();
    }

    const unread = await countUnread(req.userId);
    return res.json({ success: true, data: { notification: doc, unread } });
  } catch (err) {
    console.error('[Notification] markAsRead error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi đánh dấu đã đọc' });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const now = new Date();
    await Notification.updateMany(
      { userId: req.userId, isRead: false },
      { $set: { isRead: true, readAt: now } }
    );

    return res.json({ success: true, data: { unread: 0 } });
  } catch (err) {
    console.error('[Notification] markAllAsRead error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi đọc tất cả thông báo' });
  }
};

exports.createSelfTestNotification = async (req, res) => {
  try {
    const { title, message, link, type = 'system' } = req.body || {};
    const doc = await Notification.create({
      userId: req.userId,
      type: ['system', 'reward', 'plan', 'reminder'].includes(type) ? type : 'system',
      title: String(title || 'Thông báo mới'),
      message: String(message || 'Bạn có cập nhật mới trên hệ thống.'),
      link: String(link || '/dashboard'),
      meta: {
        source: 'self_test',
        senderName: 'Hệ thống',
        senderRole: 'system',
      },
      isRead: false,
    });

    const unread = await countUnread(req.userId);
    return res.status(201).json({ success: true, data: { notification: doc, unread } });
  } catch (err) {
    console.error('[Notification] createSelfTestNotification error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi tạo thông báo test' });
  }
};

exports.pushNotification = async ({ userId, title, message = '', type = 'system', link = '', meta = {} }) => {
  if (!userId || !title) return null;
  try {
    return await Notification.create({
      userId,
      title,
      message,
      type: ['system', 'reward', 'plan', 'reminder'].includes(type) ? type : 'system',
      link,
      meta: {
        senderName: meta?.senderName || 'Hệ thống',
        senderRole: meta?.senderRole || 'system',
        source: meta?.source || 'system_event',
        ...meta,
      },
      isRead: false,
    });
  } catch (err) {
    console.error('[Notification] pushNotification error:', err.message);
    return null;
  }
};
