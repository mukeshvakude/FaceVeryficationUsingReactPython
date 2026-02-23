import axios from "axios";
import express from "express";
import FormData from "form-data";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import { findUserById, updateUserFacePath } from "../utils/userStore.js";
import { readFaceImage, readFaceImageFromDb, saveFaceImage, saveFaceImageToDb } from "../utils/faceStorage.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });


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

      const faceUrl = process.env.FACE_SERVICE_URL;
      if (!faceUrl) {
        return res.status(500).json({ message: "FACE_SERVICE_URL not set" });
      }

      const form = new FormData();
      form.append("imageA", imageA.buffer, imageA.originalname || "imageA.png");
      form.append("imageB", imageB.buffer, imageB.originalname || "imageB.png");

      const response = await axios.post(faceUrl, form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity
      });

      return res.json(response.data);
    } catch (err) {
      return res.status(500).json({ message: "Face verification failed" });
    }
  }
);

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

      // Save to file system (fallback)
      const storedPath = await saveFaceImage(req.user.id, image);
      const updated = await updateUserFacePath(req.user.id, storedPath);

      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Save to database (persistent storage)
      await saveFaceImageToDb(req.user.id, image.buffer);

      return res.json({ message: "Face registered" });
    } catch (err) {
      return res.status(500).json({ message: "Face registration failed" });
    }
  }
);

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

      const user = await findUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Try reading from database first (persistent storage)
      let storedBuffer = await readFaceImageFromDb(user.id);
      
      // Fall back to file system if not in database
      if (!storedBuffer && user.faceImagePath) {
        try {
          storedBuffer = await readFaceImage(user.faceImagePath);
        } catch (err) {
          console.error("Failed to read from file system:", err.message);
        }
      }
      
      if (!storedBuffer) {
        return res.status(404).json({ message: "No registered face found" });
      }

      const faceUrl = process.env.FACE_SERVICE_URL;
      if (!faceUrl) {
        return res.status(500).json({ message: "FACE_SERVICE_URL not set" });
      }

      const form = new FormData();
      form.append("imageA", storedBuffer, "registered.jpg");
      form.append("imageB", image.buffer, image.originalname || "live.jpg");

      const response = await axios.post(faceUrl, form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity
      });

      return res.json(response.data);
    } catch (err) {
      return res.status(500).json({ message: "Live verification failed" });
    }
  }
);

export default router;
