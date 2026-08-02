import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(__dirname);
const outDir = join(projectRoot, 'public', 'icons');

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function createPng(size) {
  const width = size;
  const height = size;
  const pixels = Buffer.alloc((width * 4 + 1) * height);
  const bg = [5, 8, 15, 255];
  const glow = [78, 163, 255, 255];
  const accent = [139, 92, 246, 255];

  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    pixels[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const i = row + 1 + x * 4;
      const dx = x - width / 2;
      const dy = y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const cornerDist = Math.min(
        Math.sqrt((x - 18) ** 2 + (y - 18) ** 2),
        Math.sqrt((x - (width - 18)) ** 2 + (y - 18) ** 2),
        Math.sqrt((x - 18) ** 2 + (y - (height - 18)) ** 2),
        Math.sqrt((x - (width - 18)) ** 2 + (y - (height - 18)) ** 2),
      );
      const insideRoundedRect = x > 8 && x < width - 8 && y > 8 && y < height - 8 && cornerDist > 10;
      let rgba = bg;
      if (insideRoundedRect) {
        rgba = bg;
      }
      if (dist < size * 0.23) {
        rgba = glow;
      }
      if (x > width * 0.25 && x < width * 0.75 && y > height * 0.58 && y < height * 0.68) {
        rgba = accent;
      }
      pixels[i] = rgba[0];
      pixels[i + 1] = rgba[1];
      pixels[i + 2] = rgba[2];
      pixels[i + 3] = rgba[3];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = deflateSync(pixels);
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    await writeFile(join(outDir, `icon${size}.png`), createPng(size));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
