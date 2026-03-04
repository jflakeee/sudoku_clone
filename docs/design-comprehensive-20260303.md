# 스도쿠 리그 - 종합 기능 확장 설계문서

> 작성일: 2026-03-03
> 대상 버전: v3 (현재 v2 기반)
> 현재 상태: 클래식/타임어택, 일일도전, 5단계 난이도, 5개 보드 크기(4~16), 대각선 변형, 업적 시스템, 테마 스킨, 게임 기록/재도전, 인쇄/내보내기 구현 완료

---

## 1. 프로젝트 개요

### 1.1 현재 상태

스도쿠 리그는 바닐라 JavaScript ES Module 기반의 PWA 스도쿠 게임이다. 서버 없이 LocalStorage만으로 모든 데이터를 영속화하며, Service Worker를 통해 오프라인 사용을 지원한다.

**구현 완료된 기능:**

| 영역 | 기능 |
|------|------|
| 게임 모드 | 클래식, 타임어택 |
| 보드 크기 | 4x4, 6x6, 9x9, 12x12, 16x16 |
| 변형 | 기본(standard), 대각선(diagonal) |
| 도전 | 일일 도전 (시드 기반 동일 퍼즐) |
| 기록 | 게임 기록 아카이브 (최대 200개), 재도전 |
| 인쇄 | 1/2/4/6/8개 레이아웃, 모범답안 토글, PNG/SVG 내보내기 |
| 업적 | 20개 업적, 4개 카테고리, 토스트 알림 |
| 테마 | 6개 컬러 테마 (default, ocean, forest, sunset, lavender, rose) |
| 기타 | 다크모드, 메모(pencil marks), 힌트, 실행취소, 키보드 지원 |

**기술 스택:**
- 바닐라 JavaScript (ES Module) — 번들러 없음
- CSS 4개 파일 (main, grid, animations, screens) + themes.css + print.css
- LocalStorage 영속화
- Service Worker 오프라인 캐시 (`sudoku-v20`)
- Playwright E2E 테스트 148개 (19개 spec 파일)
- Web Worker 기반 대형 보드 퍼즐 생성

### 1.2 목표

사용자 리텐션과 재미 요소를 대폭 강화하기 위해 23개 신규 기능을 3개 Phase로 나누어 구현한다.
- **Phase 1**: 기존 아키텍처에 최소 변경으로 빠르게 구현 가능한 기능 (각 1~3일)
- **Phase 2**: 중간 규모 확장, 새로운 UI/시스템 추가 필요 (각 3~7일)
- **Phase 3**: 대규모 시스템 추가 또는 전체 리팩토링 필요 (각 1~2주)

---

## 2. 현재 아키텍처 요약

### 2.1 모듈 구조

```
src/js/
├── app.js                  ← 라우터/네비게이션 (~610줄)
├── core/
│   ├── board-config.js     ← 보드 크기 → 블록 크기 매핑
│   ├── generator.js        ← 퍼즐 생성 (boardSize, variant 파라미터)
│   ├── solver.js           ← 백트래킹 솔버 (MRV 휴리스틱, variant 지원)
│   ├── scorer.js           ← 점수 계산 (셀/완료/타임어택 보너스)
│   ├── validator.js        ← 이동 검증, 충돌 감지, 대각선 지원
│   └── puzzle-worker.js    ← Web Worker 퍼즐 생성
├── game/
│   ├── board.js            ← Board 클래스 (~700줄) — 중앙 게임 상태
│   ├── input.js            ← InputHandler (터치/클릭/키보드)
│   ├── notes.js            ← Notes 메모 매니저 (variant 지원)
│   ├── hints.js            ← 힌트 시스템 (5가지 전략, 대각선 지원)
│   ├── history.js          ← 실행취소 스택
│   └── timer.js            ← 타이머 (카운트다운 지원)
├── ui/
│   ├── grid.js             ← GridUI (동적 그리드, variant별 CSS 클래스)
│   ├── highlight.js        ← HighlightUI (선택/관련셀/대각선 하이라이트)
│   ├── numberpad.js        ← NumberpadUI (동적 버튼 생성)
│   ├── toolbar.js          ← ToolbarUI
│   └── animations.js       ← CSS 애니메이션 유틸
├── screens/
│   ├── main.js, game.js, complete.js, daily.js
│   ├── mode-select.js, history.js, print.js
│   ├── profile.js, stats.js, awards.js, settings.js
│   ├── ranking.js, tutorial.js
│   └── (신규 화면은 여기 추가)
├── utils/
│   ├── storage.js          ← LocalStorage 래퍼 (~450줄)
│   ├── achievements.js     ← 업적 시스템 (20개 정의 + 조건 체크)
│   ├── daily-seed.js       ← 시드 기반 RNG
│   ├── export.js           ← PNG/SVG 내보내기
│   └── sound.js            ← 사운드 매니저
└── sw.js                   ← Service Worker
```

### 2.2 네비게이션 흐름 (현재)

```
메인 → 새게임 → mode-select → 난이도모달 → game → complete → (메인 | mode-select)
메인 → 일일도전 → game → complete
메인 → 계속하기 → game (loadSaved=true)
메인 → 게임기록 → history → replay → game
메인 → 인쇄 → mode-select(forPrint) → 난이도모달 → N개 생성 → print
메인 → 프로필 → stats | awards | settings | tutorial | rules
history → print → 인쇄
```

### 2.3 저장소 키 (현재 v2)

