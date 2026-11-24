/* 오너먼트 10종을 수채화로 칠한 그림 한 장(가로로 이어 붙인 띠)을 만든다 (2026-11-24).

   트리를 수채화로 바꾸고 나니 매끈한 벡터 오너먼트가 칠한 가지 위에서 스티커처럼 떴다.
   그래서 트리(tools/make-tree-paint.mjs)와 **같은 붓**으로 칠한다.
     - 바탕: 왼쪽 위가 밝고 오른쪽 아래가 짙은 물감. 한 색으로 채우지 않는다.
     - 물감 번짐: 둥근 얼룩을 겹겹이(같은 색 안에서 조금씩 다른 색).
     - 도톰함: 실루엣을 비켜 찍어 생기는 틈만 칠한다. 오른쪽 아래 안쪽만 그늘, 왼쪽 위 안쪽만 빛.
       테두리를 한 바퀴 두르면 꼭대기 별에서 겪었듯 "도형 안에 도형"이 된다.
     - 하이라이트: 흰 타원을 또렷이 찍지 않는다. 물감을 덜 칠해 종이가 비친 것처럼 흐리게 띄운다.
     - 종이 결(픽셀 흔들기)과 얹을 때 살짝 번지게(blur).

   색은 민트, 청록 트리에 맞췄다. 따뜻한 색(산호 빨강, 금, 장미, 크림)이 가지 위에서 산다.
   선물 상자는 초록이면 가지에 묻혀서 베리색으로 바꿨다. 초록 방울은 이름이 초록이라
   짙은 숲 초록으로 두었다(밝은 민트 위에서 명도 차이로 산다).

   좌표는 ornaments.js와 같은 viewBox 64x80. 칸 하나 = 64*S x 80*S px.
   순서는 ornaments.js의 ORNAMENT_KEYS 그대로다(ornamentSVG가 칸 번호로 잘라 쓴다).

   실행: node tools/make-ornament-paint.mjs [나올파일]   (puppeteer의 크롬 canvas를 빌려 쓴다) */
import puppeteer from 'puppeteer';
import fs from 'fs';
import { ORNAMENT_KEYS, PAINT_SPRITE, PAINT_CELL } from '../ornaments.js';

