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
const STAR = { y: 11, ro: 8.4, ri: 3.5 };   // tree.html의 STAR_Y, starPath(50, 11, 8.4, 3.5)와 같은 자리

const tiers = TIERS.map(t => ({
  d: tierPath(t, 0, PAINT_FLAT),
  shadow: tierPath(t, 2.2, PAINT_FLAT),
  apexY: t.apexY, baseY: t.baseY, half: t.half,
}));

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const url = await page.evaluate(({ tiers, TRUNK, STAR, W, H, SCALE }) => {
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
    /* 나뭇결. 고른 간격의 물결선을 끝까지 그으면 수식으로 그린 티가 난다(첫 시안이 그랬다).
       길이, 간격, 굵기, 진하기를 제각각으로 두고, 옹이 하나를 둥글게 감는다. */
    x.lineCap = 'round';
    let yy = y0 + 4.5;
    while (yy < y0 + h - 1.5) {
      const xs = x0 + rnd() * w * 0.45, xe = x0 + w * (0.55 + rnd() * 0.5);
      x.strokeStyle = `rgba(125, 88, 52, ${(0.18 + rnd() * 0.32).toFixed(2)})`;
      x.lineWidth = 0.14 + rnd() * 0.2;
      x.beginPath();
      x.moveTo(xs, yy + rnd() * 0.6);
      x.bezierCurveTo(xs + (xe - xs) * 0.35, yy - 0.9 - rnd(), xs + (xe - xs) * 0.7, yy + 0.4 + rnd(), xe, yy - 0.3 + rnd() * 0.6);
      x.stroke();
      yy += 1.4 + rnd() * 2.6;
    }
    x.strokeStyle = 'rgba(115, 80, 46, .38)';
    x.lineWidth = 0.2;
    for (const r of [0.55, 1.05, 1.5]) {
      x.beginPath(); x.ellipse(x0 + w * 0.66, y0 + h * 0.52, r * 1.4, r, -0.2, 0.3, Math.PI * 1.85); x.stroke();
    }
    // 둥근 기둥처럼: 양옆을 조금 어둡게
    const roll = x.createLinearGradient(x0, 0, x0 + w, 0);
    roll.addColorStop(0, 'rgba(90,60,30,.22)'); roll.addColorStop(0.3, 'rgba(255,240,210,.12)');
    roll.addColorStop(0.75, 'rgba(0,0,0,0)'); roll.addColorStop(1, 'rgba(60,35,15,.3)');
    x.fillStyle = roll;
    x.fillRect(x0, y0, w, h);
    x.setTransform(1, 0, 0, 1, 0, 0);
    grain(x, 14, 10);
    m.save(); m.setTransform(1, 0, 0, 1, 0, 0); m.filter = 'blur(0.8px)'; m.drawImage(c, 0, 0); m.restore();
  }

  /* ── 눈 더미 ──
     예전 바닥은 반투명 타원 두 장이라 눈이 아니라 회색 접시로 보였다. 지금은 크기가 다른
     둥근 덩이 여러 개를 겹쳐 울퉁불퉁하게 쌓고, 아래와 오른쪽에 푸른 그늘, 위에 흰 빛을 준다.
     바닥에는 가장자리가 사라지는 옅은 눈빛만 깐다(선이 있으면 다시 접시가 된다). */
  {
    const GY = TRUNK.groundY;
    const haze = m.createRadialGradient(50, GY + 1, 0, 50, GY + 1, 40);
    haze.addColorStop(0, 'rgba(220, 236, 250, .20)');
    haze.addColorStop(0.6, 'rgba(220, 236, 250, .07)');
    haze.addColorStop(1, 'rgba(220, 236, 250, 0)');
    m.save(); m.translate(50, GY + 1); m.scale(1, 0.13); m.translate(-50, -(GY + 1));
    m.fillStyle = haze; m.beginPath(); m.arc(50, GY + 1, 40, 0, Math.PI * 2); m.fill();
    m.restore();

    const c = mk(), x = c.getContext('2d');
    x.scale(SCALE, SCALE);
    // [가운데 x, 가운데 y, 가로 반지름, 세로 반지름]
    const LUMPS = [
      // 바닥에 넓고 납작한 덩이를 먼저 깐다(덩이 사이로 뒤 건물이 비치지 않게)
      [50, GY + 2.6, 23, 1.7],
      [50, GY + 1.6, 13, 2.3], [42, GY + 1.0, 5.5, 2.1], [57.5, GY + 0.9, 6.2, 2.4],
      [49, GY + 0.2, 5.2, 1.9], [34, GY + 2.3, 4.6, 1.4], [66, GY + 2.2, 5.0, 1.5],
      [28, GY + 2.9, 3.0, 0.9], [72.5, GY + 2.9, 3.4, 1.0],
    ];
    const body = new Path2D();
    // 타원마다 moveTo로 끊어야 한다. 안 끊으면 앞 타원 끝에서 선이 이어져 구멍이 뚫린다.
    for (const [cx, cy, rx, ry] of LUMPS) { body.moveTo(cx + rx, cy); body.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); }
    const g = x.createLinearGradient(0, GY - 3.5, 0, GY + 4.5);
    g.addColorStop(0, '#f6fbff'); g.addColorStop(0.55, '#dbe9f7'); g.addColorStop(1, '#a9c0e2');
    x.fillStyle = g;
    x.fill(body);
    x.globalCompositeOperation = 'source-atop';
    // 덩이마다 아래 오른쪽 그늘, 위 왼쪽 빛
    for (const [cx, cy, rx, ry] of LUMPS) {
      const sh = x.createRadialGradient(cx + rx * 0.35, cy + ry * 0.7, 0, cx + rx * 0.35, cy + ry * 0.7, rx * 0.9);
      sh.addColorStop(0, 'rgba(110, 140, 200, .34)'); sh.addColorStop(1, 'rgba(110, 140, 200, 0)');
      x.fillStyle = sh; x.fillRect(cx - rx * 2, cy - ry * 2, rx * 4, ry * 4);
      const hi = x.createRadialGradient(cx - rx * 0.3, cy - ry * 0.55, 0, cx - rx * 0.3, cy - ry * 0.55, rx * 0.6);
      hi.addColorStop(0, 'rgba(255, 255, 255, .55)'); hi.addColorStop(1, 'rgba(255, 255, 255, 0)');
      x.fillStyle = hi; x.fillRect(cx - rx * 2, cy - ry * 2, rx * 4, ry * 4);
    }
    // 트리가 눈 위에 드리운 그늘
    const ts = x.createRadialGradient(50, GY - 1.5, 0, 50, GY - 1.5, 13);
    ts.addColorStop(0, 'rgba(60, 90, 170, .30)'); ts.addColorStop(1, 'rgba(60, 90, 170, 0)');
    x.fillStyle = ts; x.fillRect(30, GY - 8, 40, 14);
    x.setTransform(1, 0, 0, 1, 0, 0);
    grain(x, 10, 8);
    m.save(); m.setTransform(1, 0, 0, 1, 0, 0); m.filter = 'blur(1.2px)'; m.drawImage(c, 0, 0); m.restore();
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

  /* ── 꼭대기 별 ──
     예전 별은 금색 별 위에 연한 별을 겹친 두 겹이라 클립아트 같았다. 참고 그림처럼
     꼭지를 둥글게 하고, 가운데에서 꼭지로 가는 능선을 따라 열 개의 면을 밝고 어둡게
     나눠 도톰한 입체로 칠한다. 빛은 왼쪽 위에서 온다.
     반짝이는 섬광과 둘레 빛은 화면(tree.html)이 이 위에 따로 얹는다. */
  {
    const CX = 50, CY = STAR.y, RO = STAR.ro, RI = STAR.ri;
    const c = mk(), x = c.getContext('2d');
    x.scale(SCALE, SCALE);
    const pt = (k, r) => { const a = (-90 + k * 36) * Math.PI / 180; return [CX + r * Math.cos(a), CY + r * Math.sin(a)]; };
    const outline = new Path2D();
    for (let k = 0; k < 10; k++) {
      const [px, py] = pt(k, k % 2 ? RI : RO * 0.93);
      k ? outline.lineTo(px, py) : outline.moveTo(px, py);
    }
    outline.closePath();
    // 둥근 꼭지: 같은 별을 굵은 둥근 선으로 한 번 더 그어 부풀린다
    x.fillStyle = '#f2b93b'; x.strokeStyle = '#f2b93b';
    x.lineJoin = 'round'; x.lineWidth = 1.5;
    x.fill(outline); x.stroke(outline);
    x.globalCompositeOperation = 'source-atop';
    const LIGHT = Math.atan2(-1, -0.7);   // 왼쪽 위
    for (let k = 0; k < 10; k++) {
      const [ax, ay] = pt(k, k % 2 ? RI : RO * 1.2);
      const [bx, by] = pt(k + 1, (k + 1) % 2 ? RI : RO * 1.2);
      const mid = Math.atan2((ay + by) / 2 - CY, (ax + bx) / 2 - CX);
      const lit = Math.cos(mid - LIGHT);             // 1이면 빛을 정면으로 받는 면
      x.fillStyle = lit > 0
        ? `rgba(255, 238, 170, ${(0.15 + lit * 0.55).toFixed(2)})`
        : `rgba(176, 104, 18, ${(0.12 - lit * 0.42).toFixed(2)})`;
      x.beginPath(); x.moveTo(CX, CY); x.lineTo(ax, ay); x.lineTo(bx, by); x.closePath(); x.fill();
    }
    // 가운데 둥근 빛과 테두리 쪽 따뜻한 그늘
    const hi = x.createRadialGradient(CX - 1.6, CY - 2, 0, CX - 1.6, CY - 2, 4.5);
    hi.addColorStop(0, 'rgba(255, 252, 230, .7)'); hi.addColorStop(1, 'rgba(255, 252, 230, 0)');
    x.fillStyle = hi; x.fillRect(CX - 10, CY - 10, 20, 20);
    x.save(); x.filter = `blur(${SCALE * 0.35}px)`;
    x.strokeStyle = 'rgba(190, 110, 20, .45)'; x.lineWidth = 0.9; x.lineJoin = 'round';
    x.stroke(outline); x.restore();
    x.setTransform(1, 0, 0, 1, 0, 0);
    grain(x, 12, 8);
    m.save(); m.setTransform(1, 0, 0, 1, 0, 0); m.filter = 'blur(0.7px)'; m.drawImage(c, 0, 0); m.restore();
  }

  return main.toDataURL('image/webp', 0.86);
}, { tiers, TRUNK, STAR, W: TREE.vbW, H: TREE.vbH, SCALE });
await browser.close();

fs.writeFileSync(OUT, Buffer.from(url.split(',')[1], 'base64'));
console.log(`${OUT} ${(fs.statSync(OUT).size / 1024).toFixed(0)}KB`);
