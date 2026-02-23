import mysql from "mysql2/promise";
import pg from "pg";
import { getDbType } from "./dbPool.js";

const { Client } = pg;

const createDatabaseAndTables = async () => {
  // Check if Database is configured
  const hasMySQL = (process.env.MYSQL_HOST || "").trim();
  const hasPostgreSQL = (process.env.DATABASE_HOST || process.env.DB_HOST || "").trim();
  
  if (!hasMySQL && !hasPostgreSQL) {
    console.log("⚠️  No database configured, using CSV storage");
    return Promise.resolve();
  }

  const dbType = getDbType();
  
  if (dbType === 'mysql') {
    await createMySQLTables();
  } else if (dbType === 'postgresql') {
    await createPostgreSQLTables();
  }
};

const createMySQLTables = async () => {
  const host = (process.env.MYSQL_HOST || "").trim();
  const user = (process.env.MYSQL_USER || "").trim();
  
  if (!host || !user) {
    console.log("⚠️  MySQL not configured");
    return;
  }

  try {
    const connection = await mysql.createConnection({
      host: host,
      user: user,
      password: process.env.MYSQL_PASSWORD || "root",
      ssl: host.includes('psdb.cloud') ? { rejectUnauthorized: true } : undefined
    });

    const dbName = process.env.MYSQL_DB || "face_verification_db";
    await connection.execute(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\``
    );
    console.log(`✅ Database '${dbName}' ready`);

    await connection.changeUser({ database: dbName });

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        passwordHash VARCHAR(255) NOT NULL,
        createdAt DATETIME NOT NULL,
        faceImagePath VARCHAR(255),
        faceImageData LONGBLOB,
        role VARCHAR(50) DEFAULT 'user',
        INDEX idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log("✅ MySQL users table ready");
    
    // Migration: Add faceImageData column if it doesn't exist
    try {
      await connection.execute(`
        ALTER TABLE users 
        ADD COLUMN faceImageData LONGBLOB
      `);
      console.log("✅ faceImageData column migration complete");
    } catch (err) {
      // Column likely already exists
      if (!err.message.includes('Duplicate column')) {
        console.warn("⚠️ Column migration failed:", err.message);
      }
    }

    await connection.end();
  } catch (error) {
    console.warn("⚠️  MySQL initialization failed:", error.message);
  }
};

const createPostgreSQLTables = async () => {
  const host = process.env.DATABASE_HOST || process.env.DB_HOST || process.env.POSTGRES_HOST;
  const user = process.env.DATABASE_USERNAME || process.env.DB_USER || process.env.POSTGRES_USER;
  
  if (!host || !user) {
    console.log("⚠️  PostgreSQL not configured");
    return;
  }

  try {
    const client = new Client({
      host: host,
      port: parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'),
      user: user,
      password: process.env.DATABASE_PASSWORD || process.env.DB_PASS || process.env.POSTGRES_PASSWORD,
      database: process.env.DATABASE_NAME || process.env.DB_NAME || process.env.POSTGRES_DB || 'postgres',
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    console.log(`✅ Connected to PostgreSQL`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        "passwordHash" VARCHAR(255) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL,
        "faceImagePath" VARCHAR(255),
        "faceImageData" BYTEA,
        role VARCHAR(50) DEFAULT 'user'
      )
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_email ON users(email)
    `);
    
    // Migration: Add faceImageData column if it doesn't exist
    try {
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS "faceImageData" BYTEA
      `);
      console.log("✅ faceImageData column migration complete");
    } catch (err) {
      console.log("⚠️ Column migration skipped:", err.message);
    }
    
    console.log("✅ PostgreSQL users table ready");

    await client.end();
  } catch (error) {
    console.warn("⚠️  PostgreSQL initialization failed:", error.message);
  }
};

export default createDatabaseAndTables;

