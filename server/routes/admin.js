import express from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { readFaceImage } from "../utils/faceStorage.js";
import { findUserById, listUsers } from "../utils/userStore.js";

const router = express.Router();

router.get("/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await listUsers();
    const payload = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      faceImagePath: user.faceImagePath,
      role: user.role || "user"
    }));

    return res.json({ users: payload });
  } catch (err) {
    return res.status(500).json({ message: "Failed to load users" });
  }
});

router.get("/faces/:userId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await findUserById(req.params.userId);
    if (!user || !user.faceImagePath) {
      return res.status(404).json({ message: "Face image not found" });
    }

    const buffer = await readFaceImage(user.faceImagePath);
    res.setHeader("Content-Type", "image/jpeg");
    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({ message: "Failed to load image" });
  }
});

export default router;
