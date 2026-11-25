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
export function layout(ids, w = ORN_W) {
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
    return { id, x, y, w };
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
/* 맨 바깥 물결이 옆선 방향으로 뻗는 길이(0~1). 1이면 옆선과 완전히 같은 길이로 밀어
   날개처럼 길게 뻗는다. 줄여도 **방향**은 그대로라 꼭지점은 여전히 안 꺾인다. */
export const TIP_REACH = 0.45;

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
  /* 물결 하나를 반타원(호) 대신 3차 곡선으로 긋는다 (2026-11-24).
     호로 그으면 양끝에서 선이 수직으로 서기 때문에, 물결과 물결이 만나는 자리가
     바늘처럼 뾰족한 각이 됐다 — 동그라미를 일직선에 붙여 놓은 꼴이라 "도형 같다".
     곡선이 수평으로 들어와 수평으로 나가면 이음매에 각이 아예 생기지 않는다.
     깊이는 그대로다(3차 곡선은 제어점 높이의 0.75만큼 내려가므로 4/3을 곱한다).

     맨 바깥 물결의 바깥쪽 끝은 따로 잡는다. 거기서 옆 대각선과 밑단이 만나는데,
     방향이 다르면 꼭지점이 꺾여 파워포인트 도형처럼 보인다. 그래서 **옆선이 내려오던
     그 방향 그대로** 제어점을 둔다(`ux, uy`). 그러면 꺾이는 각이 0이 되어 대각선이
     물결로 그냥 흘러 들어간다. 바깥 물결이 단 너비보다 1 남짓 바깥으로 나가며
     끝이 아래로 처지는데, 실제 전나무 가지 끝이 그렇다. 거는 자리는 이보다 안쪽
     (TREE.inset)이라 오너먼트가 비어져 나올 일은 없다.
     방향만 맞추고 **미는 거리는 TIP_REACH로 줄인다**. 끝까지(1.0) 밀면 각은 없지만
     바깥 물결이 박쥐 날개처럼 길게 뻗는다. 줄여도 방향은 그대로라 각은 여전히 0이다. */
  const sl = Math.hypot(t.half / 2 - ox, h / 2 + oy);
  const ux = (t.half / 2 - ox) / sl;      // 옆선이 밑단에 닿을 때의 방향(단위벡터)
  const uy = (h / 2 + oy) / sl;
  const a = TIP_REACH * 2.25 * ry;        // 바깥쪽 제어점을 그 방향으로 민 거리(세로분)
  const ax = ((a / uy) * ux).toFixed(3);  // 같은 방향을 지키는 가로분
  const ay = a.toFixed(3);
  // 바깥 물결의 안쪽 제어점. 바깥쪽을 짧게 민 만큼 여기서 채워 깊이를 ry로 맞춘다.
  const b = Math.max(0, ry * 8 / 3 - a).toFixed(3);
  const k = (ry * 4 / 3).toFixed(3);      // 가운데 물결의 제어점 높이
  const w = (rx * 2).toFixed(3);
  for (let i = 0; i < t.scallops; i++) {
    const first = i === 0, last = i === t.scallops - 1;
    const c1 = first ? `-${ax} ${ay}` : `${(rx * 2 / 3).toFixed(3)} ${last ? b : k}`;
    const c2 = last ? `${(rx * 2 + Number(ax)).toFixed(3)} ${ay}`
                    : `${(rx * 4 / 3).toFixed(3)} ${first ? b : k}`;
    d += `c${c1} ${c2} ${w} 0`;
  }
  d += `Q${qrx} ${qy} ${cx} ${topY}`;
  d += 'Z';
  return d;
}

/* 전구 줄 — 기하 시안(?art=svg)의 가지에 건다.
   알을 흩어 두면 얼룩으로 보인다. 단마다 비스듬히 늘어진 줄에 꿰어야 전구로 읽힌다.
   (수채화 시안은 이것 대신 꼭대기 별과 같은 빛줄기를 쓴다 — glintLights) */
