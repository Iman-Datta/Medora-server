// Dependencies
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");

// Import Notification Service
const { initNotificationCron } = require("./services/notificationService");

// Load environment variables FIRST
dotenv.config();

// Start express app
const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Connect MongoDB
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("MongoDB Connected");
    // Start background cron service for medicine dose reminders after DB connects
    initNotificationCron();
  })
  .catch((error) => console.log("MongoDB Connection Error:", error));

// Routes
const authRoutes = require("./routes/authRoutes");
app.use("/auth", authRoutes);

const medicineRoutes = require("./routes/medicineRoutes");
app.use("/api/medicines", medicineRoutes);

const prescriptionRoutes = require("./routes/prescriptionRoutes");
app.use("/api/prescriptions", prescriptionRoutes);

const notificationRoutes = require("./routes/notificationRoutes");
app.use("/api/notifications", notificationRoutes);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});