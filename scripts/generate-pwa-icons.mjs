// Dependency-free PWA icon generator.
// Writes valid PNGs from scratch (zlib only) + a favicon.ico, with a geometric
// white "P" on the brand green (#0F6E56). Placeholder art — replace with the
// final logo later by dropping real PNGs into public/ with the same filenames.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
mkdirSync(OUT, { recursive: true });

const GREEN = [0x0f, 0x6e, 0x56];
const WHITE = [0xff, 0xff, 0xff];

// "P" as fractional rectangles of the canvas (x0,y0,x1,y1 in 0..1).
const P_RECTS = [
  [0.32, 0.20, 0.44, 0.80], // stem
  [0.32, 0.20, 0.74, 0.32], // top bar
  [0.62, 0.20, 0.74, 0.52], // bowl right
  [0.32, 0.46, 0.74, 0.58], // middle bar
];

function inP(x, y, S) {
  for (const [x0, y0, x1, y1] of P_RECTS) {
    if (x >= x0 * S && x < x1 * S && y >= y0 * S && y < y1 * S) return true;
  }
  return false;
}

// --- CRC32 (PNG chunks) ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function makePng(S) {
  // RGB (color type 2), 8-bit. Raw = per row: filter byte (0) + S*3 bytes.
  const raw = Buffer.alloc(S * (1 + S * 3));
  for (let y = 0; y < S; y++) {
    const rowStart = y * (1 + S * 3);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < S; x++) {
      const [r, g, b] = inP(x + 0.5, y + 0.5, S) ? WHITE : GREEN;
      const o = rowStart + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0);
  ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // color type RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function makeIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size; // width
  entry[1] = size >= 256 ? 0 : size; // height
  entry[2] = 0; entry[3] = 0;
  entry.writeUInt16LE(1, 4);   // planes
  entry.writeUInt16LE(32, 6);  // bpp
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(6 + 16, 12); // offset
  return Buffer.concat([header, entry, png]);
}

const sizes = { "icon-192x192.png": 192, "icon-512x512.png": 512, "apple-touch-icon.png": 180 };
for (const [name, S] of Object.entries(sizes)) {
  writeFileSync(join(OUT, name), makePng(S));
  console.log(`wrote ${name} (${S}x${S})`);
}
const fav = makePng(32);
writeFileSync(join(OUT, "favicon.ico"), makeIco(fav, 32));
console.log("wrote favicon.ico (32x32)");

// Keep an editable SVG source alongside the PNGs for future reference.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0F6E56"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="320" fill="#ffffff">P</text>
</svg>`;
writeFileSync(join(OUT, "icon.svg"), svg);
console.log("wrote icon.svg (source)");
