import axios from "axios";
import bcrypt from "bcryptjs";
import express from "express";0
import FormData from "form-data";
import jwt from "jsonwebtoken";
import multer from "multer";
import pool, { getDbType } from "../config/dbPool.js";
import { saveFaceImage, saveFaceImageToDb } from "../utils/faceStorage.js";

import { createUser, findUserByEmail, updateUserFacePath, listUsers } from "../utils/userStore.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const getFaceServiceBaseUrl = () => {
  const raw = process.env.FACE_SERVICE_URL || "http://localhost:5001";
  return raw.replace(/\/verify-face\/?$/, "");
};

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    console.log(`[REGISTER] Attempt: name=${name}, email=${email}`);
    if (!name || !email || !password) {
      console.warn(`[REGISTER] Missing fields: name=${name}, email=${email}, password=${!!password}`);
      return res.status(400).json({ message: "Missing fields" });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      console.warn(`[REGISTER] Email already registered: ${email}`);
      return res.status(409).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase();
    const role = adminEmail && adminEmail === email.toLowerCase() ? "admin" : "user";
    const user = await createUser({ name, email, passwordHash, role });
    console.log(`[REGISTER] User created: id=${user.id}, email=${user.email}, role=${user.role}`);

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log(`[REGISTER] Success: id=${user.id}, email=${user.email}`);
    return res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error(`[REGISTER] Error:`, err);
    return res.status(500).json({ message: "Registration failed" });
  }
});

router.post("/register-live", upload.single("image"), async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const image = req.file;

    if (!name || !email || !password || !image) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase();
    const role = adminEmail && adminEmail === email.toLowerCase() ? "admin" : "user";
    console.log(`📝 Creating user: ${email}`);
    console.log(`   passwordHash length: ${passwordHash.length}`);
    const user = await createUser({ name, email, passwordHash, role });
    console.log(`   Created user ID: ${user.id}`);

    // Save face image to file system (fallback)
    const storedPath = await saveFaceImage(user.id, image);
    await updateUserFacePath(user.id, storedPath);
    
    // Save face image to database (persistent storage for production)
    await saveFaceImageToDb(user.id, image.buffer);

    // Extract and store face embedding for fast verification
    try {
      const faceServiceUrl = getFaceServiceBaseUrl();
      const form = new FormData();
      form.append("image", image.buffer, image.originalname || "face.jpg");

      const embeddingResponse = await axios.post(`${faceServiceUrl}/get-embedding`, form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        timeout: 30000
      });

      if (embeddingResponse.data?.success) {
        const embedding = embeddingResponse.data.embedding;
        await updateUserEmbedding(user.id, embedding);
      } else {
        console.warn("⚠️ Embedding extraction failed during registration");
      }
    } catch (embedErr) {
      console.warn("⚠️ Embedding extraction error during registration:", embedErr.message);
      if (embedErr.response?.data) {
        console.warn("  Face service response:", embedErr.response.data);
      }
      // Continue registration; embedding can be backfilled later
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error("❌ Registration error:", err.message);
    return res.status(500).json({ message: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`[LOGIN] Attempt: email=${email}`);
    if (!email || !password) {
      console.warn(`[LOGIN] Missing fields: email=${email}, password=${!!password}`);
      return res.status(400).json({ message: "Missing fields" });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      console.warn(`[LOGIN] User not found: ${email}`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.passwordHash) {
      console.error(`[LOGIN] CRITICAL: User passwordHash is missing! User:`, user);
      return res.status(500).json({ message: "Login failed - user data corrupted" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      console.warn(`[LOGIN] Invalid password for: ${email}`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log(`[LOGIN] Success: id=${user.id}, email=${user.email}`);
    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error(`[LOGIN] Error:`, err);
    return res.status(500).json({ message: "Login failed" });
  }
});

// Debug endpoint to view all registered users (remove in production)
router.get("/users/debug", async (req, res) => {
  try {
    const users = await listUsers();
    const userList = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      hasFaceImage: !!u.faceImagePath
    }));
    return res.json({ count: users.length, users: userList });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

const updateUserEmbedding = async (userId, embedding) => {
  const dbType = getDbType();
  const params = [JSON.stringify(embedding), userId];
  const query = dbType === "postgresql"
    ? "UPDATE users SET \"faceEmbedding\" = $1 WHERE id = $2"
    : "UPDATE users SET faceEmbedding = ? WHERE id = ?";

  const result = await pool.query(query, params);
  const affected = result?.affectedRows || result?.rowCount || 0;
  if (affected === 0) {
    throw new Error("Failed to save face embedding");
  }
};

export default router;
