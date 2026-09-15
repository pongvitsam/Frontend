import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcSrc = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcSrc));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function writePng(file, width, height, rgbaAt) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const row = y * stride;
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const px = rgbaAt(x, y, width, height);
      const i = row + 1 + x * 4;
      raw[i] = px[0];
      raw[i + 1] = px[1];
      raw[i + 2] = px[2];
      raw[i + 3] = px[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
}

function mix(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
  ];
}

function coverage(dist, radius) {
  return Math.max(0, Math.min(1, radius + 0.65 - dist));
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function drawSunIcon(x, y, size, opts) {
  const cx = size / 2;
  const cy = size / 2;
  const pad = opts.maskable ? 0.2 : opts.opaque ? 0.12 : 0.06;
  const outer = size * (0.5 - pad);
  const inner = size * 0.155;
  const navy = [44, 53, 72, 255];
  const gold = [139, 115, 85, 255];
  const ray = [201, 184, 150, 255];
  const px = x + 0.5;
  const py = y + 0.5;
  const disk = coverage(Math.hypot(px - cx, py - cy), outer);

  let color;
  if (opts.opaque) {
    color = navy.slice();
  } else {
    if (disk <= 0) return [0, 0, 0, 0];
    color = [navy[0], navy[1], navy[2], Math.round(255 * disk)];
  }

  const cin = coverage(Math.hypot(px - cx, py - cy), inner);
  if (cin > 0) color = mix(color, gold, cin * (color[3] / 255 || 1));

  const rayInner = inner + size * 0.045;
  const rayOuter = outer - size * 0.07;
  const halfW = Math.max(1.1, size * 0.018);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const x1 = cx + Math.cos(a) * rayInner;
    const y1 = cy + Math.sin(a) * rayInner;
    const x2 = cx + Math.cos(a) * rayOuter;
    const y2 = cy + Math.sin(a) * rayOuter;
    const c = coverage(distToSegment(px, py, x1, y1, x2, y2), halfW);
    if (c > 0) color = mix(color, ray, c);
  }

  if (opts.opaque) color[3] = 255;
  return [
    Math.round(color[0]),
    Math.round(color[1]),
    Math.round(color[2]),
    Math.round(Math.max(0, Math.min(255, color[3]))),
  ];
}

export function generatePwaIcons(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const jobs = [
    ['icon-192.png', 192, { opaque: true }],
    ['icon-512.png', 512, { opaque: true }],
    ['icon-192-maskable.png', 192, { opaque: true, maskable: true }],
    ['icon-512-maskable.png', 512, { opaque: true, maskable: true }],
    ['apple-touch-icon.png', 180, { opaque: true }],
  ];
  jobs.forEach(function ([name, size, opts]) {
    writePng(path.join(outDir, name), size, size, function (x, y, w) {
      return drawSunIcon(x, y, w, opts);
    });
  });
}