| 키 | 용도 | 데이터 타입 |
|----|------|-------------|
| `sudoku_currentGame` | 진행 중 게임 상태 | Object (JSON) |
| `sudoku_stats` | 클래식 모드 통계 | Object (난이도별) |
| `sudoku_stats_timeAttack` | 타임어택 통계 | Object (난이도별) |
| `sudoku_settings` | 사용자 설정 | Object |
| `sudoku_dailyChallenge` | 일일 도전 진행 | `{completed: string[], streak: number}` |
| `sudoku_gameHistory` | 완료 게임 아카이브 | `GameHistoryEntry[]` (최대 200개) |
| `sudoku_achievements` | 업적 해금 타임스탬프 | `{[id]: ISO_string}` |
| `sudoku_version` | 마이그레이션 버전 | Number (현재 2) |

### 2.4 변형 시스템 현재 구조

현재 `variant` 파라미터는 문자열(`'standard'` | `'diagonal'`)로 코어 엔진 전체에 관통한다:
- `solver.js`: `isValid()`, `getCandidates()`, `solve()`, `countSolutions()` — 모두 `variant` 파라미터 수용
- `validator.js`: `checkConflicts()` — variant별 충돌 셀 추가
- `notes.js`: `removeFromRelated()` — variant별 메모 자동 제거
- `hints.js`: `getHint()` — variant별 힌트 전략 추가
- `generator.js` / `puzzle-worker.js`: variant 전달
- `Board` 클래스: `this.variant` 필드, `getState()`/`loadState()` 직렬화

이 구조는 새 변형을 추가할 때마다 각 파일의 if/switch 분기가 늘어나는 한계가 있다.

---

## 3. 전체 아키텍처 변경 사항

### 3.1 VariantRules 추상화 리팩토링 (Phase 1 선행 작업)

현재 `variant === 'diagonal'` 같은 하드코딩 분기를 **VariantRules 인터페이스**로 추상화한다. 이를 통해 새 변형 추가 시 코어 엔진 수정 없이 규칙 객체만 등록하면 된다.

```javascript
// core/variant-rules.js (신규)

/**
 * @typedef {Object} VariantRule
 * @property {string} key - 변형 식별자 ('standard', 'diagonal', 'antiKnight', ...)
 * @property {string} label - 한국어 표시명
 * @property {string} description - 규칙 설명
 * @property {function} getExtraCells - (row, col, boardSize) => {row, col}[]
 *   해당 셀과 같은 그룹에 속하는 "추가" 셀 목록 반환
 * @property {function} getCSSClass - (row, col, boardSize) => string|null
 *   셀에 부여할 추가 CSS 클래스 (시각적 표시용)
 * @property {number[]} supportedSizes - 지원하는 보드 크기 목록
 */

const VARIANT_REGISTRY = new Map();

export function registerVariant(rule) { ... }
export function getVariantRule(key) { ... }
export function getExtraCells(variantKey, row, col, boardSize) { ... }
```

**영향 범위:**
- `solver.js`: `isValid()` → `getExtraCells()` 호출로 통합
- `validator.js`: `checkConflicts()` → `getExtraCells()` 호출로 통합
- `notes.js`: `removeFromRelated()` → `getExtraCells()` 호출로 통합
- `hints.js`: variant별 힌트 → `getExtraCells()` 기반 일반화
- `grid.js`: CSS 클래스 부여 → `getCSSClass()` 호출
- `highlight.js`: 관련 셀 하이라이트 → `getExtraCells()` 호출

**마이그레이션 전략:** 기존 `'diagonal'` 코드를 VariantRules 레지스트리 기반으로 교체하되, 기존 API 시그니처는 유지하여 하위 호환성 보장.

### 3.2 저장소 확장 (v2 → v3)

```javascript
// 신규/변경 저장소 키
const KEYS = {
    // ... 기존 유지
    USER_PROFILE: 'sudoku_userProfile',     // XP/레벨/칭호
    STREAK_DATA: 'sudoku_streak',           // 스트릭 시스템
    WEEKLY_CHALLENGE: 'sudoku_weeklyChallenge', // 주간 챌린지
};

// 마이그레이션 v2 → v3
if (storedVersion < 3) {
    // userProfile 초기화
    if (!readJSON(KEYS.USER_PROFILE)) {
        writeJSON(KEYS.USER_PROFILE, { xp: 0, level: 1, title: '' });
    }
    // streak 초기화
    if (!readJSON(KEYS.STREAK_DATA)) {
        writeJSON(KEYS.STREAK_DATA, { current: 0, best: 0, lastDate: null });
    }
}
```

### 3.3 Board 클래스 확장

```javascript
// board.js 확장 필드
class Board {
    constructor() {
        // ... 기존 필드
        this._cellColors = null;        // 셀 컬러 마킹용 (Phase 1.6)
    }

    getState() {
        return {
            // ... 기존 필드
            cellColors: this._cellColors,
        };
    }
}
```

### 3.4 settings 확장

```javascript
function getDefaultSettings() {
    return {
        // ... 기존 설정
        autoShowMistakes: false,    // 실수 자동 표시 (Phase 1.5)
        autoFillNotes: false,       // 자동 메모 채우기 기본값은 false
        soundEnabled: false,        // 사운드 효과 (Phase 3.20)
        colorblindMode: false,      // 컬러블라인드 모드 (Phase 3.22)
        language: 'ko',             // 다국어 (Phase 3.23)
    };
}
```

---

## 4. Phase별 기능 목록

### Phase 1 — 즉시 구현 (각 1~3일)

#### 4.1 Anti-Knight 변형

**설명:** 체스 나이트 이동 위치(L자)에 같은 숫자를 놓을 수 없는 변형.

