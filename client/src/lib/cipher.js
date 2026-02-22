const ivLength = 12;

const toBase64 = (bytes) => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const fromBase64 = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export const aesEncrypt = async (plainText) => {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(ivLength));
  const encoded = new TextEncoder().encode(plainText);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  const keyBytes = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  const cipherBytes = new Uint8Array(cipherBuffer);
  const payload = new Uint8Array(ivLength + cipherBytes.length);
  payload.set(iv);
  payload.set(cipherBytes, ivLength);

  return {
    cipherText: toBase64(payload),
    key: toBase64(keyBytes)
  };
};

export const aesDecrypt = async (cipherText, keyBase64) => {
  if (!cipherText || !keyBase64) {
    throw new Error("Cipher text and key are required");
  }

  const payload = fromBase64(cipherText);
  const iv = payload.slice(0, ivLength);
  const data = payload.slice(ivLength);
  const keyBytes = fromBase64(keyBase64);

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );

  return new TextDecoder().decode(plainBuffer);
};
