function getApiKey() {
  return process.env.RESEND_API || process.env.RESEND_API_KEY || '';
}

const FROM_EMAIL = 'Khokhi <verify@greyrope.tech>';

export async function sendOtpEmail(toEmail, otpCode, userName) {
  const apiKey = getApiKey();

  if (!apiKey) {
    console.warn('⚠️  RESEND_API key not found in environment. Logging OTP to console for local testing:');
    console.log(`🔐 OTP for ${toEmail}: [${otpCode}]`);
    return { id: 'mock-console-id' };
  }

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Khokhi Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f7f7f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f7f7f8; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="480px" cellspacing="0" cellpadding="0" border="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; border: 1px solid #eaeaea; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 20px 32px; text-align: left; border-bottom: 1px solid #f0f0f0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="width: 36px; height: 36px; background-color: #111111; color: #ffffff; font-weight: bold; font-size: 16px; text-align: center; border-radius: 8px;">K</td>
                  <td style="padding-left: 12px; font-size: 18px; font-weight: 700; color: #111111; letter-spacing: -0.5px;">Khokhi</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #111111; letter-spacing: -0.3px;">Verify your email address</h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 22px; color: #555555;">
                Hello ${userName || 'Analyst'},<br>
                Please use the following 6-digit code to complete your Khokhi account registration.
              </p>

              <!-- OTP Box -->
              <div style="background-color: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
                <div style="font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #09090b;">
                  ${otpCode}
                </div>
                <div style="font-size: 11px; color: #71717a; margin-top: 8px; font-weight: 500;">
                  Expires in 10 minutes &bull; Single-use only
                </div>
              </div>

              <p style="margin: 24px 0 0 0; font-size: 12px; line-height: 18px; color: #888888;">
                If you did not request this verification code, you can safely ignore this email. Someone may have typed your address by mistake.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #fafafa; border-top: 1px solid #f0f0f0; text-align: center; font-size: 11px; color: #999999;">
              &copy; ${new Date().getFullYear()} Khokhi. Secure Email Verification via greyrope.tech
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [toEmail],
        subject: `Your Khokhi Verification Code: ${otpCode}`,
        html: htmlContent,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('Resend API error:', data);
      throw new Error(data.message || 'Failed to send verification email');
    }

    console.log(`✉️  Verification code sent successfully to ${toEmail} via greyrope.tech (Message ID: ${data.id})`);
    return data;
  } catch (err) {
    console.error('Error sending email with Resend:', err.message);
    throw err;
  }
}
