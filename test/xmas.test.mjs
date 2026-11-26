// xmas/tree-layout.js 순수 로직 단위 테스트. 빌드툴 없이 `node --test` 로 실행한다.
//   실행: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TREE, slotCapacity, rowsFor, slotIndex, slotPitch, halfWidthAt, hash01, layout,
  ORN_W, ORN_W_MAX, ORN_W_MIN, ornWidthFor, TREE_CAP, pageCount,
  ornHeight, onTree, clampSpot, nudgeFree, autoSpot, placeAll } from '../tree-layout.js';

const ids = n => Array.from({ length: n }, (_, i) => 'letter' + i);

test('slotCapacity: 줄마다 r+2칸씩 쌓인다', () => {
  assert.equal(slotCapacity(1), 2);        // 2
  assert.equal(slotCapacity(2), 5);        // 2+3
  assert.equal(slotCapacity(3), 9);        // 2+3+4
  assert.equal(slotCapacity(6), 27);
});

test('rowsFor: 편지가 적어도 최소 줄 수는 유지한다', () => {
  assert.equal(rowsFor(0), TREE.minRows);
  assert.equal(rowsFor(1), TREE.minRows);
  assert.equal(rowsFor(27), TREE.minRows);          // 6줄 정원이 27
  assert.ok(rowsFor(28) > TREE.minRows);
});

test('rowsFor: 편지 수만큼 자리가 생긴다', () => {
  for (const n of [40, 120, 161, 300, 500]) {
    assert.ok(slotCapacity(rowsFor(n)) >= n, `${n}통을 담지 못한다`);
  }
});

test('rowsFor: 최대 줄 수를 넘지 않는다', () => {
  assert.equal(rowsFor(99999), TREE.maxRows);
});

test('slotIndex: 칸 번호를 줄과 자리로 푼다', () => {
  assert.deepEqual(slotIndex(0, 6), { row: 0, col: 0, cols: 2 });
  assert.deepEqual(slotIndex(1, 6), { row: 0, col: 1, cols: 2 });
  assert.deepEqual(slotIndex(2, 6), { row: 1, col: 0, cols: 3 });
  assert.deepEqual(slotIndex(4, 6), { row: 1, col: 2, cols: 3 });
  assert.deepEqual(slotIndex(5, 6), { row: 2, col: 0, cols: 4 });
});

test('slotIndex: 자리가 모자라면 앞에서부터 다시 쓴다', () => {
  const cap = slotCapacity(6);
  assert.deepEqual(slotIndex(cap, 6), slotIndex(0, 6));
  assert.deepEqual(slotIndex(cap + 3, 6), slotIndex(3, 6));
});

test('halfWidthAt: 꼭대기는 0, 아래로 갈수록 넓어진다', () => {
  assert.equal(halfWidthAt(TREE.apexY), 0);
  assert.ok(halfWidthAt(60) > halfWidthAt(30));
  assert.ok(Math.abs(halfWidthAt(TREE.baseY) - TREE.baseHalf * TREE.inset) < 1e-9);
});

test('slotPitch: 편지가 많아질수록 칸이 촘촘해진다', () => {
  assert.ok(slotPitch(6) > slotPitch(12));
  assert.ok(slotPitch(12) > slotPitch(24));
});

test('hash01: 같은 글자는 늘 같은 값, 소금이 다르면 다른 값', () => {
  assert.equal(hash01('abc'), hash01('abc'));
  assert.notEqual(hash01('abc', 1), hash01('abc', 2));
  for (const s of ['', 'a', 'letter42', '가나다']) {
    const v = hash01(s);
    assert.ok(v >= 0 && v < 1, `${s} → ${v}`);
  }
});

test('layout: 오너먼트가 트리 그림 밖으로 나가지 않는다', () => {
  for (const n of [1, 5, 27, 100, 161, 400]) {
    for (const o of layout(ids(n))) {
      const half = halfWidthAt(o.y);
      // 흔들림까지 더해도 가지 안쪽에 머물러야 한다
      assert.ok(Math.abs(o.x - 50) <= half + 1e-9, `${n}통: x=${o.x} y=${o.y}`);
      assert.ok(o.y >= TREE.firstRowY - 4 && o.y <= TREE.baseY + 4, `${n}통: y=${o.y}`);
    }
  }
});

