/**
 * Generate the extension icons (extension/icons/icon{16,48,128}.png).
 *
 * Zero dependencies: encodes PNGs by hand with node:zlib — an RGBA raster,
 * filter-0 scanlines, and manually assembled chunks with CRC32.
 * Run: node scripts/make-icons.cjs
 */

const zlib = require('node:zlib');
const fs = require('node:fs');
const path = require('node:path');

// ─── PNG encoding ─────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
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
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── The icon itself ──────────────────────────────────────────────

// Lowercase "y", 7×8 cells — two stems converging into a left-hook descender.
const GLYPH = [
  '#.....#',
  '#.....#',
  '#.....#',
  '.#...#.',
  '..###..',
  '...#...',
  '..##...',
  '.###...',
];

const BG = [15, 118, 110];   // teal #0f766e — the app's brand color
const FG = [255, 255, 255];  // white glyph

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  const gw = size * 0.62;              // glyph width in px
  const cell = gw / GLYPH[0].length;   // px per glyph cell
  const offX = (size - gw) / 2;
  const gh = cell * GLYPH.length;
  const offY = (size - gh) / 2;

  const insideRoundedRect = (x, y) => {
    if (radius <= 0) return true;
    const cx = Math.max(radius - x, x - (size - 1 - radius), 0);
    const cy = Math.max(radius - y, y - (size - 1 - radius), 0);
    return cx * cx + cy * cy <= radius * radius;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (!insideRoundedRect(x, y)) continue; // alpha stays 0 → transparent corner

      let color = BG;
      const gx = Math.floor((x + 0.5 - offX) / cell);
      const gy = Math.floor((y + 0.5 - offY) / cell);
      if (
        gx >= 0 && gx < GLYPH[0].length &&
        gy >= 0 && gy < GLYPH.length &&
        GLYPH[gy][gx] === '#'
      ) {
        color = FG;
      }
      rgba[i] = color[0];
      rgba[i + 1] = color[1];
      rgba[i + 2] = color[2];
      rgba[i + 3] = 255;
    }
  }
  return encodePng(size, rgba);
}

// ─── Emit ─────────────────────────────────────────────────────────

const outDir = path.join(__dirname, '..', 'extension', 'icons');
fs.mkdirSync(outDir, { recursive: true });
for (const size of [16, 48, 128]) {
  const file = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(file, drawIcon(size));
  console.log(`wrote ${file} (${fs.statSync(file).size} bytes)`);
}
