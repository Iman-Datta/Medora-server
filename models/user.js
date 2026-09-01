const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String },
    name: { type: String },

    avatar: {
      type: String,
      required: false,
      validate: {
        validator: function (value) {
          return /^(https?:\/\/)[^\s]+$/.test(value);
        },
        message: "Avatar must be a valid URL",
      },
    },

    emailVerified: { type: Boolean, default: false },
    emailVerificationOTP: { type: String },
    emailVerificationExp: { type: Date },

    passwordResetOTP: { type: String },
    passwordResetExp: { type: Date },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);

module.exports = User;
