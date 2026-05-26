import nodemailer from "nodemailer";

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log(`[EMAIL - SMTP not configured]`);
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"DTT Hardware" <${SMTP_USER}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error("[EMAIL] Send failed:", (err as Error).message);
  }
}
