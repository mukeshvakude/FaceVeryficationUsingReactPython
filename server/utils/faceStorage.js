import fs from "fs/promises";
import path from "path";
import { getConnection, getDbType } from "../config/dbPool.js";

const ensureFacesDir = async () => {
  const dir = path.join(process.cwd(), "data", "faces");
  await fs.mkdir(dir, { recursive: true });
  return dir;
};

export const saveFaceImage = async (userId, file) => {
  // Always save to file system as fallback
  const facesDir = await ensureFacesDir();
  const fileName = `${userId}.jpg`;
  const filePath = path.join(facesDir, fileName);
  await fs.writeFile(filePath, file.buffer);
  
  return path.join("data", "faces", fileName);
};

export const saveFaceImageToDb = async (userId, imageBuffer) => {
  try {
    const dbType = getDbType();
    
    if (dbType === 'mysql') {
      const connection = await getConnection();
      await connection.execute(
        "UPDATE users SET faceImageData = ? WHERE id = ?",
        [imageBuffer, userId]
      );
      connection.release();
      console.log("✅ Face image saved to MySQL");
    } else if (dbType === 'postgresql') {
      const connection = await getConnection();
      await connection.execute(
        'UPDATE users SET "faceImageData" = ? WHERE id = ?',
        [imageBuffer, userId]
      );
      connection.release();
      console.log("✅ Face image saved to PostgreSQL");
    }
    
    return true;
  } catch (error) {
    console.error("❌ Failed to save face image to database:", error.message);
    return false;
  }
};

export const readFaceImageFromDb = async (userId) => {
  try {
    const dbType = getDbType();
    
    if (dbType === 'mysql') {
      const connection = await getConnection();
      const [rows] = await connection.execute(
        "SELECT faceImageData FROM users WHERE id = ?",
        [userId]
      );
      connection.release();
      
      if (rows.length > 0 && rows[0].faceImageData) {
        return rows[0].faceImageData;
      }
    } else if (dbType === 'postgresql') {
      const connection = await getConnection();
      const [rows] = await connection.execute(
        'SELECT "faceImageData" FROM users WHERE id = ?',
        [userId]
      );
      connection.release();
      
      if (rows.length > 0 && rows[0].faceImageData) {
        return Buffer.from(rows[0].faceImageData);
      }
    }
    
    return null;
  } catch (error) {
    console.error("❌ Failed to read face image from database:", error.message);
    return null;
  }
};

export const readFaceImage = async (relativePath) => {
  const fullPath = path.join(process.cwd(), relativePath);
  try {
    // Check if file exists before reading
    await fs.access(fullPath);
    return await fs.readFile(fullPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      const error = new Error(`Face image file not found: ${fullPath}`);
      error.code = 'FACE_IMAGE_NOT_FOUND';
      throw error;
    }
    throw err;
  }
};
