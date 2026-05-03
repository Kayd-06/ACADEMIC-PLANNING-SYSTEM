import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`

  await transporter.sendMail({
    from: `"Academic Planning System" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Verify your email address',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:40px;border-radius:16px;">
        <h2 style="color:#818cf8;margin-bottom:8px;">Welcome, ${name}!</h2>
        <p style="color:#94a3b8;margin-bottom:24px;">
          Click the button below to verify your email address. This link expires in <strong style="color:#e2e8f0;">24 hours</strong>.
        </p>
        <a href="${verifyUrl}"
           style="display:inline-block;padding:12px 28px;background:#4f46e5;color:white;
                  text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
          Verify Email Address
        </a>
        <p style="color:#475569;margin-top:24px;font-size:13px;">
          Or copy this link into your browser:<br/>
          <span style="color:#6366f1;">${verifyUrl}</span>
        </p>
        <hr style="border:none;border-top:1px solid #1e293b;margin-top:32px;"/>
        <p style="color:#334155;font-size:12px;margin-top:16px;">
          If you didn't create an account, you can safely ignore this email.
        </p>
      </div>
    `,
  })
}
