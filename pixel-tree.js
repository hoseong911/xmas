/* ════════════════════════════════════════════════════════════════
   큰 트리의 픽셀 버전.

   전시 화면(tree.html)에서 [픽셀 트리]를 누르면 같은 트리가 네모 블록으로
   다시 그려진다. 오너먼트도 같이 픽셀로 바뀐다.

   **가장 중요한 것: 그림이 달라져도 거는 자리는 그대로여야 한다.**
   학생이 찍어 둔 x, y는 문서에 저장돼 있고 보기를 바꿨다고 움직이면 안 된다.
   그래서 블록을 멋대로 쌓지 않고 **원래 트리의 윤곽(tree-layout.js의 tierHalfAt)을
   그대로 찍어 낸다.** 같은 좌표계(가로 100, 세로 130) 위에서 칸마다 "여기가 가지
   안쪽인가"를 물어보는 식이라, 두 보기의 실루엣이 어긋날 수가 없다.

   오너먼트는 새로 그리지 않는다. **있는 그림을 작은 캔버스에 한 번 줄여 그린 뒤
   다시 키운다**(image-rendering: pixelated). 열 가지를 손으로 다시 찍는 것보다
   빠르고, 색이 저절로 원본과 같다.
   ════════════════════════════════════════════════════════════════ */
import { TIERS, TREE, tierHalfAt } from './tree-layout.js';
import { ORNAMENT_KEYS, ornamentSVG, ornamentDefsMarkup } from './ornaments.js';

/** 블록 한 칸의 크기(트리 좌표). 작을수록 곱고, 클수록 옛날 게임 같다. */
export const BLOCK = 2.6;

const TRUNK = ['#6b4a2e', '#80593a'];
const SNOW  = '#e8f6ff';
const STAR  = ['#f7d479', '#fff6d8'];

/** 단 하나가 그 높이에서 차지하는 반쪽 너비 */
function halfOf(t, y) {
  if (y < t.apexY) return 0;
  const r = t.half / t.scallops;
  if (y > t.baseY + r) return 0;
  const span = Math.min(y, t.baseY) - t.apexY;
  return (span / (t.baseY - t.apexY)) * t.half;
}

/** 그 높이가 어느 단에 속하는가(가장 넓은 단을 고른다 — tierHalfAt와 같은 규칙) */
function tierAt(y) {
  let best = -1, w = 0;
  TIERS.forEach((t, i) => {
    const ww = halfOf(t, y);
    if (ww > w) { w = ww; best = i; }
  });
  return best;
}

/* 꼭대기 별. 블록으로 찍은 다섯 꼭지. */
const STAR_ROWS = [
  '....#....',
  '...###...',
  '#########',
  '.#######.',
  '..#####..',
  '..##.##..',
  '.##...##.',   // 다리는 윗줄과 한 칸씩 붙여 둔다(떨어뜨리면 블록이 둥둥 뜬다)
];

/**
 * 픽셀 트리를 SVG 조각(문자열)으로 만든다. tree.html의 <g id="treeArt">에 넣는다.
 * 블록은 `shape-rendering="crispEdges"`로 그려야 가장자리가 흐려지지 않는다.
 */
