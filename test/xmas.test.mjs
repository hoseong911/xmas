// xmas/tree-layout.js 순수 로직 단위 테스트. 빌드툴 없이 `node --test` 로 실행한다.
//   실행: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TREE, slotCapacity, rowsFor, slotIndex, slotPitch, halfWidthAt, hash01, layout,
  ORN_W, ornHeight, onTree, clampSpot, nudgeFree, autoSpot, placeAll
} from '../tree-layout.js';

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
import { TIERS, tierPath, tierHalfAt, starPath } from '../tree-layout.js';

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
    // 물결 개수만큼 호가 들어 있다
    assert.equal((d.match(/a[\d.]+ /g) || []).length, t.scallops);
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

test('ORN_W: 편지 수와 무관하게 늘 같은 크기다', () => {
  for (const n of [1, 50, 180, 400]) {
    for (const p of layout(ids(n))) assert.equal(p.w, ORN_W);
  }
  assert.ok(ornHeight() > ORN_W);          // 그림이 세로로 길다(고리 자리)
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
  for (const p of out) assert.equal(p.w, ORN_W);
});

test('placeAll: 편지가 늘어도 이미 걸린 것은 움직이지 않는다', () => {
  const first = placeAll([{ id: 'a', x: 44, y: 90 }]);
  const later = placeAll([{ id: 'a', x: 44, y: 90 }, ...ids(200).map((id, i) => ({ id, x: 40 + i % 20, y: 40 + i % 60 }))]);
  assert.deepEqual(first[0], later[0]);
});
