/* ════════════════════════════════════════════════════════════════
   트리에 오너먼트를 어디에 걸지 정하는 계산.

   화면 코드와 떼어 둔 이유는 두 가지다 — 눈으로 확인하기 어려운 셈이라
   테스트(test/xmas.test.mjs)로 묶어 두고 싶었고, 트리 그림(tree.html의 <svg>)과
   좌표계를 반드시 같이 맞춰야 해서 한 곳에 숫자를 모아 두는 편이 안전하다.

   좌표는 전부 트리 그림과 같은 viewBox 단위다(가로 100, 세로 140).
   화면에서는 그대로 퍼센트로 쓴다 — 담는 칸의 가로세로 비율이 100:140이라
   x 단위 = 가로 %, y 단위 = 세로의 (y/140*100) %가 된다.

   세로는 2026-11-16에 130에서 140으로 늘렸다. 맨 아래 가지 밑으로 12만 남아 있어
   기둥이 물결에 거의 가려졌다. 가지와 거는 자리는 그대로 두고 아래에 자리만 더 냈다.
   저장된 자리(x, y)는 viewBox 단위라 이것과 상관없이 같은 데 걸린다.
   ════════════════════════════════════════════════════════════════ */

// 트리 그림이 차지하는 범위. 아래 TIERS에서 뽑아낸 값이라 둘이 어긋날 수 없다.
export const TREE = {
  vbW: 100,
  vbH: 140,
  apexY: 14,     // 맨 위 가지 꼭대기(그 위는 별 자리)
  baseY: 118,    // 맨 아래 가지의 밑단
  baseHalf: 40,  // 맨 아래 가지의 반쪽 너비
  inset: 0.80,   // 가장자리에서 이만큼 안쪽에만 건다(가지 밖으로 비어져 나오지 않게)
  firstRowY: 26, // 첫 줄 높이(꼭대기 별과 겹치지 않게 조금 내린다)
  minRows: 6,
  maxRows: 34,   // 칸 629개. 그보다 많으면 앞 칸부터 다시 쓴다(겹쳐 달린다).
};

/** 줄이 rows개일 때 걸 수 있는 자리 수 — r번째 줄에 r+2칸 */
export function slotCapacity(rows) {
  return rows * (rows + 3) / 2;
}

/** 편지 n통을 담으려면 몇 줄이 필요한가 */
export function rowsFor(n) {
  let rows = TREE.minRows;
  while (rows < TREE.maxRows && slotCapacity(rows) < n) rows++;
  return rows;
}

/** 칸 번호 → 몇 번째 줄의 몇 번째인지 */
export function slotIndex(i, rows) {
  const cap = slotCapacity(rows);
  let k = ((i % cap) + cap) % cap;   // 자리보다 많으면 앞에서부터 다시 쓴다
  let row = 0;
  while (k >= row + 2) { k -= row + 2; row++; }
  return { row, col: k, cols: row + 2 };
}

/** 칸 간격을 정하는 기준 너비. 오너먼트 자체 크기가 아니다(그건 ORN_W). */
export function slotPitch(rows) {
  const bottomCols = rows + 1;
  const spread = 2 * TREE.baseHalf * TREE.inset;
  return (spread / bottomCols) * 1.15;
}

/** 줄 간격(viewBox 단위) */
export function rowGap(rows) {
  return (TREE.baseY - TREE.firstRowY) / Math.max(1, rows - 1);
}

/** 그 높이에서 트리의 반쪽 너비 */
export function halfWidthAt(y) {
  const t = (y - TREE.apexY) / (TREE.baseY - TREE.apexY);
  return Math.max(0, Math.min(1, t)) * TREE.baseHalf * TREE.inset;
}

