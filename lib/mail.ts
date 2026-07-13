import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

export async function sendVerificationEmail(to: string, name: string, otp: string) {
  await transporter.sendMail({
    from: `"Academic Planning System" <${process.env.GMAIL_USER}>`,
    to,
    subject: `${otp} is your verification code`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:40px;border-radius:16px;">
        <h2 style="color:#818cf8;margin-bottom:8px;">Welcome, ${name}!</h2>
        <p style="color:#94a3b8;margin-bottom:24px;">
          Enter this code to verify your email address. It expires in <strong style="color:#e2e8f0;">10 minutes</strong>.
        </p>
        <div style="display:inline-block;padding:16px 32px;background:#1e1b4b;border:1px solid #4f46e5;border-radius:12px;">
          <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#e2e8f0;">${otp}</span>
        </div>
        <hr style="border:none;border-top:1px solid #1e293b;margin-top:32px;"/>
        <p style="color:#334155;font-size:12px;margin-top:16px;">
          If you didn't create an account, you can safely ignore this email.
        </p>
      </div>
    `,
  })
}
