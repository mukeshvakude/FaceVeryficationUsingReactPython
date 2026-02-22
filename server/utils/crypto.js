import crypto from "crypto";

const ivLength = 12;
const tagLength = 16;

export const encryptText = (plainText, secret) => {
  if (!secret || secret.length < 32) {
    throw new Error("AES_SECRET must be at least 32 characters");
  }

  const iv = crypto.randomBytes(ivLength);
  const key = crypto.scryptSync(secret, "svstego", 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, tag, encrypted]);

  return packed.toString("base64");
};

export const decryptText = (encodedText, secret) => {
  if (!secret || secret.length < 32) {
    throw new Error("AES_SECRET must be at least 32 characters");
  }

  const packed = Buffer.from(encodedText, "base64");
  const iv = packed.subarray(0, ivLength);
  const tag = packed.subarray(ivLength, ivLength + tagLength);
  const cipherText = packed.subarray(ivLength + tagLength);

  const key = crypto.scryptSync(secret, "svstego", 32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()]);
  return decrypted.toString("utf8");
};
