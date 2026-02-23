import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import { saveFaceImage } from "../utils/faceStorage.js";
import { createUser, findUserByEmail, updateUserFacePath, listUsers } from "../utils/userStore.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase();
    const role = adminEmail && adminEmail === email.toLowerCase() ? "admin" : "user";
    const user = await createUser({ name, email, passwordHash, role });

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

    const storedPath = await saveFaceImage(user.id, image);
    await updateUserFacePath(user.id, storedPath);

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
    return res.status(500).json({ message: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    console.log(`🔑 Login attempt for: ${email}`);
    const user = await findUserByEmail(email);
    if (!user) {
      console.log(`❌ User not found: ${email}`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    console.log(`✅ User found: ${user.name} (${user.email})`);
    console.log(`   passwordHash type: ${typeof user.passwordHash}`);
    console.log(`   passwordHash length: ${user.passwordHash?.length || 'undefined'}`);
    
    if (!user.passwordHash) {
      console.error(`❌ CRITICAL: User passwordHash is missing!`);
      console.log(`   User object keys:`, Object.keys(user));
      console.log(`   User object:`, user);
      return res.status(500).json({ message: "Login failed - user data corrupted" });
    }
    
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      console.log(`❌ Invalid password for: ${email}`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log(`✅ Login successful: ${user.name}`);
    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error("❌ Login error:", err);
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

export default router;
