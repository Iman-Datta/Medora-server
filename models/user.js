const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String },
    name: { type: String },

    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    emailVerificationExp: { type: Date },

    passwordResetOTP: { type: String },
    passwordResetExp: { type: Date },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);

module.exports = User;
