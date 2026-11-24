/* 트리를 수채화처럼 칠한 그림 한 장을 만든다 (2026-11-24, 시안 ②의 두 번째).
   선생님이 보여 주신 참고 그림: 물결진 단, 민트 바탕에 파란 물감 번짐, 종이 질감,
   살짝 번진 가장자리, 위 단 밑의 푸른 그늘, 밝은 나무색 기둥.

   **윤곽은 tree-layout.js의 tierPath 그대로 칠한다.** 그래서 학생이 거는 자리와 이미
   저장된 자리는 하나도 안 틀어진다. 물결만 그림에서 조금 깊게(PAINT_FLAT) 판다.
   밑단 아래로 반 칸쯤 더 내려올 뿐이라 거는 자리 셈에는 영향이 없다.

   반짝이와 별은 그림에 넣지 않는다. 화면에서 따로 숨 쉬어야 해서 SVG로 얹는다.

   실행: node tools/make-tree-paint.mjs [나올파일]   (puppeteer의 크롬 canvas를 빌려 쓴다) */
import puppeteer from 'puppeteer';
import fs from 'fs';
import { TIERS, tierPath, TRUNK, TREE } from '../tree-layout.js';

const OUT = process.argv[2] || 'img/tree-paint.webp';
const PAINT_FLAT = 0.78;
const SCALE = 12;   // viewBox 1칸 = 12px  ->  1200 x 1680

