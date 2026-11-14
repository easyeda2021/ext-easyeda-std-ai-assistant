#!/usr/bin/env node
/*
 * Generates the PNG icons (16/24/32/48/64/128) for the EasyEDA Std extension.
 * Pure Node: hand-rolled rasteriser (supersampled SDF) + minimal PNG encoder (zlib).
 * The artwork matches extension/icon.svg: an AI chip on a rounded dark tile.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'extension');

/* ---------------------------------------------------------------- PNG ---- */

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
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePNG(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------ artwork ---- */

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;

// signed distance to a rounded rectangle centred at (cx, cy)
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

// signed distance to a capsule (thick line segment)
function sdSegment(px, py, ax, ay, bx, by, r) {
  const pax = px - ax, pay = py - ay;
  const bax = bx - ax, bay = by - ay;
  const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay), 0, 1);
  return Math.hypot(pax - bax * h, pay - bay * h) - r;
}

function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

// 4-point sparkle (concave diamond-ish star)
function sdSparkle(px, py, cx, cy, R, waist) {
  const dx = Math.abs(px - cx), dy = Math.abs(py - cy);
  const k = Math.max(dx, dy);
  const diag = (dx + dy) * 0.7071;
  return Math.max(k - R, diag - waist);
}

/**
 * Renders one icon.
 * @param {number} S  output size in px
 */
function render(S) {
  const SS = 4;                       // supersampling factor
  const acc = new Float32Array(S * S * 4);

  const u = S / 32;                   // artwork is authored on a 32x32 grid
  const px = (v) => v * u;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const X = (x + (sx + 0.5) / SS) / u;   // 32-grid coords
          const Y = (y + (sy + 0.5) / SS) / u;

          // ---- tile background (rounded square, vertical gradient) ----
          const dBg = sdRoundRect(X, Y, 16, 16, 15, 15, 7.5);
          if (dBg > 0.6) continue;
          const bgA = clamp(0.5 - dBg, 0, 1);
          let cr = mix(0x14, 0x1e, Y / 32);
          let cg = mix(0x2b, 0x3f, Y / 32);
          let cb = mix(0x52, 0x7a, Y / 32);

          // ---- chip body ----
          const dChip = sdRoundRect(X, Y, 16, 18, 8.2, 6.2, 2.0);
          if (dChip < 0.6) {
            const chipA = clamp(0.5 - dChip, 0, 1);
            cr = mix(cr, 0x16, chipA);
            cg = mix(cg, 0xc2, chipA);
            cb = mix(cb, 0xdd, chipA);
          }

          // ---- chip pins ----
          let dPin = 1e9;
          for (let i = 0; i < 3; i++) {
            const ox = 12.2 + i * 3.8;
            dPin = Math.min(dPin, sdSegment(X, Y, ox, 10.4, ox, 11.8, 0.85));
            dPin = Math.min(dPin, sdSegment(X, Y, ox, 24.2, ox, 25.6, 0.85));
          }
          for (let i = 0; i < 3; i++) {
            const oy = 13.6 + i * 3.6;
            dPin = Math.min(dPin, sdSegment(X, Y, 6.4, oy, 7.8, oy, 0.85));
            dPin = Math.min(dPin, sdSegment(X, Y, 24.2, oy, 25.6, oy, 0.85));
          }
          if (dPin < 0.6) {
            const pinA = clamp(0.5 - dPin, 0, 1);
            cr = mix(cr, 0x7d, pinA);
            cg = mix(cg, 0xf3, pinA);
            cb = mix(cb, 0xfc, pinA);
          }

          // ---- inner die ----
          const dDie = sdRoundRect(X, Y, 16, 18, 4.6, 3.0, 1.0);
          if (dDie < 0.6) {
            const dieA = clamp(0.5 - dDie, 0, 1);
            cr = mix(cr, 0x0d, dieA);
            cg = mix(cg, 0x2b, dieA);
            cb = mix(cb, 0x46, dieA);
          }

          // ---- AI sparkle ----
          const dSpark = sdSparkle(X, Y, 23.5, 7.5, 5.2, 2.0);
          if (dSpark < 0.6) {
            const spA = clamp(0.5 - dSpark, 0, 1);
            cr = mix(cr, 0xff, spA);
            cg = mix(cg, 0xc4, spA);
            cb = mix(cb, 0x4d, spA);
          }
          const dSpark2 = sdSparkle(X, Y, 7.6, 7.2, 3.0, 1.2);
          if (dSpark2 < 0.6) {
            const spA = clamp(0.5 - dSpark2, 0, 1);
            cr = mix(cr, 0xa5, spA);
            cg = mix(cg, 0xf0, spA);
            cb = mix(cb, 0xff, spA);
          }

          r += cr * bgA; g += cg * bgA; b += cb * bgA; a += bgA;
        }
      }
      const n = SS * SS;
      const i = (y * S + x) * 4;
      const A = a / n;
      if (A > 0) {
        acc[i] = clamp(r / a, 0, 255);
        acc[i + 1] = clamp(g / a, 0, 255);
        acc[i + 2] = clamp(b / a, 0, 255);
        acc[i + 3] = clamp(A * 255, 0, 255);
      }
    }
  }

  const out = Buffer.alloc(S * S * 4);
  for (let i = 0; i < S * S * 4; i++) out[i] = Math.round(acc[i]);
  return encodePNG(S, S, out);
}

const sizes = [16, 24, 32, 48, 64, 128];
for (const s of sizes) {
  const file = path.join(OUT, `icon${s}.png`);
  fs.writeFileSync(file, render(s));
  console.log('wrote', file, fs.statSync(file).size, 'bytes');
}