test('layout: 자동으로 잡아 주는 자리끼리 칸을 넘어가지 않는다', () => {
  const out = layout(ids(100));
  const bottom = out.filter(o => o.y > TREE.baseY - 3).sort((a, b) => a.x - b.x);
  /* 흔들림은 칸 간격의 ±15%라 이웃 사이는 아무리 좁아도 칸 간격의 70%는 남는다.
     칸 수는 세어서 구하면 안 된다 — 마지막 줄은 대개 덜 차 있어서
     실제보다 넓은 간격이 나오고, 멀쩡한 자리를 "붙었다"고 잡는다. */
  const cols = rowsFor(100) + 1;
  const pitch = (2 * halfWidthAt(TREE.baseY)) / cols;
  for (let i = 1; i < bottom.length; i++) {
    const gap = bottom[i].x - bottom[i - 1].x;
    assert.ok(gap > pitch * 0.68,
      `너무 붙었다: ${bottom[i - 1].x.toFixed(2)} / ${bottom[i].x.toFixed(2)} (칸 간격 ${pitch.toFixed(2)})`);
  }
});

test('layout: 같은 편지는 늘 같은 자리에 걸린다', () => {
  const a = layout(ids(50));
  const b = layout(ids(50));
  assert.deepEqual(a, b);
});

// ── 트리 그림과 오너먼트 자리가 어긋나지 않는지 ─────────────────
import { TIERS, tierPath, tierHalfAt, starPath, treeArtSVG, TRUNK, FLAT } from '../tree-layout.js';

test('기둥: 맨 아래 가지 밑으로 넉넉히 보이고, 칸 밖으로 넘치지 않는다', () => {
  const last = TIERS[TIERS.length - 1];
  const scallopBottom = last.baseY + (last.half / last.scallops) * FLAT;
  // 2026-11-16 "밑동이 거의 안 보인다": 예전에는 물결 밑으로 3 남짓만 보였다
  assert.ok(TRUNK.groundY - scallopBottom >= 8, `보이는 기둥 ${(TRUNK.groundY - scallopBottom).toFixed(1)}`);
  assert.ok(TRUNK.topY < last.baseY, '기둥 위끝이 가지 속에 묻혀야 한다');
  assert.ok(TRUNK.groundY + 2.4 <= TREE.vbH, '바닥 눈 더미가 칸 밖으로 넘친다');
});

test('TIERS: 위에서 아래로 넓어지고 겹쳐 있다', () => {
  for (let i = 1; i < TIERS.length; i++) {
    assert.ok(TIERS[i].half > TIERS[i - 1].half, `${i}번째 단이 더 좁다`);
    // 다음 단의 꼭대기가 앞 단 밑보다 위에 있어야 가지가 끊기지 않는다
    assert.ok(TIERS[i].apexY < TIERS[i - 1].baseY, `${i}번째 단이 앞 단과 떨어져 있다`);
  }
  assert.equal(TIERS[0].apexY, TREE.apexY);
  assert.equal(TIERS[TIERS.length - 1].baseY, TREE.baseY);
  assert.equal(TIERS[TIERS.length - 1].half, TREE.baseHalf);
});

test('tierPath: 쓸 수 있는 path가 나온다', () => {
  for (const t of TIERS) {
    const d = tierPath(t);
    assert.match(d, /^M50 \d/);
    assert.ok(d.endsWith('Z'));
    assert.ok(!/NaN|undefined/.test(d), d);
    // 물결 개수만큼 곡선이 들어 있다
    assert.equal((d.match(/c-?[\d.]+ /g) || []).length, t.scallops);
  }
});

