import "dotenv/config";
import nodemailer from "nodemailer";

async function main() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.EMAIL_FROM;

  console.log("SMTP configured keys:", {
    host: Boolean(host),
    port: Boolean(port),
    user: Boolean(user),
    pass: Boolean(pass),
    from: Boolean(from),
  });

  if (!host || !port || !user || !pass || !from) {
    console.log("SMTP incomplete");
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  try {
    await transporter.verify();
    console.log("SMTP verify: ok");
  } catch (error) {
    console.log(
      "SMTP verify: failed —",
      error instanceof Error ? error.message : "unknown",
    );
  }

  try {
    await transporter.sendMail({
      from,
      to: user,
      subject: "Ticketloom SMTP smoke",
      text: "SMTP connectivity check from Ticketloom Milestone 2.",
    });
    console.log("SMTP send: ok");
  } catch (error) {
    console.log(
      "SMTP send: failed —",
      error instanceof Error ? error.message : "unknown",
    );
    process.exitCode = 1;
  }
}

main();
