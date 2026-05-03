const express = require('express');
const router = express.Router();

const { protect } = require('../../middlewares/authMiddleware');
const requireAdmin = require('../../middlewares/requireAdmin');
const controller = require('../../controllers/AdminNotifications');

router.use(protect, requireAdmin);

router.get('/recipients/stats', controller.getRecipientStats);
router.get('/history', controller.getSendHistory);
router.post('/send', controller.sendNotification);

module.exports = router;