test('treeArtSVG: 그림자는 아래 단에만 오려 붙이고, 전구 줄은 끌 수 있다', () => {
  const svg = treeArtSVG();
  assert.ok(!/NaN|undefined/.test(svg));
  // 맨 아래 단은 드리울 데가 없으니 그림자 오리기는 단 수보다 하나 적다
  assert.equal((svg.match(/<clipPath /g) || []).length, TIERS.length - 1);
  assert.ok(/class="xt-l0"/.test(svg));
  assert.ok(!/xtBulb/.test(treeArtSVG({ lights: false })));


  /* 수채화 시안은 전구 줄이 아니라 꼭대기 별과 같은 빛줄기를 쓴다
     (2026-11-25 "전구도 반짝이도 별로야, 별 반짝임을 트리에도 작게 여러 개"). */
  const p = treeArtSVG({ paint: true });
  assert.ok(!/NaN|undefined/.test(p));
  assert.ok(!/xtBulb/.test(p));                                    // 전구 알은 없다
  assert.ok(!/xm-twinkle/.test(treeArtSVG({ paint: true, lights: false })));

  /* 켜져 있는 구간이 한 바퀴의 5분의 1쯤이라, 스물 몇 개는 돼야 늘 대여섯 개가
     켜져 있다. 적으면 한동안 트리가 캄캄해진다. */
  const spots = [...p.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="[\d.]+" fill="url\(#xtGlint\)"\/>/g)]
    .map(m => [Number(m[1]), Number(m[2])]);
  assert.ok(spots.length >= 25, `빛줄기가 ${spots.length}개뿐이다`);
  assert.equal((p.match(/class="xm-twinkle"/g) || []).length, spots.length);

  // 자리마다 박자가 달라야 한꺼번에 켜지지 않는다
  assert.ok(new Set(p.match(/animation-delay:-[0-9.]+s/g)).size >= spots.length - 1);

  // 하나도 가지 밖으로 나가면 안 된다(밤하늘에 혼자 떠 있는 반짝임이 된다)
  for (const [x, y] of spots) {
    assert.ok(Math.abs(x - 50) <= tierHalfAt(y), `가지 밖: ${x}, ${y}`);
  }
});

test('starPath: 꼭지 다섯 개짜리 닫힌 길이 나온다', () => {
  const d = starPath(50, 9, 8, 3.4);
  assert.ok(d.startsWith('M') && d.endsWith('Z'));
  assert.equal(d.split('L').length, 10);   // 바깥 5 + 안쪽 5
  assert.ok(!/NaN/.test(d));
});

test('오너먼트를 거는 띠가 실제 가지 안에 들어온다', () => {
  // 첫 줄부터 맨 아랫줄까지 훑으며, 거는 띠(halfWidthAt)가 그림(tierHalfAt)을 넘지 않는지 본다.
  let worst = 0, worstY = 0;
  for (let y = TREE.firstRowY; y <= TREE.baseY; y += 0.5) {
    const over = halfWidthAt(y) - tierHalfAt(y);
    if (over > worst) { worst = over; worstY = y; }
  }
  // 물결이 밑단 아래로 더 내려와 있어 1 단위(트리 폭의 1%) 안쪽이면 눈에 안 띈다
  assert.ok(worst <= 1, `y=${worstY} 에서 ${worst.toFixed(2)} 만큼 가지 밖으로 나간다`);
});

test('layout: 모든 오너먼트가 가지 위에 걸린다', () => {
  for (const n of [1, 10, 50, 161, 400]) {
    for (const o of layout(ids(n))) {
      assert.ok(Math.abs(o.x - 50) <= tierHalfAt(o.y) + 1,
        `${n}통: x=${o.x.toFixed(1)} y=${o.y.toFixed(1)} 가지 반폭=${tierHalfAt(o.y).toFixed(1)}`);
    }
  }
});

// ── 학생이 고르는 자리 ──────────────────────────────────────────

test('layout: 크기를 따로 주지 않으면 기준 크기를 쓴다', () => {
  for (const n of [1, 50, 180, 400]) {
    for (const p of layout(ids(n))) assert.equal(p.w, ORN_W);
  }
  for (const p of layout(ids(5), 4.2)) assert.equal(p.w, 4.2);
  assert.ok(ornHeight() > ORN_W);          // 그림이 세로로 길다(고리 자리)
});

