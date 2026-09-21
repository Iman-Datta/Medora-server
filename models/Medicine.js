const mongoose = require("mongoose");

// Sub-schema for daily schedule timing
const scheduleSchema = new mongoose.Schema(
  {
    time: {
      type: String, // e.g., "08:00", "14:30", "21:00" (24-hour format)
      required: true,
    },
    dose: {
      type: String, // e.g., "1 tablet", "5ml", "2 drops"
      default: "1 dose",
    },
    takenStatus: [
      {
        date: { type: String }, // Format: "YYYY-MM-DD"
        status: {
          type: String,
          enum: ["taken", "skipped", "missed", "pending"],
          default: "pending",
        },
      },
    ],
  },
  { _id: true },
);

const medicineSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },
    dosage: {
      type: String,
      required: true,
    },
    form: {
      type: String,
      enum: [
        "Tablet",
        "Capsule",
        "Syrup",
        "Injection",
        "Drops",
        "Ointment",
        "Other",
      ],
      default: "Tablet",
    },
    instructions: {
      type: String,
      enum: ["Before Food", "After Food", "With Food", "Anytime"],
      default: "After Food",
    },
    frequency: {
      type: String,
      enum: ["Daily", "Specific Days", "As Needed (PRN)"],
      default: "Daily",
    },
    schedules: [scheduleSchema],

    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },

    currentStock: {
      type: Number,
      default: 0,
    },
    reorderLevel: {
      type: Number,
      default: 5,
    },

    source: {
      type: String,
      enum: ["manual", "prescription_scan"],
      default: "manual",
    },
    notes: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

const Medicine = mongoose.model("Medicine", medicineSchema);

module.exports = Medicine;
