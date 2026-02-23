import axios from "axios";
import express from "express";
import FormData from "form-data";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import { findUserById } from "../utils/userStore.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || "http://localhost:5001";

/**
 * Register user's face - compute and store embedding
 * Flow: User image → Python service computes embedding → Store in DB
 */
router.post(
  "/register-live",
  requireAuth,
  upload.single("image"),
  async (req, res) => {
    try {
      const image = req.file;
      if (!image) {
        return res.status(400).json({ message: "Image required" });
      }

      console.log("📸 Face registration started");
      console.log("  User:", req.user.id);
      console.log("  Image size:", image.size);

      const form = new FormData();
      form.append("image", image.buffer, image.originalname || "face.jpg");

      console.log("  Sending to embedding service:", `${FACE_SERVICE_URL}/get-embedding`);
      
      const embeddingResponse = await axios.post(`${FACE_SERVICE_URL}/get-embedding`, form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        timeout: 30000
      });

      if (!embeddingResponse.data.success) {
        return res.status(400).json({ message: "Failed to extract face embedding" });
      }

      const embedding = embeddingResponse.data.embedding;
      console.log("  ✅ Embedding extracted, size:", embedding.length);

      const user = await findUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const result = await updateUserEmbedding(req.user.id, embedding);
      if (!result) {
        return res.status(500).json({ message: "Failed to save embedding" });
      }

      console.log("  ✅ Embedding saved to database");
      return res.json({ 
        message: "Face registered successfully",
        embedding_size: embedding.length
      });
    } catch (err) {
      console.error("❌ Face registration error:", err.message);
      if (err.response?.status === 400) {
        return res.status(400).json({ 
          message: "No face detected in image. Please ensure your face is clearly visible.",
          error: err.response?.data?.detail
        });
      }
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
        return res.status(504).json({ message: "Face service timeout - please try again" });
      }
      return res.status(500).json({ message: "Face registration failed" });
    }
  }
);

/**
 * Verify user's face - compare embeddings (fast!)
 * Flow: Live image → Get embedding → Compare with stored embedding → Result
 */
router.post(
  "/verify-live",
  requireAuth,
  upload.single("image"),
  async (req, res) => {
    try {
      const image = req.file;
      if (!image) {
        return res.status(400).json({ message: "Image required" });
      }

      console.log("👤 Face verification started");
      console.log("  User:", req.user.id);

      const user = await findUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.faceEmbedding) {
        return res.status(404).json({ message: "No face registered. Please register your face first." });
      }

      let storedEmbedding;
      try {
        storedEmbedding = typeof user.faceEmbedding === 'string' 
          ? JSON.parse(user.faceEmbedding) 
          : user.faceEmbedding;
      } catch (e) {
        console.error("Failed to parse stored embedding:", e.message);
        return res.status(500).json({ message: "Invalid stored embedding" });
      }

      const form = new FormData();
      form.append("image", image.buffer, image.originalname || "face.jpg");

      console.log("  Sending to embedding service...");
      
      const embeddingResponse = await axios.post(`${FACE_SERVICE_URL}/get-embedding`, form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        timeout: 30000
      });

      if (!embeddingResponse.data.success) {
        return res.status(400).json({ message: "Failed to extract face embedding from live image" });
      }

      const liveEmbedding = embeddingResponse.data.embedding;
      console.log("  ✅ Live embedding extracted");

      console.log("  Comparing embeddings...");
      
      const comparisonResponse = await axios.post(`${FACE_SERVICE_URL}/compare-embeddings`, {
        embA: storedEmbedding,
        embB: liveEmbedding
      }, {
        timeout: 5000
      });

      const verification = comparisonResponse.data;
      console.log("  ✅ Verification result:", verification.verified ? "PASSED" : "FAILED");

      if (!verification.verified) {
        return res.status(403).json({
          message: "Face verification failed - your face does not match the registered user",
          verification
        });
      }

      return res.json({
        message: "Face verified successfully",
        verification
      });
    } catch (err) {
      console.error("❌ Face verification error:", err.message);
      
      if (err.response?.status === 400) {
        return res.status(400).json({ 
          message: "No face detected in image. Please ensure your face is clearly visible.",
          error: err.response?.data?.detail
        });
      }
      if (err.response?.status === 502 || err.response?.status === 503) {
        return res.status(503).json({ message: "Face service temporarily unavailable" });
      }
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
        return res.status(504).json({ message: "Face service timeout - please try again" });
      }
      
      return res.status(500).json({ message: "Face verification failed" });
    }
  }
);

/**
 * Legacy endpoint: Direct face comparison
 */
router.post(
  "/verify",
  requireAuth,
  upload.fields([
    { name: "imageA", maxCount: 1 },
    { name: "imageB", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const imageA = req.files?.imageA?.[0];
      const imageB = req.files?.imageB?.[0];

      if (!imageA || !imageB) {
        return res.status(400).json({ message: "Two images required" });
      }

      const form = new FormData();
      form.append("imageA", imageA.buffer, imageA.originalname || "imageA.png");
      form.append("imageB", imageB.buffer, imageB.originalname || "imageB.png");

      const response = await axios.post(`${FACE_SERVICE_URL}/verify-face`, form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        timeout: 120000,
      });

      return res.json(response.data);
    } catch (err) {
      console.error("Face comparison error:", err.message);
      if (err.response?.status === 400) {
        return res.status(400).json({ 
          message: "No face detected in one or both images",
          error: err.response?.data?.detail
        });
      }
      return res.status(500).json({ message: "Face verification failed" });
    }
  }
);

async function updateUserEmbedding(userId, embedding) {
  try {
    const { pool } = await import("../config/dbPool.js");
    
    const dbType = process.env.DATABASE_HOST ? 'postgresql' : 'mysql';
    const params = dbType === 'postgresql' 
      ? [JSON.stringify(embedding), userId]
      : [JSON.stringify(embedding), userId];
    
    const query = dbType === 'postgresql'
      ? `UPDATE users SET "faceEmbedding" = $1 WHERE id = $2`
      : `UPDATE users SET faceEmbedding = ? WHERE id = ?`;
    
    const result = await pool.query(query, params);
    return (result.affectedRows || result.rowCount || 0) > 0;
  } catch (err) {
    console.error("Error updating embedding:", err.message);
    throw err;
  }
}