test('ornWidthFor: 적을 때 키우고, 한 그루가 차도 기준 크기를 지킨다', () => {
  assert.equal(ornWidthFor(0), ORN_W_MAX);
  assert.equal(ornWidthFor(1), ORN_W_MAX);
  assert.equal(ornWidthFor(60), ORN_W);
  assert.ok(ornWidthFor(14) > ORN_W);       // 열네 통이면 기준보다 크다
  /* 한 그루가 꽉 차도 줄어들지 않는 것이 TREE_CAP을 100으로 둔 까닭이다.
     그루를 늘리는 값이 오너먼트를 줄이는 값보다 싸다. */
  assert.equal(ornWidthFor(TREE_CAP), ORN_W);
  // 통수가 늘면 절대 커지지 않고, 바닥과 천장을 벗어나지 않는다
  let prev = Infinity;
  for (let n = 0; n <= 600; n++) {
    const w = ornWidthFor(n);
    assert.ok(w <= prev + 1e-9, `${n}통에서 커졌다 (${prev} → ${w})`);
    assert.ok(w >= ORN_W_MIN && w <= ORN_W_MAX, `${n}통: ${w}`);
    prev = w;
  }
  // 엉뚱한 값에도 멈추지 않는다
  for (const bad of [NaN, undefined, -5, Infinity]) {
    assert.ok(ornWidthFor(bad) >= ORN_W_MIN && ornWidthFor(bad) <= ORN_W_MAX, String(bad));
  }
});

test('pageCount: 한 그루가 차면 그루가 늘어난다', () => {
  assert.equal(pageCount(0), 1);
  assert.equal(pageCount(1), 1);
  assert.equal(pageCount(TREE_CAP), 1);
  assert.equal(pageCount(TREE_CAP + 1), 2);
  assert.equal(pageCount(TREE_CAP * 2), 2);
  assert.equal(pageCount(TREE_CAP * 2 + 1), 3);
});

test('그루를 나눠 담으면 꽉 찬 그루도 기준 크기를 지킨다', () => {
  // 전시 화면이 하는 것과 같이 TREE_CAP 단위로 잘라 placeAll을 부른다
  const all = ids(TREE_CAP * 3).map((id, i) => ({ id, x: 50, y: 40 + (i % 60) }));
  for (let p = 0; p * TREE_CAP < all.length; p++) {
    for (const q of placeAll(all.slice(p * TREE_CAP, (p + 1) * TREE_CAP))) {
      assert.equal(q.w, ORN_W);
    }
  }
  // 아직 덜 찬 마지막 그루는 오너먼트가 더 크다 — 그루마다 따로 부르는 까닭이다
  assert.ok(placeAll(all.slice(0, 20))[0].w > ORN_W);
});

test('clampSpot: 어디를 찍어도 가지 안으로 끌어온다', () => {
  for (const [x, y] of [[-50, 60], [200, 60], [50, -10], [50, 400], [0, 0], [100, 130]]) {
    const s = clampSpot(x, y);
    assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y), `${x},${y}`);
    assert.ok(s.y >= TREE.firstRowY && s.y <= TREE.baseY, `y=${s.y}`);
    assert.ok(Math.abs(s.x - 50) <= tierHalfAt(s.y) + 1e-9, `x=${s.x} y=${s.y}`);
  }
});

test('clampSpot: 이미 가지 안이면 그대로 둔다', () => {
  const s = clampSpot(50, 80);
  assert.equal(s.x, 50);
  assert.equal(s.y, 80);
});

test('onTree: 가지 밖은 걸러낸다', () => {
  assert.equal(onTree(50, 80), true);
  assert.equal(onTree(5, 80), false);      // 왼쪽 허공
  assert.equal(onTree(50, 10), false);     // 별 자리
  assert.equal(onTree(50, 128), false);    // 바닥
});

test('nudgeFree: 이미 걸린 자리에 겹쳐 찍으면 옆으로 밀어 준다', () => {
  const taken = [{ x: 50, y: 70 }];
  const s = nudgeFree(50, 70, taken);
  assert.ok(Math.hypot(s.x - 50, s.y - 70) >= ORN_W * 0.6, `거리 ${Math.hypot(s.x - 50, s.y - 70)}`);
  assert.ok(Math.abs(s.x - 50) <= tierHalfAt(s.y) + 1e-9);
});