**기술 설계:**
- `variant-rules.js`에 `'antiKnight'` 규칙 등록
- `getExtraCells()`: 8개 나이트 이동 좌표 반환 (보드 범위 내 필터링)
  - `(row-2,col-1)`, `(row-2,col+1)`, `(row-1,col-2)`, `(row-1,col+2)`, `(row+1,col-2)`, `(row+1,col+2)`, `(row+2,col-1)`, `(row+2,col+1)`
- `mode-select.js`: variant 옵션에 `'antiKnight'` 추가
- CSS: `.anti-knight` 클래스 (나이트 이동 셀 시각적 표시는 불필요 — 모든 셀이 해당)
- 지원 크기: 9x9 전용 (4x4/6x6은 제약이 너무 강함)

**영향 파일:** `variant-rules.js`(신규), `solver.js`, `validator.js`, `notes.js`, `hints.js`, `grid.js`, `highlight.js`, `mode-select.js`, `index.html`

**의존:** VariantRules 리팩토링 (3.1) 선행

**우선순위 근거:** diagonal 구현 패턴을 그대로 복제하므로 매우 빠름. 변형 시스템 확장의 첫 검증 사례.

#### 4.2 Anti-King 변형

**설명:** 대각선으로 인접한 셀(킹 이동 중 대각선)에 같은 숫자를 놓을 수 없는 변형.

**기술 설계:**
- `variant-rules.js`에 `'antiKing'` 규칙 등록
- `getExtraCells()`: 4개 대각선 인접 좌표 반환
  - `(row-1,col-1)`, `(row-1,col+1)`, `(row+1,col-1)`, `(row+1,col+1)`
- Anti-Knight와 동시 구현 (동일 패턴)
- 지원 크기: 9x9 전용

**영향 파일:** Anti-Knight과 동일

**의존:** VariantRules 리팩토링 (3.1) 선행

**우선순위 근거:** Anti-Knight와 완전히 동일한 구현 패턴. 동시 구현 시 추가 비용 최소.

#### 4.3 자동 메모 채우기

**설명:** 버튼 하나로 현재 보드 상태 기반 모든 빈 셀의 가능한 후보 숫자를 일괄 입력.

**기술 설계:**
- `toolbar.js`에 "자동 메모" 버튼 추가 (`data-action="auto-notes"`)
- `input.js`에 `autoFillNotes()` 메서드 추가:
  ```javascript
  autoFillNotes() {
      const board = this.board.getBoard();
      for (let r = 0; r < boardSize; r++) {
          for (let c = 0; c < boardSize; c++) {
              if (board[r][c] !== 0 || this.board.isGiven(r, c)) continue;
              const candidates = getCandidates(board, r, c, boardSize, blockSize, variant);
              for (const num of candidates) {
                  this.board.notes.toggle(r, c, num); // add if not present
              }
          }
      }
  }
  ```
- Undo 지원: 전체 메모 상태 스냅샷을 히스토리에 기록
- 기존 메모가 있는 경우: 기존 메모 유지 + 새로운 후보만 추가 (또는 초기화 후 재계산 — 사용자 선택)

**영향 파일:** `input.js`, `toolbar.js`, `index.html`, `css/main.css`

**의존:** 없음 (독립적)

**우선순위 근거:** solver.js의 `getCandidates()` 이미 구현됨. UI 버튼 하나만 추가하면 완성.

#### 4.4 스트릭(연속 풀기) 시스템

**설명:** 매일 최소 1개 퍼즐을 풀면 연속 카운트 증가, 연속 기록 깨지면 리셋.

**기술 설계:**
- `storage.js`에 `sudoku_streak` 키 추가:
  ```javascript
  { current: number, best: number, lastDate: 'YYYY-MM-DD' }
  ```
- `complete.js`에서 게임 완료 시 `updateStreak()` 호출:
  - `lastDate === today`: 무변화
  - `lastDate === yesterday`: `current++`, `best = max(best, current)`
  - 그 외: `current = 1`
- 메인 화면에 연속 기록 표시 (불꽃 아이콘 + 숫자)
- 업적 연동: `achievements.js`에 스트릭 관련 업적 추가 (연속 7일, 30일, 100일)

**영향 파일:** `storage.js`, `complete.js`, `main.js`, `achievements.js`, `index.html`, `css/screens.css`

**의존:** 없음

**우선순위 근거:** 일일 도전의 streak와 유사 패턴. 리텐션 효과가 매우 큼.

#### 4.5 실수 자동 표시 토글

**설명:** 설정 ON 시 잘못 입력한 숫자를 즉시 빨간색으로 표시.

**기술 설계:**
- `settings.js`에 `autoShowMistakes` 토글 추가 (기본: OFF)
- `input.js`의 `inputNumber()` 또는 `board.setCellValue()` 반환값 처리에서:
  - `valid === false`이고 `autoShowMistakes`가 ON이면 → 셀에 `.auto-mistake` 클래스 부여
  - 현재 이미 `valid` 체크 후 실수 카운트를 올리므로, UI 반영만 추가
- CSS: `.auto-mistake { color: var(--error-color); }` (기존 `.cell-error`와 구분)
- 기존 동작과의 차이: 현재는 solution 비교 없이 충돌(conflict)만 표시. 이 기능은 solution과 직접 비교하여 즉시 오답 표시.

**영향 파일:** `settings.js`, `input.js` (또는 `game.js`), `grid.js`, `css/grid.css`, `index.html`

**의존:** 없음

