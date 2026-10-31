// Original pixel share art. Node 22+; no image library, network, or installed fonts.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { drawHamster, drawWheel } from '../src/art.ts';

const width = 1200, height = 630;
const pixels = Buffer.alloc(width * height * 4);
let transform = { x: 0, y: 0, scale: 1 }, stack = [];
const color = hex => hex.slice(1).match(/../g).map(v => parseInt(v, 16));
const ctx = {
  fillStyle: '#0e100e', globalAlpha: 1,
  save() { stack.push({ ...transform, fillStyle: this.fillStyle, alpha: this.globalAlpha }); },
  restore() { const s = stack.pop(); transform = { x: s.x, y: s.y, scale: s.scale }; this.fillStyle = s.fillStyle; this.globalAlpha = s.alpha; },
  translate(x, y) { transform.x += x * transform.scale; transform.y += y * transform.scale; },
  scale(x) { transform.scale *= x; },
  fillRect(x, y, w, h) {
    const rgb = color(this.fillStyle);
    const x1 = Math.max(0, Math.round(transform.x + x * transform.scale)), y1 = Math.max(0, Math.round(transform.y + y * transform.scale));
    const x2 = Math.min(width, Math.round(transform.x + (x + w) * transform.scale)), y2 = Math.min(height, Math.round(transform.y + (y + h) * transform.scale));
    for (let yy = y1; yy < y2; yy++) for (let xx = x1; xx < x2; xx++) {
      const i = (yy * width + xx) * 4;
      for (let c = 0; c < 3; c++) pixels[i + c] = Math.round(rgb[c] * this.globalAlpha + pixels[i + c] * (1 - this.globalAlpha));
      pixels[i + 3] = 255;
    }
  },
};
const glyphs = {
  A: ['01110','10001','10001','11111','10001','10001','10001'], B: ['11110','10001','10001','11110','10001','10001','11110'],
  C: ['01111','10000','10000','10000','10000','10000','01111'], D: ['11110','10001','10001','10001','10001','10001','11110'],
  E: ['11111','10000','10000','11110','10000','10000','11111'], F: ['11111','10000','10000','11110','10000','10000','10000'],
  G: ['01111','10000','10000','10111','10001','10001','01111'], H: ['10001','10001','10001','11111','10001','10001','10001'],
  I: ['11111','00100','00100','00100','00100','00100','11111'], J: ['00111','00010','00010','00010','10010','10010','01100'],
  K: ['10001','10010','10100','11000','10100','10010','10001'], L: ['10000','10000','10000','10000','10000','10000','11111'],
  M: ['10001','11011','10101','10101','10001','10001','10001'], N: ['10001','11001','10101','10011','10001','10001','10001'],
  O: ['01110','10001','10001','10001','10001','10001','01110'], P: ['11110','10001','10001','11110','10000','10000','10000'],
  Q: ['01110','10001','10001','10001','10101','10010','01101'], R: ['11110','10001','10001','11110','10100','10010','10001'],
  S: ['01111','10000','10000','01110','00001','00001','11110'], T: ['11111','00100','00100','00100','00100','00100','00100'],
  U: ['10001','10001','10001','10001','10001','10001','01110'], V: ['10001','10001','10001','10001','10001','01010','00100'],
  W: ['10001','10001','10001','10101','10101','11011','10001'], X: ['10001','10001','01010','00100','01010','10001','10001'],
  Y: ['10001','10001','01010','00100','00100','00100','00100'], Z: ['11111','00001','00010','00100','01000','10000','11111'],
  '.': ['00000','00000','00000','00000','00000','00100','00100'], ' ': Array(7).fill('00000'),
};
function text(value, x, y, scale, ink) {
  ctx.fillStyle = ink;
  [...value].forEach((c, i) => (glyphs[c] ?? glyphs[' ']).forEach((row, yy) => [...row].forEach((p, xx) => { if (p === '1') ctx.fillRect(x + (i * 6 + xx) * scale, y + yy * scale, scale, scale); })));
}
ctx.fillRect(0, 0, width, height);
ctx.fillStyle = '#252b1c';
for (let x = 12; x < width; x += 12) for (let y = 12; y < height; y += 12) ctx.fillRect(x, y, 2, 2);
ctx.fillStyle = '#181e14'; ctx.fillRect(0, 480, width, 150);
ctx.fillStyle = '#6d6637'; ctx.fillRect(0, 480, width, 3);
for (let x = 10; x < width; x += 60) ctx.fillRect(x, 510, 24, 3);
drawWheel(ctx, 941, 277, 164, 0.28);
drawHamster(ctx, 958, 438, 4.3, 'run', 0.12);
drawHamster(ctx, 588, 478, 3.4, 'run', 0.22, true);
text('RACE', 72, 110, 7, '#f0eddc');
text('SQUEEKTOSHI', 72, 180, 8, '#ffd16b');
text('TINY PAWS. BIG RACE.', 76, 290, 4, '#f0eddc');
text('ONE REAL HAMSTER.', 76, 358, 3, '#a5aa98');
text('YOUR NEXT RIVAL.', 76, 389, 3, '#a5aa98');
text('A SQUEEKCHAIN RHYTHM GAME', 76, 555, 3, '#ffd16b');
const crcTable = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ n >>> 1 : n >>> 1; return n >>> 0; });
function chunk(name, data) {
  const type = Buffer.from(name), length = Buffer.alloc(4), crc = Buffer.alloc(4); length.writeUInt32BE(data.length);
  let sum = 0xffffffff; for (const byte of Buffer.concat([type, data])) sum = crcTable[(sum ^ byte) & 255] ^ sum >>> 8;
  crc.writeUInt32BE((sum ^ 0xffffffff) >>> 0); return Buffer.concat([length, type, data, crc]);
}
const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
const scanlines = Buffer.alloc(height * (width * 4 + 1));
for (let y = 0; y < height; y++) pixels.copy(scanlines, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
writeFileSync(new URL('../public/og-image.png', import.meta.url), Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(scanlines, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
console.log('Created public/og-image.png (1200 × 630), using the original game sprites.');