test('nudgeFree: 빈 자리면 찍은 그대로 둔다', () => {
  const s = nudgeFree(44, 90, [{ x: 60, y: 60 }]);
  assert.equal(s.x, 44);
  assert.equal(s.y, 90);
});

test('nudgeFree: 꽉 차 있어도 가지 안의 자리를 돌려준다', () => {
  // 트리 전체를 촘촘히 메운 상태
  const taken = [];
  for (let y = TREE.firstRowY; y <= TREE.baseY; y += 2) {
    for (let x = 50 - tierHalfAt(y); x <= 50 + tierHalfAt(y); x += 2) taken.push({ x, y });
  }
  const s = nudgeFree(50, 80, taken);
  assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y));
  assert.ok(Math.abs(s.x - 50) <= tierHalfAt(s.y) + 1e-9);
});

test('autoSpot: 빈 곳을 찾아 주고, 같은 씨앗이면 같은 자리다', () => {
  const taken = [];
  for (let i = 0; i < 40; i++) {
    const s = autoSpot(taken, 'letter' + i);
    assert.ok(Math.abs(s.x - 50) <= tierHalfAt(s.y) + 1e-9, `자리 밖 ${s.x},${s.y}`);
    // 앞서 놓은 것과 겹치지 않아야 한다
    for (const t of taken) {
      assert.ok(Math.hypot(t.x - s.x, t.y - s.y) >= ORN_W * 0.6,
        `${i}번째가 겹쳤다 (${s.x.toFixed(1)},${s.y.toFixed(1)})`);
    }
    taken.push(s);
  }
  assert.deepEqual(autoSpot([], 'abc'), autoSpot([], 'abc'));
  assert.notDeepEqual(autoSpot([], 'abc'), autoSpot([], 'xyz'));
});

test('placeAll: 고른 자리는 그대로, 없는 것만 예전 방식으로 채운다', () => {
  const out = placeAll([
    { id: 'a', x: 44, y: 90 },
    { id: 'b' },                       // 자리 없음
    { id: 'c', x: 58, y: 70 },
    { id: 'd', x: 999, y: 999 },       // 엉뚱한 값은 가지 안으로 끌어온다
  ]);
  assert.deepEqual({ x: out[0].x, y: out[0].y }, { x: 44, y: 90 });
  assert.deepEqual({ x: out[2].x, y: out[2].y }, { x: 58, y: 70 });
  assert.ok(Number.isFinite(out[1].x) && Number.isFinite(out[1].y));
  assert.ok(Math.abs(out[3].x - 50) <= tierHalfAt(out[3].y) + 1e-9);
  for (const p of out) assert.equal(p.w, ornWidthFor(out.length));
});

/* 크기는 통수에 따라 변한다. **자리는 변하지 않는다** — 이 둘이 섞이면
   "내가 저기 달았어"가 깨진다. 그래서 x, y만 본다. */
test('placeAll: 편지가 늘어도 이미 걸린 것은 움직이지 않는다', () => {
  const first = placeAll([{ id: 'a', x: 44, y: 90 }]);
  const later = placeAll([{ id: 'a', x: 44, y: 90 }, ...ids(200).map((id, i) => ({ id, x: 40 + i % 20, y: 40 + i % 60 }))]);
  assert.deepEqual({ x: first[0].x, y: first[0].y }, { x: later[0].x, y: later[0].y });
  assert.ok(later[0].w < first[0].w);   // 작아지기는 한다
});

test('nudgeFree: 찍은 자리에서 멀리 날아가지 않는다', () => {
  // 트리를 빽빽하게 채워 두고 한가운데를 찍어 본다
  const taken = [];
  for (let y = TREE.firstRowY; y <= TREE.baseY; y += 3) {
    for (let x = 50 - tierHalfAt(y); x <= 50 + tierHalfAt(y); x += 3) taken.push({ x, y });
  }
  for (const [px, py] of [[50, 60], [42, 90], [58, 105], [50, 30]]) {
    const s = nudgeFree(px, py, taken);
    const want = clampSpot(px, py);
    const moved = Math.hypot(s.x - want.x, s.y - want.y);
    assert.ok(moved <= ORN_W * 1.5,
      `(${px},${py}) 에서 ${moved.toFixed(1)} 만큼 밀렸다 (오너먼트 너비 ${ORN_W})`);
  }
});

