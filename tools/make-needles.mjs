/* 트리 가지 안쪽을 채울 침엽 질감을 만든다 (2026-11-24, 시안 ②).
   트리 윤곽은 tree-layout.js의 SVG 그대로 두고, 그 안쪽만 이 그림으로 덮는다.
   그래서 학생이 저장해 둔 자리(x, y)는 하나도 안 틀어진다.

   그림은 색이 없는 빛과 그늘뿐이다(투명 바탕에 짙은 획과 밝은 획). 색은 아래에 깔린
   단마다의 그러데이션이 낸다. 그래야 색을 바꿀 때 이 그림을 다시 만들 필요가 없다.

   이음매 없이 이어 붙는 타일이다. 획 하나를 가로세로로 한 칸씩 밀어 아홉 번 찍어서
   가장자리에서 잘린 획이 반대편에서 이어진다.

   나중에 Higgsfield 같은 도구로 만든 그림으로 바꿔도 된다. 조건은 둘이다:
   이음매 없는 타일일 것, 바탕이 투명하고 색이 거의 없을 것.

   실행: node tools/make-needles.mjs [나올파일]   (puppeteer의 크롬 canvas를 빌려 쓴다) */
import puppeteer from 'puppeteer';
import fs from 'fs';

const OUT = process.argv[2] || 'img/tree-needles.webp';

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const url = await page.evaluate(() => {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const x = c.getContext('2d');
  x.lineCap = 'round';

  // 고정 난수: 다시 만들어도 같은 그림이 나온다
  let seed = 20261124;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

  /* 잔가지 하나: 줄기에서 양옆으로 바늘잎이 앞쪽으로 비스듬히 난다.
     전나무 가지 끝은 아래로 처지므로 대부분 아래쪽(±55도)을 향하게 둔다. */
  function sprig(ox, oy, ang, len, style) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const strokes = [[ox, oy, ox + dx * len, oy + dy * len, style.stem]];
    for (let s = 6; s < len; s += 3.2 + rnd() * 1.6) {
      const px = ox + dx * s, py = oy + dy * s;
      const nl = style.needle * (0.75 + rnd() * 0.5) * (1 - 0.35 * s / len);
      for (const side of [-1, 1]) {
        const a = ang + side * (0.62 + rnd() * 0.25);
        strokes.push([px, py, px + Math.cos(a) * nl, py + Math.sin(a) * nl, style.w]);
      }
    }
    for (const ddx of [-S, 0, S]) for (const ddy of [-S, 0, S]) {
      for (const [x0, y0, x1, y1, w] of strokes) {
        x.lineWidth = w;
        x.beginPath(); x.moveTo(x0 + ddx, y0 + ddy); x.lineTo(x1 + ddx, y1 + ddy); x.stroke();
      }
    }
  }

  /* 세 겹으로 쌓는다. 뒤 겹은 짙은 그늘(가지 사이의 어둠), 앞으로 올수록 밝다.
     이 차이가 "잎이 겹겹이 있다"는 깊이를 만든다. */
  const LAYERS = [
    { n: 150, color: 'rgba(0, 26, 30, .42)',     len: [46, 80], needle: 15, w: 2.6, stem: 2.4 },
    { n: 170, color: 'rgba(0, 40, 40, .30)',     len: [40, 70], needle: 13, w: 1.9, stem: 1.8 },
    { n: 190, color: 'rgba(225, 255, 240, .15)', len: [34, 60], needle: 11, w: 1.4, stem: 1.3 },
    { n: 90,  color: 'rgba(240, 255, 245, .26)', len: [22, 40], needle: 8,  w: 1.1, stem: 1.0 },
  ];
  for (const L of LAYERS) {
    x.strokeStyle = L.color;
    for (let i = 0; i < L.n; i++) {
      const ang = Math.PI / 2 + (rnd() - 0.5) * 1.9;     // 아래를 중심으로 ±55도
      const len = L.len[0] + rnd() * (L.len[1] - L.len[0]);
      sprig(rnd() * S, rnd() * S, ang, len, { needle: L.needle, w: L.w, stem: L.stem });
    }
  }
  return c.toDataURL('image/webp', 0.8);
});
await browser.close();

fs.writeFileSync(OUT, Buffer.from(url.split(',')[1], 'base64'));
console.log(`${OUT} ${(fs.statSync(OUT).size / 1024).toFixed(0)}KB`);
