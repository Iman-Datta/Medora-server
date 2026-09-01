const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");

const User = require("../models/user");
const generateOTP = require("../utils/otpGenerator");
const otpEmailTemplate = require("../emails/otpEmailTemplate");
const sendEmail = require("../utils/sendEmail"); // Adjust path to match your actual helper

router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    const existingUser = await User.findOne({ email });

    if (existingUser && existingUser.emailVerified) {
      return res.status(409).json({
        message: "Account already exists. Please login.",
      });
    }

    // Generate OTP
    const { otp, hashedOtp } = generateOTP();
    const hashedPassword = await bcrypt.hash(password, 10);
    const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    let user;

    if (existingUser && !existingUser.emailVerified) {
      // Reuse unverified account
      existingUser.password = hashedPassword;
      existingUser.fullName = fullName;
      existingUser.emailVerificationOTP = hashedOtp;
      existingUser.emailVerificationExpire = otpExpiry;

      user = await existingUser.save({ validateBeforeSave: false });
    } else {
      user = new User({
        email,
        password: hashedPassword,
        fullName,
        emailVerified: false,
        emailVerificationOTP: hashedOtp,
        emailVerificationExpire: otpExpiry,
      });

      user = await user.save();
    }

    // Send email
    await sendEmail(
      user.email,
      "Email Verification OTP",
      otpEmailTemplate(otp),
    );

    return res.status(200).json({
      message: "Registration successful. Please check your email for the OTP.",
    });
  } catch (error) {
    console.error("Registration Error:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
    });
  }
});

module.exports = router;
