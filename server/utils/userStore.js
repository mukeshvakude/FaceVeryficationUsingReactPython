import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import pool from "../config/mysql.js";

const headerColumns = [
  "id",
  "name",
  "email",
  "passwordHash",
  "createdAt",
  "faceImagePath",
  "role"
];
const header = headerColumns.join(",");

let mysqlAvailable = false;

// Helper function to convert ISO datetime to MySQL format
const toMySQLDateTime = (isoString) => {
  return isoString.split('.')[0].replace('T', ' ');
};

// Check MySQL availability on startup
export const initMysql = async () => {
  try {
    const connection = await pool.getConnection();
    connection.release();
    mysqlAvailable = true;
    console.log("✅ MySQL connection successful");
  } catch (error) {
    console.warn("⚠️ MySQL unavailable, falling back to CSV storage:", error.message);
    mysqlAvailable = false;
  }
};

const getStorePath = () => {
  const fallback = path.join(process.cwd(), "data", "users.csv");
  return process.env.USERS_CSV
    ? path.resolve(process.env.USERS_CSV)
    : fallback;
};

const ensureStoreFile = async () => {
  const filePath = getStorePath();
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, `${header}\n`, "utf8");
  }

  return filePath;
};

const parseCsvLine = (line) => {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
};

const csvEscape = (value) => {
  const raw = String(value ?? "");
  if (raw.includes("\"") || raw.includes(",") || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
};

const readUsers = async () => {
  const filePath = await ensureStoreFile();
  const content = await fs.readFile(filePath, "utf8");
  const lines = content.split("\n").filter(Boolean);

  if (lines.length <= 1) {
    return { filePath, users: [] };
  }

  const headerLine = lines[0];
  const columns = parseCsvLine(headerLine);
  const columnIndex = columns.reduce((acc, column, index) => {
    acc[column] = index;
    return acc;
  }, {});

  const getValue = (values, key) => {
    const index = columnIndex[key];
    if (index === undefined) {
      return "";
    }
    return values[index] ?? "";
  };

  const users = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const id = getValue(values, "id");
    const name = getValue(values, "name");
    const email = getValue(values, "email");
    const passwordHash = getValue(values, "passwordHash");
    const createdAt = getValue(values, "createdAt");
    const faceImagePath = getValue(values, "faceImagePath");
    const role = getValue(values, "role") || "user";
    return { id, name, email, passwordHash, createdAt, faceImagePath, role };
  });

  return { filePath, users };
};

const writeUsers = async (filePath, users) => {
  const lines = users.map((user) =>
    [
      user.id,
      user.name,
      user.email,
      user.passwordHash,
      user.createdAt,
      user.faceImagePath || "",
      user.role || "user"
    ]
      .map(csvEscape)
      .join(",")
  );

  const payload = [header, ...lines].join("\n") + "\n";
  await fs.writeFile(filePath, payload, "utf8");
};

export const initUserStore = async () => {
  if (mysqlAvailable) {
    try {
      const connection = await pool.getConnection();
      await connection.release();
      console.log("✅ User store initialized with MySQL");
      return;
    } catch (error) {
      console.error("❌ MySQL init failed, using CSV fallback");
      mysqlAvailable = false;
    }
  }

  const filePath = await ensureStoreFile();
  const content = await fs.readFile(filePath, "utf8");
  const lines = content.split("\n").filter(Boolean);

  if (lines.length === 0) {
    await fs.writeFile(filePath, `${header}\n`, "utf8");
    return;
  }

  const columns = parseCsvLine(lines[0]);
  const missingColumn = headerColumns.some((column) => !columns.includes(column));

  if (missingColumn) {
    const { users } = await readUsers();
    await writeUsers(filePath, users);
  }
};

// Find user by email - checks MySQL first, then CSV
export const findUserByEmail = async (email) => {
  const emailLower = email.toLowerCase();

  if (mysqlAvailable) {
    try {
      const connection = await pool.getConnection();
      const [rows] = await connection.execute(
        "SELECT * FROM users WHERE LOWER(email) = ?",
        [emailLower]
      );
      connection.release();

      if (rows.length > 0) {
        return rows[0];
      }
    } catch (error) {
      console.warn("⚠️ MySQL query failed, checking CSV:", error.message);
      mysqlAvailable = false;
    }
  }

  // Fallback to CSV
  const { users } = await readUsers();
  return users.find((user) => user.email === emailLower) || null;
};

// Find user by ID - checks MySQL first, then CSV
export const findUserById = async (id) => {
  if (mysqlAvailable) {
    try {
      const connection = await pool.getConnection();
      const [rows] = await connection.execute(
        "SELECT * FROM users WHERE id = ?",
        [id]
      );
      connection.release();

      if (rows.length > 0) {
        return rows[0];
      }
    } catch (error) {
      console.warn("⚠️ MySQL query failed, checking CSV:", error.message);
      mysqlAvailable = false;
    }
  }

  // Fallback to CSV
  const { users } = await readUsers();
  return users.find((user) => user.id === id) || null;
};

// Create user - saves to MySQL and CSV
export const createUser = async ({ name, email, passwordHash, role = "user" }) => {
  const emailLower = email.toLowerCase();
  const now = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(),
    name,
    email: emailLower,
    passwordHash,
    createdAt: now,
    faceImagePath: "",
    role
  };

  if (mysqlAvailable) {
    try {
      const connection = await pool.getConnection();
      const mysqlDateTime = toMySQLDateTime(now);
      await connection.execute(
        "INSERT INTO users (id, name, email, passwordHash, createdAt, faceImagePath, role) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [user.id, user.name, user.email, user.passwordHash, mysqlDateTime, user.faceImagePath, user.role]
      );
      connection.release();
      console.log("✅ User created in MySQL");
      return user;
    } catch (error) {
      console.warn("⚠️ MySQL insert failed, saving to CSV:", error.message);
      mysqlAvailable = false;
    }
  }

  // Fallback to CSV
  const { filePath, users } = await readUsers();
  users.push(user);
  await writeUsers(filePath, users);
  console.log("✅ User created in CSV");
  return user;
};

// Update user face path - updates MySQL and CSV
export const updateUserFacePath = async (id, faceImagePath) => {
  if (mysqlAvailable) {
    try {
      const connection = await pool.getConnection();
      await connection.execute(
        "UPDATE users SET faceImagePath = ? WHERE id = ?",
        [faceImagePath, id]
      );
      const [rows] = await connection.execute(
        "SELECT * FROM users WHERE id = ?",
        [id]
      );
      connection.release();

      if (rows.length > 0) {
        return rows[0];
      }
    } catch (error) {
      console.warn("⚠️ MySQL update failed, updating CSV:", error.message);
      mysqlAvailable = false;
    }
  }

  // Fallback to CSV
  const { filePath, users } = await readUsers();
  const index = users.findIndex((user) => user.id === id);

  if (index === -1) {
    return null;
  }

  users[index] = { ...users[index], faceImagePath };
  await writeUsers(filePath, users);
  return users[index];
};

// List all users - reads from MySQL, falls back to CSV
export const listUsers = async () => {
  if (mysqlAvailable) {
    try {
      const connection = await pool.getConnection();
      const [rows] = await connection.execute("SELECT * FROM users");
      connection.release();
      return rows;
    } catch (error) {
      console.warn("⚠️ MySQL query failed, reading CSV:", error.message);
      mysqlAvailable = false;
    }
  }

  // Fallback to CSV
  const { users } = await readUsers();
  return users;
};
