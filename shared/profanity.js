/**
 * ============================================================
 *  HOISTORY · shared/profanity.js  v1.0
 * ------------------------------------------------------------
 *  비속어/욕설 검사 공통 모듈.
 *  blind_ryeo · s_threads에 동일하게 들어있던 BAD_WORDS 리스트와
 *  검사 로직을 한 곳으로 추출.
 *
 *  사용:
 *    import { containsBadWord } from '/hoistory/shared/profanity.js';
 *    if (containsBadWord(content)) {
 *      showToast('부적절한 표현이 포함되어 있어요', true);
 *      return;
 *    }
 * ============================================================
 */

// ─── 기본 사전 ──────────────────────────────────────────────
const DEFAULT_BAD_WORDS = [
  // 한국어
  "씨발","시발","쉬발","씨바","시바","ㅅㅂ","ㅆㅂ",
  "개새끼","개새","ㄱㅅㄲ","개샊","개섀끼",
  "병신","ㅂㅅ","벙신","뻥신","지랄","ㅈㄹ","지ㄹㄹ",
  /* 이 사전은 hoistory 쪽과 다르다 — 거기서 쓰던 "미치", "미친", "새끼",
     "죽어", "죽여", "멍청"을 좁은 형태로 바꿨다. 이 앱은 감사편지를 받는데
     "미치도록 고마워요", "새끼손가락 걸고", "죽어도 못 잊어요", "멍청한 질문을 해도
     들어 주셨어요"가 통째로 막혀 학생이 왜 안 되는지 모르고 포기한다. */
  "미친놈","미친년","미친새","미칀","엠창","ㅁㅊ",
  "쌔끼","섀끼","ㅅㄲ","이새끼","저새끼","니새끼","새끼야",
  /* 아래 다섯 줄은 2026-11-25에 좁혔다. 감사편지를 받는 앱이라 **잘못 막는 것이
     놓치는 것보다 아프다** — 학생에게는 "쓸 수 없는 말이 있어요"라고만 뜨고 어느
     말인지 안 알려 주므로, 300자 편지에서 찾아내지 못하고 그냥 포기한다.
     실제로 막히던 말: "꺼지지 않는 열정", "책을 뒤지며", "죽어라 공부했더니",
     "다시 보지 못해서", "자지 않고 공부했어요", "멍청이 같은 질문을 해도". */
  "꺼져라","꺼지라","꺼져버려",
  "죽어버","죽여버",
  "뒈져","뒈지","뒤져라","뒤질래","뒤져버",
  "창녀","창년","걸레",
  /* 이 둘은 욕이기도 하고 '보다/자다'의 한 토막이기도 하다. 뒤에 어미가 붙으면 욕이
     아니다("보지 못해", "보지만", "자지 않고", "자지러지게"). 사전은 정규식도 받는다. */
  /보지(?!않|못|마|만|말|는|도|라|러|요|무)/,
  /자지(?!않|못|마|만|말|는|도|라|러|요|무)/,
  "강간","성폭","성추","닥쳐","닥ㅊ",
  "느금마","느그엄마","니애미","니에미","니엄마",
  "존나","ㅈㄴ","좆","좆같","좋같","ㅈㅈ",
  "빡대가리","찐따","머저리","멍청아",
  "ㅗㅗ","개같","개 같",
  // 영어
  "fuck","shit","bitch","asshole","bastard"
];

let _wordList = [...DEFAULT_BAD_WORDS];
let _normalizedCache = null;


// ────────────────────────────────────────────────────────────
//  Public API
// ────────────────────────────────────────────────────────────

/**
 * 텍스트에 비속어가 포함되어 있는지 확인합니다.
 * - 공백 제거 + 소문자 변환 후 부분일치 검사
 * @param {string} text
 * @returns {boolean}
 */
/** 사전 한 칸과 맞는지 본다. 글자면 부분일치, 정규식이면 그대로 시험한다. */
function _hit(entry, text) {
  return entry instanceof RegExp ? entry.test(text) : text.includes(entry);
}

export function containsBadWord(text) {
  if (!text) return false;
  const normalized = String(text).replace(/\s/g, '').toLowerCase();
  if (!_normalizedCache) _buildCache();
  return _normalizedCache.some(w => _hit(w, normalized));
}

/**
 * 발견된 첫 비속어를 반환합니다 (디버깅·관리자용).
 * @returns {string | null}
 */
export function findBadWord(text) {
  if (!text) return null;
  const normalized = String(text).replace(/\s/g, '').toLowerCase();
  if (!_normalizedCache) _buildCache();
  const w = _wordList.find((_, i) => _hit(_normalizedCache[i], normalized));
  return w == null ? null : (w instanceof RegExp ? w.source : w);
}

/**
 * 사전을 교체합니다 (기본 사전을 무시).
 * @param {string[]} words
 */
export function setBadWords(words) {
  _wordList = Array.isArray(words) ? [...words] : [];
  _normalizedCache = null;
}

/**
 * 사전에 단어를 추가합니다.
 * @param {string | string[]} words
 */
export function addBadWords(words) {
  const arr = Array.isArray(words) ? words : [words];
  arr.forEach(w => { if (w && !_wordList.includes(w)) _wordList.push(w); });
  _normalizedCache = null;
}

/**
 * 사전 목록을 반환합니다.
 * @returns {string[]}
 */
export function getBadWords() {
  return [..._wordList];
}


// ────────────────────────────────────────────────────────────
function _buildCache() {
  _normalizedCache = _wordList.map(w =>
    w instanceof RegExp ? w : String(w).toLowerCase().replace(/\s/g, ''));
}

/**
 * 뜻이 있는 글자 수. 편지 최소 길이를 재는 데 쓴다.
 * 공백과 "ㅋㅋㅋ·ㅎㅎ·ㅠㅠ" 처럼 홀로 쓴 자모는 세지 않고,
 * 같은 글자를 세 번 넘게 이은 것("!!!!!", "하하하하")은 한 번으로 셈한다.
 * @param {string} text
 * @returns {number}
 */
export function meaningfulLen(text) {
  if (!text) return 0;
  return String(text)
    .replace(/[ᄀ-ᇿ㄰-㆏ꥠ-꥿ힰ-퟿]/gu, '')
    .replace(/\s/gu, '')
    .replace(/(.)\1{2,}/gu, '$1')
    .length;
}