function swagLights() {
  let defs = '<radialGradient id="xtBulb">'
    + '<stop offset="0" stop-color="#fff6d8"/>'
    + '<stop offset=".35" stop-color="#ffd77a" stop-opacity=".55"/>'
    + '<stop offset="1" stop-color="#ffb84a" stop-opacity="0"/></radialGradient>';
  let body = '';
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
  return { defs, body };
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
 * @param {{lights?: boolean, paint?: boolean}} opt
 *   lights: 전구 줄을 그릴지
 *   paint: 수채화 그림을 쓸지. 두 화면 모두 기본으로 켠다(`?art=svg` 면 끄고 여기서 그린다).
 */
export function treeArtSVG({ lights = true, paint = false } = {}) {
  if (paint) return paintedTreeSVG({ lights });
  const n = TIERS.length;
  let defs = '';
  let body = '';

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
    body += `<path d="${tierPath(t)}" fill="url(#xtT${i})"/>`;
    body += `<path d="${tierPath(t)}" fill="url(#xtSide)"/>`;
  }

  if (lights) {
    const L = swagLights();
    defs += L.defs; body += L.body;
  }

  return `<defs>${defs}</defs>${body}`;
}

/* ── 시안 ② 수채화 (2026-11-24) ─────────────────────────────────
   선생님이 보여 주신 참고 그림처럼 물감으로 칠한 트리. 가지와 기둥은 그림 한 장
   (tools/make-tree-paint.mjs가 tierPath 윤곽 그대로 칠한다)이고, 그 위에 반짝이만
   SVG로 얹는다. 반짝임은 꼭대기 별과 같은 빛줄기다(glintLights). 전구 줄(swagLights)은
   기하 시안(?art=svg)에만 남아 있다 — 물감 그림 위에서는 줄과 알이 도형으로 보였다.
   주소에 ?art=paint 일 때만 켠다. */
export const PAINT_IMG = 'img/tree-paint.webp';

function paintedTreeSVG({ lights = true } = {}) {
  let defs = '', body = '';
  /* 기둥, 눈 더미, 꼭대기 별까지 그림 안에 칠해 두었다. 매끈한 도형으로 따로 그리면
     수채화 트리 사이에서 도형만 튀어 보인다(2026-11-24 "도형의 집합 같다").
     그래서 화면(tree.html, index.html)은 이 모드에서 별을 따로 그리지 않는다. */
  body += `<image href="${PAINT_IMG}" x="0" y="0" width="${TREE.vbW}" height="${TREE.vbH}"/>`;

  if (lights) {
    const L = glintLights();
    defs += L.defs; body += L.body;
  }
  return `<defs>${defs}</defs>${body}`;
}

/* 트리 반짝임 — 꼭대기 별과 **같은 반짝임**을 트리에도 뿌린다
   (2026-11-25 "전구도 반짝이도 별로야, 별에 있는 반짝이는 효과를 트리에도 작게 여러 개").
   가늘고 긴 빛줄기가 천천히 번졌다 사라진다. 자리마다 박자를 어긋나게 줘서 늘 몇 개만
   켜져 있다 — 한꺼번에 켜지면 전구 스위치가 되고, 하나씩이면 트리가 비어 보인다.
   움직임은 xmas.css의 .xm-twinkle이 맡는다(별의 .xm-glint보다 순하다). */

/** 빛줄기 자리 [x, y, 크기]. 난수로 두면 새로고침마다 바뀌어 어수선하므로 한 번만 셈해 둔다.
    개수가 적으면 한동안 트리에 아무것도 안 켜져 있다 — 켜져 있는 구간이 한 바퀴의
    5분의 1쯤이라, 서른 개쯤 뿌려야 늘 대여섯 개가 켜져 있다. */
const GLINTS = (() => {
  const n = 32, out = [];
  for (let i = 0; i < n; i++) {
    const y = 22 + ((i + 0.5) / n) * 92;        // 꼭대기 별 밑에서 밑단 조금 위까지
    /* 좌우는 황금비로 흩는다. 난수가 아니라 늘 같은 자리가 나오면서도 줄이 서지 않는다.
       가장자리에서 조금 들여야(0.72) 물감 가지 밖으로 비어져 나오지 않는다. */
    const u = ((((i + 1) * 0.6180339887) % 1) * 2 - 1) * 0.92;
    const h = tierHalfAt(y) * 0.72;
    if (h < 4) continue;
    out.push([+(50 + u * h).toFixed(1), +y.toFixed(1), 0.9 + ((i * 3) % 5) * 0.12]);
  }
  return out;
})();

/** 가는 빛줄기: 아주 납작한 마름모 두 개를 십자로. 곡선으로 두면 갈래가 통통해져
    또 하나의 별처럼 보인다(2026-11-24). 꼭대기 별도 이것을 쓴다(tree.html). */
