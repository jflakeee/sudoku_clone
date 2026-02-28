# 상세 구현 계획서 - 신규 3개 모드

> 작성일: 2026-02-27
> 대상: `docs/idea_20260227.txt` 3개 기능
> 참조: `docs/review_idea_20260227.md`, `docs/design.md`, 소스코드 전체
> 분석 방법: 에이전트 팀 (코어 엔진 + UI 레이어 + 게임 레이어) 병렬 분석

---

## 목차

1. [구현 대상 요약](#1-구현-대상-요약)
2. [전체 아키텍처 변경 개요](#2-전체-아키텍처-변경-개요)
3. [Phase A: 모드 시스템 기반 (기능 1 — 클래식 모드 분리)](#3-phase-a-모드-시스템-기반)
4. [Phase B: 타임어택 모드 (기능 3)](#4-phase-b-타임어택-모드)
5. [Phase C: 다양한 크기 모드 — 엔진 리팩터링 (기능 2)](#5-phase-c-다양한-크기-모드--엔진-리팩터링)
6. [Phase D: 다양한 크기 모드 — UI 동적화 (기능 2)](#6-phase-d-다양한-크기-모드--ui-동적화)
7. [Phase E: 다양한 크기 모드 — 대형 보드 최적화 (기능 2)](#7-phase-e-다양한-크기-모드--대형-보드-최적화)
8. [데이터 마이그레이션 전략](#8-데이터-마이그레이션-전략)
9. [테스트 계획](#9-테스트-계획)
10. [파일 변경 총괄표](#10-파일-변경-총괄표)
11. [의존성 그래프](#11-의존성-그래프)
12. [리스크 및 완화 방안](#12-리스크-및-완화-방안)

---

## 1. 구현 대상 요약

| # | 기능 | 난이도 | Phase | 예상 규모 |
|---|------|--------|-------|----------|
| 1 | 클래식 모드 분리 (모드 선택 UI) | 하 | A | 소 |
| 3 | 타임어택 모드 (카운트다운) | 중 | B | 중 |
| 2 | 다양한 크기 모드 (4x4~16x16) | 상 | C+D+E | 대 |

**구현 순서**: A → B → C → D → E (의존성 기반)

---

## 2. 전체 아키텍처 변경 개요

### 2.1 신규 파일

| 파일 | 목적 |
|------|------|
| `src/js/core/board-config.js` | 보드 크기별 설정 (size, blockSize, numRange, difficultyRanges) |
| `src/js/screens/mode-select.js` | 모드 선택 화면 컨트롤러 |

### 2.2 핵심 변경 파일 (영향도순)

| 파일 | Phase | 변경 규모 | 핵심 변경 |
|------|-------|----------|----------|
| `src/js/game/board.js` | A,B,C | 대 | mode 필드, boardSize, blockSize 추가 |
| `src/js/core/generator.js` | C | 대 | boardSize 파라미터화, DIFFICULTY_RANGES 크기별 분리 |
| `src/js/core/solver.js` | C | 대 | isValid() 블록 계산 가변화 |
| `src/js/core/validator.js` | C | 대 | getBlockCells() 가변화 |
| `src/js/ui/grid.js` | D | 대 | DOM 동적 생성, CSS 동적 주입 |
| `src/css/grid.css` | D | 대 | nth-child 동적화, CSS 변수 시스템 |
| `src/js/game/timer.js` | B | 중 | 카운트다운 메서드 추가 |
| `src/js/app.js` | A,D | 중 | 모드 선택 라우팅, 키보드 범위 동적화 |
| `src/js/screens/game.js` | A,B | 중 | 모드별 분기 4개 |
| `src/js/game/notes.js` | C | 중 | boardSize/blockSize 파라미터화 |
| `src/js/game/hints.js` | C | 중 | boardSize/blockSize 파라미터화 |
| `src/js/ui/highlight.js` | D | 중 | gridSize 파라미터화 |
| `src/js/ui/numberpad.js` | D | 중 | 동적 버튼 수 |
| `src/js/utils/storage.js` | A | 소 | 모드별 키 분리 |
| `src/js/core/scorer.js` | B | 소 | 타임어택 보너스 함수 추가 |
| `src/js/screens/complete.js` | B | 소 | 모드별 메시지 |
| `src/index.html` | A,D | 중 | 모드 선택 화면 HTML, numberpad 동적화 |
| `src/css/screens.css` | A | 중 | 모드 선택 스타일 |
| `src/css/animations.css` | B | 소 | 타이머 경고 애니메이션 |

---

## 3. Phase A: 모드 시스템 기반

> 기능 1 — 클래식 모드 분리, 모드 선택 UI 추가

### 3.1 라우팅 플로우 변경

```
현재:  메인 → (난이도 모달) → game
변경:  메인 → (모드 선택 화면) → (난이도 모달) → game
```

### 3.2 `src/index.html` — 모드 선택 화면 추가

```html
<!-- ===== Mode Selection Screen ===== -->
<div id="screen-mode-select" class="screen">
  <div class="sub-header">
    <button class="icon-btn btn-back" data-action="back" aria-label="뒤로가기">
      <svg><!-- 뒤로가기 아이콘 --></svg>
    </button>
    <h2 class="sub-title">게임 모드</h2>
    <div class="sub-header-right"></div>
  </div>

  <div class="mode-content">
    <!-- 게임 모드 선택 -->
    <div class="mode-section">
      <h3 class="mode-section-title">게임 모드</h3>
      <div class="game-mode-options">
        <button class="game-mode-option active" data-game-mode="classic">
          <span class="mode-name">클래식</span>
          <span class="mode-desc">무제한 시간</span>
        </button>
        <button class="game-mode-option" data-game-mode="timeAttack">
          <span class="mode-name">타임어택</span>
          <span class="mode-desc">제한 시간 도전</span>
        </button>
      </div>
    </div>

    <!-- 타임어택 시간 선택 (조건부 표시) -->
    <div class="mode-section timed-section" style="display:none;">
      <h3 class="mode-section-title">제한 시간</h3>
      <div class="time-duration-grid">
        <button class="time-option" data-duration="300">5분</button>
        <button class="time-option active" data-duration="600">10분</button>
        <button class="time-option" data-duration="900">15분</button>
        <button class="time-option" data-duration="1200">20분</button>
      </div>
    </div>

    <!-- 보드 크기 선택 (Phase D에서 활성화) -->
    <div class="mode-section board-size-section" style="display:none;">
      <h3 class="mode-section-title">보드 크기</h3>
      <div class="board-size-grid">
        <button class="size-option" data-size="4">4x4</button>
        <button class="size-option" data-size="6">6x6</button>
        <button class="size-option active" data-size="9">9x9</button>
        <button class="size-option" data-size="12">12x12</button>
        <button class="size-option" data-size="16">16x16</button>
      </div>
    </div>
  </div>

  <div class="mode-actions">
    <button class="btn btn-primary" data-action="select-mode">다음</button>
  </div>
</div>
```

### 3.3 `src/js/screens/mode-select.js` — 신규 파일

```javascript
// 모드 선택 화면 컨트롤러
export class ModeSelectScreen {
  constructor(app) {
    this._app = app;
    this._selectedMode = 'classic';     // classic | timeAttack
    this._selectedDuration = 600;        // 초 (타임어택)
    this._selectedBoardSize = 9;         // 4 | 6 | 9 | 12 | 16
  }

  onShow() { /* 버튼 이벤트 바인딩, 활성 상태 복원 */ }
  onHide() { /* 이벤트 정리 */ }

  _onModeSelect(mode) {
    this._selectedMode = mode;
    // 타임어택 선택 시 시간 섹션 표시
    const timedSection = document.querySelector('.timed-section');
    timedSection.style.display = mode === 'timeAttack' ? '' : 'none';
  }

  _onNext() {
    // 난이도 모달 표시, 선택 후 게임 시작
    this._app.showDifficultyModal({
      mode: this._selectedMode,
      duration: this._selectedDuration,
      boardSize: this._selectedBoardSize,
    });
  }
}
```

### 3.4 `src/js/app.js` — 라우팅 변경

```javascript
// 변경 전: "새 게임" → showDifficultyModal()
// 변경 후: "새 게임" → navigate('mode-select')

// showDifficultyModal 확장
showDifficultyModal(modeParams = {}) {
  this._pendingModeParams = modeParams;
  // 기존 모달 표시 로직
}

// 난이도 선택 후 게임 시작
_onDifficultySelect(difficulty) {
  const params = {
    ...this._pendingModeParams,
    difficulty,
  };
  this.navigate('game', params);
}
```

### 3.5 `src/js/game/board.js` — mode 필드 추가

```javascript
// 생성자에 추가
this.mode = 'classic';  // classic | timeAttack

// newGame() 시그니처 변경
newGame(difficulty, dailyDate = null, mode = 'classic', options = {}) {
  this.mode = mode;
  // 기존 로직...
}

// getState() / loadState() 에 mode 직렬화
getState() {
  return {
    mode: this.mode,
    // ... 기존 필드
  };
}

loadState(state) {
  this.mode = state.mode || 'classic';
  // ... 기존 로직
}
```

### 3.6 `src/js/utils/storage.js` — 모드별 키 분리

```javascript
// 통계 키 분리
function getStatsKey(mode = 'classic') {
  return mode === 'classic' ? 'sudoku_stats' : `sudoku_stats_${mode}`;
}

// loadStats / saveStats 에 mode 파라미터 추가 (기본값 'classic')
export function loadStats(mode = 'classic') {
  const key = getStatsKey(mode);
  // 기존 로직...
}

export function saveStats(stats, mode = 'classic') {
  const key = getStatsKey(mode);
  // 기존 로직...
}
```

### 3.7 `src/css/screens.css` — 모드 선택 스타일

```css
/* 게임 모드 선택 */
.game-mode-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}

.game-mode-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
  background: var(--bg-main);
  border: 2px solid transparent;
  transition: all var(--transition-fast);
}

.game-mode-option.active {
  background: var(--primary);
  color: #FFFFFF;
  border-color: var(--primary);
}

/* 시간/크기 선택 그리드 */
.time-duration-grid,
.board-size-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: var(--spacing-sm);
}

.time-option,
.size-option {
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  background: var(--bg-main);
  border: 2px solid transparent;
  font-weight: 600;
  text-align: center;
}

.time-option.active,
.size-option.active {
  background: var(--primary);
  color: #FFFFFF;
}
```

### 3.8 Phase A 변경 파일 목록

| 파일 | 작업 | 규모 |
|------|------|------|
| `src/index.html` | 모드 선택 화면 HTML 추가 | 소 |
| `src/js/screens/mode-select.js` | **신규** 모드 선택 컨트롤러 | 소 |
| `src/js/app.js` | 라우팅 추가, showDifficultyModal 확장 | 소 |
| `src/js/screens/main.js` | "새 게임" → mode-select 라우팅 | 소 |
| `src/js/game/board.js` | mode 필드, newGame() 파라미터 | 소 |
| `src/js/utils/storage.js` | 모드별 키 분리 | 소 |
| `src/css/screens.css` | 모드 선택 스타일 | 소 |
| `src/sw.js` | CACHE_NAME `sudoku-v4` | 소 |

---

## 4. Phase B: 타임어택 모드

> 기능 3 — 카운트다운 타이머, 시간 초과 게임오버, 전용 점수

### 4.1 `src/js/game/timer.js` — 카운트다운 확장

```javascript
// === 추가할 속성 ===
this._isCountdown = false;    // 카운트다운 모드 플래그
this._duration = 0;           // 제한 시간 (ms)
this._onTimeUp = null;        // 시간 초과 콜백

// === 추가할 메서드 ===

setCountdown(isCountdown) {
  this._isCountdown = isCountdown;
}

setDuration(seconds) {
  this._duration = seconds * 1000;
}

onTimeUp(callback) {
  this._onTimeUp = callback;
}

getRemaining() {
  // 카운트다운 모드에서 잔여 시간 (초)
  if (!this._isCountdown || !this._duration) return Infinity;
  let total = this._elapsed;
  if (this._running && this._startTimestamp !== null) {
    total += performance.now() - this._startTimestamp;
  }
  return Math.max(0, Math.floor((this._duration - total) / 1000));
}

isTimeUp() {
  return this._isCountdown && this.getRemaining() <= 0;
}

// === 기존 메서드 수정 ===

getElapsed() {
  let total = this._elapsed;
  if (this._running && this._startTimestamp !== null) {
    total += performance.now() - this._startTimestamp;
  }
  // 카운트다운 모드: 잔여 시간 반환
  if (this._isCountdown && this._duration) {
    return Math.max(0, Math.floor((this._duration - total) / 1000));
  }
  return Math.floor(total / 1000);
}

// _tick() 내부에 시간 초과 체크 추가
_tick() {
  if (this._onTick) {
    this._onTick(this.getFormatted());
  }
  // 타임어택: 시간 초과 감지
  if (this._isCountdown && this.isTimeUp()) {
    this.pause();
    if (this._onTimeUp) this._onTimeUp();
  }
}

// reset() 확장
reset() {
  this.pause();
  this._elapsed = 0;
  this._isCountdown = false;
  this._duration = 0;
  this._onTimeUp = null;
}
```

### 4.2 `src/js/core/scorer.js` — 타임어택 보너스

```javascript
// === 추가 함수 ===

/**
 * 타임어택 전용 완료 보너스
 * @param {string} difficulty - 난이도
 * @param {number} remainingSeconds - 남은 시간 (초)
 * @param {number} totalSeconds - 전체 제한 시간 (초)
 * @param {number} mistakes - 실수 횟수
 */
export function calculateTimeAttackBonus(difficulty, remainingSeconds, totalSeconds, mistakes) {
  const multiplier = getDifficultyMultiplier(difficulty);
  const timeRatio = remainingSeconds / totalSeconds;  // 0.0 ~ 1.0
  const timeBonus = 1 + timeRatio * 2;                // 1.0 ~ 3.0
  const mistakeFactor = Math.max(0, 1 - 0.2 * mistakes);
  return Math.round(1500 * multiplier * timeBonus * mistakeFactor);
}
```

### 4.3 `src/js/screens/game.js` — 4개 분기 포인트

```javascript
// 분기 1: 게임 시작 시 타이머 초기화
startNewGame(difficulty, dailyDate, mode, options) {
  this._board.newGame(difficulty, dailyDate, mode, options);

  if (mode === 'timeAttack') {
    const duration = options.duration || 600;
    this._board.timer.setCountdown(true);
    this._board.timer.setDuration(duration);
    this._board.timer.onTimeUp(() => this._handleTimeUp());
  }
}

// 분기 2: 타이머 UI 업데이트 (onTick 콜백)
_updateTimerUI(formatted) {
  const timerEl = document.querySelector('.info-timer');
  document.querySelector('.timer-value').textContent = formatted;

  if (this._board.mode === 'timeAttack') {
    const remaining = this._board.timer.getRemaining();
    timerEl.classList.toggle('timer-warning', remaining <= 30 && remaining > 10);
    timerEl.classList.toggle('timer-danger', remaining <= 10);
  }
}

// 분기 3: 시간 초과 게임오버
_handleTimeUp() {
  // 보드 가림, 결과 표시
  this._app.navigate('complete', {
    mode: 'timeAttack',
    success: false,
    score: this._board.getScore(),
    difficulty: this._board.difficulty,
    message: '시간 초과!',
  });
}

// 분기 4: 게임 완료 시 잔여 시간 전달
_handleGameComplete() {
  const params = {
    mode: this._board.mode,
    score: this._board.getScore(),
    difficulty: this._board.difficulty,
    time: this._board.timer.getElapsed(),
    mistakes: this._board.getMistakes(),
  };

  if (this._board.mode === 'timeAttack') {
    params.remainingTime = this._board.timer.getRemaining();
    params.totalTime = this._board.timer._duration / 1000;
    params.success = true;
  }

  this._app.navigate('complete', params);
}
```

### 4.4 `src/js/screens/complete.js` — 모드별 결과

```javascript
// onShow() 내 모드별 메시지 분기
if (params.mode === 'timeAttack') {
  if (params.success) {
    messageEl.textContent = `${params.remainingTime}초 남기고 완료!`;
    // 타임어택 보너스 점수 표시
    const bonus = calculateTimeAttackBonus(
      params.difficulty, params.remainingTime, params.totalTime, params.mistakes
    );
    bonusEl.textContent = `타임어택 보너스: +${bonus}`;
  } else {
    messageEl.textContent = '시간 초과!';
    // 완료하지 못한 경우 다른 UI
  }
}
```

### 4.5 `src/css/animations.css` — 타이머 경고 애니메이션

```css
/* 30초 이하: 파란 펄스 */
.info-timer.timer-warning .info-value {
  animation: timerWarningPulse 1s infinite;
}

/* 10초 이하: 빨간 급박한 펄스 */
.info-timer.timer-danger .info-value {
  animation: timerDangerPulse 0.5s infinite;
  color: var(--text-error);
}

@keyframes timerWarningPulse {
  0%, 100% { color: var(--text-primary); }
  50% { color: var(--primary); }
}

@keyframes timerDangerPulse {
  0%, 100% { color: var(--text-error); }
  50% { color: #FF0000; transform: scale(1.1); }
}

/* 시간 초과: 흔들림 */
.info-timer.timer-expired .info-value {
  animation: shake 300ms ease-out;
  color: var(--text-error);
}
```

### 4.6 난이도별 제한 시간 기본값

| 난이도 | 빈 셀 수 | 기본 제한 시간 |
|--------|---------|-------------|
| 쉬움 | 36-40 | 10분 (600초) |
| 보통 | 41-46 | 15분 (900초) |
| 어려움 | 47-51 | 20분 (1200초) |
| 전문가 | 52-55 | 30분 (1800초) |
| 마스터 | 56-60 | 45분 (2700초) |

> 사용자가 모드 선택 화면에서 직접 시간을 선택할 수 있으므로, 위 값은 기본값으로만 사용.

### 4.7 Phase B 변경 파일 목록

| 파일 | 작업 | 규모 |
|------|------|------|
| `src/js/game/timer.js` | 카운트다운 메서드 5개 추가, _tick 수정, reset 확장 | 중 |
| `src/js/core/scorer.js` | calculateTimeAttackBonus() 함수 추가 | 소 |
| `src/js/screens/game.js` | 4개 분기 (시작, UI, 시간초과, 완료) | 중 |
| `src/js/screens/complete.js` | 모드별 메시지/보너스 표시 | 소 |
| `src/css/animations.css` | 경고 펄스/위험 펄스/만료 흔들림 | 소 |

---

## 5. Phase C: 다양한 크기 모드 — 엔진 리팩터링

> 기능 2 — 핵심 엔진의 9x9 하드코딩 제거

### 5.1 `src/js/core/board-config.js` — 신규 설정 모듈

```javascript
/**
 * 보드 크기별 설정
 */
export const BOARD_CONFIGS = {
  4:  { size: 4,  blockRows: 2, blockCols: 2, numRange: 4,  totalCells: 16  },
  6:  { size: 6,  blockRows: 2, blockCols: 3, numRange: 6,  totalCells: 36  },
  9:  { size: 9,  blockRows: 3, blockCols: 3, numRange: 9,  totalCells: 81  },
  12: { size: 12, blockRows: 3, blockCols: 4, numRange: 12, totalCells: 144 },
  16: { size: 16, blockRows: 4, blockCols: 4, numRange: 16, totalCells: 256 },
};

/**
 * 크기별 난이도 범위 (제거할 셀 수)
 * 비율: 약 44~74%
 */
export const DIFFICULTY_RANGES_BY_SIZE = {
  4: {
    easy: [5, 6], normal: [7, 8], hard: [9, 10],
    expert: [10, 11], master: [11, 12],
  },
  6: {
    easy: [14, 16], normal: [17, 20], hard: [21, 24],
    expert: [25, 28], master: [29, 32],
  },
  9: {
    easy: [36, 40], normal: [41, 46], hard: [47, 51],
    expert: [52, 55], master: [56, 60],
  },
  12: {
    easy: [60, 72], normal: [73, 88], hard: [89, 103],
    expert: [104, 115], master: [116, 126],
  },
  16: {
    easy: [110, 128], normal: [129, 154], hard: [155, 179],
    expert: [180, 200], master: [201, 220],
  },
};

/**
 * 블록 크기 조회 헬퍼
 */
export function getBlockSize(boardSize) {
  const config = BOARD_CONFIGS[boardSize];
  if (!config) throw new Error(`Unsupported board size: ${boardSize}`);
  return { rows: config.blockRows, cols: config.blockCols };
}

/**
 * 난이도 범위 조회
 */
export function getDifficultyRange(boardSize, difficulty) {
  const ranges = DIFFICULTY_RANGES_BY_SIZE[boardSize];
  if (!ranges) throw new Error(`Unsupported board size: ${boardSize}`);
  return ranges[difficulty] || ranges.easy;
}
```

### 5.2 `src/js/core/solver.js` — 파라미터화

**하드코딩 위치**: 6곳 (L22-23, L27-28, L32-35, L58, L77, L79-80)

```javascript
// === 변경 전 ===
export function isValid(board, row, col, num)

// === 변경 후 ===
export function isValid(board, row, col, num, boardSize = 9, blockSize = null) {
  if (!blockSize) blockSize = getBlockSize(boardSize);

  // 행 검사: c < 9 → c < boardSize
  for (let c = 0; c < boardSize; c++) { /* ... */ }

  // 열 검사: r < 9 → r < boardSize
  for (let r = 0; r < boardSize; r++) { /* ... */ }

  // 블록 검사: Math.floor(row/3)*3 → Math.floor(row/blockSize.rows)*blockSize.rows
  const blockRow = Math.floor(row / blockSize.rows) * blockSize.rows;
  const blockCol = Math.floor(col / blockSize.cols) * blockSize.cols;
  for (let r = blockRow; r < blockRow + blockSize.rows; r++) {
    for (let c = blockCol; c < blockCol + blockSize.cols; c++) { /* ... */ }
  }
}

// getCandidates: num <= 9 → num <= boardSize
export function getCandidates(board, row, col, boardSize = 9, blockSize = null) {
  if (!blockSize) blockSize = getBlockSize(boardSize);
  const candidates = [];
  for (let num = 1; num <= boardSize; num++) {
    if (isValid(board, row, col, num, boardSize, blockSize)) candidates.push(num);
  }
  return candidates;
}

// findBestEmptyCell: < 9 → < boardSize, 10 → boardSize + 1
function findBestEmptyCell(board, boardSize = 9, blockSize = null) {
  let minCandidates = boardSize + 1;
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) { /* ... */ }
  }
}

// solve / countSolutions: boardSize, blockSize 전달
export function solve(board, boardSize = 9, blockSize = null)
export function countSolutions(board, boardSize = 9, blockSize = null, limit = 2)
```

### 5.3 `src/js/core/generator.js` — 파라미터화

**하드코딩 위치**: 7곳 (L64, L83, L85-86, L89, L118-120)

```javascript
// === 변경 후 ===
export function generatePuzzle(difficulty, boardSize = 9, dailyDate = null) {
  const blockSize = getBlockSize(boardSize);
  const range = getDifficultyRange(boardSize, difficulty);

  // 완성 보드 생성
  const solution = generateCompleteBoard(boardSize, blockSize, dailyDate);

  // 셀 제거
  const board = removeCells(solution, range, boardSize, blockSize);
  // ...
}

function generateCompleteBoard(boardSize, blockSize, seed) {
  const board = createEmptyBoard(boardSize);       // length: 9 → boardSize
  const totalCells = boardSize * boardSize;         // 81 → 동적

  function fill(pos) {
    if (pos === totalCells) return true;            // 81 → totalCells
    const row = Math.floor(pos / boardSize);        // /9 → /boardSize
    const col = pos % boardSize;                    // %9 → %boardSize
    const nums = shuffle(range(1, boardSize + 1));  // [1..9] → [1..boardSize]

    for (const num of nums) {
      if (isValid(board, row, col, num, boardSize, blockSize)) {
        board[row][col] = num;
        if (fill(pos + 1)) return true;
        board[row][col] = 0;
      }
    }
    return false;
  }

  fill(0);
  return board;
}

function removeCells(solution, range, boardSize, blockSize) {
  const totalCells = boardSize * boardSize;
  const positions = Array.from({ length: totalCells }, (_, i) => ({
    row: Math.floor(i / boardSize),   // /9 → /boardSize
    col: i % boardSize,               // %9 → %boardSize
  }));
  // ... countSolutions에 boardSize, blockSize 전달
}
```

### 5.4 `src/js/core/validator.js` — 파라미터화

**하드코딩 위치**: 10곳

```javascript
export function getRowCells(row, boardSize = 9) {
  const cells = [];
  for (let c = 0; c < boardSize; c++) cells.push({ row, col: c });
  return cells;
}

export function getColCells(col, boardSize = 9) {
  const cells = [];
  for (let r = 0; r < boardSize; r++) cells.push({ row: r, col });
  return cells;
}

export function getBlockCells(row, col, boardSize = 9, blockSize = null) {
  if (!blockSize) blockSize = getBlockSize(boardSize);
  const startRow = Math.floor(row / blockSize.rows) * blockSize.rows;
  const startCol = Math.floor(col / blockSize.cols) * blockSize.cols;
  const cells = [];
  for (let r = startRow; r < startRow + blockSize.rows; r++) {
    for (let c = startCol; c < startCol + blockSize.cols; c++) {
      cells.push({ row: r, col: c });
    }
  }
  return cells;
}

export function checkConflicts(board, row, col, num, boardSize = 9, blockSize = null) {
  if (num < 1 || num > boardSize) return [];   // > 9 → > boardSize
  // key: r * 9 + c → r * boardSize + c
}

export function isBoardComplete(board, solution, boardSize = 9) {
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) { /* ... */ }
  }
}
```

### 5.5 `src/js/game/board.js` — boardSize 통합

```javascript
export class Board {
  constructor(boardSize = 9) {
    this.boardSize = boardSize;
    this.blockSize = getBlockSize(boardSize);
    this._board = Board._emptyGrid(boardSize);
    this._solution = Board._emptyGrid(boardSize);
    this._given = Board._emptyBoolGrid(boardSize);
    // ...
  }

  newGame(difficulty, dailyDate, mode, options) {
    if (options.boardSize) {
      this.boardSize = options.boardSize;
      this.blockSize = getBlockSize(this.boardSize);
    }
    const puzzle = generatePuzzle(difficulty, this.boardSize, dailyDate);
    // ...
  }

  // 모든 검증 호출에 boardSize/blockSize 전달
  _validateMove(row, col, num) {
    return validateMove(
      this._board, this._solution, row, col, num,
      this.boardSize, this.blockSize
    );
  }

  // 상태 직렬화에 boardSize 포함
  getState() {
    return {
      boardSize: this.boardSize,
      mode: this.mode,
      // ... 기존 필드
    };
  }

  static _emptyGrid(boardSize = 9) {
    return Array.from({ length: boardSize }, () => Array(boardSize).fill(0));
  }

  static _emptyBoolGrid(boardSize = 9) {
    return Array.from({ length: boardSize }, () => Array(boardSize).fill(false));
  }
}
```

### 5.6 `src/js/game/notes.js` — 파라미터화

**하드코딩 위치**: 7곳

```javascript
export class Notes {
  constructor(boardSize = 9, blockSize = null) {
    this.boardSize = boardSize;
    this.blockSize = blockSize || getBlockSize(boardSize);
    this._grid = Notes._createEmptyGrid(boardSize);
  }

  removeFromRelated(row, col, num) {
    // 행: c < 9 → c < this.boardSize
    for (let c = 0; c < this.boardSize; c++) { /* ... */ }
    // 열: r < 9 → r < this.boardSize
    for (let r = 0; r < this.boardSize; r++) { /* ... */ }
    // 블록: /3*3 → /blockSize.rows*blockSize.rows
    const br = Math.floor(row / this.blockSize.rows) * this.blockSize.rows;
    const bc = Math.floor(col / this.blockSize.cols) * this.blockSize.cols;
    for (let r = br; r < br + this.blockSize.rows; r++) {
      for (let c = bc; c < bc + this.blockSize.cols; c++) { /* ... */ }
    }
  }

  fromJSON(data) {
    if (data.length !== this.boardSize) return;  // !== 9 → !== this.boardSize
    // ...
  }

  static _createEmptyGrid(boardSize = 9) {
    return Array.from({ length: boardSize }, () =>
      Array.from({ length: boardSize }, () => new Set())
    );
  }
}
```

### 5.7 `src/js/game/hints.js` — 파라미터화

**하드코딩 위치**: 11곳

```javascript
export function getHint(board, solution, notes, boardSize = 9, blockSize = null, useSmartHints = true) {
  if (!blockSize) blockSize = getBlockSize(boardSize);

  if (useSmartHints) {
    // 1순위: findLastInRow(board, boardSize)
    // 2순위: findLastInCol(board, boardSize)
    // 3순위: findLastInBlock(board, boardSize, blockSize)
    // 4순위: findNakedSingle(board, boardSize, blockSize)
  }
  return findDirectReveal(board, solution, boardSize);
}

// 모든 헬퍼 함수에 boardSize, blockSize 전달
function findLastInRow(board, boardSize) { /* r < 9 → r < boardSize */ }
function findLastInCol(board, boardSize) { /* c < 9 → c < boardSize */ }
function findLastInBlock(board, boardSize, blockSize) {
  // blockR < 3 → blockR < boardSize / blockSize.rows
  // blockC < 3 → blockC < boardSize / blockSize.cols
  // blockR * 3 → blockR * blockSize.rows
}
function findNakedSingle(board, boardSize, blockSize) { /* getCandidates에 boardSize 전달 */ }
function findDirectReveal(board, solution, boardSize) { /* r < 9 → r < boardSize */ }
```

### 5.8 `src/js/game/input.js` — hints 호출 수정

```javascript
useHint() {
  const hint = getHint(
    this._board.getBoard(),
    this._board.getSolution(),
    this._board.notes,
    this._board.boardSize,         // 추가
    this._board.blockSize,         // 추가
    this._settings?.smartHints ?? true
  );
}
```

### 5.9 `src/js/game/history.js` — 변경 불필요

> Generic stack 구현이므로 보드 크기에 무관.

### 5.10 Phase C 변경 파일 목록

| 파일 | 작업 | 규모 |
|------|------|------|
| `src/js/core/board-config.js` | **신규** 크기별 설정 모듈 | 소 |
| `src/js/core/solver.js` | 6곳 파라미터화 | 대 |
| `src/js/core/generator.js` | 7곳 파라미터화 + DIFFICULTY_RANGES 분리 | 대 |
| `src/js/core/validator.js` | 10곳 파라미터화 | 대 |
| `src/js/game/board.js` | boardSize/blockSize 속성, 전체 메서드 전파 | 대 |
| `src/js/game/notes.js` | 7곳 파라미터화 | 중 |
| `src/js/game/hints.js` | 11곳 파라미터화 | 중 |
| `src/js/game/input.js` | hints 호출 시그니처 수정 | 소 |
| `src/js/core/scorer.js` | getDifficultyRange 연동 | 소 |

---

## 6. Phase D: 다양한 크기 모드 — UI 동적화

> 기능 2 — 그리드/숫자패드/하이라이트 동적 렌더링

### 6.1 `src/js/ui/grid.js` — DOM 동적 생성

**하드코딩 위치**: 8곳

```javascript
export class GridUI {
  constructor(containerEl, gridSize = 9) {
    this._gridSize = gridSize;
    this._blockSize = getBlockSize(gridSize);
    this._cells = [];
    this._container = containerEl;
  }

  // 그리드 재구성 (크기 변경 시)
  rebuild(gridSize) {
    this._gridSize = gridSize;
    this._blockSize = getBlockSize(gridSize);
    this._container.innerHTML = '';
    this._cells = [];
    this._buildGrid();
    this._injectDynamicCSS();
  }

  _buildGrid() {
    const grid = document.createElement('div');
    grid.className = 'sudoku-grid';
    grid.style.gridTemplateColumns = `repeat(${this._gridSize}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${this._gridSize}, 1fr)`;

    for (let r = 0; r < this._gridSize; r++) {
      for (let c = 0; c < this._gridSize; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = r;
        cell.dataset.col = c;

        // 블록 테두리 클래스
        if ((c + 1) % this._blockSize.cols === 0 && c < this._gridSize - 1) {
          cell.classList.add('block-right');
        }
        if ((r + 1) % this._blockSize.rows === 0 && r < this._gridSize - 1) {
          cell.classList.add('block-bottom');
        }

        grid.appendChild(cell);
        this._cells.push(cell);
      }
    }
    this._container.appendChild(grid);
  }

  // 동적 CSS 주입 (nth-child 대체)
  _injectDynamicCSS() {
    let existing = document.getElementById('dynamic-grid-css');
    if (existing) existing.remove();

    const style = document.createElement('style');
    style.id = 'dynamic-grid-css';
    // 마지막 열/행 테두리 제거, 블록 경계 강조 등
    document.head.appendChild(style);
  }

  // 셀 접근: row * 9 + col → row * this._gridSize + col
  getCell(row, col) {
    return this._cells[row * this._gridSize + col];
  }

  renderBoard(board, given) {
    for (let r = 0; r < this._gridSize; r++) {
      for (let c = 0; c < this._gridSize; c++) { /* ... */ }
    }
  }

  showNotes(row, col, notes) {
    // 노트 그리드: 3x3 → blockSize.cols x blockSize.rows
    for (let n = 1; n <= this._gridSize; n++) { /* ... */ }
  }

  animateWave() {
    const totalCells = this._gridSize * this._gridSize;  // 81 → 동적
    for (let r = 0; r < this._gridSize; r++) {
      for (let c = 0; c < this._gridSize; c++) { /* ... */ }
    }
  }
}
```

### 6.2 `src/js/ui/highlight.js` — gridSize 파라미터화

```javascript
export class HighlightUI {
  constructor(gridUI, gridSize = 9) {
    this._grid = gridUI;
    this._gridSize = gridSize;
  }

  highlightSelection(pos, board) {
    // row * 9 + col → row * this._gridSize + col
    // 전체 순회: r < 9, c < 9 → r < this._gridSize, c < this._gridSize
  }
}
```

### 6.3 `src/js/ui/numberpad.js` — 동적 버튼 수

```javascript
export class NumberpadUI {
  constructor(containerEl, maxNumber = 9) {
    this._container = containerEl;
    this._maxNumber = maxNumber;
  }

  // 숫자패드 재구성
  rebuild(maxNumber) {
    this._maxNumber = maxNumber;
    this._container.innerHTML = '';

    for (let i = 1; i <= maxNumber; i++) {
      const btn = document.createElement('button');
      btn.className = 'num-btn';
      btn.dataset.number = i;
      // 12+: 10='A', 11='B' 등 표기 또는 숫자 그대로
      btn.textContent = i <= 9 ? String(i) : String.fromCharCode(55 + i);
      // 또는 단순히 숫자: btn.textContent = String(i);
      this._container.appendChild(btn);
    }
  }
}
```

### 6.4 `src/css/grid.css` — CSS 변수 시스템

```css
/* 기존 하드코딩 nth-child 규칙 → 클래스 기반으로 전환 */

/* 블록 테두리: JavaScript에서 클래스 부여 */
.cell.block-right {
  border-right: 2px solid var(--grid-block-border, #455A64);
}

.cell.block-bottom {
  border-bottom: 2px solid var(--grid-block-border, #455A64);
}

/* 크기별 셀 폰트 */
body[data-grid-size="4"] .cell { font-size: clamp(1.2rem, 6vw, 2rem); }
body[data-grid-size="6"] .cell { font-size: clamp(1rem, 5vw, 1.8rem); }
body[data-grid-size="9"] .cell { font-size: clamp(1.1rem, 4.5vw, 1.5rem); }
body[data-grid-size="12"] .cell { font-size: clamp(0.8rem, 3vw, 1.2rem); }
body[data-grid-size="16"] .cell { font-size: clamp(0.6rem, 2vw, 1rem); }

/* 크기별 그리드 최대 너비 */
body[data-grid-size="4"] .sudoku-grid { max-width: 240px; }
body[data-grid-size="6"] .sudoku-grid { max-width: 300px; }
body[data-grid-size="9"] .sudoku-grid { max-width: 396px; }
body[data-grid-size="12"] .sudoku-grid { max-width: 480px; }
body[data-grid-size="16"] .sudoku-grid { max-width: 100%; }

/* 크기별 숫자패드 레이아웃 */
body[data-grid-size="12"] .numberpad { flex-wrap: wrap; }
body[data-grid-size="12"] .num-btn { flex: 0 0 calc(25% - 6px); }
body[data-grid-size="16"] .numberpad { flex-wrap: wrap; }
body[data-grid-size="16"] .num-btn { flex: 0 0 calc(25% - 6px); }

/* 크기별 노트 그리드 */
body[data-grid-size="4"] .cell-notes {
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
}
body[data-grid-size="6"] .cell-notes {
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
}
/* 9x9: 기존 3x3 유지 */
body[data-grid-size="12"] .cell-notes {
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(3, 1fr);
}
body[data-grid-size="16"] .cell-notes {
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(4, 1fr);
}
```

### 6.5 `src/js/app.js` — 키보드 범위 동적화

```javascript
// 키보드 입력 (현재: key >= '1' && key <= '9')
const maxNum = this._board?.boardSize || 9;
const num = parseInt(key, 10);
if (num >= 1 && num <= Math.min(maxNum, 9)) {
  e.preventDefault();
  this._input.inputNumber(num);
}
// 12/16x16: 숫자 10 이상은 별도 UI 입력만 지원 (키보드 미지원)
```

### 6.6 `src/index.html` — numberpad 동적화

```html
<!-- 기존: 정적 9개 버튼 삭제 -->
<!-- 변경: JavaScript로 동적 생성 -->
<div class="numberpad" id="numberpad">
  <!-- NumberpadUI.rebuild()에서 동적 생성 -->
</div>
```

### 6.7 16x16 반응형 레이아웃

```css
/* 태블릿 이상: 사이드바 레이아웃 */
@media (min-width: 768px) {
  body[data-grid-size="12"] #screen-game,
  body[data-grid-size="16"] #screen-game {
    flex-direction: row;
    align-items: flex-start;
  }

  body[data-grid-size="12"] .grid-container,
  body[data-grid-size="16"] .grid-container {
    flex: 0 0 auto;
    max-width: 500px;
  }

  body[data-grid-size="12"] .game-controls,
  body[data-grid-size="16"] .game-controls {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: var(--spacing-lg);
  }
}
```

### 6.8 Phase D 변경 파일 목록

| 파일 | 작업 | 규모 |
|------|------|------|
| `src/js/ui/grid.js` | gridSize 파라미터, 동적 DOM, CSS 주입 | 대 |
| `src/js/ui/highlight.js` | gridSize 파라미터화 | 중 |
| `src/js/ui/numberpad.js` | 동적 버튼 생성 rebuild() | 중 |
| `src/js/ui/animations.js` | 루프 범위 동적화 | 소 |
| `src/css/grid.css` | nth-child → 클래스 전환, 크기별 스타일 | 대 |
| `src/css/screens.css` | 보드 크기 선택 섹션 활성화, 반응형 | 중 |
| `src/index.html` | 정적 numberpad 제거, 보드 크기 섹션 표시 | 중 |
| `src/js/app.js` | 키보드 범위 동적화, body data-grid-size 설정 | 소 |

---

## 7. Phase E: 다양한 크기 모드 — 대형 보드 최적화

> 12x12, 16x16 퍼즐 생성 성능 문제 해결

### 7.1 성능 문제 분석

| 보드 크기 | 총 셀 | 백트래킹 예상 시간 | 문제 |
|-----------|-------|:--:|------|
| 4x4 | 16 | <1ms | 없음 |
| 6x6 | 36 | <10ms | 없음 |
| 9x9 | 81 | <100ms | 없음 |
| 12x12 | 144 | 1-5초 | UI 블로킹 |
| 16x16 | 256 | 5-60초 | 사용 불가 |

### 7.2 해결 전략: Web Worker

```javascript
// src/js/core/puzzle-worker.js (신규)
self.onmessage = (e) => {
  const { difficulty, boardSize } = e.data;
  // generator + solver 로직 실행
  const puzzle = generatePuzzle(difficulty, boardSize);
  self.postMessage({ puzzle });
};

// board.js에서 호출
async newGame(difficulty, dailyDate, mode, options) {
  const boardSize = options.boardSize || 9;

  if (boardSize >= 12) {
    // Web Worker로 비동기 생성
    const puzzle = await this._generateAsync(difficulty, boardSize);
    this._applyPuzzle(puzzle);
  } else {
    // 기존 동기 생성
    const puzzle = generatePuzzle(difficulty, boardSize);
    this._applyPuzzle(puzzle);
  }
}
```

### 7.3 로딩 UI

```html
<!-- 퍼즐 생성 중 로딩 표시 -->
<div class="puzzle-loading" style="display:none;">
  <div class="loading-spinner"></div>
  <p>퍼즐 생성 중...</p>
  <p class="loading-size">16x16 퍼즐을 만들고 있습니다</p>
</div>
```

### 7.4 DLX 알고리즘 (선택적 최적화)

> 16x16 생성이 Web Worker로도 30초 이상 걸릴 경우 도입

```javascript
// DLX (Dancing Links) - Exact Cover 기반 solver
// 스도쿠 → 4가지 제약조건의 Exact Cover 문제로 변환:
// 1. 각 셀에 숫자 1개 (NxN 제약)
// 2. 각 행에 모든 숫자 (NxN 제약)
// 3. 각 열에 모든 숫자 (NxN 제약)
// 4. 각 블록에 모든 숫자 (NxN 제약)
// 총 제약: 4 * N^2 열, N^3 행

// 참고 구현: https://github.com/nicwest/dancing-links
// npm: @algorithm.ts/sudoku
```

### 7.5 사전 생성 전략 (대안)

```javascript
// 16x16 퍼즐을 미리 생성하여 캐시
const PREGENERATED_16x16 = {
  easy: [/* 10개 퍼즐 */],
  normal: [/* 10개 퍼즐 */],
  // ...
};

// 앱 유휴 시 백그라운드로 추가 생성
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => generateAndCache(16));
}
```

### 7.6 Phase E 변경 파일 목록

| 파일 | 작업 | 규모 |
|------|------|------|
| `src/js/core/puzzle-worker.js` | **신규** Web Worker | 중 |
| `src/js/game/board.js` | 비동기 생성 로직 | 중 |
| `src/index.html` | 로딩 UI HTML | 소 |
| `src/css/screens.css` | 로딩 스피너 스타일 | 소 |

---

## 8. 데이터 마이그레이션 전략

### 8.1 localStorage 키 변경

```
변경 전:                    변경 후:
sudoku_stats       →       sudoku_stats (classic 호환)
                           sudoku_stats_timeAttack (신규)
sudoku_currentGame →       sudoku_currentGame (+ mode 필드)
                           sudoku_currentGame (+ boardSize 필드)
```

### 8.2 마이그레이션 코드 (`app.js` init 시점)

```javascript
function migrateStorageIfNeeded() {
  const version = localStorage.getItem('sudoku_version');

  if (!version || version < '2') {
    // v2: 기존 currentGame에 mode/boardSize 기본값 추가
    const game = readJSON('sudoku_currentGame');
    if (game && !game.mode) {
      game.mode = 'classic';
      game.boardSize = 9;
      writeJSON('sudoku_currentGame', game);
    }
    localStorage.setItem('sudoku_version', '2');
  }
}
```

### 8.3 하위 호환성 원칙

- 모든 신규 파라미터에 기본값 설정 (`boardSize = 9`, `mode = 'classic'`)
- 기존 저장 데이터에 mode/boardSize 없으면 기본값 적용
- 기존 통계 키 `sudoku_stats`는 classic 모드로 자동 인식

---

## 9. 테스트 계획

### 9.1 기존 테스트 영향도

| 테스트 파일 | Phase A | Phase B | Phase C | Phase D |
|------------|:--:|:--:|:--:|:--:|
| 01-navigation.spec.js | 수정 | - | - | - |
| 02-game-basics.spec.js | - | - | 수정 | 수정 |
| 03-input-and-tools.spec.js | - | - | 수정 | 수정 |
| 04-game-completion.spec.js | - | 수정 | - | - |
| 05-persistence.spec.js | 수정 | 수정 | 수정 | - |
| 06-screens.spec.js | 수정 | - | - | - |
| 07-dark-mode.spec.js | - | - | - | - |
| 08-keyboard.spec.js | - | - | - | 수정 |
| 09-enhanced-ui.spec.js | - | - | - | 수정 |

### 9.2 신규 테스트 항목

#### Phase A 테스트
- [ ] 모드 선택 화면 표시/숨김
- [ ] 클래식 모드 선택 → 난이도 모달 → 게임 시작
- [ ] 게임 저장/로드 시 mode 필드 유지
- [ ] 모드별 통계 분리 확인

#### Phase B 테스트
- [ ] 타임어택 모드 진입
- [ ] 카운트다운 타이머 표시 (MM:SS 감소)
- [ ] 30초 이하 경고 애니메이션
- [ ] 10초 이하 위험 애니메이션
- [ ] 시간 초과 시 게임오버
- [ ] 시간 내 완료 시 보너스 점수
- [ ] 일시정지 시 카운트다운 정지
- [ ] 타임어택 통계 별도 저장

#### Phase C 테스트
- [ ] 4x4 퍼즐 생성/풀이/검증
- [ ] 6x6 퍼즐 생성/풀이/검증 (비정사각 블록 2x3)
- [ ] 9x9 기존 기능 회귀 테스트
- [ ] 12x12 퍼즐 생성/풀이/검증
- [ ] 16x16 퍼즐 생성/풀이/검증
- [ ] 각 크기별 유일해 검증
- [ ] 각 크기별 힌트 정확성
- [ ] 각 크기별 메모 기능

#### Phase D 테스트
- [ ] 4x4 그리드 렌더링 (2x2 블록 테두리)
- [ ] 6x6 그리드 렌더링 (2x3 블록 테두리)
- [ ] 16x16 그리드 렌더링 (셀 가독성)
- [ ] 동적 숫자패드 (4/6/9/12/16 버튼)
- [ ] 크기별 하이라이트 정확성
- [ ] 반응형 레이아웃 (모바일/태블릿)

#### Phase E 테스트
- [ ] 12x12 Web Worker 생성 (5초 이내)
- [ ] 16x16 Web Worker 생성 (30초 이내)
- [ ] 로딩 UI 표시/숨김
- [ ] Worker 에러 처리

---

## 10. 파일 변경 총괄표

### 신규 파일 (3개)

| 파일 | Phase | 목적 |
|------|-------|------|
| `src/js/core/board-config.js` | C | 보드 크기별 설정 |
| `src/js/screens/mode-select.js` | A | 모드 선택 화면 |
| `src/js/core/puzzle-worker.js` | E | Web Worker 퍼즐 생성 |

### 수정 파일 (19개)

| 파일 | Phase | 변경 규모 | 하드코딩 수정 수 |
|------|-------|----------|:--:|
| `src/js/game/board.js` | A,B,C | 대 | 4곳 |
| `src/js/core/generator.js` | C | 대 | 7곳 |
| `src/js/core/solver.js` | C | 대 | 6곳 |
| `src/js/core/validator.js` | C | 대 | 10곳 |
| `src/js/ui/grid.js` | D | 대 | 8곳 |
| `src/css/grid.css` | D | 대 | 8곳 |
| `src/js/game/timer.js` | B | 중 | 0 (신규 메서드) |
| `src/js/screens/game.js` | A,B | 중 | 0 (분기 추가) |
| `src/js/app.js` | A,D | 중 | 1곳 |
| `src/js/game/notes.js` | C | 중 | 7곳 |
| `src/js/game/hints.js` | C | 중 | 11곳 |
| `src/js/ui/highlight.js` | D | 중 | 5곳 |
| `src/js/ui/numberpad.js` | D | 중 | 0 (동적 생성) |
| `src/index.html` | A,D | 중 | 2곳 |
| `src/css/screens.css` | A | 중 | 0 (신규 스타일) |
| `src/js/utils/storage.js` | A | 소 | 0 (키 분리) |
| `src/js/core/scorer.js` | B | 소 | 0 (함수 추가) |
| `src/js/screens/complete.js` | B | 소 | 0 (분기 추가) |
| `src/css/animations.css` | B | 소 | 0 (애니메이션 추가) |
| `src/js/game/input.js` | C | 소 | 0 (시그니처 수정) |
| `src/sw.js` | A | 소 | CACHE_NAME만 |

**총 하드코딩 수정: 69곳+**

---

## 11. 의존성 그래프

### Phase 간 의존성

```
Phase A (모드 시스템)     ← 독립
    │
    ├── Phase B (타임어택)  ← A 필요
    │
    └── Phase C (엔진 리팩터링) ← A 필요
            │
            └── Phase D (UI 동적화) ← C 필요
                    │
                    └── Phase E (대형 보드 최적화) ← D 필요
```

### 파일 간 의존성 (호출 방향)

```
app.js
  └→ screens/mode-select.js
  └→ screens/game.js
       └→ game/board.js (중앙)
            ├→ core/board-config.js (설정)
            ├→ core/generator.js
            │    └→ core/solver.js
            ├→ core/validator.js
            ├→ core/scorer.js
            ├→ game/notes.js
            ├→ game/hints.js
            │    └→ core/solver.js
            ├→ game/timer.js
            ├→ game/history.js
            └→ game/input.js
                 └→ game/hints.js
       └→ ui/grid.js
       └→ ui/highlight.js
       └→ ui/numberpad.js
       └→ ui/animations.js
  └→ utils/storage.js
```

---

## 12. 리스크 및 완화 방안

| # | 리스크 | 영향도 | 발생 확률 | 완화 방안 |
|---|--------|:--:|:--:|----------|
| 1 | 엔진 리팩터링 시 기존 9x9 회귀 버그 | 상 | 중 | 모든 함수에 기본값 `boardSize=9`; 단계별 테스트; Phase C 진입 전 기존 61개 테스트 전체 통과 확인 |
| 2 | 16x16 퍼즐 생성 성능 (30초+) | 상 | 상 | Web Worker; DLX 알고리즘; 사전 생성 캐시 |
| 3 | 6x6 비정사각 블록 (2x3) 로직 오류 | 중 | 중 | `blockSize.rows !== blockSize.cols` 별도 테스트; 4x4(정사각) 먼저 구현 후 6x6 진행 |
| 4 | 16x16 모바일 UI 가독성 | 중 | 상 | 태블릿/데스크톱 권장; 모바일에서는 핀치 줌 or 9x9 이하 제한 |
| 5 | localStorage 마이그레이션 실패 | 중 | 하 | 마이그레이션 전 백업; 실패 시 기본값 적용; try-catch |
| 6 | 기존 61개 테스트 대량 수정 | 중 | 상 | Phase D까지는 기존 9x9 기본값으로 테스트 통과 유지; Phase D에서 일괄 수정 |
| 7 | Timer 카운트다운 정확도 (±1초) | 하 | 중 | 기존 performance.now() 드리프트 보정 활용; 10초 이하 구간 rAF 전환 검토 |

---

> 이 문서는 에이전트 팀(코어 엔진 분석기 + UI 레이어 분석기 + 게임 레이어 분석기)의 분석을 종합하여 작성되었습니다.
> 분석 원본: `memory/core-engine-analysis.md`, `memory/UI_LAYER_ANALYSIS.md`, `memory/game-layer-analysis.md`
