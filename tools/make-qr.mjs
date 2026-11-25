/* 학생 작성 화면(index.html) 주소의 QR 그림 한 장을 만든다 (2026-11-25).
   전시용 트리(tree.html) 제목 아래에 붙여 두고 학생들이 폰으로 찍어 들어온다.

   그림으로 미리 만들어 두는 이유: 축제 당일 화면에서 QR 만드는 라이브러리를
   따로 내려받다 실패하면 부스가 멈춘다. 주소는 바뀌지 않으니 한 번 만들어 둔다.
   **주소가 바뀌면 이 스크립트를 다시 돌려야 한다.**

   실행: node tools/make-qr.mjs [주소] [나올파일]   (puppeteer의 크롬을 빌려 쓴다) */
import puppeteer from 'puppeteer';
import fs from 'fs';

const URL = process.argv[2] || 'https://hoseong911.github.io/xmas/';
const OUT = process.argv[3] || 'img/qr-index.svg';
const QUIET = 4;   // QR 규격이 요구하는 흰 여백(모듈 4칸). 모자라면 안 읽힌다.

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto('about:blank');
await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js' });

const { n, dark } = await page.evaluate((url) => {
  const qr = qrcode(0, 'M');          // 자동 크기, 오류정정 M
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount();
  const dark = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) dark.push([c, r]);
  return { n, dark };
}, URL);
await browser.close();

const size = n + QUIET * 2;
const d = dark.map(([x, y]) => `M${x + QUIET} ${y + QUIET}h1v1h-1z`).join('');
fs.writeFileSync(OUT,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
  `<rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#0a1622"/></svg>\n`);
console.log(`${OUT} <- ${URL}  (${n}x${n} 모듈)`);