export function rayPath(cx, cy, r, w) {
  const f = n => n.toFixed(2);
  return `M${f(cx)} ${f(cy - r)}L${f(cx + w)} ${f(cy)}L${f(cx)} ${f(cy + r)}L${f(cx - w)} ${f(cy)}Z`
       + `M${f(cx - r)} ${f(cy)}L${f(cx)} ${f(cy - w)}L${f(cx + r)} ${f(cy)}L${f(cx)} ${f(cy + w)}Z`;
}

function glintLights() {
  /* 거의 흰빛이다. 진한 금빛으로 두니 트리에 금단추를 단 것 같았다(2026-11-25).
     다만 아주 옅은 따뜻한 기를 남겨야 연한 민트 가지 위에서 형체가 보인다 —
     순백으로 두면 그냥 묻힌다(해 봤다). */
  const defs = '<radialGradient id="xtGlint">'
    + '<stop offset="0" stop-color="#ffffff"/>'
    + '<stop offset=".32" stop-color="#fff4d2" stop-opacity=".5"/>'
    + '<stop offset="1" stop-color="#ffe6a8" stop-opacity="0"/></radialGradient>';
  let body = '';
  GLINTS.forEach(([x, y, s], i) => {
    /* 길이(초)를 자리마다 조금씩 달리 줘야 시간이 갈수록 박자가 더 흐트러진다.
       다 같으면 처음 어긋나게 줘도 한 바퀴 뒤에 똑같은 무늬가 돌아온다. */
    const dur = (6 + (i % 5) * 0.6).toFixed(1);
    const delay = (i * 7.2 / GLINTS.length).toFixed(2);
    const len = s * 0.95;
    body += `<g class="xm-twinkle" style="animation-duration:${dur}s;animation-delay:-${delay}s">`
      + `<circle cx="${x}" cy="${y}" r="${(s * 0.8).toFixed(2)}" fill="url(#xtGlint)"/>`
      + `<path d="${rayPath(x, y, len, 0.07)}" fill="#fffdf6"/>`
      + '</g>';
  });
  return { defs, body };
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
     · 오너먼트 크기를 통수에서 끊어 내 큼직하게 둘 수 있고,
     · 편지가 늘어도 남의 오너먼트가 움직이지 않는다("내가 저기 달았어"가 지켜진다).
   크기는 통수에 따라 조금 달라지지만(ornWidthFor) **자리는 늘 그대로다** — 움직이는
   것과 작아지는 것은 다르다. 그래도 너무 빽빽해지면 겹치므로, 한 그루가 TREE_CAP까지
   차면 전시 화면이 트리를 한 그루 더 띄운다.

   자리가 없던 시절의 문서(x, y가 없는 것)는 예전처럼 layout()이 자리를 잡아 준다.
   ════════════════════════════════════════════════════════════════ */

/**
 * 오너먼트 **기준** 너비(viewBox 단위). 화면에 쓰는 값은 아래 ornWidthFor()가
 * 통수에서 정한다 — 이것은 60~160통 구간에서 쓰는 가운데 값이다.
 *
 * 7에서 5.4로 줄였다(2026-11-11). 160통쯤 모인 트리를 미리 보니 오너먼트가
 * 서로 닿아 "장식을 단 트리"가 아니라 "구슬로 덮인 트리"로 보였다. 대신 트리
 * 자체를 화면 가득 키웠으므로 오너먼트 하나가 눈에 보이는 크기는 거의 그대로고,
 * **사이의 빈 가지만 늘어난다.** 크기를 줄이는 쪽만 하면 멀리서 안 보이고,
 * 트리만 키우면 빽빽한 것이 그대로 커진다 — 둘은 같이 움직여야 한다.
 */
export const ORN_W = 5.4;

/* ── 트리 한 그루가 받는 수 ──────────────────────────────────────
   여기까지 차면 전시 화면(tree.html)이 트리를 한 그루 더 띄우고 번갈아 보여 준다.
   학생 화면도 같은 값을 봐서 **지금 차고 있는 그루**에 자리를 고르게 한다.

   **그루 번호를 문서에 적지 않는다.** 걸린 순서(createdAt)에서 셈할 수 있으므로 적어
   둘 필요가 없고, 적어 두면 어드민에서 숨겼다 되돌릴 때 같이 챙겨야 하는 값이 하나 더
   생긴다 — 자리(x, y)를 빠뜨려 오너먼트가 엉뚱한 데로 간 일이 있었다.

   300에서 100으로 줄였다(2026-11-26). 300통을 한 그루에 담으면 오너먼트를 4.2%까지
   줄여야 겨우 들어가는데, 그러면 멀리서 뭘 달았는지 안 보인다. 100통이면 **기준 크기
   그대로**(5.4%) 넉넉히 들어간다 — 그루를 늘리는 값이 오너먼트를 줄이는 값보다 싸다.
   대신 그루가 늘수록 내 것을 보려고 기다리는 시간이 길어지므로, 전시 화면이 넘기는
   간격을 그루 수에 맞춰 줄인다(tree.html의 ROUND_SEC). */
export const TREE_CAP = 100;

/** 편지 n통이면 트리가 몇 그루인가 */
export function pageCount(n) {
  return Math.max(1, Math.ceil((Number(n) || 0) / TREE_CAP));
}

/* ── 통수에 따라 오너먼트 크기를 정한다 (2026-11-26) ──────────────
   크기를 한 값으로 못 박아 두면 양 끝에서 둘 다 탈이 난다.
     · 열 통쯤 달린 트리는 큰 화면에서 "아무도 안 썼구나"로 보인다.
     · 삼백 통쯤 달린 트리는 가운데가 서로 덮여 자기 것을 못 찾는다.
   그래서 적을 때는 키우고 많을 때는 줄인다. **자리(x, y)는 건드리지 않는다** —
   크기만 변하므로 "내가 저기 달았어"는 그대로 지켜진다. 한 통 들어올 때 변하는 폭이
   0.1%도 안 되고, `.xm-hang`의 width transition이 그 사이를 건너가므로 보이지 않는다.

   2026-11-11에 탈이 났던 것은 **오너먼트가 3.5%까지 쪼그라든 것**이었다. 그래서 바닥
   (ORN_W_MIN)을 두었다.

   **지금 TREE_CAP(100)에서는 줄어드는 쪽이 한 번도 안 쓰인다** — 한 그루가 꽉 차도 100통,
   기준 크기(5.4%)로 넉넉하다. 줄이는 길을 남겨 둔 것은 TREE_CAP을 다시 올릴 때를 위해서다.
   올리면 MANY를 넘는 만큼 저절로 줄어든다. */
export const ORN_W_MAX = 7.6;   // 적을 때 이보다 더 키우지 않는다
export const ORN_W_MIN = 4.2;   // 많을 때 이보다 더 줄이지 않는다
const FEW  = 60;                // 여기까지는 통수가 적을수록 크다
const MANY = 160;               // 여기부터 줄기 시작한다(60~160통이 기준 크기 구간)

/** 한 그루에 n통 달렸을 때 오너먼트 너비(viewBox 단위) */
export function ornWidthFor(n) {
  const k = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  const r = v => Math.round(v * 100) / 100;
  if (k <= 1)   return ORN_W_MAX;
  if (k <= FEW) return r(ORN_W_MAX + (ORN_W - ORN_W_MAX) * ((k - 1) / (FEW - 1)));
  // 한 그루가 MANY통도 못 받으면 줄일 일이 없다(0으로 나누는 것도 여기서 막힌다)
  if (k <= MANY || TREE_CAP <= MANY) return ORN_W;
  return r(ORN_W + (ORN_W_MIN - ORN_W) * Math.min(1, (k - MANY) / (TREE_CAP - MANY)));
}

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
 * 트리 한 그루에 걸 것들의 자리를 정한다.
 * 학생이 고른 자리(x, y)가 있으면 그대로 쓰고, 없는 것만 예전 방식으로 채운다.
 * 크기는 **그 그루에 걸린 통수**로 정한다(ornWidthFor) — 그루를 나눠 부르면
 * 각 그루가 자기 통수에 맞는 크기를 갖는다.
 * @param {{id:string, x?:number, y?:number}[]} items 걸린 순서대로
 */
export function placeAll(items) {
  const w = ornWidthFor(items.length);
  const legacy = items.filter(it => !Number.isFinite(it.x) || !Number.isFinite(it.y));
  const fallback = new Map(layout(legacy.map(it => it.id), w).map(p => [p.id, p]));
  return items.map(it => {
    if (Number.isFinite(it.x) && Number.isFinite(it.y)) {
      const c = clampSpot(it.x, it.y, w);
      return { id: it.id, x: c.x, y: c.y, w };
    }
    return fallback.get(it.id);
  });
}
