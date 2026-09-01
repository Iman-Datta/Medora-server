const otpEmailTemplate = (otp) => {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Your Medora verification code</title>
  </head>
  <body style="margin:0; padding:0; background-color:#eefaf6; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#eefaf6; padding: 48px 16px;">
      <tr>
        <td align="center">

          <table width="520" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">

            <!-- Header -->
            <tr>
              <td style="background-color:#009688; padding: 28px 40px;">
                <p style="margin:0; font-size:22px; font-weight:700; color:#ffffff; letter-spacing:-0.02em;">
                  Medora
                </p>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding: 40px 40px 32px;">

                <h1 style="margin:0 0 16px; font-size:22px; font-weight:600; color:#1e293b; letter-spacing:-0.01em;">
                  Your verification code
                </h1>

                <p style="margin:0 0 28px; font-size:15px; line-height:1.6; color:#64748b;">
                  Use the code below to verify your identity. It is valid for
                  <strong style="color:#009688;">10 minutes</strong> and can only be used once.
                </p>

                <!-- OTP Box -->
                <table cellpadding="0" cellspacing="0" style="margin-bottom:28px; width:100%;">
                  <tr>
                    <td style="background-color:#f0fdf9; border-radius:8px; border:1px solid #ccfbf1; padding: 20px 36px;" align="center">
                      <p style="margin:0; font-family:'Courier New', monospace; font-size:32px; font-weight:700; color:#00897b; letter-spacing:0.25em; text-align:center;">
                        ${otp}
                      </p>
                    </td>
                  </tr>
                </table>

                <p style="margin:0; font-size:14px; line-height:1.6; color:#64748b;">
                  If you did not request this, you can safely ignore this email.
                  No action is required.
                </p>

              </td>
            </tr>

            <!-- Divider -->
            <tr>
              <td style="padding: 0 40px;">
                <hr style="border:none; border-top:1px solid #e2e8f0; margin:0;" />
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding: 24px 40px 32px;">

                <p style="margin:0 0 8px; font-size:12px; color:#94a3b8; line-height:1.6;">
                  This email was sent because a verification was requested for your Medora account.
                  If this was not you, no action is required.
                </p>

                <p style="margin:12px 0 0; font-size:12px; font-weight:500; color:#64748b; line-height:1.5;">
                  Medora — AI-assisted prescription understanding and medication management.
                </p>

              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>

  </body>
  </html>
  `;
};

module.exports = otpEmailTemplate;
