import nodemailer from "nodemailer";

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    console.log("📧 Email transporter initialized");
    console.log("  USER:", process.env.EMAIL_USER);
    console.log("  SERVICE:", process.env.EMAIL_SERVICE || "gmail");
  }
  return transporter;
};

export const sendStegoEmail = async (recipientEmail, encryptionKey, imageBuffer, imageName) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject: "🔐 SecureVision - Encoded Image & Encryption Key",
      html: `
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
      `,
      attachments: [
        {
          filename: imageName,
          content: imageBuffer,
          contentType: "image/png"
        }
      ]
    };

    const info = await getTransporter().sendMail(mailOptions);
    console.log("✉️  Email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error("❌ Email sending failed:", err.message);
    throw new Error(`Failed to send email: ${err.message}`);
  }
};
