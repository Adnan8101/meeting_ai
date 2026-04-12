import nodemailer from "nodemailer";

async function readInput() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8").trim();
}

function fail(message) {
  process.stdout.write(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}

function getRequiredEnv(name) {
  const value = (process.env[name] || "").trim();
  if (!value) {
    fail(`Missing environment variable: ${name}`);
  }
  return value;
}

async function main() {
  const raw = await readInput();
  if (!raw) {
    fail("Missing email payload on stdin");
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    fail("Invalid JSON payload for email send");
  }

  const to = (payload.to || "").trim();
  const subject = (payload.subject || "").trim();
  const html = payload.html || "";
  const text = payload.text || undefined;

  if (!to || !subject || !html) {
    fail("Payload must include to, subject, and html");
  }

  const user = (process.env.GMAIL_USER || process.env.SENDER_EMAIL || "").trim();
  if (!user) {
    fail("Missing environment variable: GMAIL_USER or SENDER_EMAIL");
  }

  const clientId = getRequiredEnv("GMAIL_CLIENT_ID");
  const clientSecret = getRequiredEnv("GMAIL_CLIENT_SECRET");
  const refreshToken = getRequiredEnv("GMAIL_REFRESH_TOKEN");
  const accessToken = (process.env.GMAIL_ACCESS_TOKEN || "").trim() || undefined;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user,
      clientId,
      clientSecret,
      refreshToken,
      accessToken,
    },
  });

  const info = await transporter.sendMail({
    from: `AI Meeting Agent <${user}>`,
    to,
    subject,
    html,
    text,
  });

  process.stdout.write(
    JSON.stringify({
      ok: true,
      message: "Email sent successfully",
      messageId: info.messageId,
    }),
  );
}

main().catch((error) => {
  fail(error?.message || "Unexpected Nodemailer error");
});