**우선순위 근거:** 설정 토글 하나 + CSS 클래스 하나로 완성. 초보자 경험 대폭 개선.

#### 4.6 셀 컬러 마킹

**설명:** 풀이 추론 시 셀에 색상을 표시하여 논리적 경로를 시각화. 4~6가지 색상 팔레트.

**기술 설계:**
- `Board` 클래스에 `_cellColors` 2D 배열 추가 (0 = 없음, 1~6 = 색상 인덱스)
- `toolbar.js`에 "마킹" 버튼 + 색상 팔레트 드롭다운 추가
- `input.js`에 마킹 모드 토글 + 클릭 시 색상 적용 로직
- `grid.js`에 셀 배경색 렌더링: `cell.style.backgroundColor = MARKING_COLORS[colorIdx]`
- Undo 지원: 마킹 변경도 히스토리에 기록
- JSON 직렬화: `getState()` / `loadState()`에 `cellColors` 포함

**색상 팔레트:**
```javascript
const MARKING_COLORS = [
    null,                    // 0: 없음
    'rgba(255,235,59,0.3)',  // 1: 노랑
    'rgba(76,175,80,0.3)',   // 2: 초록
    'rgba(33,150,243,0.3)',  // 3: 파랑
    'rgba(255,152,0,0.3)',   // 4: 주황
    'rgba(156,39,176,0.3)',  // 5: 보라
    'rgba(244,67,54,0.3)',   // 6: 빨강
];
```

**영향 파일:** `board.js`, `input.js`, `toolbar.js`, `grid.js`, `css/main.css`, `index.html`

**의존:** 없음

**우선순위 근거:** 고급 풀이자에게 필수적인 기능. Board 확장 패턴은 이미 검증됨.

---

### Phase 2 — 높은 가치 (각 3~7일)

#### 4.7 XP/레벨 시스템

**설명:** 퍼즐 완료 시 XP 획득, 레벨업 보상. 게이미피케이션의 핵심.

**기술 설계:**
- `storage.js`에 `sudoku_userProfile` 키:
  ```javascript
  { xp: number, level: number, title: string, unlockedRewards: string[] }
  ```
- `scorer.js` 확장: `calculateXP(difficulty, boardSize, time, mistakes)` 추가
  - 기본 XP = 점수의 1/10 (정수)
  - 레벨 커브: `requiredXP(level) = 100 * level * (level + 1) / 2`
- `complete.js`에서 XP 적용 + 레벨업 체크 → 레벨업 시 축하 표시
- 프로필 화면에 레벨/XP 바 표시
- 메인 화면 상단에 현재 레벨 뱃지

**영향 파일:** `storage.js`, `scorer.js`, `complete.js`, `profile.js`, `main.js`, `index.html`, `css/screens.css`

**의존:** 없음 (독립적이지만 Phase 2.13 칭호 시스템과 연동)

#### 4.8 주간 챌린지

**설명:** 매주 특별 규칙이 적용된 퍼즐 세트 (예: "이번 주는 Anti-Knight 9x9 어려움 5판").

**기술 설계:**
- `daily-seed.js` 패턴 복제 → `weekly-seed.js` (주 단위 시드)
- `storage.js`에 `sudoku_weeklyChallenge` 키:
  ```javascript
  { weekId: string, rules: object, completed: number, total: number, results: object[] }
  ```
- 주간 규칙 정의 풀: 난이도/크기/변형 조합 + 특수 조건 (예: 3실수 이내, 시간 제한)
- 메인 화면에 "주간 챌린지" 버튼 + 진행률 표시
- 완료 시 보너스 XP + 업적 연동

**영향 파일:** `weekly-seed.js`(신규), `storage.js`, `main.js`, `app.js`, `index.html`

**의존:** 변형 시스템 확장 (Phase 1.1~1.2) 후 더 다양한 챌린지 가능

#### 4.9 Even/Odd 변형

**설명:** 특정 셀에 짝수 또는 홀수만 들어갈 수 있는 마커가 표시된 변형.

**기술 설계:**
- 이 변형은 VariantRules의 `getExtraCells()` 패턴과 다름 — 셀 자체의 **값 제약**
- `VariantRule` 인터페이스 확장: `getCellConstraint(row, col, boardSize)` 메서드 추가
  - 반환: `null` | `'even'` | `'odd'`
- 퍼즐 생성 시 랜덤하게 일부 셀에 짝/홀 마커 부여 (solution 기반)
- `solver.js`: `isValid()`에 값 제약 체크 추가
- `grid.js`: 마커 셀에 `.even-marker` / `.odd-marker` CSS 클래스 (동그라미/다이아몬드)
- Board에 `_cellConstraints` 2D 배열 추가 (직렬화 포함)

**영향 파일:** `variant-rules.js`, `solver.js`, `generator.js`, `board.js`, `grid.js`, `css/grid.css`

**의존:** VariantRules 리팩토링 (3.1) — `getCellConstraint` 확장 필요

**주의:** generator에서 마커 배치 로직 추가 필요. 난이도 조절이 복잡해질 수 있음.

#### 4.10 Windoku (Hyper Sudoku)

**설명:** 9x9 전용. 기존 9개 블록 외에 4개 추가 3x3 영역이 존재.

**기술 설계:**
- 추가 영역 위치 (각 3x3):
  - (1,1)~(3,3), (1,5)~(3,7), (5,1)~(7,3), (5,5)~(7,7)
- `variant-rules.js`에 `'windoku'` 등록
- `getExtraCells()`: 해당 셀이 속한 추가 블록의 나머지 8개 셀 반환
- CSS: `.windoku-zone` 배경색으로 4개 영역 시각적 표시
- 지원 크기: 9x9 전용

