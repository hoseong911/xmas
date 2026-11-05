# CLAUDE.md

이 파일은 Claude Code(claude.ai/code)가 이 저장소에서 일할 때 보는 안내다.

## 무엇인가

학교 축제용 **감사편지 트리**. 학생이 태블릿에서 선생님께 감사편지를 쓰면 큰 화면의
크리스마스트리에 오너먼트로 걸린다. 빌드 도구 없는 순수 HTML/CSS/JS이고
GitHub Pages로 배포된다(`hoseong911/xmas` → `https://hoseong911.github.io/xmas/`).

원래 [`hoseong911/hoistory`](https://github.com/hoseong911/hoistory)의 `xmas/` 폴더였고
2026-11-05에 이 저장소로 떼어 냈다. `shared/` 는 그때 hoistory에서 복사해 온 사본이다
(lms2027을 떼어 낼 때와 같은 방식). **hoistory 쪽 `shared/` 와 저절로 같이 바뀌지 않는다.**

## 화면

| 파일 | 하는 일 | 어디에 띄우나 |
|------|---------|----------------|
| `index.html` | 학생 작성. 학번·이름 → 선생님 → 편지 → 오너먼트 → 달기 | 축제 부스 태블릿 |
| `tree.html` | 전시용 트리. 실시간으로 오너먼트가 늘어난다 | 큰 화면(TV, 빔) |
| `teacher.html` | 선생님이 이름을 고르고 네 자리 번호로 자기 편지를 읽는다 | 선생님 각자 폰 |
| `admin.html` | 선생님 등록과 번호 발급, 편지 숨기기, 공개일 설정 | 관리자 |

| 모듈 | 하는 일 |
|------|---------|
| `xmas-core.js` | Firebase 연결, 설정, 서버 시각, 밤하늘 눈 내리기 |
| `ornaments.js` | 오너먼트 그림 10종 |
| `tree-layout.js` | 트리에 거는 자리 계산 (테스트: `test/xmas.test.mjs`) |
| `xmas.css` | 네 화면 공통 스타일 |
| `_preview.html` | PC/패드/폰 동시 미리보기 |

실행: `npm run preview` 뒤 `http://localhost:4173/xmas/_preview.html`. 테스트: `npm test`.

## Firebase는 hoistory와 같은 프로젝트를 쓴다 — 중요

프로젝트는 **`ho0911seong-56638`** 하나뿐이고 hoistory, lms2027과 같이 쓴다.
컬렉션 이름에 `xmas_` 접두어가 붙어 있어 섞이지 않는다.

**그래서 이 저장소에는 `firestore.rules` 와 `functions/` 가 없다.** 규칙 파일은
Firebase 프로젝트에 하나뿐이라 두 군데 두면 한쪽에서 배포할 때 다른 쪽을 덮어쓴다.
둘 다 hoistory 저장소에 있다.

| 고칠 것 | 있는 곳 | 배포 |
|---------|---------|------|
| 화면·스타일·모듈 | **이 저장소** | main에 push하면 GitHub Pages가 자동 배포 |
| 보안 규칙 (`xmas_*` 블록) | hoistory `firestore.rules` | `firebase deploy --only firestore:rules --project ho0911seong-56638` |
| 선생님 열람 함수 (`xmasLetters`) | hoistory `functions/index.js` | `firebase deploy --only functions:xmasLetters --project ho0911seong-56638` |

- Cloud Function의 CORS 허용 목록(`ALLOWED_ORIGINS`)은 **고칠 필요가 없다.**
  GitHub Pages 사용자 사이트라 origin이 `https://hoseong911.github.io` 로 hoistory와 같다.
- 로컬 미리보기(`http://localhost:4173`)도 이미 허용 목록에 들어 있다.

## 데이터를 둘로 나눈 까닭 — 여기가 이 앱의 핵심이다

선생님이 고른 공개 범위는 **학생이 보는 트리는 완전 익명, 선생님만 자기 편지를 읽는다**이다.
학생도 선생님도 Firebase Auth로 로그인하지 않기 때문에(선생님은 네 자리 번호뿐) 보안 규칙으로는
번호를 확인해 줄 수 없다. 그래서 **애초에 클라이언트가 받을 수 있는 것을 줄이는 쪽으로** 설계했다.

| 컬렉션 | 내용 | 읽기 |
|--------|------|------|
| `xmas_letters/{id}` | 학번, 이름, 받는 선생님, 내용, 오너먼트, `hidden` | **관리자만.** 선생님 화면은 Cloud Function을 거친다 |
| `xmas_ornaments/{id}` | `ornament`, `createdAt` 뿐 | 누구나(트리 화면) |
| `xmas_teachers/{id}` | 이름, 담당, 순서 | 누구나(학생이 고른다) |
| `xmas_teacher_pins/{id}` | 네 자리 번호, 실패 횟수, 잠금 시각 | **관리자만** |
| `settings/xmas_config` | 제목, 안내 문구, `openAt`, `closed`, 글자 수 | 누구나 |

- **두 문서의 id가 같다.** 학생이 보낼 때 id를 먼저 만들어 `writeBatch`로 편지와 오너먼트를
  함께 쓴다. id가 같아야 선생님 화면이 "내 편지가 트리 어디에 걸렸는지"를 찾을 수 있다.
- **`xmas_ornaments`에 `teacherId`를 넣지 말 것.** 넣으면 통신을 들여다보는 것만으로 어느
  오너먼트가 누구 앞으로 간 편지인지 드러난다. 선생님별 보기는 Cloud Function이 돌려주는
  편지 id 목록으로 한다.
- **hoistory `firestore.rules` 맨 아래 catch-all의 제외 목록에 `xmas_letters`와
  `xmas_teacher_pins`가 들어 있다.** 규칙은 겹치면 OR로 합쳐지므로 거기서 빼지 않으면
  위에서 닫아도 실제로는 열려 있다. 규칙을 손볼 때 이 목록을 같이 보라.

## Cloud Function `xmasLetters`

`POST { teacherId, pin }` → 번호를 확인하고 그 선생님 편지만 돌려준다.
주소는 `https://asia-northeast3-ho0911seong-56638.cloudfunctions.net/xmasLetters`
(`xmas-core.js`의 `XMAS_FN_URL`).

- 번호 확인과 실패 횟수 기록을 한 트랜잭션에서 한다. 8번 틀리면 10분 잠근다.
- **공개일(`openAt`) 전에는 내용을 주지 않는다** — `{ locked: true, count, letterIds }` 만
  돌려줘서 "N통 도착, 12월 24일에 열립니다"와 트리에서 빛내기만 되게 한다.
- 돌려주는 편지에는 `teacherId`와 `hidden`을 담지 않는다(필요 없는 것은 내보내지 않는다).
- 런타임은 **Node 22**다(Node 20은 2026-10-30에 수명이 끝나 배포가 막힌다).

## 화면에서 지킨 것

- **공용 태블릿이라 아무것도 남기지 않는다.** 입력은 메모리 변수에만 두고
  sessionStorage/localStorage를 쓰지 않는다. 보내면 바로 비우고 첫 화면으로 가며,
  2분 30초 동안 아무 동작이 없으면 물어본 뒤(15초) 지운다. 어드민에서 받기를 멈춰도
  쓰던 내용이 지워진다.
- **오너먼트는 `shared/icons.js`로 못 만든다.** 그쪽 `icon()`은 바깥 `<svg>`에
  `fill="none" stroke="currentColor"`를 박는 한 색 선 아이콘 전용이다. 오너먼트는 색을 채운
  콘텐츠 그림이라 `ornaments.js`에 따로 뒀다. **화면의 UI 아이콘은 그대로 `shared/icons.js`를 쓴다.**
- **오너먼트 하나하나에 `<defs>`나 `id`를 넣지 말 것.** 한 화면에 수백 개가 뜨므로
  id가 겹쳐 그라데이션이 서로 엉킨다. 대신 **문서에 그라데이션 한 벌만 두고 모두가 그걸
  가리킨다** — `ornaments.js`의 `GRADIENTS`(빛 `xmSheen`, 그늘 `xmShade`, 선용 `xmSheenLine`,
  금색 둘레 빛 `xmHalo`)를 `ensureDefs()`가 첫 그림을 그릴 때 숨은 `<svg>`로 한 번 붙인다.
  objectBoundingBox 기준이라 크기와 자리가 제각각인 도형에 저마다 알아서 맞는다.
  빛이 더 필요하면 `GRADIENTS`에 한 줄을 더하지, 오너먼트 안에 defs를 만들지 않는다.
- 빛은 `gloss(도형)`으로 입힌다 — 같은 도형을 `xmSheen`과 `xmShade`로 두 번 덧칠한다.
  그래서 도형 조각을 `FILL` 자리를 비워 둔 문자열 상수로 두었다(`BELL_SHAPE` 등).
  **무늬를 먼저 얹고 그 위에 빛을 비춘다** — 순서를 바꾸면 무늬만 혼자 납작해 보인다.
- 트리에 거는 자리는 `tree-layout.js`가 정한다. 편지가 늘면 줄 수가 늘고 오너먼트가 작아지며,
  이미 걸린 것도 새 자리로 미끄러져 간다(CSS transition). 자리는 편지 id에서 뽑은 고정 난수로
  흔들어 격자 티를 없앤다 — **흔드는 폭은 트리 너비가 아니라 칸 간격에 맞춰야 한다**
  (트리 너비에 맞추면 아래 줄에서 옆칸까지 넘어가 포개진다).
- **트리 그림도 `tree-layout.js`에 있다**(`TIERS`, `tierPath`, `starPath`). 가지는 밑단이 둥글게
  물결치는 네 단이고, 색은 민트에서 청록으로 내려간다. 참고한 것은 인스타에서 유행한 트리
  편지 서비스들이다 — 뾰족한 삼각형으로 두면 색을 아무리 바꿔도 종이 공작처럼 보인다.
  그림과 거는 자리를 한 파일에 둔 것은 둘이 어긋나면 장식이 가지 밖 허공에 뜨기 때문이다.
  `TREE` 상수는 `TIERS`에서 뽑은 값이고, 테스트가 거는 띠와 실제 가지를 대조한다.
- 가지 옆선을 불룩하게 하는 제어점을 **꼭대기와 밑끝을 잇는 직선 위에 두면 아무 일도
  안 일어난다**(0.60/0.58이 꼭 그랬다). 같은 높이에서 직선보다 바깥에 있도록 가로를 크게 잡는다.
- 꼭대기 별빛이 viewBox 위로 넘치면 거기서 잘려 네모 자국이 남는다(`cy - r >= 0`).
  옅은 별을 한 겹 더 까는 방식은 밤하늘 위에서 회색 테두리처럼 보여 빛이 아니라 그림자가 된다.
- 바닥 눈은 가로로 꽉 찬 띠가 아니라 타원으로 둔다. 띠는 트리 칸 가장자리에서 네모로 잘린다.
- **트리 칸은 폭 하나만 정한다**(`width: min(100%, 78vh * 100 / 130)`). `aspect-ratio`가 높이를
  끌어내므로 폭 100%로 두면 세로로 긴 화면에서 밑동이 잘려 나간다.
- **`canvas.xm-snow`에는 `width:100%; height:100%`를 꼭 적는다.** canvas는 대체 요소라
  `position:fixed; inset:0`만으로는 고유 크기(300x150)에 머물러 눈이 왼쪽 위 구석에만 내린다.
- 글자 수 조건은 화면에 문구로 안내하지 않고 버튼이 켜지는 것으로만 알린다
  (규칙을 알려 주면 그 선까지 긁어 보게 된다).

## 디자인 규칙 (hoistory에서 그대로 가져온 것)

- 색은 `shared/theme.css`의 `--hi-*` 토큰만 쓴다. 이 앱은 `<body class="hi-preset-xmas">`
  (밤하늘 남색 + 골드), 어드민만 `hi-preset-admin`.
- **유니코드 이모지 금지.** UI 아이콘은 `shared/icons.js`의 `icon('이름', 크기)`로 렌더한다.
  정적 HTML에는 `<span data-icon="이름" data-icon-size="24"></span>`로 두고 스크립트에서 주입한다.
- **버튼·링크 문구에 화살표(←, →, ↑, ↓) 금지.** 예외는 목록 순서 이동(↑↓)뿐.
- **사용자에게 보이는 문구에 가운뎃점(·) 금지.** 쉼표나 조사로 바꾼다(코드 주석은 예외).
- 카드 가장자리 색 강조 띠("네일팁") 금지.
- 어드민 탭은 중앙 정렬, 메뉴 라벨은 영문 대문자(`TEACHER` / `LETTER` / `SETTING`),
  브라우저 제목은 `"웹앱 제목 - 관리자 모드"`, 로그인 화면은 login-title = 앱 이름,
  login-sub = "관리자 모드".
- 모든 대화·주석·화면 문구는 한국어로 쓴다.

## Git 규칙

- 코드를 고치면 확인 없이 바로 `git add → git commit → git push` 한다.
- 되돌릴 수 없는 것(`reset --hard`, force push, 브랜치 삭제)만 미리 묻는다.