const OUT = process.argv[2] || PAINT_SPRITE;
const S = PAINT_CELL / 64;   // viewBox 1칸 = S px

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const url = await page.evaluate(({ KEYS, S }) => {
  const W = 64, H = 80;
  let seed = 2412;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const mk = () => { const c = document.createElement('canvas'); c.width = W * S; c.height = H * S; return c; };
  const ctx = (c, scaled = true) => { const x = c.getContext('2d'); if (scaled) x.scale(S, S); return x; };

  /* 종이 결: 큰 얼룩(저주파)과 잔 알갱이(고주파)를 섞어 밝기를 흔든다. 트리와 같은 방식. */
  function grain(x, amt, big) {
    const c = x.canvas, img = x.getImageData(0, 0, c.width, c.height), p = img.data;
    const G = Math.round(S * 2), gw = Math.ceil(c.width / G) + 1, gh = Math.ceil(c.height / G) + 1;
    const low = Float32Array.from({ length: gw * gh }, () => rnd() - 0.5);
    for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) {
      const k = (y * c.width + xx) * 4;
      if (!p[k + 3]) continue;
      const gx = xx / G, gy = y / G, ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy;
      const l = low[iy * gw + ix] * (1 - fx) * (1 - fy) + low[iy * gw + ix + 1] * fx * (1 - fy)
              + low[(iy + 1) * gw + ix] * (1 - fx) * fy + low[(iy + 1) * gw + ix + 1] * fx * fy;
      const n = (rnd() - 0.5) * amt + l * big;
      p[k] += n; p[k + 1] += n; p[k + 2] += n;
    }
    x.putImageData(img, 0, 0);
  }

  /** 실루엣(검정) 한 장. draw(x)가 단위 좌표로 채우거나 긋는다. */
  function silhouette(draw) {
    const c = mk(), x = ctx(c);
    x.fillStyle = '#000'; x.strokeStyle = '#000'; x.lineJoin = 'round'; x.lineCap = 'round';
    draw(x);
    return c;
  }

  /** 실루엣을 (dx, dy)만큼 비켜 찍고 남는 틈만 color로 흐리게 칠한다(테가 한 바퀴 돌지 않는다). */
  function rimShade(x, sil, dx, dy, color, blurU) {
    const r = mk(), rx = ctx(r, false);
    rx.fillStyle = color; rx.fillRect(0, 0, r.width, r.height);
    rx.globalCompositeOperation = 'destination-out';
    rx.drawImage(sil, dx * S, dy * S);
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.filter = `blur(${S * blurU}px)`; x.drawImage(r, 0, 0); x.restore();
  }

  /** 둥근 물감 얼룩 하나 */
  function blot(x, cx, cy, r, rgb, a, squash = 1.25) {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(${rgb}, ${a})`);
    g.addColorStop(0.6, `rgba(${rgb}, ${a * 0.55})`);
    g.addColorStop(1, `rgba(${rgb}, 0)`);
    x.fillStyle = g;
    x.beginPath(); x.ellipse(cx, cy, r * squash, r, rnd() * Math.PI, 0, Math.PI * 2); x.fill();
  }

  /**
   * 실루엣 안을 수채화로 칠한 조각 하나를 돌려준다.
   * o.light: [cx, cy, r] 빛이 모이는 자리와 번지는 반지름(방사형 바탕)
   * o.stops: 바탕 색 [[0, 밝은색], [.., ..], [1, 짙은색]]
   * o.blots: [[rgb, 진하기, 개수, 최소r, 최대r]] — 실루엣 상자(o.box) 안에 흩는다
   * o.deco(x): 무늬. 바탕 위, 빛과 그늘 아래에 얹는다(무늬에도 빛이 걸려야 한다)
   * o.rim: [그늘색, 빛색]  o.lift: [x, y, rx, ry, 기울기] 종이가 비친 하이라이트
   */
  function paint(sil, o) {
    const c = mk(), x = ctx(c, false);
    x.drawImage(sil, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.scale(S, S);
    const [lx, ly, lr] = o.light;
    const g = x.createRadialGradient(lx, ly, 0, lx, ly, lr);
    o.stops.forEach(([at, col]) => g.addColorStop(at, col));
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    x.globalCompositeOperation = 'source-atop';
    const [bx0, by0, bx1, by1] = o.box;
    for (const [rgb, a, n, r0, r1] of o.blots || []) {
      for (let k = 0; k < n; k++) {
        blot(x, bx0 + rnd() * (bx1 - bx0), by0 + rnd() * (by1 - by0), r0 + rnd() * (r1 - r0), rgb, a);
      }
    }
    if (o.deco) { x.save(); o.deco(x); x.restore(); }

    const [shade, light] = o.rim || ['rgba(90, 20, 30, .45)', 'rgba(255, 246, 225, .55)'];
    rimShade(x, sil, -(o.rimW || 1.5), -(o.rimW || 1.5) * 1.15, shade, 1.1);
    rimShade(x, sil, 1.0, 1.15, light, 0.8);

    if (o.lift) {
      const [hx, hy, hrx, hry, rot = -0.5] = o.lift;
      x.save();
      x.filter = `blur(${S * 1.1}px)`;
      x.fillStyle = 'rgba(255, 251, 238, .55)';
      x.beginPath(); x.ellipse(hx, hy, hrx, hry, rot, 0, Math.PI * 2); x.fill();
      x.filter = `blur(${S * 0.45}px)`;
      x.fillStyle = 'rgba(255, 255, 250, .7)';
      x.beginPath(); x.ellipse(hx - hrx * 0.12, hy - hry * 0.1, hrx * 0.42, hry * 0.38, rot, 0, Math.PI * 2); x.fill();
      x.restore();
    }
    x.setTransform(1, 0, 0, 1, 0, 0);
    grain(x, 9, 9);
    return c;
  }

  /** 칠한 조각을 칸에 살짝 번지게 얹는다 */
  const lay = (cell, piece, blurPx = 0.6) => {
    const x = cell.getContext('2d');
    x.save(); x.filter = `blur(${blurPx}px)`; x.drawImage(piece, 0, 0); x.restore();
  };

  /** 뒤에 까는 둘레 빛(금빛 것들) */
  function halo(cell, cx, cy, r, rgb = '255, 214, 130', a = 0.32) {
    const x = ctx(cell);
    const g = x.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
    g.addColorStop(0, `rgba(${rgb}, ${a})`);
    g.addColorStop(0.55, `rgba(${rgb}, ${a * 0.35})`);
    g.addColorStop(1, `rgba(${rgb}, 0)`);
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    x.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** 가지에 걸리는 금빛 고리와 끈 */
  function hook(cell, col = '#d6b25e') {
    const p = mk(), x = ctx(p);
    x.lineCap = 'round';
    x.strokeStyle = col; x.lineWidth = 1.9;
    x.beginPath(); x.moveTo(32, 16.5); x.lineTo(32, 9.6); x.stroke();
    x.beginPath(); x.ellipse(32, 6.4, 4.0, 3.8, 0, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = 'rgba(255, 244, 205, .75)'; x.lineWidth = 0.7;
    x.beginPath(); x.ellipse(31.6, 6.0, 3.6, 3.3, 0, Math.PI * 0.95, Math.PI * 1.6); x.stroke();
    x.strokeStyle = 'rgba(120, 80, 20, .45)'; x.lineWidth = 0.8;
    x.beginPath(); x.ellipse(32.3, 6.7, 3.9, 3.7, 0, Math.PI * 0.05, Math.PI * 0.6); x.stroke();
    lay(cell, p, 0.5);
  }

  const GOLD = { stops: [[0, '#fff0b0'], [0.3, '#f6cf63'], [0.7, '#e2a537'], [1, '#b97a1c']],
                 rim: ['rgba(150, 80, 5, .55)', 'rgba(255, 250, 215, .7)'] };

  /** 방울과 종 머리에 끼우는 금빛 마개 */
  function cap(cell) {
    const sil = silhouette(x => { x.beginPath(); x.roundRect(26, 14, 12, 14, 2.5); x.fill(); });
    lay(cell, paint(sil, {
      ...GOLD, light: [28, 15, 14], box: [26, 14, 38, 28], rimW: 0.7,
      deco: x => {
        x.strokeStyle = 'rgba(160, 100, 20, .45)'; x.lineWidth = 0.6;
        for (const xx of [29.5, 32, 34.5]) { x.beginPath(); x.moveTo(xx, 14.5); x.lineTo(xx, 27); x.stroke(); }
      },
    }), 0.4);
  }

  function starPts(cx, cy, ro, ri) {
    const pts = [];
    for (let k = 0; k < 10; k++) {
      const a = (-90 + k * 36) * Math.PI / 180, r = k % 2 ? ri : ro;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return pts;
  }
  const starPath2D = (cx, cy, ro, ri) => {
    const p = new Path2D();
    starPts(cx, cy, ro, ri).forEach(([px, py], k) => (k ? p.lineTo(px, py) : p.moveTo(px, py)));
    p.closePath();
    return p;
  };

  // 둥근 방울: 마개, 고리, 몸통을 차례로
  const BALL = x => { x.beginPath(); x.arc(32, 50, 23, 0, Math.PI * 2); x.fill(); };
  function ball(cell, o) {
    hook(cell); cap(cell);
    lay(cell, paint(silhouette(BALL), { light: [23, 39, 38], box: [9, 27, 55, 73], lift: [22.5, 38.5, 6.2, 4.0, -0.5], ...o }));
  }

  // 물감으로 그은 선(조금씩 흔들리게 두 번 긋는다)
  function wobbly(x, d, col, w) {
    x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'round'; x.lineJoin = 'round';
    x.stroke(new Path2D(d));
    x.save(); x.translate(0.25, 0.3); x.globalAlpha = 0.35; x.lineWidth = w * 0.7; x.stroke(new Path2D(d)); x.restore();
  }

  const PAINTERS = {
    ball_red(cell) {
      ball(cell, {
        stops: [[0, '#f59a82'], [0.35, '#e25d55'], [0.75, '#c23c45'], [1, '#8f2735']],
        blots: [['180, 40, 60', 0.30, 9, 4, 9], ['245, 130, 100', 0.25, 6, 3, 7], ['120, 30, 60', 0.22, 4, 4, 8]],
        rim: ['rgba(90, 15, 35, .5)', 'rgba(255, 220, 200, .5)'],
        deco: x => {
          x.filter = `blur(${S * 0.18}px)`;
          wobbly(x, 'M6 44q5.1 5.5 10.2 0t10.3 0 10.2 0 10.3 0 10.2 0', 'rgba(252, 238, 205, .9)', 3);
          wobbly(x, 'M8 52.5q12 3.2 24 3.2t24 -3.2', 'rgba(242, 198, 96, .75)', 1.3);
          wobbly(x, 'M9 36.5q11.5 -2.6 23 -2.6t23 2.6', 'rgba(242, 198, 96, .7)', 1.2);
        },
      });
    },
    ball_green(cell) {
      ball(cell, {
        stops: [[0, '#7cc3a1'], [0.35, '#3f8f72'], [0.75, '#286d5b'], [1, '#174845']],
        blots: [['30, 90, 110', 0.30, 8, 4, 9], ['90, 170, 130', 0.22, 6, 3, 7], ['20, 60, 80', 0.25, 4, 4, 8]],
        rim: ['rgba(8, 35, 40, .55)', 'rgba(220, 255, 235, .45)'],
        deco: x => {
          x.filter = `blur(${S * 0.15}px)`;
          const dots = [[24, 57, 2.7], [34.5, 62, 2.3], [43, 54, 2.7], [38.5, 44, 2.3], [26.5, 48.5, 2.1],
                        [16.5, 51, 1.6], [47.5, 64.5, 1.6], [31, 70, 1.4], [49, 44, 1.5]];
          for (const [cx, cy, r] of dots) {
            x.fillStyle = 'rgba(252, 240, 205, .95)';
            x.beginPath(); x.ellipse(cx, cy, r * 1.05, r, rnd(), 0, Math.PI * 2); x.fill();
            x.fillStyle = 'rgba(232, 186, 80, .5)';
            x.beginPath(); x.ellipse(cx + r * 0.3, cy + r * 0.35, r * 0.6, r * 0.5, 0, 0, Math.PI * 2); x.fill();
          }
        },
      });
    },
    ball_gold(cell) {
      halo(cell, 32, 50, 31);
      ball(cell, {
        ...GOLD,
        blots: [['230, 160, 40', 0.28, 8, 4, 9], ['255, 230, 140', 0.25, 6, 3, 7], ['190, 110, 20', 0.22, 4, 4, 8]],
        deco: x => {
          x.filter = `blur(${S * 0.2}px)`;
          x.fillStyle = 'rgba(255, 249, 228, .92)';
          x.strokeStyle = 'rgba(255, 249, 228, .92)'; x.lineWidth = 1.6; x.lineJoin = 'round';
          const st = starPath2D(32, 52.5, 9.4, 4.3);
          x.fill(st); x.stroke(st);
          x.fillStyle = 'rgba(225, 160, 50, .35)';
          x.fill(starPath2D(33, 53.6, 5, 2.3));
        },
      });
    },
    star(cell) {
      halo(cell, 32, 48, 31, '255, 214, 120', 0.36);
      hook(cell, '#d9b04c');
      const CX = 32, CY = 48, RO = 23, RI = 10.6;
      const sil = silhouette(x => { const p = starPath2D(CX, CY, RO, RI); x.lineWidth = 4; x.fill(p); x.stroke(p); });
      lay(cell, paint(sil, {
        light: [24, 36, 40], box: [8, 24, 56, 72],
        stops: [[0, '#fff1a8'], [0.3, '#f8cf58'], [0.7, '#eaa733'], [1, '#c47e1a']],
        blots: [['230, 160, 40', 0.22, 6, 3, 7], ['255, 236, 160', 0.22, 5, 3, 6]],
        rim: ['rgba(165, 88, 8, .55)', 'rgba(255, 250, 215, .75)'], rimW: 1.8,
        deco: x => {
          // 가운데에서 꼭지로 가는 능선: 빛을 받는 면과 등진 면을 아주 옅게 나눈다
          x.filter = `blur(${S * 0.45}px)`;
          const LIGHT = Math.atan2(-1, -0.7);
          const pts = starPts(CX, CY, RO * 1.2, RI);
          for (let k = 0; k < 10; k++) {
            const [ax, ay] = pts[k], [bx, by] = pts[(k + 1) % 10];
            const lit = Math.cos(Math.atan2((ay + by) / 2 - CY, (ax + bx) / 2 - CX) - LIGHT);
            x.fillStyle = lit > 0 ? `rgba(255, 244, 200, ${(lit * 0.3).toFixed(2)})`
                                  : `rgba(170, 95, 10, ${(-lit * 0.26).toFixed(2)})`;
            x.beginPath(); x.moveTo(CX, CY); x.lineTo(ax, ay); x.lineTo(bx, by); x.closePath(); x.fill();
          }
        },
        lift: [28.5, 34, 1.6, 5.2, 0.32],
      }));
    },
    bell(cell) {
      halo(cell, 32, 46, 30);
      hook(cell, '#d0a540');
      // 추: 종 밑으로 살짝 나온다
      lay(cell, paint(silhouette(x => { x.beginPath(); x.arc(32, 65.5, 5.2, 0, Math.PI * 2); x.fill(); }),
        { ...GOLD, light: [30, 63, 8], box: [27, 60, 37, 71], rimW: 0.9 }));
      cap(cell);
      const BELL = 'M32 21c-8.5 0-11.8 6-12.4 14.2C19 44 16.2 50 12.8 53.4h38.4C47.8 50 45 44 44.4 35.2 43.8 27 40.5 21 32 21Z';
      const sil = silhouette(x => { x.fill(new Path2D(BELL)); x.beginPath(); x.roundRect(11, 51.5, 42, 8.5, 4.2); x.fill(); });
      lay(cell, paint(sil, {
        ...GOLD, light: [24, 30, 36], box: [11, 21, 53, 60],
        blots: [['230, 160, 40', 0.25, 7, 3, 7], ['255, 232, 150', 0.22, 5, 3, 6]],
        deco: x => {
          // 밑자락 테: 조금 짙게
          x.filter = `blur(${S * 0.25}px)`;
          x.fillStyle = 'rgba(190, 120, 25, .35)';
          x.beginPath(); x.roundRect(11, 52, 42, 7.5, 3.8); x.fill();
          // 빨간 리본 띠와 작은 매듭
          x.filter = `blur(${S * 0.15}px)`;
          wobbly(x, 'M21 26.5q11 5 22 0', 'rgba(214, 70, 72, .95)', 3.4);
          x.fillStyle = 'rgba(190, 45, 55, .95)';
          x.beginPath(); x.ellipse(27.4, 29.2, 3.4, 2.1, 0.5, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.ellipse(36.6, 29.2, 3.4, 2.1, -0.5, 0, Math.PI * 2); x.fill();
          x.fillStyle = 'rgba(170, 35, 50, 1)';
          x.beginPath(); x.arc(32, 29.4, 1.9, 0, Math.PI * 2); x.fill();
        },
        lift: [24.5, 34, 3.2, 6.5, -0.2],
      }));
    },
    sock(cell) {
      hook(cell);
      const SOCK = 'M21.5 28h20v18c0 2.6 1.3 4 3.8 5.1l7.2 3.3c4.6 2.1 5.4 7.9 1.3 10.8-3.3 2.3-7.4 1.6-10.6-.5l-16-10.4c-3.6-2.3-5.7-5.7-5.7-10.1V28Z';
      lay(cell, paint(silhouette(x => x.fill(new Path2D(SOCK))), {
        light: [26, 34, 36], box: [21, 28, 56, 68],
        stops: [[0, '#f28a7a'], [0.35, '#df5652'], [0.75, '#bf3a44'], [1, '#8a2433']],
        blots: [['180, 40, 60', 0.28, 8, 3, 7], ['245, 130, 100', 0.22, 5, 3, 6]],
        rim: ['rgba(90, 15, 35, .5)', 'rgba(255, 220, 200, .5)'],
        deco: x => {
          x.filter = `blur(${S * 0.2}px)`;
          // 발끝과 뒤꿈치에 덧댄 크림색 천
          x.fillStyle = 'rgba(250, 238, 210, .95)';
          x.beginPath(); x.ellipse(52, 61, 6.8, 6, -0.5, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.ellipse(22, 50, 4.4, 5.4, 0.3, 0, Math.PI * 2); x.fill();
          // 줄무늬 두 줄
          wobbly(x, 'M22.5 37.5h18.5', 'rgba(250, 238, 210, .9)', 2.8);
          wobbly(x, 'M22.5 43h18.5', 'rgba(240, 196, 92, .8)', 1.4);
        },
        lift: [26, 35, 2.6, 5.5, -0.15],
      }));
      // 복슬복슬한 목: 둥근 덩이를 이어 붙인 크림색 띠
      const cuff = silhouette(x => {
        x.beginPath(); x.roundRect(18, 18.5, 27, 10.5, 4); x.fill();
        for (let k = 0; k <= 6; k++) { x.beginPath(); x.arc(18.8 + k * 4.25, 28.6 + (k % 2) * 0.5, 2.2, 0, Math.PI * 2); x.fill(); }
        for (let k = 0; k <= 6; k++) { x.beginPath(); x.arc(18.8 + k * 4.25, 18.9 - (k % 2) * 0.4, 1.8, 0, Math.PI * 2); x.fill(); }
      });
      lay(cell, paint(cuff, {
        light: [22, 19, 26], box: [17, 17, 46, 31],
        stops: [[0, '#fffdf6'], [0.5, '#f5ebd6'], [1, '#d6c3a4']],
        blots: [['215, 200, 175', 0.25, 8, 1.5, 3.5]],
        rim: ['rgba(120, 95, 70, .4)', 'rgba(255, 255, 255, .6)'], rimW: 1.0,
      }));
    },
    candy(cell) {
      // 지팡이는 스스로 가지에 걸리므로 고리를 달지 않는다.
      const CANE = new Path2D('M22 73V39a11 11 0 0 1 22 0');
      const sil = silhouette(x => { x.lineWidth = 11.5; x.stroke(CANE); });
      lay(cell, paint(sil, {
        light: [26, 30, 50], box: [16, 28, 50, 79],
        stops: [[0, '#fffdf7'], [0.5, '#f7eedd'], [1, '#d8c7ad']],
        rim: ['rgba(120, 40, 50, .45)', 'rgba(255, 255, 255, .6)'], rimW: 1.3,
        deco: x => {
          // 비스듬한 빨간 줄. 점선으로 끊은 것보다 손으로 칠한 사탕처럼 보인다.
          x.filter = `blur(${S * 0.2}px)`;
          x.translate(32, 50); x.rotate(-0.62);
          for (let k = -8; k <= 8; k++) {
            x.fillStyle = k % 2 ? 'rgba(215, 66, 74, .93)' : 'rgba(200, 50, 64, .9)';
            x.beginPath(); x.roundRect(-40, k * 6.4 - 1.7, 80, 3.6, 1.6); x.fill();
          }
          x.fillStyle = 'rgba(120, 190, 150, .55)';   // 가는 초록 줄 하나씩
          for (let k = -8; k <= 8; k += 2) { x.beginPath(); x.roundRect(-40, k * 6.4 + 2.4, 80, 0.8, 0.4); x.fill(); }
        },
        lift: [19.6, 52, 1.5, 9, 0],
      }));
    },
    gift(cell) {
      hook(cell);
      const BERRY = {
        stops: [[0, '#d27a92'], [0.35, '#b04c6c'], [0.75, '#8a3354'], [1, '#5e1f3b']],
        blots: [['130, 40, 80', 0.28, 7, 3, 7], ['220, 120, 140', 0.2, 5, 3, 6]],
        rim: ['rgba(50, 10, 30, .5)', 'rgba(255, 220, 230, .45)'],
      };
      const ribbon = (x, y0, y1) => {
        x.filter = `blur(${S * 0.15}px)`;
        x.fillStyle = 'rgba(244, 196, 88, .97)';
        x.fillRect(28, y0, 8, y1 - y0);
        x.fillStyle = 'rgba(255, 240, 180, .55)'; x.fillRect(28.6, y0, 2, y1 - y0);
        x.fillStyle = 'rgba(170, 105, 20, .4)'; x.fillRect(34.4, y0, 1.6, y1 - y0);
      };
      lay(cell, paint(silhouette(x => { x.beginPath(); x.roundRect(15, 38, 34, 31, 3); x.fill(); }), {
        ...BERRY, light: [20, 42, 40], box: [15, 38, 49, 69],
        deco: x => {
          ribbon(x, 38, 69);
          x.fillStyle = 'rgba(244, 196, 88, .97)'; x.fillRect(15, 50.5, 34, 6.5);
          x.fillStyle = 'rgba(255, 240, 180, .5)'; x.fillRect(15, 51, 34, 1.6);
          x.fillStyle = 'rgba(170, 105, 20, .35)'; x.fillRect(15, 55.5, 34, 1.5);
        },
        lift: [21, 44, 3, 3.6, -0.4],
      }));
      lay(cell, paint(silhouette(x => { x.beginPath(); x.roundRect(11, 28, 42, 11, 3); x.fill(); }), {
        ...BERRY, light: [16, 29, 44], box: [11, 28, 53, 39],
        stops: [[0, '#dc8aa0'], [0.35, '#bb5878'], [0.75, '#95395c'], [1, '#6a2543']],
        deco: x => ribbon(x, 28, 39),
        rimW: 1.0, lift: [17, 31, 4, 1.4, 0],
      }));
      // 나비 리본
      const BOW = 'M30 28C24 28 18 26 15.5 23c-2-2.4.3-5.3 3.4-4.3C22.8 19.9 27 23.4 30 28Z'
                + 'M34 28C40 28 46 26 48.5 23c2-2.4-.3-5.3-3.4-4.3C41.2 19.9 37 23.4 34 28Z';
      lay(cell, paint(silhouette(x => { x.fill(new Path2D(BOW)); x.beginPath(); x.arc(32, 26.8, 3.4, 0, Math.PI * 2); x.fill(); }), {
        ...GOLD, light: [20, 20, 30], box: [14, 18, 50, 30], rimW: 0.9,
        deco: x => {
          x.strokeStyle = 'rgba(170, 105, 20, .45)'; x.lineWidth = 0.6;
          x.stroke(new Path2D('M29 27.2C24 26 20 24 17.8 21.6M35 27.2C40 26 44 24 46.2 21.6'));
        },
      }));
    },
    snow(cell) {
      halo(cell, 32, 48, 30, '220, 240, 255', 0.22);
      hook(cell, '#cfe3f0');
      const arms = x => {
        for (let i = 0; i < 6; i++) {
          x.save(); x.translate(32, 48); x.rotate(i * Math.PI / 3); x.translate(-32, -48);
          x.stroke(new Path2D('M32 48V20M25.8 21.2 32 27.4l6.2-6.2M26.3 30.8 32 36.6l5.7-5.8'));
          x.restore();
        }
        x.beginPath(); x.arc(32, 48, 3.8, 0, Math.PI * 2); x.fill();
      };
      // 푸른 그늘을 아래 오른쪽으로 비켜 깐다. 흰 눈송이가 밝은 민트 가지 위에서도 떠 보인다.
      const sh = silhouette(x => { x.lineWidth = 4.2; arms(x); });
      const shc = mk(), sx = ctx(shc, false);
      sx.drawImage(sh, 0, 0); sx.globalCompositeOperation = 'source-in';
      sx.fillStyle = 'rgba(52, 92, 170, .55)'; sx.fillRect(0, 0, shc.width, shc.height);
      const cx = cell.getContext('2d');
      cx.save(); cx.filter = `blur(${S * 0.9}px)`; cx.drawImage(shc, S * 0.7, S * 1.0); cx.restore();

      const sil = silhouette(x => { x.lineWidth = 3.3; arms(x); });
      lay(cell, paint(sil, {
        light: [24, 36, 40], box: [4, 20, 60, 76],
        stops: [[0, '#ffffff'], [0.45, '#eef7ff'], [1, '#b9d3ef']],
        blots: [['170, 205, 240', 0.3, 10, 2, 5]],
        rim: ['rgba(60, 100, 170, .45)', 'rgba(255, 255, 255, .7)'], rimW: 0.8,
      }), 0.45);
    },
    heart(cell) {
      hook(cell, '#d9b04c');
      const HEART = 'M32 74S9 58.5 9 40.5C9 32 15.6 25.6 23.4 25.6c4 0 7 1.7 8.6 4.2 1.6-2.5 4.6-4.2 8.6-4.2C48.4 25.6 55 32 55 40.5 55 58.5 32 74 32 74Z';
      lay(cell, paint(silhouette(x => x.fill(new Path2D(HEART))), {
        light: [21, 35, 42], box: [9, 25, 55, 74],
        stops: [[0, '#fbc3cc'], [0.3, '#ef8ea4'], [0.7, '#d9668a'], [1, '#a7426b']],
        blots: [['220, 90, 130', 0.25, 8, 3, 8], ['255, 190, 200', 0.25, 6, 3, 7], ['170, 60, 110', 0.2, 4, 4, 8]],
        rim: ['rgba(110, 20, 60, .45)', 'rgba(255, 235, 240, .6)'],
        lift: [21.5, 37, 4.8, 3.2, -0.55],
      }));
    },
  };

  const sheet = document.createElement('canvas');
  sheet.width = W * S * KEYS.length; sheet.height = H * S;
  const sx = sheet.getContext('2d');
  KEYS.forEach((key, i) => {
    if (!PAINTERS[key]) throw new Error(`칠하는 법이 없는 오너먼트: ${key}`);
    const cell = mk();
    PAINTERS[key](cell);
    sx.drawImage(cell, i * W * S, 0);
  });
  return sheet.toDataURL('image/webp', 0.88);
}, { KEYS: ORNAMENT_KEYS, S });
await browser.close();

fs.writeFileSync(OUT, Buffer.from(url.split(',')[1], 'base64'));
console.log(`${OUT} ${(fs.statSync(OUT).size / 1024).toFixed(0)}KB`);