export function pixelTreeMarkup() {
  const out = [];
  const B = BLOCK;
  const rect = (x, y, fill, w = B, h = B) =>
    out.push(`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="${fill}"/>`);

  // ── 가지 ──────────────────────────────────────────────────────
  const top = TIERS[0].apexY;
  const bot = TREE.baseY + TIERS[3].half / TIERS[3].scallops;
  const cols = Math.ceil(100 / B);
  for (let y = top; y < bot; y += B) {
    const cy = y + B / 2;
    const ti = tierAt(cy);
    if (ti < 0) continue;
    const half = tierHalfAt(cy);
    if (half < B * 0.35) continue;
    const t = TIERS[ti];
    for (let c = 0; c < cols; c++) {
      const x = c * B;
      const cx = x + B / 2;
      const d = Math.abs(cx - 50);
      if (d > half) continue;
      /* 왼쪽 가장자리는 밝게, 오른쪽 가장자리는 어둡게 — 한 칸씩만 바꿔도
         평평한 덩어리가 아니라 입체로 읽힌다. */
      const edge = d > half - B;
      let fill = t.fill;
      if (edge && cx > 50) fill = t.shade;
      else if (edge && cx < 50) fill = lighten(t.fill, 0.14);
      /* 단의 밑자락에 눈이 걸린다 — 다만 **아래 단에 덮이지 않고 드러난 턱에만**.
         줄 전체를 하얗게 칠했더니 트리를 가로지르는 흰 띠가 되어 층층이 쌓은
         케이크처럼 보였다. 드러난 데만 칠해야 가지에 눈이 앉은 것으로 읽힌다. */
      if (cy > t.baseY - B) {
        const under = ti < TIERS.length - 1 ? halfOf(TIERS[ti + 1], cy) : 0;
        if (d > under + B * 0.2) fill = SNOW;
      }
      rect(x, y, fill);
    }
  }

  // ── 기둥 ──────────────────────────────────────────────────────
  const tx = Math.round((50 - B) / B) * B;
  for (let y = TREE.baseY; y < TREE.baseY + B * 2; y += B) {
    rect(tx, y, TRUNK[1]);
    rect(tx + B, y, TRUNK[0]);
  }

  /* ── 바닥에 쌓인 눈 ──────────────────────────────────────────
     가로로 꽉 찬 네모로 두면 상자 위에 트리를 올려놓은 것처럼 보인다.
     아래로 갈수록 넓어지는 두 줄로 두어 둔덕처럼 보이게 한다. */
  const groundY = TREE.baseY + B * 2;
  [[13, '#eef9ff'], [22, '#dceaf7'], [31, '#c3d9ea']].forEach(([halfW, col], i) => {
    for (let c = 0; c < cols; c++) {
      const cx = c * B + B / 2;
      if (Math.abs(cx - 50) > halfW) continue;
      rect(c * B, groundY + i * B, col);
    }
  });

  // ── 꼭대기 별 ─────────────────────────────────────────────────
  const sb = B * 1.15;                                  // 별은 블록을 조금 크게
  const sx = 50 - (STAR_ROWS[0].length * sb) / 2;
  const sy = 11 - (STAR_ROWS.length * sb) / 2;
  STAR_ROWS.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch !== '#') return;
      rect(sx + c * sb, sy + r * sb, r < 2 || (r === 2 && c > 2 && c < 6) ? STAR[1] : STAR[0], sb, sb);
    });
  });

  return out.join('');
}

/** 색을 조금 밝게 (가장자리 한 칸에만 쓴다) */
function lighten(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.min(255, Math.round(v + (255 - v) * amt));
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)]
    .map(v => v.toString(16).padStart(2, '0')).join('');
}

/* ════════════════════════════════════════════════════════════════
   오너먼트 픽셀로 바꾸기

   있는 그림을 작은 캔버스에 줄여 그린다. 줄일 때는 부드럽게(평균 내기), 키울 때는
   `image-rendering: pixelated`로 네모를 살린다. 열 가지를 손으로 다시 찍는 것보다
   빠르고 색이 저절로 원본과 같다.

   그림 안의 빛 그라데이션은 문서에 따로 붙어 있는 <defs>를 가리키므로
   **데이터 주소로 떼어 낼 때 defs를 같이 넣어 줘야 한다** — 안 넣으면 색이 빠진다.
   ════════════════════════════════════════════════════════════════ */

/* 오너먼트 한 개를 몇 칸으로 줄일 것인가. 칸이 많으면 그냥 흐린 그림이 되고,
   적으면 뭘 달았는지 알 수 없다. 11x14가 "네모로 보이면서 알아볼 수 있는" 선이었다. */
const PX_W = 11, PX_H = 14;
const cache = new Map();

function standalone(key) {
  return ornamentSVG(key, 64)
    .replace(/^<svg /, '<svg xmlns="http://www.w3.org/2000/svg" ')
    .replace('>', '>' + ornamentDefsMarkup());
}

function shrink(key) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = PX_W; c.height = PX_H;
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = true;      // 줄일 때는 평균을 내야 색이 안 튄다
      x.drawImage(img, 0, 0, PX_W, PX_H);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => resolve('');       // 못 만들면 원래 그림을 쓴다
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(standalone(key));
  });
}

/** 열 가지를 미리 다 만들어 둔다. 보기를 바꾸기 전에 한 번 부른다. */
export async function preparePixelOrnaments() {
  if (cache.size) return;
  const urls = await Promise.all(ORNAMENT_KEYS.map(shrink));
  ORNAMENT_KEYS.forEach((k, i) => { if (urls[i]) cache.set(k, urls[i]); });
}

/** 픽셀 오너먼트 한 개. 아직 안 만들어졌으면 원래 그림을 돌려준다. */
export function pixelOrnamentHTML(key) {
  const url = cache.get(key);
  if (!url) return ornamentSVG(key, 64);
  return `<img class="xm-pxorn" src="${url}" alt="" draggable="false">`;
}