**영향 파일:** `variant-rules.js`, `grid.js`, `css/grid.css`, `mode-select.js`

**의존:** VariantRules 리팩토링 (3.1)

#### 4.11 완료 축하 애니메이션

**설명:** 퍼즐 완료 시 컨페티/파티클 이펙트.

**기술 설계:**
- `ui/confetti.js` (신규): Canvas 기반 파티클 시스템
  - 100~200개 파티클, 중력 + 랜덤 속도 + 회전
  - 2~3초간 재생 후 자동 제거
  - `requestAnimationFrame` 루프
- `complete.js`에서 성공 화면 전환 시 `confetti.burst()` 호출
- 설정에서 비활성화 가능 (`settings.celebration`)
- 외부 라이브러리 없이 순수 Canvas API 구현

**영향 파일:** `confetti.js`(신규), `complete.js`, `settings.js`, `css/animations.css`

**의존:** 없음

#### 4.12 풀이 시간 추이 그래프

**설명:** gameHistory 데이터 기반 풀이 시간 변화 추이를 차트로 표시.

**기술 설계:**
- `ui/chart.js` (신규): Canvas 기반 라인 차트
  - X축: 게임 날짜 (최근 30/60/전체)
  - Y축: 풀이 시간 (초 → 분:초)
  - 난이도별 필터링
  - 터치/마우스 호버로 데이터 포인트 상세 표시
- `stats.js`에서 그래프 탭 또는 섹션 추가
- 외부 라이브러리 없이 Canvas 2D 직접 그리기

**영향 파일:** `chart.js`(신규), `stats.js`, `index.html`, `css/screens.css`

**의존:** gameHistory에 충분한 데이터 축적 필요 (기존 기능으로 충족)

#### 4.13 칭호/프로필 카드

**설명:** 업적 + 레벨 기반으로 칭호 부여. 프로필 카드 UI.

**기술 설계:**
- 칭호 목록: 레벨/업적 조합으로 해금
  - 예: Lv.5 → "초보 풀이사", Lv.10 + 10승 → "숙련된 풀이사", ...
- `profile.js` 확장: 프로필 카드 렌더링 (레벨, 칭호, 통계 요약, 업적 수)
- `storage.js`의 `userProfile`에 `selectedTitle` 필드
- 칭호 선택 UI: 해금된 칭호 목록에서 선택

**영향 파일:** `profile.js`, `storage.js`, `css/screens.css`, `index.html`

**의존:** XP/레벨 시스템 (4.7) 선행

#### 4.14 퍼즐 결과 공유

**설명:** Wordle 스타일 이모지 결과 + Web Share API.

**기술 설계:**
- `complete.js`에 "공유" 버튼 추가
- 공유 텍스트 생성:
  ```
  스도쿠 리그 🟩
  난이도: 어려움 | 9x9
  시간: 12:34 | 실수: 0
  ⬛⬛⬛⬛⬛⬛⬛⬛⬛
  ... (간략한 보드 시각화)
  ```
- Web Share API 지원 시 `navigator.share()`, 미지원 시 클립보드 복사
- 공유 데이터에 게임 URL은 포함하지 않음 (오프라인 앱이므로)

**영향 파일:** `complete.js`, `index.html`, `css/screens.css`

**의존:** 없음

---

### Phase 3 — 대규모 시스템 (각 1~2주)

#### 4.15 퍼즐 URL/QR 공유

**설명:** Board.toJSON() 데이터를 Base64 인코딩하여 URL 또는 QR 코드로 공유.

**기술 설계:**
- 퍼즐 데이터 압축: puzzle(2D) + boardSize + difficulty + variant만 추출
  - 9x9 퍼즐: 81자리 숫자 → ~40바이트 (run-length 인코딩 + Base64)
- URL 형식: `?puzzle=<encoded>` 쿼리 파라미터
- QR 코드: Canvas 기반 QR 생성 라이브러리 (또는 직접 구현)
- `app.js`에서 URL 파라미터 감지 → 자동 게임 시작

**영향 파일:** `utils/puzzle-encoder.js`(신규), `app.js`, `complete.js`, `index.html`

**의존:** 없음

#### 4.16 리그/시즌 시스템

**설명:** 가상 라이벌과 경쟁하는 4주 시즌 시스템. 등급(Bronze~Diamond) 부여.

**기술 설계:**
- `utils/league.js` (신규): 시즌 관리, 라이벌 AI 생성, 등급 계산
- 등급: Bronze → Silver → Gold → Platinum → Diamond
- 4주 시즌: 매주 일정 점수 목표 달성 → 승격/유지/강등
- 가상 라이벌: 시드 RNG 기반 AI 점수 생성 (실제 멀티플레이어 아님)
- `screens/league.js` (신규): 리그 화면, 순위표, 시즌 결과
- 네비게이션에 리그 탭 추가

**영향 파일:** `league.js`(신규), `storage.js`, `app.js`, `index.html`, `css/screens.css`

**의존:** XP/레벨 시스템 (4.7) — 등급 기준으로 레벨 데이터 활용

#### 4.17 보상/해금 콘텐츠

**설명:** 레벨업/업적/시즌 보상으로 잠금 테마, 프로필 프레임 등 해금.

**기술 설계:**
- `rewards.js` (신규): 보상 정의 + 해금 조건 + 관리
  - 잠금 테마: 기존 6개 외 추가 테마 (레벨/업적으로 해금)
  - 프로필 프레임: CSS 보더 스타일 (bronze~diamond 색상)
  - 넘버패드 스킨: 버튼 스타일 변형
