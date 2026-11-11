/* ════════════════════════════════════════════════════════════════
   트리에 오너먼트를 어디에 걸지 정하는 계산.

   화면 코드와 떼어 둔 이유는 두 가지다 — 눈으로 확인하기 어려운 셈이라
   테스트(test/xmas.test.mjs)로 묶어 두고 싶었고, 트리 그림(tree.html의 <svg>)과
   좌표계를 반드시 같이 맞춰야 해서 한 곳에 숫자를 모아 두는 편이 안전하다.

   좌표는 전부 트리 그림과 같은 viewBox 단위다(가로 100, 세로 130).
   화면에서는 그대로 퍼센트로 쓴다 — 담는 칸의 가로세로 비율이 100:130이라
   x 단위 = 가로 %, y 단위 = 세로의 (y/130*100) %가 된다.
   ════════════════════════════════════════════════════════════════ */

// 트리 그림이 차지하는 범위. 아래 TIERS에서 뽑아낸 값이라 둘이 어긋날 수 없다.
export const TREE = {
  vbW: 100,
  vbH: 130,
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

/** 가지 네 단. 위에서 아래로 넓어지고 짙어진다. */
export const TIERS = [
  { apexY: 14, baseY: 44,  half: 15, scallops: 3, fill: '#74DCCB', shade: '#4FB5AC' },
  { apexY: 26, baseY: 70,  half: 24, scallops: 4, fill: '#5CCBBF', shade: '#3C9F9A' },
  { apexY: 46, baseY: 96,  half: 32, scallops: 5, fill: '#46B1AC', shade: '#2F8A89' },
  { apexY: 66, baseY: 118, half: 40, scallops: 6, fill: '#339695', shade: '#226F72' },
];

/**
 * 가지 한 단의 윤곽선.
 * 꼭대기에서 왼쪽 아래로 살짝 불룩하게 내려와, 밑단을 반원 여러 개로 물결치며
 * 오른쪽 끝까지 간 뒤, 다시 불룩하게 꼭대기로 돌아온다.
 * @param {object} t TIERS의 한 칸
 * @param {number} dy 아래로 밀 거리(그림자 사본을 만들 때 쓴다)
 */
export function tierPath(t, dy = 0) {
  const cx = 50;
  const topY = t.apexY + dy;
  const botY = t.baseY + dy;
  const h = botY - topY;
  const r = t.half / t.scallops;        // 물결 하나의 반지름
  /* 옆선을 바깥으로 불룩하게 만드는 제어점. 직선으로 두면 각이 서서
     종이로 오린 삼각형처럼 보인다.
     주의: 제어점을 꼭대기와 밑끝을 잇는 직선 **위**에 두면 아무 일도 안 일어난다.
     0.60/0.58 로 뒀을 때가 꼭 그랬다(가로 비율보다 세로 비율이 커야 바깥으로 밀린다).
     지금은 같은 높이에서 직선보다 늘 바깥에 있도록 가로를 크게 잡았다. */
  const cxOff = t.half * 0.96;
  const cyOff = h * 0.70;

  let d = `M${cx} ${topY}`;
  d += `Q${(cx - cxOff).toFixed(2)} ${(topY + cyOff).toFixed(2)} ${(cx - t.half).toFixed(2)} ${botY.toFixed(2)}`;
  // sweep-flag 0 이라야 아래로 볼록한 반원이 된다(1이면 위로 파인다).
  for (let i = 0; i < t.scallops; i++) {
    d += `a${r.toFixed(3)} ${r.toFixed(3)} 0 0 0 ${(r * 2).toFixed(3)} 0`;
  }
  d += `Q${(cx + cxOff).toFixed(2)} ${(topY + cyOff).toFixed(2)} ${cx} ${topY}`;
  d += 'Z';
  return d;
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
    const r = t.half / t.scallops;
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
