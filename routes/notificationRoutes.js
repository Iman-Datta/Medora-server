const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const authMiddleware = require("../middleware/authMiddleware");

// All notification routes are protected
router.use(authMiddleware);

// @desc    Get all notifications for logged-in user
// @route   GET /api/notifications
router.get("/", async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user })
      .sort({ createdAt: -1 })
      .limit(50); // Fetch latest 50

    const unreadCount = await Notification.countDocuments({
      userId: req.user,
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      unreadCount,
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Mark a single notification as read
// @route   PATCH /api/notifications/:id/read
router.patch("/:id/read", async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user },
      { isRead: true },
      { new: true },
    );

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    return res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/read-all
router.patch("/read-all", async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user, isRead: false },
      { isRead: true },
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
router.delete("/:id", async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user,
    });

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
