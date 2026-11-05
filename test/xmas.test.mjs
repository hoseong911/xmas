// xmas/tree-layout.js 순수 로직 단위 테스트. 빌드툴 없이 `node --test` 로 실행한다.
//   실행: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TREE, slotCapacity, rowsFor, slotIndex, ornamentWidth, halfWidthAt, hash01, layout
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

test('ornamentWidth: 편지가 많아질수록 오너먼트가 작아진다', () => {
  assert.ok(ornamentWidth(6) > ornamentWidth(12));
  assert.ok(ornamentWidth(12) > ornamentWidth(24));
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

test('layout: 아래 줄 오너먼트가 서로 심하게 겹치지 않는다', () => {
  const out = layout(ids(100));
  const w = out[0].w;
  // 맨 아래 줄만 본다 — 가장 빽빽한 줄이다
  const bottom = out.filter(o => o.y > TREE.baseY - 3).sort((a, b) => a.x - b.x);
  for (let i = 1; i < bottom.length; i++) {
    assert.ok(bottom[i].x - bottom[i - 1].x > w * 0.45,
      `너무 붙었다: ${bottom[i - 1].x} / ${bottom[i].x} (너비 ${w})`);
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