const tiers = TIERS.map(t => ({
  d: tierPath(t, 0, PAINT_FLAT),
  shadow: tierPath(t, 2.2, PAINT_FLAT),
  apexY: t.apexY, baseY: t.baseY, half: t.half,
}));

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const url = await page.evaluate(({ tiers, TRUNK, W, H, SCALE }) => {
  let seed = 1224;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const mk = () => { const c = document.createElement('canvas'); c.width = W * SCALE; c.height = H * SCALE; return c; };

  const main = mk();
  const m = main.getContext('2d');
  m.scale(SCALE, SCALE);

  /* 종이 결: 픽셀마다 밝기를 조금씩 흔든다. 큰 얼룩(저주파)과 잔 알갱이(고주파)를 섞는다. */
  function grain(ctx, amt, big) {
    const c = ctx.canvas, img = ctx.getImageData(0, 0, c.width, c.height), p = img.data;
    const G = 24, gw = Math.ceil(c.width / G) + 1, gh = Math.ceil(c.height / G) + 1;
    const low = Float32Array.from({ length: gw * gh }, () => rnd() - 0.5);
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      const k = (y * c.width + x) * 4;
      if (!p[k + 3]) continue;
      const gx = x / G, gy = y / G, ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy;
      const l = low[iy * gw + ix] * (1 - fx) * (1 - fy) + low[iy * gw + ix + 1] * fx * (1 - fy)
              + low[(iy + 1) * gw + ix] * (1 - fx) * fy + low[(iy + 1) * gw + ix + 1] * fx * fy;
      const n = (rnd() - 0.5) * amt + l * big;
      p[k] += n; p[k + 1] += n; p[k + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }

  /* ── 기둥: 밝은 나무색에 결 ── */
  {
    const c = mk(), x = c.getContext('2d');
    x.scale(SCALE, SCALE);
    const x0 = 50 - TRUNK.half - 0.6, w = (TRUNK.half + 0.6) * 2, y0 = TRUNK.topY - 4, h = TRUNK.groundY - y0;
    const g = x.createLinearGradient(x0, 0, x0 + w, 0);
    g.addColorStop(0, '#d9b98a'); g.addColorStop(0.5, '#c49f70'); g.addColorStop(1, '#a07a52');
    x.fillStyle = g;
    x.beginPath(); x.roundRect(x0, y0, w, h, 1.6); x.fill();
    x.globalCompositeOperation = 'source-atop';
    x.strokeStyle = 'rgba(140, 100, 60, .45)';
    x.lineWidth = 0.22;
    for (let i = 0; i < 9; i++) {           // 나뭇결: 비스듬히 휘는 선
      const yy = y0 + 4 + i * (h - 4) / 9 + rnd() * 1.2;
      x.beginPath();
      x.moveTo(x0 - 1, yy + rnd());
      x.bezierCurveTo(x0 + w * 0.3, yy - 1.4 - rnd(), x0 + w * 0.6, yy + 1.6, x0 + w + 1, yy - 0.5 + rnd());
      x.stroke();
    }
    x.setTransform(1, 0, 0, 1, 0, 0);
    grain(x, 14, 10);
    m.save(); m.setTransform(1, 0, 0, 1, 0, 0); m.filter = 'blur(0.8px)'; m.drawImage(c, 0, 0); m.restore();
  }

  /* ── 가지: 아래 단부터. 위 단이 아래 단 위로 물결진 밑자락을 덮는다 ── */
  for (let i = tiers.length - 1; i >= 0; i--) {
    const t = tiers[i];
    const path = new Path2D(t.d);

    // 1) 위 단이 아래(이미 칠한 단과 기둥)에 드리우는 푸른 그늘. 이미 칠한 데에만 묻는다.
    m.save();
    m.globalCompositeOperation = 'source-atop';
    m.filter = `blur(${SCALE * 0.9}px)`;
    m.fillStyle = 'rgba(34, 64, 160, .55)';
    m.fill(new Path2D(t.shadow));
    m.restore();

    // 2) 단 하나를 따로 칠한다
    const c = mk(), x = c.getContext('2d');
    x.scale(SCALE, SCALE);
    const g = x.createLinearGradient(0, t.apexY, 0, t.baseY + 3);
    g.addColorStop(0, '#7fdccb');
    g.addColorStop(0.55, '#4fc5bf');
    g.addColorStop(1, '#44b5c9');
    x.fillStyle = g;
    x.fill(path);

    x.globalCompositeOperation = 'source-atop';
    // 물감 번짐: 둥근 얼룩을 겹겹이. 파랑은 단 가운데에서 위쪽(위 단의 그늘 쪽)에 더 많이.
    const blots = [
      ['86, 132, 226', 0.40, 18, 0.25, 0.70],   // 파랑
      ['60, 110, 210', 0.30, 10, 0.30, 0.60],    // 짙은 파랑
      ['52, 178, 186', 0.22, 12, 0.10, 0.95],   // 청록
      ['160, 240, 220', 0.20, 12, 0.15, 1.00],  // 밝은 민트
      ['205, 250, 236', 0.12, 6, 0.55, 1.00],   // 거의 흰 민트(밑자락 쪽)
    ];
    const tierH = t.baseY - t.apexY;
    for (const [rgb, a, n, v0, v1] of blots) {
      for (let k = 0; k < n * (t.half / 25 + 0.4); k++) {
        const v = v0 + rnd() * (v1 - v0);
        const cy = t.apexY + tierH * v;
        const half = t.half * (cy - t.apexY) / tierH;
        const cx = 50 + (rnd() * 2 - 1) * half * 0.95;
        const r = (2.5 + rnd() * 6) * (0.6 + t.half / 60);
        const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        rg.addColorStop(0, `rgba(${rgb}, ${a})`);
        rg.addColorStop(0.6, `rgba(${rgb}, ${a * 0.55})`);
        rg.addColorStop(1, `rgba(${rgb}, 0)`);
        x.fillStyle = rg;
        x.beginPath(); x.ellipse(cx, cy, r * 1.3, r, 0, 0, Math.PI * 2); x.fill();
      }
    }
    // 가장자리 안쪽을 밝게: 물결 하나하나가 도톰하게 보인다
    x.save();
    x.filter = `blur(${SCALE * 0.7}px)`;
    x.strokeStyle = 'rgba(190, 248, 232, .36)';
    x.lineWidth = 2.6;
    x.stroke(path);
    x.restore();
    // 오른쪽은 살짝 그늘
    const side = x.createLinearGradient(50 - t.half, 0, 50 + t.half, 0);
    side.addColorStop(0, 'rgba(255,255,255,.10)');
    side.addColorStop(0.5, 'rgba(255,255,255,0)');
    side.addColorStop(1, 'rgba(20,60,120,.16)');
    x.fillStyle = side;
    x.fill(path);

    x.setTransform(1, 0, 0, 1, 0, 0);
    grain(x, 16, 14);

    // 3) 가장자리를 살짝 번지게 얹는다
    m.save(); m.setTransform(1, 0, 0, 1, 0, 0); m.filter = 'blur(1.1px)'; m.drawImage(c, 0, 0); m.restore();
  }

  return main.toDataURL('image/webp', 0.86);
}, { tiers, TRUNK, W: TREE.vbW, H: TREE.vbH, SCALE });
await browser.close();

fs.writeFileSync(OUT, Buffer.from(url.split(',')[1], 'base64'));
console.log(`${OUT} ${(fs.statSync(OUT).size / 1024).toFixed(0)}KB`);