- `storage.js`의 `userProfile.unlockedRewards`에 해금 아이템 ID 목록

**영향 파일:** `rewards.js`(신규), `storage.js`, `settings.js`, `profile.js`, `css/themes.css`

**의존:** XP/레벨 (4.7) + 리그/시즌 (4.16)

#### 4.18 Killer Sudoku

**설명:** 셀 그룹(케이지)에 합산 제약이 있는 가장 인기 있는 스도쿠 변형.

**기술 설계:**
- **가장 복잡한 변형**: 단순한 `getExtraCells()` 패턴으로는 부족
- 케이지(Cage) 데이터 구조:
  ```javascript
  { cells: [{row, col}], sum: number }
  ```
- 퍼즐 생성: solution 기반으로 케이지 분할 + 합산 계산 (NP-hard에 가까움)
- `solver.js` 확장: 케이지 합산 제약 + 중복 불가 체크
- `generator.js` 확장: 케이지 생성 알고리즘 (랜덤 분할 + 유일해 검증)
- `grid.js`: 케이지 경계선(점선) + 좌상단 합산 숫자 표시
- CSS: `.cage-border-top/right/bottom/left`, `.cage-sum` 스타일
- Board에 `_cages` 배열 추가 (직렬화 포함)

**영향 파일:** `variant-rules.js`, `solver.js`, `generator.js`, `board.js`, `grid.js`, `css/grid.css`, 전반

**의존:** VariantRules 리팩토링 (3.1) — 하지만 cage 합산은 별도 로직 필요

**주의:** 케이지 생성 알고리즘이 가장 큰 기술적 도전. 생성 시간이 길 수 있으므로 Web Worker 필수.

#### 4.19 단계적 힌트 (기법명 표시)

**설명:** 현재 5단계 힌트를 확장하여 Naked Single, Hidden Single, Naked Pair 등 풀이 기법명을 표시.

**기술 설계:**
- `hints.js` 대폭 확장:
  - 현재: lastInRow/Col/Block/Diagonal → nakedSingle → direct
  - 확장: + hiddenSingle → nakedPair → hiddenPair → pointingPair → boxLineReduction
- 3단계 힌트 UI:
  1. **영역 힌트**: "이 행/열/블록을 살펴보세요" (셀 위치 미공개)
  2. **셀 힌트**: "이 셀에 주목하세요" (셀 위치 공개, 값 미공개)
  3. **값 힌트**: "정답은 N입니다" (현재 동작)
- 힌트 사용 시 3→2→1 순서로 단계 진행 (같은 셀에 대해)
- 기법명 표시: "Naked Single: 이 칸에 들어갈 수 있는 숫자는 하나뿐입니다"

**영향 파일:** `hints.js` (대폭 확장), `input.js`, `game.js`, `css/main.css`

**의존:** 없음

**주의:** 고급 풀이 기법 구현의 정확성 검증이 필요. E2E 테스트 필수.

#### 4.20 사운드 효과

**설명:** Web Audio API 기반 게임 사운드.

**기술 설계:**
- `sound.js` 확장 (현재 빈 프레임워크):
  - 숫자 입력: 경쾌한 클릭음
  - 올바른 입력: 짧은 성공음
  - 오류: 불쾌하지 않은 경고음
  - 퍼즐 완료: 축하 효과음
  - 실행취소: 되감기 효과음
- 사운드 파일 형식: Web Audio API `OscillatorNode`로 프로그래밍 생성 (파일 불필요)
- 설정에서 ON/OFF + 볼륨 조절

**영향 파일:** `sound.js`, `settings.js`, `game.js`, `complete.js`, `index.html`

**의존:** 없음

#### 4.21 마이크로 인터랙션

**설명:** 입력 시 바운스, 오류 시 셰이크 등 미세한 애니메이션.

**기술 설계:**
- CSS 키프레임 애니메이션:
  ```css
  @keyframes cell-bounce { 0% { transform: scale(1); } 50% { transform: scale(1.15); } 100% { transform: scale(1); } }
  @keyframes cell-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }
  @keyframes cell-fade-in { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
  ```
- `grid.js`에서 셀 값 변경 시 애니메이션 클래스 부여 → `animationend`에서 제거
- 설정에서 비활성화 가능

**영향 파일:** `grid.js`, `css/animations.css`, `settings.js`

**의존:** 없음

#### 4.22 컬러블라인드 모드

**설명:** 색각 이상 사용자를 위한 접근성 테마.

**기술 설계:**
- 현재 테마 시스템의 확장: `body[data-colorblind="true"]`
- 색상만으로 구분하는 요소에 패턴/아이콘 추가:
  - 오류 셀: 빨강 대신 빗금(hatching) 패턴
  - 선택 셀: 색상 외에 굵은 테두리 추가
  - 하이라이트: 색상 외에 점선 테두리
  - 셀 컬러 마킹: 색상 + 작은 패턴/숫자 라벨
- `settings.js`에 컬러블라인드 모드 토글
- CSS 변수 오버라이드: Deuteranopia/Protanopia 안전 팔레트

**영향 파일:** `css/themes.css`, `settings.js`, `css/grid.css`

**의존:** 셀 컬러 마킹 (4.6) — 마킹 색상에 대한 접근성 보장

#### 4.23 다국어 (i18n)

**설명:** 전체 UI 문자열을 한국어/영어/일본어 등으로 전환 가능.

