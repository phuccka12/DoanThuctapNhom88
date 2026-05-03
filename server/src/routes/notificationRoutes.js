'use strict';

const express = require('express');
const router = express.Router();

const { protect } = require('../middlewares/authMiddleware');
const notificationController = require('../controllers/notificationController');

router.use(protect);

router.get('/', notificationController.getNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.post('/mark-all-read', notificationController.markAllAsRead);
router.patch('/:id/read', notificationController.markAsRead);

// Dev/test helper: tạo thông báo cho chính user hiện tại
router.post('/self-test', notificationController.createSelfTestNotification);

module.exports = router;
