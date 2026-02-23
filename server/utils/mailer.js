import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";

let transporter = null;

// Initialize SendGrid if API key is available
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log("📧 SendGrid email service initialized");
  console.log("  FROM:", process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_USER);
} else {
  console.log("📧 SendGrid API key not found, will use nodemailer fallback");
}

const getTransporter = async () => {
  if (!transporter) {
    const host = process.env.EMAIL_HOST;
    const port = process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : undefined;
    const secure = process.env.EMAIL_SECURE === "true";

    const config = host
      ? {
          host,
          port: port || 587,
          secure,
          connectionTimeout: 30000,
          greetingTimeout: 30000,
          socketTimeout: 30000,
          tls: {
            ciphers: 'SSLv3',
            rejectUnauthorized: false
          },
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        }
      : {
          service: process.env.EMAIL_SERVICE || "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        };

    transporter = nodemailer.createTransport(config);
    console.log("📧 Nodemailer transporter initialized (fallback)");
    console.log("  USER:", process.env.EMAIL_USER);
    console.log("  HOST:", host || "(service)");
    console.log("  SERVICE:", process.env.EMAIL_SERVICE || "gmail");
    console.log("  PORT:", port || (host ? 587 : "default"));
    console.log("  SECURE:", secure);
  }
  return transporter;
};

const getEmailHtmlTemplate = (encryptionKey) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0ea5e9;">SecureVision Transmission</h2>
      <p>Hi,</p>
      <p>You have received an encoded image with a hidden message. Here is your <strong>encryption key</strong> to decrypt it:</p>
      
      <div style="background-color: #1e293b; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <code style="color: #0ea5e9; word-break: break-all; font-size: 14px; letter-spacing: 1px;">
          ${encryptionKey}
        </code>
      </div>
      
      <p><strong>Important:</strong> Keep this key safe and confidential. You'll need it to decode your message.</p>
      
      <h3 style="color: #0ea5e9;">How to decode:</h3>
      <ol>
        <li>Visit <strong>SecureVision</strong> application</li>
        <li>Go to the <strong>Decode</strong> section</li>
        <li>Upload the attached image</li>
        <li>Paste the encryption key above</li>
        <li>Click <strong>Decode</strong> to reveal the message</li>
      </ol>
      
      <hr style="border: none; border-top: 1px solid #475569; margin: 30px 0;">
      <p style="color: #94a3b8; font-size: 12px;">
        This email was sent by SecureVision. Do not share this email with untrusted parties.
      </p>
    </div>
  `;
};

export const sendStegoEmail = async (recipientEmail, encryptionKey, imageBuffer, imageName) => {
  try {
    // Use SendGrid if API key is configured
    if (process.env.SENDGRID_API_KEY) {
      const fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_USER;
      
      const msg = {
        to: recipientEmail,
        from: fromEmail,
        subject: "🔐 SecureVision - Encoded Image & Encryption Key",
        html: getEmailHtmlTemplate(encryptionKey),
        attachments: [
          {
            content: imageBuffer.toString('base64'),
            filename: imageName,
            type: "image/png",
            disposition: "attachment"
          }
        ]
      };

      const response = await sgMail.send(msg);
      console.log("✉️  Email sent successfully via SendGrid");
      console.log("  TO:", recipientEmail);
      console.log("  STATUS:", response[0].statusCode);
      return { success: true, messageId: response[0].headers['x-message-id'] };
    }

    // Fallback to nodemailer
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject: "🔐 SecureVision - Encoded Image & Encryption Key",
      html: getEmailHtmlTemplate(encryptionKey),
      attachments: [
        {
          filename: imageName,
          content: imageBuffer,
          contentType: "image/png"
        }
      ]
    };

    const transporter = await getTransporter();
    const info = await transporter.sendMail(mailOptions);
    console.log("✉️  Email sent successfully via nodemailer");
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error("❌ Email sending failed:", err.message);
    if (err.response) {
      console.error("  SendGrid error body:", err.response.body);
    }
    throw new Error(`Failed to send email: ${err.message}`);
  }
};