/** 문자열에서 늘 같은 0~1 값을 뽑는다 — 새로고침해도 오너먼트가 제자리에 있게 */
export function hash01(str, salt = 0) {
  let h = (2166136261 ^ salt) >>> 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * 편지 id 목록(걸린 순서대로)을 받아 자리를 정한다.
 * @returns [{ id, x, y, w }]  x,y,w 는 viewBox 단위
 */
export function layout(ids) {
  const n = ids.length;
  const rows = rowsFor(n);
  const gap = rowGap(rows);
  return ids.map((id, i) => {
    const { row, col, cols } = slotIndex(i, rows);
    const baseY = TREE.firstRowY + row * gap;
    const half = halfWidthAt(baseY);
    const baseX = 50 + (((col + 0.5) / cols) * 2 - 1) * half;
    // 격자 티가 안 나게 살짝 흔들어 둔다. 흔들림도 id에서 나오므로 늘 같은 자리다.
    // 흔드는 폭은 트리 너비가 아니라 **칸 간격**에 맞춘다 — 트리 너비에 맞추면
    // 아래 줄처럼 칸이 촘촘한 데서 옆칸까지 넘어가 오너먼트가 서로 포개진다.
    const pitch = (2 * half) / cols;
    const x = baseX + (hash01(id, 1) - 0.5) * pitch * 0.3;
    const y = baseY + (hash01(id, 2) - 0.5) * gap * 0.34;
    return { id, x, y, w: ORN_W };
  });
}

/* ════════════════════════════════════════════════════════════════
   트리 그림

   인스타에서 유행한 트리 편지 서비스들의 트리를 참고했다. 뾰족한 삼각형
   세 개가 아니라, **밑단이 둥글게 물결치는 가지가 네 단** 겹쳐 있고 색은
   민트에서 청록으로 내려간다. 그려 보니 이 물결(scallop)이 분위기의 거의
   전부였다 — 삼각형으로 두면 아무리 색을 바꿔도 종이 공작 같아 보인다.

   그림을 여기 둔 까닭: 오너먼트를 거는 자리(위 TREE 상수)와 그림이 어긋나면
   오너먼트가 가지 밖 허공에 뜬다. 한 파일에 있으면 어긋날 수가 없다.
   ════════════════════════════════════════════════════════════════ */

/** 가지 네 단. 위에서 아래로 넓어지고 짙어진다. top/bottom은 한 단 안의 위아래 색이다. */
export const TIERS = [
  { apexY: 14, baseY: 44,  half: 15, scallops: 3, top: '#8FE6D6', bottom: '#5CC6B8' },
  { apexY: 26, baseY: 70,  half: 24, scallops: 4, top: '#72D4C4', bottom: '#43ABA3' },
  { apexY: 46, baseY: 96,  half: 32, scallops: 5, top: '#57BDB2', bottom: '#33918F' },
  { apexY: 66, baseY: 118, half: 40, scallops: 6, top: '#3FA29F', bottom: '#246F72' },
];

/* 가지 모양을 정하는 값 (2026-11-16에 다시 다듬었다).
   예전에는 옆선을 크게 부풀리고 물결을 반원으로 깊게 팠더니, 단마다 물방울이나
   젤리처럼 보였고 맨 위 단은 양파 모양이 됐다. 밑단은 치마 프릴 같았다.
   - BULGE: 옆선이 직선에서 바깥으로 나오는 거리. 아주 조금만 둔다. 0이면 각이 서서
     종이 공작 같고, 크게 두면 다시 젤리가 된다.
   - FLAT:  물결의 세로/가로 비율. 1이면 반원이다. 얕은 타원이라야 가지 끝으로 읽힌다. */
export const BULGE = 1.6;
export const FLAT = 0.55;

/** 기둥: 위끝은 맨 아래 가지 속에 묻히고, 아래끝은 바닥 눈 더미에 묻힌다 */
export const TRUNK = { topY: 112, groundY: 134, half: 5 };

/** 단마다 전구 줄이 걸리는 높이: [왼쪽 끝 y, 오른쪽 끝 y, 처지는 정도] */
const SWAGS = [[30, 38, 3], [52, 62, 4], [74, 86, 5], [97, 108, 6]];

/**
 * 가지 한 단의 윤곽선.
 * 꼭대기에서 왼쪽 아래로 거의 곧게 내려와, 밑단을 얕은 타원 여러 개로 물결치며
 * 오른쪽 끝까지 간 뒤, 다시 꼭대기로 돌아온다.
 * @param {object} t TIERS의 한 칸
 * @param {number} dy 아래로 밀 거리(그림자 사본을 만들 때 쓴다)
 * @param {number} flat 물결 깊이. 수채화 그림(tools/make-tree-paint.mjs)만 조금 더 깊게 쓴다.
 *   거는 자리 셈(tierHalfAt)은 늘 FLAT 그대로다.
 */
export function tierPath(t, dy = 0, flat = FLAT) {
  const cx = 50;
  const topY = t.apexY + dy;
  const botY = t.baseY + dy;
  const h = botY - topY;
  const rx = t.half / t.scallops;       // 물결 하나의 가로 반지름
  const ry = rx * flat;
  /* 옆선의 제어점은 꼭대기와 밑끝을 잇는 직선의 한가운데에서 **바깥쪽 법선 방향으로**
     BULGE만큼 민 자리다. 직선 위에 두면 아무 일도 안 일어나고(예전에 0.60/0.58이 그랬다),
     법선 방향으로 밀어야 단의 크기와 상관없이 같은 정도로 부푼다. */
  const len = Math.hypot(t.half, h);
  const ox = (h / len) * BULGE;
  const oy = (t.half / len) * BULGE;
  const qy = (topY + h / 2 - oy).toFixed(2);
  const qlx = (cx - t.half / 2 - ox).toFixed(2);
  const qrx = (cx + t.half / 2 + ox).toFixed(2);

  let d = `M${cx} ${topY}`;
  d += `Q${qlx} ${qy} ${(cx - t.half).toFixed(2)} ${botY.toFixed(2)}`;
  // sweep-flag 0 이라야 아래로 볼록한 물결이 된다(1이면 위로 파인다).
  for (let i = 0; i < t.scallops; i++) {
    d += `a${rx.toFixed(3)} ${ry.toFixed(3)} 0 0 0 ${(rx * 2).toFixed(3)} 0`;
  }
  d += `Q${qrx} ${qy} ${cx} ${topY}`;
  d += 'Z';
  return d;
}

/**
 * 가지 전체를 SVG 문자열로 만든다. 전시 트리(tree.html)와 자리 고르기 트리(index.html)가
 * 같이 쓴다. 두 화면의 트리가 따로 놀면 학생이 고른 자리와 전시 화면이 달라 보인다.
 *
 * 지킨 것:
 * - **그림자는 바로 아래 단 안쪽에서만 보이게 오려 낸다**(clipPath). 예전에는 단을 조금
 *   아래로 민 짙은 사본을 그대로 깔았더니 가지 옆으로 삐져나와, 밤하늘 위에서 스티커
 *   외곽선처럼 보였다. 맨 아래 단은 드리울 데가 없으므로 그림자가 없다.
 * - 단마다 위가 밝고 아래가 짙은 그러데이션, 그 위에 왼쪽에서 비치는 빛을 한 겹 더 얹는다.
 *   한 색으로 칠하면 납작한 색종이가 된다.
 * - 전구는 흩어진 점이 아니라 **단마다 비스듬히 늘어진 줄**로 건다. 흩어 두면 얼룩으로
 *   보인다. 알은 작게 둔다(크게 두면 진주 목걸이가 된다).
 * - id는 트리가 화면에 하나뿐이라 써도 된다(오너먼트와 다르다). 그래도 `xt` 접두사를 붙인다.
 *
 * @param {{lights?: boolean, needles?: boolean}} opt
 *   lights: 전구 줄을 그릴지
 *   needles: 시안 ②(2026-11-24). 가지 안쪽을 침엽 질감 그림으로 덮고 가장자리에 바늘잎을 단다.
 *            윤곽은 그대로라 거는 자리와 저장된 자리는 바뀌지 않는다. 주소에 ?art=needle 일 때만 켠다.
 */
export function treeArtSVG({ lights = true, needles = false, paint = false } = {}) {
  if (paint) return paintedTreeSVG({ lights });
  const n = TIERS.length;
  let defs = '';
  let body = '';

  if (needles) {
    /* 질감 타일(tools/make-needles.mjs가 만든다). 단마다 타일을 조금씩 밀어 둔다.
       같은 자리에서 시작하면 네 단의 무늬가 위아래로 줄을 맞춰 벽지처럼 보인다. */
    for (let i = 0; i < n; i++) {
      defs += `<pattern id="xtNeedle${i}" patternUnits="userSpaceOnUse" width="${NEEDLE_TILE}" height="${NEEDLE_TILE}"`
        + ` patternTransform="translate(${(i * 7.3).toFixed(1)} ${(i * 4.1).toFixed(1)})">`
        + `<image href="${NEEDLE_IMG}" width="${NEEDLE_TILE}" height="${NEEDLE_TILE}"/></pattern>`;
    }
  }

  // 왼쪽에서 비치는 빛과 오른쪽 그늘
  defs += '<linearGradient id="xtSide" x1="0" y1="0" x2="1" y2="0">'
    + '<stop offset="0" stop-color="#fff" stop-opacity=".14"/>'
    + '<stop offset=".45" stop-color="#fff" stop-opacity="0"/>'
    + '<stop offset=".6" stop-color="#000" stop-opacity="0"/>'
    + '<stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>';

  /* 바닥과 기둥 (2026-11-16 "밑동이 거의 안 보인다").
     예전 기둥은 viewBox 맨 아래(130)까지 자리가 없어 물결 밑으로 3 남짓만 보였다.
     viewBox를 140으로 늘리고 기둥을 바닥 눈 속까지 내렸다. 맨 아래 단은 그림자를 드리울
     단이 없으므로 기둥 윗부분에 그늘을 따로 깐다(가지 밑에서 나온 것처럼 보이게).
     바닥 눈은 가로 띠가 아니라 타원이다. 띠는 트리 칸 가장자리에서 네모로 잘린다. */
  defs += '<linearGradient id="xtBark" x1="0" y1="0" x2="1" y2="0">'
    + '<stop offset="0" stop-color="#9a6a42"/><stop offset=".45" stop-color="#7a5232"/>'
    + '<stop offset="1" stop-color="#4f3420"/></linearGradient>';
  defs += '<linearGradient id="xtBarkShade" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0" stop-color="#1a0f08" stop-opacity=".7"/>'
    + '<stop offset=".45" stop-color="#1a0f08" stop-opacity="0"/></linearGradient>';
  body += `<ellipse cx="50" cy="${TRUNK.groundY + 1}" rx="44" ry="4.6" fill="#dceaf7" opacity=".09"/>`;
  body += `<rect x="${50 - TRUNK.half}" y="${TRUNK.topY}" width="${TRUNK.half * 2}" height="${TRUNK.groundY - TRUNK.topY}" rx="1.4" fill="url(#xtBark)"/>`;
  body += `<rect x="${50 - TRUNK.half}" y="${TRUNK.topY}" width="${TRUNK.half * 2}" height="${TRUNK.groundY - TRUNK.topY}" fill="url(#xtBarkShade)"/>`;
  // 기둥 밑을 덮는 눈 더미
  body += `<ellipse cx="50" cy="${TRUNK.groundY}" rx="${TRUNK.half * 2.6}" ry="2.4" fill="#dceaf7" opacity=".42"/>`;
  body += `<ellipse cx="48.5" cy="${TRUNK.groundY - 0.6}" rx="${TRUNK.half * 1.5}" ry="1.2" fill="#eef6fd" opacity=".3"/>`;

  // 아래 단부터 그린다. 그래야 위 단의 물결진 밑자락이 아래 단을 덮으며 층이 겹쳐 보인다.
  for (let i = n - 1; i >= 0; i--) {
    const t = TIERS[i];
    defs += `<linearGradient id="xtT${i}" x1="0" y1="0" x2="0" y2="1">`
      + `<stop offset="0" stop-color="${t.top}"/><stop offset="1" stop-color="${t.bottom}"/></linearGradient>`;
    if (i < n - 1) {
      defs += `<clipPath id="xtClip${i}"><path d="${tierPath(TIERS[i + 1])}"/></clipPath>`;
      body += `<path d="${tierPath(t, 2.4)}" fill="#0f4a4c" fill-opacity=".45" clip-path="url(#xtClip${i})"/>`;
    }
    if (needles) body += edgeNeedles(t, i);
    body += `<path d="${tierPath(t)}" fill="url(#xtT${i})"/>`;
    if (needles) body += `<path d="${tierPath(t)}" fill="url(#xtNeedle${i})"/>`;
    body += `<path d="${tierPath(t)}" fill="url(#xtSide)"/>`;
  }

  if (lights) {
    defs += '<radialGradient id="xtBulb">'
      + '<stop offset="0" stop-color="#fff6d8"/>'
      + '<stop offset=".35" stop-color="#ffd77a" stop-opacity=".55"/>'
      + '<stop offset="1" stop-color="#ffb84a" stop-opacity="0"/></radialGradient>';
    // 알은 세 무리로 나눠 둔다. 전시 화면이 무리마다 다른 박자로 숨 쉬게 한다(.xt-l0~2).
    const groups = ['', '', ''];
    TIERS.forEach((t, k) => {
      const [yl, yr, sag] = SWAGS[k];
      const half = y => ((y - t.apexY) / (t.baseY - t.apexY)) * t.half * 0.97;
      const x0 = 50 - half(yl), x1 = 50 + half(yr);
      const mx = (x0 + x1) / 2, my = (yl + yr) / 2 + sag * 2;
      body += `<path d="M${x0.toFixed(2)} ${yl}Q${mx.toFixed(2)} ${my} ${x1.toFixed(2)} ${yr}" fill="none" stroke="#f1d48a" stroke-width=".35" stroke-opacity=".55"/>`;
      const N = 9 + k * 4;
      for (let j = 0; j <= N; j++) {
        const u = j / N, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
        const x = (a * x0 + b * mx + c * x1).toFixed(2);
        const y = (a * yl + b * my + c * yr).toFixed(2);
        groups[(j + k) % 3] += `<circle cx="${x}" cy="${y}" r="1.25" fill="url(#xtBulb)"/>`
          + `<circle cx="${x}" cy="${y}" r=".42" fill="#fff4cf"/>`;
      }
    });
    body += groups.map((g, i) => `<g class="xt-l${i}">${g}</g>`).join('');
  }

  return `<defs>${defs}</defs>${body}`;
}

/* ── 시안 ② 수채화 (2026-11-24) ─────────────────────────────────
   선생님이 보여 주신 참고 그림처럼 물감으로 칠한 트리. 가지와 기둥은 그림 한 장
   (tools/make-tree-paint.mjs가 tierPath 윤곽 그대로 칠한다)이고, 그 위에 반짝이만
   SVG로 얹는다. 반짝이는 전구 줄처럼 세 무리(.xt-l0~2)로 나눠 화면이 박자를 어긋나게 숨 쉬게 한다.
   주소에 ?art=paint 일 때만 켠다. */
export const PAINT_IMG = 'img/tree-paint.webp';

/** 반짝이 자리: [x, y, 크기]. 난수로 두면 새로고침마다 바뀌어 어수선하므로 정해 둔다. */
const SPARKLES = [
  [50, 22, 1.1], [44, 33, 1.3], [56, 38, 0.9],
  [40, 50, 1.2], [58, 47, 1.4], [49, 60, 1.0], [33, 64, 1.1], [65, 63, 1.2],
  [42, 74, 1.3], [57, 78, 1.0], [27, 86, 1.2], [70, 84, 1.4], [49, 90, 1.1],
  [36, 99, 1.0], [62, 98, 1.3], [20, 108, 1.2], [46, 108, 1.4], [77, 107, 1.1],
  [31, 115, 1.0], [66, 116, 1.2],
];

/** 네 갈래 반짝이: 가운데로 오목하게 모이는 별 */
function sparklePath(x, y, r) {
  const q = (dx, dy) => `Q${x} ${y} ${(x + dx).toFixed(2)} ${(y + dy).toFixed(2)}`;
  return `M${x} ${(y - r).toFixed(2)}${q(r, 0)}${q(0, r)}${q(-r, 0)}${q(0, -r)}Z`;
}

function paintedTreeSVG({ lights = true } = {}) {
  let defs = '', body = '';
  // 바닥 눈(기둥 그림 밑에 깔린다)
  body += `<ellipse cx="50" cy="${TRUNK.groundY + 1}" rx="44" ry="4.6" fill="#dceaf7" opacity=".09"/>`;
  body += `<image href="${PAINT_IMG}" x="0" y="0" width="${TREE.vbW}" height="${TREE.vbH}"/>`;
  // 기둥 밑을 덮는 눈 더미
  body += `<ellipse cx="50" cy="${TRUNK.groundY}" rx="${TRUNK.half * 2.6}" ry="2.4" fill="#dceaf7" opacity=".42"/>`;
  body += `<ellipse cx="48.5" cy="${TRUNK.groundY - 0.6}" rx="${TRUNK.half * 1.5}" ry="1.2" fill="#eef6fd" opacity=".3"/>`;

  if (lights) {
    defs += '<radialGradient id="xtGlow">'
      + '<stop offset="0" stop-color="#fffbe6" stop-opacity=".95"/>'
      + '<stop offset=".3" stop-color="#fff0b0" stop-opacity=".45"/>'
      + '<stop offset="1" stop-color="#ffe08a" stop-opacity="0"/></radialGradient>';
    const groups = ['', '', ''];
    SPARKLES.forEach(([x, y, s], k) => {
      groups[k % 3] += `<circle cx="${x}" cy="${y}" r="${(s * 3.4).toFixed(2)}" fill="url(#xtGlow)"/>`
        + `<path d="${sparklePath(x, y, s * 1.5)}" fill="#ffffff"/>`;
    });
    body += groups.map((g, i) => `<g class="xt-l${i}">${g}</g>`).join('');
  }
  return `<defs>${defs}</defs>${body}`;
}

/* ── 시안 ②: 침엽 질감 (2026-11-24) ─────────────────────────────
   "트리가 후져 보인다"의 가장 큰 까닭은 가지 끝이 매끈한 물결이라 레이스 치마로
   읽히는 것이었다. 윤곽은 거는 자리와 한 몸이라 못 바꾸므로, 윤곽 바깥으로
   바늘잎을 짧게 삐죽삐죽 내밀어 매끈한 선을 깬다. 바늘잎은 그림일 뿐이고
   onTree(), clampSpot()은 여전히 tierPath 윤곽으로 셈한다. */
export const NEEDLE_IMG = 'img/tree-needles.webp';
export const NEEDLE_TILE = 18;   // 타일 한 장이 차지하는 viewBox 너비

/** 단 하나의 가장자리(옆선 둘, 물결진 밑단)에 바늘잎을 단다. 단 본체보다 먼저 그려 밑에 깔린다. */
function edgeNeedles(t, i) {
  const cx = 50, topY = t.apexY, botY = t.baseY, h = botY - topY;
  const rx = t.half / t.scallops, ry = rx * FLAT;
  const pts = [];   // [x, y, 바깥쪽 방향 x, y]

  // 밑단 물결: 타원 아래 반쪽을 따라간다
  for (let s = 0; s < t.scallops; s++) {
    const ecx = cx - t.half + rx * (2 * s + 1);
    const m = Math.max(4, Math.round(rx * 1.7));
    for (let j = 0; j <= m; j++) {
      const ph = Math.PI * (j + 0.5 * hash01(`${i}e${s}`, j)) / (m + 0.5);
      const px = ecx - rx * Math.cos(ph), py = botY + ry * Math.sin(ph);
      // 타원의 바깥 법선에 아래쪽을 섞는다(처진 가지 끝)
      let nx = -Math.cos(ph) / rx, ny = Math.sin(ph) / ry;
      const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
      pts.push([px, py, nx * 0.6, ny * 0.6 + 0.55]);
    }
  }
  // 옆선: 꼭대기에서 밑끝까지(거의 직선이다)
  const m = Math.round(h / 1.6);
  for (let j = 2; j < m; j++) {
    const u = j / m, py = topY + h * u, half = t.half * u;
    for (const side of [-1, 1]) pts.push([cx + side * half, py, side * 0.75, 0.66]);
  }

  /* 고르게 늘어놓으면 양탄자 술처럼 보인다(첫 시안이 그랬다). 그래서 자리마다
     바늘 두 개를 엇갈리게(잔가지 끝처럼) 달고, 길이와 각도를 크게 흔들고, 몇 군데는 비운다. */
  let dark = '', light = '';
  pts.forEach(([px, py, dx, dy], k) => {
    const r = j => hash01(`${i}n${k}`, j);
    if (r(0) < 0.22) return;
    const l = Math.hypot(dx, dy);
    const base = Math.atan2(dy / l, dx / l) + (r(1) - 0.5) * 1.1;
    const sx = px + (r(5) - 0.5) * 0.8, sy = py + (r(6) - 0.5) * 0.5;
    [[-0.32, r(2)], [0.3, r(3)]].forEach(([da, rl], q) => {
      const a = base + da, len = 0.5 + rl * rl * 2.4;
      const x0 = sx - Math.cos(a) * 0.8, y0 = sy - Math.sin(a) * 0.8;   // 윤곽 조금 안쪽에서 시작
      const seg = `M${x0.toFixed(2)} ${y0.toFixed(2)}l${(Math.cos(a) * len).toFixed(2)} ${(Math.sin(a) * len).toFixed(2)}`;
      if (r(4 + q * 3) < 0.7) dark += seg; else light += seg;
    });
  });
  return `<path d="${dark}" stroke="${t.bottom}" stroke-width=".42" stroke-linecap="round" fill="none"/>`
    + `<path d="${dark}" stroke="#062a2c" stroke-opacity=".35" stroke-width=".42" stroke-linecap="round" fill="none"/>`
    + `<path d="${light}" stroke="${t.top}" stroke-width=".34" stroke-linecap="round" fill="none"/>`;
}

/** 꼭대기 별 — 꼭지 다섯 개 */
export function starPath(cx, cy, ro, ri) {
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const ao = (-90 + i * 72) * Math.PI / 180;
    const ai = (-54 + i * 72) * Math.PI / 180;
    pts.push(`${(cx + ro * Math.cos(ao)).toFixed(2)} ${(cy + ro * Math.sin(ao)).toFixed(2)}`);
    pts.push(`${(cx + ri * Math.cos(ai)).toFixed(2)} ${(cy + ri * Math.sin(ai)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

/** 그 높이에서 트리 그림이 실제로 차지하는 반쪽 너비(가장 넓은 가지 기준) */
export function tierHalfAt(y) {
  let w = 0;
  for (const t of TIERS) {
    if (y < t.apexY) continue;
    // 밑단 아래로는 물결이 반지름만큼 더 내려와 있다
    const r = (t.half / t.scallops) * FLAT;
    if (y > t.baseY + r) continue;
    const span = Math.min(y, t.baseY) - t.apexY;
    w = Math.max(w, (span / (t.baseY - t.apexY)) * t.half);
  }
  return w;
}

/* ════════════════════════════════════════════════════════════════
   학생이 자리를 고른다 (2026-11-05)

   예전에는 걸린 차례대로 칸을 나눠 주고, 편지가 늘면 줄을 늘리며 오너먼트를
   줄였다. 편지 180통이면 오너먼트가 트리 폭의 3.5%까지 작아져 뭘 달았는지
   알아보기 어려웠다.

   지금은 **학생이 직접 찍은 자리(x, y)를 문서에 저장한다.** 그래서
     · 오너먼트 크기를 편지 수와 무관하게 큼직한 한 값(ORN_W)으로 고정할 수 있고,
     · 편지가 늘어도 남의 오너먼트가 움직이지 않는다("내가 저기 달았어"가 지켜진다).
   대신 트리가 아주 빽빽해지면 서로 겹친다 — 자리를 고르게 한 이상 피할 수 없고,
   잔뜩 꾸민 진짜 트리처럼 보여서 그대로 두기로 했다.

   자리가 없던 시절의 문서(x, y가 없는 것)는 예전처럼 layout()이 자리를 잡아 준다.
   ════════════════════════════════════════════════════════════════ */

/**
 * 오너먼트 너비(viewBox 단위).
 *
 * 7에서 5.4로 줄였다(2026-11-11). 160통쯤 모인 트리를 미리 보니 오너먼트가
 * 서로 닿아 "장식을 단 트리"가 아니라 "구슬로 덮인 트리"로 보였다. 대신 트리
 * 자체를 화면 가득 키웠으므로 오너먼트 하나가 눈에 보이는 크기는 거의 그대로고,
 * **사이의 빈 가지만 늘어난다.** 크기를 줄이는 쪽만 하면 멀리서 안 보이고,
 * 트리만 키우면 빽빽한 것이 그대로 커진다 — 둘은 같이 움직여야 한다.
 */
export const ORN_W = 5.4;

/** 오너먼트 높이 — 그림이 64x80 비율이다 */
export function ornHeight(w = ORN_W) { return w * 80 / 64; }

/** 가지 위인가 (가장자리에 살짝 걸치는 것까지는 봐준다) */
export function onTree(x, y, w = ORN_W) {
  if (y < TREE.firstRowY - 1 || y > TREE.baseY + 1) return false;
  return Math.abs(x - 50) <= tierHalfAt(y) - w * 0.2;
}

/** 찍은 자리를 가지 안으로 끌어다 놓는다 */
export function clampSpot(x, y, w = ORN_W) {
  const yy = Math.min(TREE.baseY, Math.max(TREE.firstRowY, y));
  // 가장자리에 조금 걸치는 건 자연스러우므로 폭의 20%까지 내보낸다
  const room = Math.max(0, tierHalfAt(yy) - w * 0.2);
  const xx = Math.min(50 + room, Math.max(50 - room, x));
  return { x: xx, y: yy };
}

/**
 * 찍은 자리가 이미 걸린 오너먼트와 너무 겹치면 가까운 빈자리로 밀어 준다.
 *
 * **멀리 밀지 않는 것이 중요하다.** 빈자리를 끝까지 찾아 주게 두었더니 빽빽한
 * 트리에서는 찍은 데서 트리 폭의 4분의 1만큼 날아가, 학생이 보기엔 엉뚱한 데
 * 달린 것이 된다. 자리를 고르게 한 뜻이 사라진다. 그래서 오너먼트 하나 반만큼만
 * 찾아보고, 그 안에 빈 데가 없으면 찍은 자리에 그냥 겹쳐 단다.
 * 막으려던 것은 "똑같은 자리에 완전히 포개지는 것"뿐이다.
 *
 * @param {{x:number,y:number}[]} taken 이미 걸린 자리들
 */
export function nudgeFree(x, y, taken, w = ORN_W) {
  const near = w * 0.62;                 // 이보다 가까우면 겹친 것으로 본다
  const maxPush = w * 1.4;               // 밀어 줄 수 있는 가장 먼 거리
  const free = (px, py) => !taken.some(t =>
    Math.hypot((t.x || 0) - px, (t.y || 0) - py) < near);

  const spot = clampSpot(x, y, w);
  if (free(spot.x, spot.y)) return spot;

  for (let r = near * 0.8; r <= maxPush; r += near * 0.45) {
    // 반지름마다 각도를 틀어 늘 같은 방향으로만 밀리지 않게 한다
    const turn = r * 1.7;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + turn;
      const c = clampSpot(x + Math.cos(a) * r, y + Math.sin(a) * r, w);
      if (free(c.x, c.y)) return c;
    }
  }
  return spot;
}

/**
 * "아무 데나 달아 주세요"용 자리. 빈 곳 가운데 하나를 고른다.
 * seed가 같으면 늘 같은 자리가 나오므로 화면을 새로고침해도 흔들리지 않는다.
 */
export function autoSpot(taken, seed = '', w = ORN_W) {
  const rows = TREE.maxRows > 16 ? 16 : TREE.maxRows;   // 칸 152개면 넉넉하다
  const gap = rowGap(rows);
  const cand = [];
  for (let i = 0; i < slotCapacity(rows); i++) {
    const { row, col, cols } = slotIndex(i, rows);
    const by = TREE.firstRowY + row * gap;
    const half = halfWidthAt(by);
    cand.push(clampSpot(50 + (((col + 0.5) / cols) * 2 - 1) * half, by, w));
  }
  // seed로 고른 자리부터 한 바퀴 돌며 처음 만나는 빈 곳을 쓴다
  const start = Math.floor(hash01(seed, 9) * cand.length);
  const near = w * 0.62;
  for (let k = 0; k < cand.length; k++) {
    const c = cand[(start + k) % cand.length];
    if (!taken.some(t => Math.hypot((t.x || 0) - c.x, (t.y || 0) - c.y) < near)) return c;
  }
  return nudgeFree(cand[start].x, cand[start].y, taken, w);
}

/**
 * 트리에 걸 것들의 자리를 정한다.
 * 학생이 고른 자리(x, y)가 있으면 그대로 쓰고, 없는 것만 예전 방식으로 채운다.
 * @param {{id:string, x?:number, y?:number}[]} items 걸린 순서대로
 */
export function placeAll(items) {
  const legacy = items.filter(it => !Number.isFinite(it.x) || !Number.isFinite(it.y));
  const fallback = new Map(layout(legacy.map(it => it.id)).map(p => [p.id, p]));
  return items.map(it => {
    if (Number.isFinite(it.x) && Number.isFinite(it.y)) {
      const c = clampSpot(it.x, it.y);
      return { id: it.id, x: c.x, y: c.y, w: ORN_W };
    }
    return fallback.get(it.id);
  });
}
