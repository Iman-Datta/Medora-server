// Simple pass-through limiters to keep code clean without external dependencies
const loginLimiter = (req, res, next) => next();
const forgotPasswordLimiter = (req, res, next) => next();
const verificationLimiter = (req, res, next) => next();

module.exports = {
  loginLimiter,
  forgotPasswordLimiter,
  verificationLimiter,
};