**기술 설계:**
- `utils/i18n.js` (신규): 번역 시스템
  ```javascript
  const translations = {
      ko: { 'game.difficulty.easy': '쉬움', ... },
      en: { 'game.difficulty.easy': 'Easy', ... },
      ja: { 'game.difficulty.easy': '簡単', ... },
  };
  export function t(key) { return translations[currentLang][key]; }
  ```
- 모든 하드코딩 한국어 문자열 → `t()` 함수 호출로 교체
- `index.html`의 정적 텍스트 → `data-i18n` 속성으로 마킹, 초기화 시 치환
- `settings.js`에 언어 선택 드롭다운
- 번역 범위: ~200개 문자열

**영향 파일:** **전체 파일** (모든 한국어 문자열 교체)

**의존:** 없음이지만, 다른 모든 기능 완료 후 마지막에 수행하는 것이 효율적

**주의:** 가장 광범위한 변경. 리그레션 위험 높음. 철저한 테스트 필요.

---

## 5. 기술적 전제조건 및 리팩토링

### 5.1 VariantRules 리팩토링 (필수, Phase 1 시작 전)

**현재 문제:** `variant === 'diagonal'` 하드코딩이 5개 이상 파일에 산재. 새 변형마다 동일 패턴 반복.

**해결:** `core/variant-rules.js` 신규 생성. 레지스트리 패턴으로 변형 규칙을 플러그인화.

**작업량:** 약 2일 (리팩토링 + 기존 diagonal 마이그레이션 + 테스트)

### 5.2 Board 클래스 확장 가이드라인

Board 클래스는 이미 ~700줄. 추가 필드가 늘어나면 관리가 어려워질 수 있다.

**원칙:**
- `cellColors`, `cellConstraints`, `cages` 등은 Board 내부에 추가하되, `getState()`/`loadState()`에서 `undefined`면 건너뛰는 방어적 코딩
- 변형 전용 데이터는 Board가 직접 관리하지 않고, VariantRules가 제공하는 헬퍼 통해 접근

### 5.3 설정 확장 가이드라인

현재 `getDefaultSettings()`에 11개 필드. Phase 전체를 거치면 ~18개로 증가.

**원칙:**
- 기존 `{ ...getDefaultSettings(), ...stored }` 머지 패턴 유지
- 새 설정 추가 시 반드시 기본값 포함 → 기존 사용자 데이터 호환

### 5.4 Service Worker 캐시 관리

모든 신규 JS/CSS 파일은 `sw.js`의 캐시 리스트에 추가해야 한다.
각 Phase 완료 시 `sudoku-vN` 버전 범프 필수.

### 5.5 테스트 확장 계획

| Phase | 예상 추가 테스트 수 | 주요 테스트 영역 |
|-------|---------------------|------------------|
| Phase 1 | ~50개 | 새 변형 규칙, 자동 메모, 스트릭, 마킹, 설정 |
| Phase 2 | ~40개 | XP/레벨, 주간 챌린지, 그래프, 공유, 애니메이션 |
| Phase 3 | ~60개 | Killer, URL/QR, 리그, 힌트, i18n |

총 예상: 148(현재) + 150 = ~300개 테스트

---

## 6. 의존성 그래프

```
Phase 1 시작 전 (선행 작업):
  VariantRules 리팩토링 ──→ Phase 1.1 (Anti-Knight)
                          ──→ Phase 1.2 (Anti-King)
                          ──→ Phase 2.9 (Even/Odd)
                          ──→ Phase 2.10 (Windoku)
                          ──→ Phase 3.18 (Killer)

독립적으로 병렬 가능:
  Phase 1.3 (자동 메모) ── 독립
  Phase 1.4 (스트릭) ── 독립
  Phase 1.5 (실수 표시) ── 독립
  Phase 1.6 (셀 마킹) ── 독립
  Phase 2.11 (축하 애니메이션) ── 독립
  Phase 2.12 (시간 그래프) ── 독립
  Phase 2.14 (결과 공유) ── 독립
  Phase 3.15 (URL/QR 공유) ── 독립
  Phase 3.19 (단계적 힌트) ── 독립
  Phase 3.20 (사운드) ── 독립
  Phase 3.21 (마이크로 인터랙션) ── 독립

순차 의존:
  Phase 2.7 (XP/레벨) ──→ Phase 2.13 (칭호/프로필)
                       ──→ Phase 3.16 (리그/시즌)
                       ──→ Phase 3.17 (보상/해금)

  Phase 1.6 (셀 마킹) ──→ Phase 3.22 (컬러블라인드) [접근성 보장]

  모든 기능 완료 ──→ Phase 3.23 (다국어 i18n) [마지막에 수행]

  Phase 1.1~1.2 (변형 추가) ──→ Phase 2.8 (주간 챌린지) [다양한 변형 활용]
```

### 의존성 요약 표

| 기능 | 선행 필요 |
|------|-----------|
| Anti-Knight (1.1) | VariantRules 리팩토링 |
| Anti-King (1.2) | VariantRules 리팩토링 |
| 자동 메모 (1.3) | 없음 |
| 스트릭 (1.4) | 없음 |
| 실수 표시 (1.5) | 없음 |
| 셀 마킹 (1.6) | 없음 |
| XP/레벨 (2.7) | 없음 |
| 주간 챌린지 (2.8) | 변형 추가 (1.1~1.2) 권장 |
| Even/Odd (2.9) | VariantRules 리팩토링 |
| Windoku (2.10) | VariantRules 리팩토링 |
| 축하 애니메이션 (2.11) | 없음 |
| 시간 그래프 (2.12) | 없음 |
| 칭호/프로필 (2.13) | XP/레벨 (2.7) |
| 결과 공유 (2.14) | 없음 |
| URL/QR 공유 (3.15) | 없음 |
| 리그/시즌 (3.16) | XP/레벨 (2.7) |
| 보상/해금 (3.17) | XP/레벨 (2.7) + 리그 (3.16) |
| Killer Sudoku (3.18) | VariantRules 리팩토링 |
| 단계적 힌트 (3.19) | 없음 |
| 사운드 (3.20) | 없음 |
| 마이크로 인터랙션 (3.21) | 없음 |
| 컬러블라인드 (3.22) | 셀 마킹 (1.6) |
| 다국어 (3.23) | 모든 기능 완료 |

