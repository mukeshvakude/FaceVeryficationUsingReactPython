import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { connectDb } from "./config/db.js";
import initDatabase from "./config/initDatabase.js";
import { initMysql } from "./utils/userStore.js";
import authRoutes from "./routes/auth.js";
import stegoRoutes from "./routes/stego.js";
import faceRoutes from "./routes/face.js";
import adminRoutes from "./routes/admin.js";

dotenv.config();

console.log("🔧 Environment Check:");
console.log("  PORT:", process.env.PORT);
console.log("  EMAIL_USER:", process.env.EMAIL_USER);
console.log("  EMAIL_PASS:", process.env.EMAIL_PASS ? "SET" : "NOT SET");
console.log("  EMAIL_SERVICE:", process.env.EMAIL_SERVICE);

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "*",
    credentials: true
  })
);
app.use(express.json({ limit: "2mb" }));

// Debug middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (req.headers.authorization) {
    console.log(`  Auth: ${req.headers.authorization.substring(0, 30)}...`);
  }
  next();
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/stego", stegoRoutes);
app.use("/api/face", faceRoutes);
app.use("/api/admin", adminRoutes);

const port = process.env.PORT || 4000;

const initializeApp = async () => {
  try {
    // Initialize MySQL (will gracefully fall back to CSV if unavailable)
    await initMysql();
    
    // Only try to create database if MySQL is available
    if (process.env.MYSQL_HOST && process.env.MYSQL_USER) {
      await initDatabase();
    }
    
    // Initialize user store (uses CSV or MySQL depending on availability)
    await connectDb();
    
    app.listen(port, () => {
      console.log(`✅ Server running on port ${port}`);
      console.log(`📦 Storage mode: ${process.env.MYSQL_HOST ? "MySQL" : "CSV"}`);
    });
  } catch (err) {
    console.error("❌ Failed to initialize app:", err.message);
    process.exit(1);
  }
};

initializeApp();