/* 학번 규칙(SID_RE)은 index.html 안에 있다 — xmas-core.js로 빼면 테스트가 파이어베이스
   SDK를 CDN에서 끌어오려 한다. 그래서 소스에서 정규식만 꺼내 와 확인한다. */
test('학번: 학년 1~3, 반 01~06, 번호 01~30만 통과한다', () => {
  const src = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const m = src.match(/const SID_RE = (\/\S+\/);/);
  assert.ok(m, 'index.html에서 SID_RE를 못 찾았다');
  const re = new RegExp(m[1].slice(1, -1));
  for (const ok of ['10101', '30101', '30630', '20306', '10130'])
    assert.ok(re.test(ok), `${ok}은 통과해야 한다`);
  for (const no of ['40101', '00101', '30701', '30001', '30131', '30100', '3010', '301011', ''])
    assert.ok(!re.test(no), `${no}은 막아야 한다`);
});

test('설정: 편지 길이 상한은 보안 규칙(2000자)을 못 넘는다', () => {
  /* 어드민에서 더 크게 잡아 두면 학생은 다 쓰고 나서 "지금은 달 수 없어요"만 보고
     영영 못 보낸다 — 규칙이 2000자에서 막는데 화면은 그걸 모른다(2026-11-25).
     (xmas-core.js는 Firebase를 https로 불러와 node가 import하지 못하므로 글로 본다.) */
  const core = readFileSync(new URL('../xmas-core.js', import.meta.url), 'utf8');
  assert.ok(core.includes('BODY_HARD_MAX = 2000'), '규칙과 같은 상한값이 있어야 한다');
  assert.ok(core.includes('Math.min(Number(c.maxLen) || DEFAULT_CONFIG.maxLen, BODY_HARD_MAX)'),
    '설정을 읽을 때 상한으로 깎아야 한다');
  const admin = readFileSync(new URL('../admin.html', import.meta.url), 'utf8');
  assert.ok(admin.includes('Math.min(BODY_HARD_MAX,'), '어드민이 상한 위로 저장하면 안 된다');
});

test('공용 태블릿: 편지를 들고 있는 화면은 자리를 비우면 지워진다', () => {
  /* 5단계(자리 고르기)는 편지를 다 쓴 화면이다. 여기서 시계를 안 걸어 두면 학생이
     자리를 뜬 뒤 다음 사람이 **앞사람 이름으로 앞사람 편지를** 달아 버린다
     (2026-11-25에 실제로 그랬다). 1단계는 빈 화면, 6단계는 따로 시계가 돈다. */
  const src = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(src.includes('if (step === 1 || step === 6) return;'),
    '자리 비움 시계를 거르는 화면은 1단계와 6단계뿐이어야 한다');
});

/* 비속어 사전. 이 앱은 감사편지를 받으므로 "잘못 막는 것"이 "놓치는 것"보다 아프다
   (부스에서 학생이 왜 안 되는지 모르고 포기한다). 양쪽을 다 지켜본다. */
