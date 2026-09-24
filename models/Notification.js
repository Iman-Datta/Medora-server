const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Medicine",
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["dose_reminder", "low_stock", "system"],
      default: "dose_reminder",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    scheduledTime: {
      type: String,
    },
  },
  { timestamps: true },
);

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
