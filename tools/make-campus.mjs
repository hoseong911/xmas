/* 학교 사진을 "밤하늘에 선 동양중학교"로 바꾼다.
   라이브러리를 따로 깔지 않고 크롬의 canvas를 빌려 쓴다(puppeteer가 이미 있다).
     1 띠 부분만 잘라낸다(흰 여백과 홈페이지 문구를 뺀다)
     2 하늘을 투명하게 뚫는다 — 위에서 번져 들어가며 채우므로 건물 속 밝은 벽은 안 건드린다
     3 밤으로 내리고, 창문 몇 칸에 불을 켠다
*/
import puppeteer from 'puppeteer';
import fs from 'fs';

const SRC  = process.argv[2];   // 학교 홈페이지 배너를 찍어 둔 그림
const OUT  = process.argv[3] || 'img/campus-night.webp';
const TYPE = process.argv[4] || 'image/webp';
const LIT  = Number(process.argv[5] ?? 0.22);   // 불 켜진 창문 비율

if (!SRC) {
  console.log('쓰는 법: node tools/make-campus.mjs <학교사진.png> [나올파일] [image/webp] [불켜진창문비율]');
  process.exit(1);
}

const b64 = fs.readFileSync(SRC).toString('base64');
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const out = await page.evaluate(async (b64, TYPE, LIT) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + b64;
  await img.decode();

  const CROP = { x: 60, y: 200, w: 1580, h: 545 };
  const W = 1600, H = Math.round(CROP.h * (W / CROP.w));
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.drawImage(img, CROP.x, CROP.y, CROP.w, CROP.h, 0, 0, W, H);

  const d = x.getImageData(0, 0, W, H);
  const p = d.data;
  const lumAt = i => (p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114) / 255;

  /* ── 1) 하늘 뚫기 ──────────────────────────────────────────────
     색만 보고 자르면 건물의 흰 가운데 벽도 같이 날아간다. 그래서 **맨 윗줄에서
     번져 들어가며** 밝은 데를 따라간다. 지붕의 어두운 선에서 저절로 멈춘다. */
  const SKY_BOTTOM = Math.round(H * 0.79);   // 이 아래는 운동장이다. 하늘로 보지 않는다
  const sky = new Uint8Array(W * H);
  const q = [];
  for (let xx = 0; xx < W; xx++) { q.push(xx); sky[xx] = 1; }
  while (q.length) {
    const k = q.pop();
    const yy = (k / W) | 0, xx = k % W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = xx + dx, ny = yy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nk = ny * W + nx;
      if (sky[nk]) continue;
      if (ny > SKY_BOTTOM) continue;           // 운동장 바닥까지 먹어 들어가지 않게
      if (lumAt(nk * 4) < 0.56) continue;      // 지붕선에서 멈춘다
      sky[nk] = 1; q.push(nk);
    }
  }
  // 홈페이지 문구가 있던 자리(지붕선보다 위라 건물에 닿지 않는다)
  for (let yy = 0; yy < 96; yy++) for (let xx = 470; xx < 1170; xx++) sky[yy * W + xx] = 1;

  /* ── 2) 밤으로 내리고 창문에 불을 켠다 ─────────────────────────
     사진이 한낮이라 창문이 전부 꺼져 있다. 어둡고 푸른 칸(창문)을 찾아
     드문드문 따뜻한 빛을 넣으면 밤 학교처럼 보인다. 칸은 격자로 묶어
     창틀 모양을 따라가게 하고, 켤지 말지는 자리에서 뽑은 고정 난수로 정한다
     (매번 같은 창에 불이 들어와야 다시 만들어도 같은 그림이 나온다). */
  const hash = (a, b) => {
    let h = (2166136261 ^ (a * 73856093) ^ (b * 19349663)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) % 1000 / 1000;
  };
  const CELL_W = 13, CELL_H = 11;

  for (let yy = 0; yy < H; yy++) {
    for (let xx = 0; xx < W; xx++) {
      const k = yy * W + xx, i = k * 4;
      if (sky[k]) { p[i + 3] = 0; continue; }

      const r = p[i], g = p[i + 1], b = p[i + 2];
      const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      const base = Math.pow(lum, 1.5) * 0.44;
      let R = base * 104, G = base * 134, B = base * 200;

      // 창문인가 — 낮 사진에서 어둡고 푸른 칸
      const isWindow = yy < SKY_BOTTOM + 10 && lum < 0.42 && (b - r) > 6;
      if (isWindow && hash((xx / CELL_W) | 0, (yy / CELL_H) | 0) < LIT) {
        const warm = 0.62 + hash((xx / CELL_W) | 0, ((yy / CELL_H) | 0) + 977) * 0.38;
        R = 236 * warm; G = 196 * warm; B = 118 * warm;
      }
      p[i]     = Math.min(255, R);
      p[i + 1] = Math.min(255, G);
      p[i + 2] = Math.min(255, B);
    }
  }
  x.putImageData(d, 0, 0);

  /* ── 3) 지붕선 다듬기 ──────────────────────────────────────────
     번져 들어가며 자른 가장자리는 톱니가 선다. 알파만 아주 살짝 흐려 준다. */
  const c2 = document.createElement('canvas');
  c2.width = W; c2.height = H;
  const x2 = c2.getContext('2d');
  x2.filter = 'blur(0.6px)';
  x2.drawImage(c, 0, 0);

  return c2.toDataURL(TYPE, 0.88);
}, b64, TYPE, LIT);
await browser.close();
fs.writeFileSync(OUT, Buffer.from(out.split(',')[1], 'base64'));
console.log('saved', OUT, Math.round(fs.statSync(OUT).size / 1024), 'KB');