---

## 7. 리스크 및 주의사항

| 리스크 | 영향도 | 발생 확률 | 완화 방안 |
|--------|--------|-----------|----------|
| VariantRules 리팩토링 시 기존 diagonal 깨짐 | 높음 | 중간 | 리팩토링 전후 기존 148개 테스트 전수 통과 확인 |
| Killer Sudoku 퍼즐 생성 시간 | 높음 | 높음 | Web Worker 필수, 타임아웃 + 재시도, 9x9 전용으로 제한 |
| LocalStorage 5MB 한도 | 중간 | 낮음 | 현재 ~400KB 추정. userProfile/streak/weekly 추가해도 1MB 미만 |
| 설정 필드 증가로 마이그레이션 복잡화 | 중간 | 중간 | `{ ...defaults, ...stored }` 패턴으로 자동 호환 |
| Service Worker 캐시 미갱신 | 높음 | 높음 | 매 Phase 완료 시 sw.js 버전 범프 체크리스트화 |
| 다국어(i18n) 적용 시 전체 리그레션 | 높음 | 높음 | 최후 순서로 배치, 문자열 키 정규화 단계 선행 |
| Board 클래스 비대화 (~700줄 → ~900줄+) | 중간 | 중간 | 변형 전용 데이터는 VariantRules 쪽으로 위임 |
| 주간 챌린지 시드 변경으로 과거 결과 불일치 | 낮음 | 낮음 | daily-seed.js와 동일하게 해시 알고리즘 고정 |
| 대형 보드(12x12+)에서 새 변형 성능 | 중간 | 중간 | Anti-Knight/King/Even-Odd는 9x9 전용으로 제한 |
| 사운드 효과가 모바일에서 정책에 의해 차단 | 낮음 | 중간 | 사용자 인터랙션(클릭) 후에만 AudioContext 생성 |

---

## 8. 추천 구현 로드맵

### Week 1: 기반 구축 + Phase 1 시작
- **Day 1~2**: VariantRules 리팩토링 (3.1)
  - `variant-rules.js` 생성, `'standard'`/`'diagonal'` 등록
  - 기존 5개 파일의 하드코딩 → 레지스트리 호출 교체
  - 148개 테스트 전수 통과 확인
- **Day 3**: Anti-Knight + Anti-King 변형 (1.1, 1.2) 동시 구현
- **Day 4~5**: 자동 메모 (1.3) + 실수 자동 표시 (1.5)

### Week 2: Phase 1 완료
- **Day 6**: 스트릭 시스템 (1.4)
- **Day 7~8**: 셀 컬러 마킹 (1.6)
- **Day 9~10**: Phase 1 통합 테스트 + SW 캐시 업데이트

### Week 3~4: Phase 2 핵심
- **Day 11~13**: XP/레벨 시스템 (2.7)
- **Day 14~15**: 완료 축하 애니메이션 (2.11) + 마이크로 인터랙션 (3.21)
- **Day 16~18**: Even/Odd (2.9) + Windoku (2.10)
- **Day 19~20**: 퍼즐 결과 공유 (2.14)

### Week 5~6: Phase 2 확장
- **Day 21~23**: 주간 챌린지 (2.8)
- **Day 24~26**: 칭호/프로필 (2.13) + 풀이 시간 그래프 (2.12)
- **Day 27~28**: Phase 2 통합 테스트 + SW 캐시 업데이트

### Week 7~10: Phase 3
- **Week 7**: Killer Sudoku (3.18) — 가장 복잡, 집중 필요
- **Week 8**: 단계적 힌트 (3.19) + 사운드 효과 (3.20)
- **Week 9**: 리그/시즌 (3.16) + 보상/해금 (3.17)
- **Week 10**: URL/QR 공유 (3.15) + 컬러블라인드 모드 (3.22)

### Week 11~12: 마무리
- **Week 11**: 다국어 i18n (3.23)
- **Week 12**: 전체 통합 테스트 + 성능 최적화 + 최종 SW 캐시 업데이트

---

## 9. 비기능 요구사항

| 항목 | 요구사항 |
|------|---------|
| 성능 | 퍼즐 생성 < 5초 (Killer 포함, Worker), 히스토리 200개 로딩 < 100ms |
| 저장 용량 | LocalStorage 사용량 2MB 이내 (현재 ~400KB) |
| 호환성 | Chrome 90+, Safari 15+, Firefox 90+, Edge 90+ |
| 모바일 | 터치 인터랙션, 뷰포트 적응형 레이아웃 |
| 접근성 | 키보드 탐색, aria-label, 컬러블라인드 모드 |
| 테스트 | 300개 이상 E2E 테스트, 신규 기능당 최소 10개 테스트 |
| 오프라인 | Service Worker 캐시, 네트워크 없이 완전 동작 |
| 기존 테스트 유지 | 148개 기존 테스트 리그레션 없음 |