test('비속어: 욕은 막고, 감사편지에 흔한 말은 통과한다', async () => {
  const { containsBadWord, findBadWord } = await import('../shared/profanity.js');

  for (const bad of ['선생님 씨발 뭐냐', 'ㅅ ㅂ 진짜', '개새끼', 'ㅂㅅ', '존나 짜증',
                     '미친놈', '이 새끼', '멍청아', '닥쳐', 'fuck you',
                     // 좁힌 말들도 욕으로 쓰면 여전히 막힌다(2026-11-25)
                     '죽어버려', '꺼져라', '뒈져라', '뒤져라', '보지가 어쩌고', '자지를 어쩌고'])
    assert.ok(containsBadWord(bad), `막아야 한다: ${bad}`);

  for (const ok of ['선생님, 올 한 해 정말 고마웠습니다.',
                    '선생님 덕분에 미치도록 역사가 좋아졌어요',
                    '죽어도 이 은혜 못 잊어요',
                    '제가 멍청한 질문을 해도 다 들어 주셨어요',
                    '새끼손가락 걸고 약속할게요',
                    '미치게 보고 싶을 거예요',
                    '졸업해도 잊지 않을게요',
                    /* 2026-11-25에 실제로 막히던 말들. 학생에게는 어느 말이 걸렸는지
                       안 알려 주므로, 한 번 막히면 고치지 못하고 포기한다. */
                    '죽어라 공부했더니 성적이 올랐어요',
                    '선생님의 열정은 꺼지지 않는 불꽃 같았습니다',
                    '서랍을 뒤져 보니 선생님 편지가 있었어요',
                    '도서관에서 책을 뒤지며 자료를 찾던 날',
                    '선생님을 다시 보지 못해서 아쉬워요',
                    '선생님 얼굴을 못 보지만 늘 생각해요',
                    '밤에 자지 않고 공부했어요',
                    '자지러지게 웃었던 수업이 기억나요',
                    '제가 멍청이 같은 질문을 해도 웃어 주셨어요'])
    assert.ok(!containsBadWord(ok), `통과해야 한다: ${ok} (걸린 말: ${findBadWord(ok)})`);
});

/* 편지 하한. "ㅋㅋㅋㅋㅋㅋ"로 30자를 채워 넘기는 길을 막는 것이 요점이다. */
test('편지 하한: 뜻 있는 글자만 30자로 세고, 홀로 쓴 자모와 반복은 안 센다', async () => {
  const { meaningfulLen } = await import('../shared/profanity.js');
  const MIN_LEN_FLOOR = 30;

  assert.equal(meaningfulLen(''), 0);
  assert.equal(meaningfulLen('ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ ㅎㅎㅎㅎㅎ ㅠㅠ ㅡㅡ'), 0);
  assert.equal(meaningfulLen('!!!!!!!!!!'), 1);                 // 같은 글자 반복은 한 번
  assert.equal(meaningfulLen('선생님 감사합니다'), 8);          // 공백만 뺀다
  assert.equal(meaningfulLen('감사합니다ㅋㅋㅋ'), 5);

  const 장난 = 'ㅋ'.repeat(80);
  const 진짜 = '선생님, 한 해 동안 가르쳐 주셔서 정말 고맙습니다. 수업 시간이 늘 기다려졌어요. '
            + '내년에도 건강하시고, 저 잊지 말아 주세요. 또 찾아뵙겠습니다.';
  assert.ok(meaningfulLen(장난) < MIN_LEN_FLOOR, '초성만 채운 편지는 통과하면 안 된다');
  assert.ok(meaningfulLen(진짜) >= MIN_LEN_FLOOR, '보통 길이의 감사편지는 통과해야 한다');

  /* 바닥값과 어드민에서 낮춰 저장하는 길을 막은 것은 글로 본다
     (xmas-core.js는 Firebase를 https로 불러와 node가 import하지 못한다). */
  const core = readFileSync(new URL('../xmas-core.js', import.meta.url), 'utf8');
  assert.ok(core.includes('MIN_LEN_FLOOR = ' + MIN_LEN_FLOOR), '바닥값이 ' + MIN_LEN_FLOOR + '이어야 한다');
  assert.ok(core.includes('Math.max(MIN_LEN_FLOOR, Number(c.minLen)'), '설정을 읽을 때 바닥으로 올려야 한다');
  const admin = readFileSync(new URL('../admin.html', import.meta.url), 'utf8');
  assert.ok(admin.includes("Math.max(MIN_LEN_FLOOR,"), '어드민이 바닥 아래로 저장하면 안 된다');
});

test('편지 하한: 학생 화면이 그 셈법을 쓴다', () => {
  const src = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(src.includes('meaningfulLen(v) >= min'), 'index.html이 meaningfulLen으로 재야 한다');
});
