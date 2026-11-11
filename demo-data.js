/* ════════════════════════════════════════════════════════════════
   미리보기용 가짜 데이터.

   주소 끝에 **`?demo=160`** 을 붙이면 Firebase를 건드리지 않고 오너먼트
   160개가 걸린 트리를 그린다(숫자를 비우면 160, 최대 400).
   `tree.html` 과 `index.html` 둘 다 받는다.

   무엇에 쓰나 — 축제 당일처럼 **꽉 찬 트리**를 지금 눈으로 보려고 만들었다.
   실제 컬렉션에 시험 편지를 쌓으면 나중에 지워야 하고, 지우다가 진짜 편지를
   잘못 건드릴 수도 있다. 그래서 화면에서만 만들어 보여 준다.

   demo 모드에서는 **아무것도 저장하지 않는다** — index.html의 [여기에 달기]도
   쓰는 척만 하고 끝난다(아래 isDemo를 보고 index.html이 건너뛴다).

   자리는 학생이 찍는 것과 같은 길(clampSpot → nudgeFree)을 거친다.
   그래서 "이만큼 모이면 이렇게 보인다"가 실제와 어긋나지 않는다.
   ════════════════════════════════════════════════════════════════ */
import { TREE, tierHalfAt, nudgeFree, hash01, ORN_W } from './tree-layout.js';
import { ORNAMENT_KEYS } from './ornaments.js';

const DEFAULT_N = 160;
const MAX_N     = 400;

/** 주소의 ?demo= 를 읽는다. 없으면 0(= 보통 모드). */
export function demoCount() {
  const raw = new URLSearchParams(location.search).get('demo');
  if (raw == null) return 0;
  const n = raw.trim() === '' ? DEFAULT_N : Math.floor(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, MAX_N);
}

export function isDemo() { return demoCount() > 0; }

/**
 * 가짜 오너먼트 n개. 걸린 순서대로 [{ id, ornament, x, y }].
 *
 * 난수를 id에서 뽑으므로 새로고침해도 같은 트리가 나온다
 * (화면을 고칠 때 전후를 눈으로 대조할 수 있어야 한다).
 *
 * 높이는 u^0.65 로 눌러 아래쪽에 조금 더 모이게 하고, 가로는 **그 높이에서
 * 가지가 실제로 차지하는 너비에 맞춰** 뿌린다. 가로를 트리 밑단 너비로 고정해
 * 두면 좁은 윗단에 들어가는 점이 거의 안 나와 꼭대기가 텅 빈다.
 * 반대로 높이를 고르게 뿌리면 좁은 윗단이 아랫단보다 빽빽해 보인다.
 */
export function demoOrnaments(n = demoCount()) {
  const taken = [];
  const out = [];
  const span = TREE.baseY - TREE.firstRowY;

  for (let i = 0; i < n; i++) {
    const id = 'demo-' + String(i + 1).padStart(3, '0');
    const y = TREE.firstRowY + Math.pow(hash01(id, 101), 0.65) * span;
    const room = Math.max(0, tierHalfAt(y) - ORN_W * 0.2);
    const x = 50 + (hash01(id, 100) - 0.5) * 2 * room;
    // 학생이 찍을 때와 같은 길을 거친다 — 포개지는 것만 옆으로 밀어 준다
    const spot = nudgeFree(x, y, taken);
    taken.push(spot);
    out.push({
      id,
      ornament: ORNAMENT_KEYS[Math.floor(hash01(id, 7) * ORNAMENT_KEYS.length)],
      // 가까이 보기에서 뜨는 두 줄. 실제 문서에도 같은 이름으로 들어 있다.
      studentId: demoSid(id),
      studentName: demoName(id),
      x: +spot.x.toFixed(2),
      y: +spot.y.toFixed(2),
    });
  }
  return out;
}

/* 가짜 학번과 이름. 1~3학년 1~12반 1~30번을 고루 섞는다.
   길이가 제각각이어야 라벨이 가장 긴 이름에서 넘치지 않는지 볼 수 있다. */
const SURNAME = '김이박최정강조윤장임한오서신권황안송류전홍고문양손배백허유남'.split('');
const GIVEN = [
  '서연', '지우', '하준', '도윤', '시우', '예준', '지호', '수아', '하은', '지안',
  '건우', '서윤', '민재', '유진', '채원', '현우', '소율', '태윤', '다인', '시현',
  '가온', '라온', '해든', '이든', '리아', '주원', '은우', '성민', '예린', '하율',
];

function demoSid(id) {
  const grade = 1 + Math.floor(hash01(id, 21) * 3);
  const cls   = 1 + Math.floor(hash01(id, 22) * 12);
  const no    = 1 + Math.floor(hash01(id, 23) * 30);
  return String(grade) + String(cls).padStart(2, '0') + String(no).padStart(2, '0');
}

function demoName(id) {
  const sur = SURNAME[Math.floor(hash01(id, 24) * SURNAME.length)];
  const giv = GIVEN[Math.floor(hash01(id, 25) * GIVEN.length)];
  return sur + giv;
}

/** 가짜 선생님 명단 — 이름 길이와 수를 실제와 비슷하게 두어 칸 모양을 본다. */
const DEMO_TEACHERS = [
  ['김민서', '국어'], ['이준호', '수학'], ['박지우', '영어'], ['최서연', '한국사'],
  ['정다은', '통합사회'], ['강현우', '물리'], ['윤서진', '화학'], ['장예준', '생명과학'],
  ['임채원', '지구과학'], ['오태윤', '체육'], ['한소희', '음악'], ['신동현', '미술'],
  ['서지훈', '기술가정'], ['문예린', '정보'], ['배성민', '진로'], ['조하율', '보건'],
  ['남궁유진', '사서'], ['황지호', '상담'], ['고은비', '중국어'], ['류시우', '일본어'],
  ['백다인', '윤리'], ['전우성', '경제'], ['심아름', '지리'], ['양건우', '수학'],
];

export function demoTeachers() {
  return DEMO_TEACHERS.map(([name, subject], i) => ({
    id: 'demo-t-' + (i + 1), name, subject, order: i + 1,
  }));
}

/** 진짜 화면과 헷갈리지 않게 구석에 띠를 하나 붙인다. */
export function mountDemoBadge(n = demoCount()) {
  if (!n) return;
  const el = document.createElement('div');
  el.textContent = `미리보기 가짜 데이터 ${n}개 (저장되지 않습니다)`;
  el.style.cssText = [
    'position:fixed', 'left:10px', 'top:10px', 'z-index:50',
    'padding:6px 12px', 'border-radius:999px',
    'background:rgba(240,196,87,.16)', 'border:1px solid rgba(240,196,87,.45)',
    'color:#f0c457', 'font-size:12px', 'font-weight:700',
    'pointer-events:none', 'letter-spacing:-.2px',
  ].join(';');
  document.body.appendChild(el);
}
