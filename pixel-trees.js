/* ════════════════════════════════════════════════════════════════
   배경에 서 있는 픽셀 크리스마스트리.

   왜 만들었나 — 밤의 학교 사진(사진)과 큰 트리(그림)가 서로 겉돌았다.
   둘 사이에 **큰 트리와 같은 색을 쓴 작은 트리 몇 그루**를 세우니 하나의
   풍경으로 읽힌다. 일부러 네모 블록으로 쌓아 옛날 게임 그림처럼 두었다 —
   사진을 닮게 그리려 들면 어설픈 쪽이 더 도드라진다.

   화면에 바로 그리는 SVG다(그림 파일이 아니다). 그래서
     · 큰 TV에서도 블록이 뭉개지지 않고,
     · 색을 고칠 때 그림을 다시 만들지 않아도 된다.

   건물 그림(.xm-campus)은 넓은 화면에서 아래가 잘리므로 **나무를 그림 안에
   그려 넣으면 PC에서 안 보인다.** 그래서 화면 바닥에 따로 세운다.
   ════════════════════════════════════════════════════════════════ */

/** 큰 트리(tree-layout.js의 TIERS)에서 가져온 색을 어둡게 내린 것 */
const LEAF = ['#49b5a8', '#3b9b90', '#2f8076', '#26685f'];
const TRUNK = '#4a3524';
const SNOW  = '#cfe6f2';
const LIGHTS = ['#f0c457', '#e4635a', '#f0889f', '#bfe4f5', '#ffe9b0'];

/** 자리에서 늘 같은 0~1 값을 뽑는다 — 새로고침해도 같은 나무가 서 있게 */
function rnd(a, b) {
  let h = (2166136261 ^ (a * 374761393) ^ (b * 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) % 10000 / 10000;
}

/**
 * 픽셀 트리 한 그루를 SVG 문자열로.
 * 가지를 세 단으로 쌓는다 — 단마다 폭이 0에서 넓어졌다가 다음 단에서 다시 좁아진다.
 * 한 번에 뾰족하게 좁히면 삼각형 하나가 되어 크리스마스트리로 안 보인다.
 * @param {number} seed 그루마다 다른 모양이 나오게 하는 씨앗
 */
function treeSVG(seed) {
  const tiers = [3, 4, 5];                     // 단마다 몇 줄인가
  const half  = [2, 3, 4];                     // 단마다 가장 넓을 때 반쪽 폭(블록)
  const W = half[2] * 2 + 1;                   // 블록 단위 가로
  const rows = [];                             // [y, 왼쪽x, 폭]

  let y = 0;
  tiers.forEach((n, t) => {
    for (let i = 0; i < n; i++) {
      // 단 안에서 아래로 갈수록 넓어진다. 맨 윗줄은 한 블록.
      const hw = Math.round((half[t] * (i + 1)) / n);
      rows.push([y, half[2] - hw, hw * 2 + 1, t]);
      y++;
    }
  });
  const H = y + 2;                             // 기둥 두 줄

  const px = [];
  for (const [ry, rx, rw, t] of rows) {
    for (let i = 0; i < rw; i++) {
      const x = rx + i;
      let fill = LEAF[t + (i === 0 || i === rw - 1 ? 1 : 0)] || LEAF[3];
      // 눈이 왼쪽 위에서 내려와 왼쪽 어깨에 쌓인다
      if (i === 0 && ry > 0 && rnd(seed, ry * 7) < 0.45) fill = SNOW;
      // 전구는 드문드문
      else if (rnd(seed + 31, ry * 13 + i) < 0.11) {
        fill = LIGHTS[Math.floor(rnd(seed + 57, ry * 17 + i) * LIGHTS.length)];
      }
      px.push(`<rect x="${x}" y="${ry}" width="1" height="1" fill="${fill}"/>`);
    }
  }
  // 기둥
  px.push(`<rect x="${half[2]}" y="${y}" width="1" height="2" fill="${TRUNK}"/>`);
  // 꼭대기 별 한 블록
  px.push(`<rect x="${half[2]}" y="-1" width="1" height="1" fill="#f0c457"/>`);

  return `<svg viewBox="-0.5 -1.5 ${W + 1} ${H + 1.5}" preserveAspectRatio="xMidYMax meet"
               shape-rendering="crispEdges" aria-hidden="true">${px.join('')}</svg>`;
}

/* 세울 자리. [가로 위치 %, 키(0~1)]
   가운데(35~65%)는 큰 트리 밑동이 서는 자리라 비우고, **양 끝(0~8%, 92~100%)도
   비운다** — 거기에 "N통이 모였어요"와 구석 단추가 있어 글자 뒤가 어수선해진다. */
const SPOTS = [
  [21, 0.78], [28, 1.00], [34, 0.62],
  [66, 0.66], [73, 1.00], [79, 0.82],
];

/**
 * 건물 그림 위에 픽셀 트리를 세운다.
 * @param {Element} host .xm-campus 칸
 */
export function mountPixelTrees(host) {
  if (!host || host.querySelector('.xm-pxtree')) return;
  SPOTS.forEach(([left, scale], i) => {
    const el = document.createElement('div');
    el.className = 'xm-pxtree';
    el.style.left = left + '%';
    el.style.setProperty('--h', scale.toFixed(2));
    el.innerHTML = treeSVG(i * 101 + 7);
    // 나무 밑에 깔리는 옅은 빛. 전구가 눈에 비치는 느낌을 낸다.
    el.style.setProperty('--glow', (0.5 + rnd(i, 3) * 0.5).toFixed(2));
    host.appendChild(el);
  });
}
