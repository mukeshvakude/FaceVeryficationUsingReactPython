import axios from "axios";
import archiver from "archiver";
import express from "express";
import FormData from "form-data";
import multer from "multer";
import sharp from "sharp";
import { requireAuth } from "../middleware/auth.js";
import { encryptText, decryptText } from "../utils/crypto.js";
import { readFaceImage } from "../utils/faceStorage.js";
import { decodeStego, encodeStego } from "../utils/stego.js";
import { findUserById } from "../utils/userStore.js";
import { sendStegoEmail } from "../utils/mailer.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const collectImages = (files) => {
  const images = [];
  if (files?.images?.length) {
    images.push(...files.images);
  }
  if (files?.image?.length) {
    images.push(...files.image);
  }
  return images;
};

const sendZip = (res, entries, zipName) => {
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename=${zipName}`);

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => {
    throw err;
  });
  archive.pipe(res);

  entries.forEach((entry) => {
    archive.append(entry.data, { name: entry.name });
  });

  archive.finalize();
};

const convertToPng = async (buffer, filename) => {
  try {
    // Check if already PNG
    if (filename?.toLowerCase().endsWith('.png')) {
      return buffer;
    }
    
    console.log(`    Converting ${filename} to PNG...`);
    const pngBuffer = await sharp(buffer)
      .png()
      .toBuffer();
    
    return pngBuffer;
  } catch (err) {
    throw new Error(`Failed to convert image to PNG: ${err.message}`);
  }
};

router.post(
  "/encode",
  requireAuth,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "images", maxCount: 50 }
  ]),
  async (req, res) => {
  try {
    console.log("📤 Encode request received");
    console.log("  User:", req.user?.id);
    console.log("  Files:", req.files ? Object.keys(req.files) : "none");
    console.log("  Body keys:", Object.keys(req.body));
    
    const cipherText = req.body.cipherText || "";
    const message = req.body.message || "";
    const payload = cipherText || message;
    const images = collectImages(req.files);

    console.log("  Images collected:", images.length);
    console.log("  Payload length:", payload.length);

    if (!images.length || !payload) {
      return res.status(400).json({ message: "Images and message required" });
    }

    const encrypted = cipherText
      ? cipherText
      : encryptText(message, process.env.AES_SECRET);

    const stegoEntries = await Promise.all(
      images.map(async (image, index) => {
        console.log(`  Processing image ${index + 1}: ${image.originalname}`);
        
        // Convert to PNG if needed
        let pngBuffer = image.buffer;
        if (!image.originalname?.toLowerCase().endsWith('.png')) {
          pngBuffer = await convertToPng(image.buffer, image.originalname);
        }
        
        const stegoBuffer = encodeStego(pngBuffer, encrypted);
        const baseName = image.originalname?.replace(/\.[^.]+$/, "") || `image-${index + 1}`;
        return {
          name: `${baseName}-stego.png`,
          data: stegoBuffer
        };
      })
    );

    const format = req.query.format;
    if (format === "zip" || images.length > 1) {
      return sendZip(res, stegoEntries, "stego-images.zip");
    }

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", "attachment; filename=stego.png");
    return res.send(stegoEntries[0].data);
  } catch (err) {
    console.error("❌ Encoding error:", err.message);
    console.error("  Stack:", err.stack);
    return res.status(500).json({ message: "Encoding failed", error: err.message });
  }
  }
);

router.post(
  "/decode",
  requireAuth,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "images", maxCount: 50 }
  ]),
  async (req, res) => {
  try {
    console.log("📥 Decode request received");
    console.log("  User:", req.user?.id);
    console.log("  Files:", req.files);
    console.log("  Request keys:", Object.keys(req.files || {}));
    
    const images = collectImages(req.files);
    console.log("  Collected images count:", images.length);
    
    if (!images.length) {
      console.log("  ❌ No images found");
      return res.status(400).json({ message: "Image required" });
    }

    const results = images.map((image, index) => {
      const cipherText = decodeStego(image.buffer);
      const baseName = image.originalname?.replace(/\.[^.]+$/, "") || `image-${index + 1}`;
      let message = null;

      try {
        message = decryptText(cipherText, process.env.AES_SECRET);
      } catch (err) {
        message = null;
      }

      return {
        filename: `${baseName}.png`,
        cipherText,
        message
      };
    });

    const format = req.query.format;
    if (format === "zip") {
      const entries = results.map((item) => ({
        name: `${item.filename.replace(/\.[^.]+$/, "")}.txt`,
        data: item.cipherText
      }));
      entries.push({
        name: "manifest.json",
        data: JSON.stringify(results, null, 2)
      });
      return sendZip(res, entries, "decoded-messages.zip");
    }

    console.log("  ✅ Returning JSON with", results.length, "results");
    return res.json({ results });
  } catch (err) {
    console.error("  ❌ Decode error:", err.message);
    return res.status(500).json({ message: "Decoding failed" });
  }
  }
);

router.post(
  "/decode-face",
  requireAuth,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "live", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const image = req.files?.image?.[0];
      const live = req.files?.live?.[0];

      if (!image || !live) {
        return res.status(400).json({ message: "Stego and live images required" });
      }

      const user = await findUserById(req.user.id);
      if (!user || !user.faceImagePath) {
        return res.status(404).json({ message: "No registered face found" });
      }

      const faceUrl = process.env.FACE_SERVICE_URL;
      if (!faceUrl) {
        return res.status(500).json({ message: "FACE_SERVICE_URL not set" });
      }

      const storedBuffer = await readFaceImage(user.faceImagePath);
      const form = new FormData();
      form.append("imageA", storedBuffer, "registered.jpg");
      form.append("imageB", live.buffer, live.originalname || "live.jpg");

      const verifyResponse = await axios.post(faceUrl, form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity
      });

      const verification = verifyResponse.data;
      
      // Check if face verification passed
      if (!verification?.verified) {
        return res.status(403).json({
          message: "Face verification failed - your face does not match the registered user",
          verification
        });
      }

      // Extract cipher text from stego image (don't decrypt - client will handle that)
      const cipherText = decodeStego(image.buffer);

      return res.json({ cipherText, verification });
    } catch (err) {
      // Handle face detection failures
      if (err.response?.status === 400) {
        return res.status(400).json({ 
          message: "No face detected in one or both images. Please ensure your face is clearly visible.",
          error: err.response?.data?.detail || "Face detection failed"
        });
      }
      
      console.error("Face decrypt error:", err.message);
      return res.status(500).json({ 
        message: "Face decrypt failed",
        error: process.env.NODE_ENV === "development" ? err.message : undefined
      });
    }
  }
);

router.post(
  "/send-email",
  requireAuth,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "images", maxCount: 50 }
  ]),
  async (req, res) => {
    try {
      console.log("📧 Send email request received");
      console.log("  User:", req.user?.id);
      
      const { recipientEmail, encryptionKey } = req.body;
      const images = collectImages(req.files);

      if (!recipientEmail) {
        return res.status(400).json({ message: "Recipient email is required" });
      }

      if (!images.length) {
        return res.status(400).json({ message: "At least one image is required" });
      }

      if (!encryptionKey) {
        return res.status(400).json({ message: "Encryption key is required" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recipientEmail)) {
        return res.status(400).json({ message: "Invalid email address" });
      }

      // Create stego images and send as attachments
      const results = [];
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const imageName = image.originalname?.replace(/\.[^.]+$/, "") || `image-${i + 1}`;
        try {
          // Convert to PNG if needed
          let pngBuffer = image.buffer;
          if (!image.originalname?.toLowerCase().endsWith('.png')) {
            pngBuffer = await convertToPng(image.buffer, image.originalname);
          }
          // Encrypt the message using the provided encryptionKey
          const encrypted = encryptText(req.body.message || req.body.cipherText || '', encryptionKey);
          // Create stego image
          const stegoBuffer = encodeStego(pngBuffer, encrypted);
          // Calculate file size and hash for integrity, and log them
          const fileSize = stegoBuffer.length;
          const crypto = await import('crypto');
          const hash = crypto.createHash('sha256').update(stegoBuffer).digest('hex');
          console.log(`  [EMAIL ATTACHMENT] ${imageName}-stego.png size: ${fileSize} bytes, sha256: ${hash}`);
          await sendStegoEmail(
            recipientEmail,
            encryptionKey,
            stegoBuffer,
            `${imageName}-stego.png`
          );
          results.push({ image: imageName, status: "sent", fileSize, hash });
        } catch (err) {
          console.error(`Error sending image ${imageName}:`, err.message);
          results.push({ image: imageName, status: "failed", error: err.message });
        }
      }

      const allSuccessful = results.every((r) => r.status === "sent");
      const statusCode = allSuccessful ? 200 : 207; // 207 = Multi-Status

      return res.status(statusCode).json({
        message: allSuccessful
          ? "All images sent successfully"
          : "Some images failed to send",
        results
      });
    } catch (err) {
      console.error("❌ Send email error:", err.message);
      return res.status(500).json({
        message: "Failed to send email",
        error: process.env.NODE_ENV === "development" ? err.message : undefined
      });
    }
  }
);

export default router;
