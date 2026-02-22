import mysql from "mysql2/promise";

const createDatabaseAndTables = async () => {
  // Skip MySQL if credentials are not provided
  if (!process.env.MYSQL_HOST || !process.env.MYSQL_USER) {
    console.log("⚠️  MySQL credentials not provided, skipping database initialization");
    return;
  }

  try {
    const connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || "localhost",
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_PASSWORD || "root"
    });

    try {
      // Create database if not exists
      const dbName = process.env.MYSQL_DB || "face_verification_db";
      await connection.execute(
        `CREATE DATABASE IF NOT EXISTS \`${dbName}\``
      );
      console.log(`✅ Database '${dbName}' ready`);

      // Switch to database
      await connection.changeUser({ database: dbName });

      // Create users table
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(36) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          passwordHash VARCHAR(255) NOT NULL,
          createdAt DATETIME NOT NULL,
          faceImagePath VARCHAR(255),
          role VARCHAR(50) DEFAULT 'user',
          INDEX idx_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log("✅ Users table ready");

      await connection.end();
    } catch (error) {
      console.error("❌ Database initialization failed:", error.message);
      throw error;
    }
  } catch (error) {
    console.warn("⚠️  MySQL connection failed, will use CSV fallback:", error.message);
  }
    throw error;
  }
};

export default createDatabaseAndTables;
