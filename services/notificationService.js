const cron = require("node-cron");
const admin = require("firebase-admin");
const path = require("path");

const Medicine = require("../models/Medicine");
const Notification = require("../models/Notification");
const User = require("../models/user");

// Track whether Firebase initialized successfully
let isFirebaseInitialized = false;

try {
  const serviceAccount = require(
    path.join(__dirname, "../config/serviceAccountKey.json"),
  );
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  isFirebaseInitialized = true;
  console.log("🔥 Firebase Admin Initialized Successfully");
} catch (error) {
  console.warn(
    "⚠️ Firebase Service Account Key missing or invalid. Push notifications disabled.",
  );
}

/**
 * Sends real system alarm push notification to Android/iOS
 */
const sendRealSystemPush = async (fcmToken, title, message) => {
  if (!fcmToken || !isFirebaseInitialized || !admin.apps || !admin.apps.length)
    return;

  const payload = {
    token: fcmToken,
    notification: {
      title,
      body: message,
    },
    android: {
      priority: "high",
      notification: {
        sound: "default",
        channelId: "medicine_alarm",
        priority: "max",
        visibility: "public",
      },
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
          badge: 1,
        },
      },
    },
  };

  try {
    await admin.messaging().send(payload);
    console.log(
      `🔊 [ALARM PUSH SENT] Triggered device alarm for token: ${fcmToken.slice(0, 10)}...`,
    );
  } catch (error) {
    console.error(
      "❌ [FCM ERROR] Failed to deliver push alarm:",
      error.message,
    );
  }
};

/**
 * Format local time into HH:MM (24-hour)
 */
const getCurrentTimeString = () => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const checkAndSendReminders = async () => {
  try {
    const currentTime = getCurrentTimeString();
    const todayStr = new Date().toISOString().split("T")[0];

    const activeMedicines = await Medicine.find({
      isActive: true,
      "schedules.time": currentTime,
    });

    for (const medicine of activeMedicines) {
      for (const schedule of medicine.schedules) {
        if (schedule.time === currentTime) {
          // Skip if already logged for today
          const alreadyLogged =
            schedule.takenStatus &&
            schedule.takenStatus.some(
              (entry) => entry.date === todayStr && entry.status !== "pending",
            );
          if (alreadyLogged) continue;

          // Prevent duplicate notification entries for the exact same minute
          const existingNotification = await Notification.findOne({
            userId: medicine.userId,
            medicineId: medicine._id,
            scheduledTime: currentTime,
            createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          });
          if (existingNotification) continue;

          const title = `💊 Time for your medication: ${medicine.name}`;
          const message = `Take ${schedule.dose} (${medicine.dosage}) - ${medicine.instructions}`;

          // 1. Save notification record in MongoDB
          await Notification.create({
            userId: medicine.userId,
            medicineId: medicine._id,
            title,
            message,
            type: "dose_reminder",
            scheduledTime: currentTime,
          });

          console.log(
            `🔔 [REMINDER TRIGGERED] Created notification for ${medicine.name} at ${currentTime}`,
          );

          // 2. Fetch User FCM Token and trigger push alarm (if Firebase is ready)
          const user = await User.findById(medicine.userId).select("fcmToken");
          if (user && user.fcmToken) {
            await sendRealSystemPush(user.fcmToken, title, message);
          }
        }
      }
    }
  } catch (error) {
    console.error("[CRON ERROR] Failed running dose check:", error);
  }
};

const initNotificationCron = () => {
  cron.schedule("* * * * *", () => {
    checkAndSendReminders();
  });

  console.log("⏰ Medicine Alarm Cron Service Active (checking every minute)");
};

module.exports = {
  initNotificationCron,
  checkAndSendReminders,
};
