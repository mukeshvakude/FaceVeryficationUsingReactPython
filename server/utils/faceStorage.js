import fs from "fs/promises";
import path from "path";

const ensureFacesDir = async () => {
  const dir = path.join(process.cwd(), "data", "faces");
  await fs.mkdir(dir, { recursive: true });
  return dir;
};

export const saveFaceImage = async (userId, file) => {
  const facesDir = await ensureFacesDir();
  const fileName = `${userId}.jpg`;
  const filePath = path.join(facesDir, fileName);
  await fs.writeFile(filePath, file.buffer);
  return path.join("data", "faces", fileName);
};

export const readFaceImage = async (relativePath) => {
  const fullPath = path.join(process.cwd(), relativePath);
  return fs.readFile(fullPath);
};
