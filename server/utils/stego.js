import { PNG } from "pngjs";

const getDataIndex = (bitIndex) => {
  const pixelIndex = Math.floor(bitIndex / 3);
  const channel = bitIndex % 3;
  return pixelIndex * 4 + channel;
};

const toBits = (buffer) => {
  const bits = [];
  for (const byte of buffer) {
    for (let i = 7; i >= 0; i -= 1) {
      bits.push((byte >> i) & 1);
    }
  }
  return bits;
};

const fromBits = (bits) => {
  const bytes = Buffer.alloc(bits.length / 8);
  for (let i = 0; i < bytes.length; i += 1) {
    let value = 0;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value << 1) | bits[i * 8 + bit];
    }
    bytes[i] = value;
  }
  return bytes;
};

export const encodeStego = (pngBuffer, message) => {
  const png = PNG.sync.read(pngBuffer);
  const capacityBits = (png.data.length / 4) * 3;

  const messageBytes = Buffer.from(message, "utf8");
  const lengthBytes = Buffer.alloc(4);
  lengthBytes.writeUInt32BE(messageBytes.length);

  const payload = Buffer.concat([lengthBytes, messageBytes]);
  const payloadBits = toBits(payload);

  if (payloadBits.length > capacityBits) {
    throw new Error("Message too large for this image");
  }

  for (let i = 0; i < payloadBits.length; i += 1) {
    const idx = getDataIndex(i);
    png.data[idx] = (png.data[idx] & 0xfe) | payloadBits[i];
  }

  return PNG.sync.write(png);
};

export const decodeStego = (pngBuffer) => {
  const png = PNG.sync.read(pngBuffer);
  const capacityBits = (png.data.length / 4) * 3;

  const lengthBits = [];
  for (let i = 0; i < 32; i += 1) {
    const idx = getDataIndex(i);
    lengthBits.push(png.data[idx] & 1);
  }

  const lengthBytes = fromBits(lengthBits);
  const messageLength = lengthBytes.readUInt32BE(0);
  const totalBits = 32 + messageLength * 8;

  if (totalBits > capacityBits) {
    throw new Error("Invalid stego payload");
  }

  const messageBits = [];
  for (let i = 32; i < totalBits; i += 1) {
    const idx = getDataIndex(i);
    messageBits.push(png.data[idx] & 1);
  }

  const messageBytes = fromBits(messageBits);
  return messageBytes.toString("utf8");
};
