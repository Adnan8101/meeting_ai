import nodemailer from "nodemailer";

async function main() {
  try {
    const GMAIL_USER = process.env.GMAIL_USER;
    const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
    const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
    const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

    if (!GMAIL_USER || !GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
      console.log(JSON.stringify({ ok: false, error: "Missing Gmail OAuth credentials in environment variables." }));
      process.exit(0);
    }

    let inputData = '';
    process.stdin.setEncoding('utf-8');
    for await (const chunk of process.stdin) {
      inputData += chunk;
    }

    if (!inputData.trim()) {
      console.log(JSON.stringify({ ok: false, error: "Empty stdin input" }));
      process.exit(0);
    }

    const payload = JSON.parse(inputData);

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: GMAIL_USER,
        clientId: GMAIL_CLIENT_ID,
        clientSecret: GMAIL_CLIENT_SECRET,
        refreshToken: GMAIL_REFRESH_TOKEN,
      },
    });

    const mailOptions = {
      from: GMAIL_USER,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(JSON.stringify({ ok: true, message: "Email sent successfully", messageId: info.messageId }));
  } catch (error) {
    console.log(JSON.stringify({ ok: false, error: error.message || String(error) }));
    process.exit(0);
  }
}

main();
