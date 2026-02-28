# 스도쿠 리그 - 기능추가 상세 설계문서

> 작성일: 2026-02-28
> 대상 버전: v2
> 참조: design-comprehensive-20260228.md

---

## 1. 공통 인프라: 게임 히스토리 아카이브

### 1.1 스토리지 데이터 구조

```javascript
// storage.js 추가

const KEYS = {
    // ... 기존 키 유지
    GAME_HISTORY: 'sudoku_gameHistory',     // 신규
};

const MAX_HISTORY_ENTRIES = 200;
const MAX_HISTORY_LARGE_BOARD = 100; // boardSize >= 12

/**
 * @typedef {Object} GameHistoryEntry
 * @property {string}     id         - `Date.now().toString(36)` 기반 고유 ID
 * @property {string}     completedAt - ISO 8601 완료 시각
 * @property {string}     difficulty  - 'easy'|'normal'|'hard'|'expert'|'master'
 * @property {string}     mode        - 'classic'|'timeAttack'
 * @property {number}     boardSize   - 4|6|9|12|16
 * @property {number}     score       - 최종 점수
 * @property {number}     time        - 소요 시간 (초)
 * @property {number}     mistakes    - 실수 횟수
 * @property {boolean}    success     - 완료 성공 여부
 * @property {string|null} dailyDate  - 일일 도전 날짜 (YYYY-MM-DD) or null
 * @property {number[][]} puzzle      - 초기 퍼즐 보드 (빈칸=0)
 * @property {number[][]} solution    - 정답 보드
 * @property {boolean[][]} given      - 주어진 셀 마스크
 */
```

### 1.2 신규 스토리지 함수

```javascript
// storage.js 에 추가할 함수들

/**
 * 완료된 게임을 히스토리 아카이브에 저장.
 * FIFO 방식으로 최대 개수 초과 시 가장 오래된 항목 삭제.
 *
 * @param {GameHistoryEntry} entry
 */
export function saveGameHistory(entry) {
    const history = loadGameHistory();
    history.unshift(entry);  // 최신이 앞에

    // 용량 제한 적용
    const limit = entry.boardSize >= 12 ? MAX_HISTORY_LARGE_BOARD : MAX_HISTORY_ENTRIES;
    while (history.length > limit) {
        history.pop();
    }

    writeJSON(KEYS.GAME_HISTORY, history);
}

/**
 * 전체 게임 히스토리 로드.
 *
 * @returns {GameHistoryEntry[]}
 */
export function loadGameHistory() {
    const stored = readJSON(KEYS.GAME_HISTORY);
    return Array.isArray(stored) ? stored : [];
}

/**
 * 특정 ID의 히스토리 항목 조회.
 *
 * @param {string} id
 * @returns {GameHistoryEntry|null}
 */
export function getGameHistoryById(id) {
    const history = loadGameHistory();
    return history.find(e => e.id === id) || null;
}

/**
 * 게임 히스토리 전체 삭제.
 */
export function clearGameHistory() {
    writeJSON(KEYS.GAME_HISTORY, []);
}
```

### 1.3 complete.js 수정 상세

현재 `complete.js:onShow()` (102행) 에서 `clearGame()` 호출 직전에 아카이브 저장 로직 삽입:

```javascript
// complete.js onShow() 내부 - clearGame() 호출 전 (약 169행 부근)

// --- Archive completed game to history ---
if (success !== false) {  // 실패한 타임어택은 아카이브 제외
    try {
        const board = _app.board;
        if (board) {
            saveGameHistory({
                id: Date.now().toString(36),
                completedAt: new Date().toISOString(),
                difficulty,
                mode,
                boardSize: board.boardSize || 9,
                score,
                time,
                mistakes,
                success: success !== false,
                dailyDate: isDaily ? (params.dailyDate || null) : null,
                puzzle: board.getInitialPuzzle(),  // ← Board에 추가 필요
                solution: board.getSolution(),
                given: board.getGiven(),
            });
        }
    } catch { /* 아카이브 실패 시 무시 */ }
}

// --- Clear saved game ---
clearGame();
```

### 1.4 Board 클래스 확장 (board.js)

초기 퍼즐 상태를 보관하기 위해 `_initialPuzzle` 필드 추가:

```javascript
// board.js - newGame() 내부
this._initialPuzzle = puzzle.board.map(row => [...row]);  // deep copy

// board.js - 신규 getter
getInitialPuzzle() {
    return this._initialPuzzle;
}

getSolution() {
    return this._solution;
}

getGiven() {
    return this._given;
}
```

`loadState()` 에서도 `_initialPuzzle` 복원 지원:

```javascript
// board.js - loadState()
if (saved.initialPuzzle) {
    this._initialPuzzle = saved.initialPuzzle;
}
```

`toJSON()` 에서 `initialPuzzle` 포함:

```javascript
// board.js - toJSON()
return {
    // ... 기존 필드
    initialPuzzle: this._initialPuzzle,
};
```

### 1.5 스토리지 마이그레이션 v1 → v2

```javascript
// storage.js - migrateStorageIfNeeded() 확장
const CURRENT_STORAGE_VERSION = 2;  // 1에서 2로 변경

// v1 → v2: gameHistory 초기화
if (storedVersion < 2) {
    if (!readJSON(KEYS.GAME_HISTORY)) {
        writeJSON(KEYS.GAME_HISTORY, []);
    }
}
```

---

## 2. F4 - 과거 플레이 재도전 모드

### 2.1 화면 구조 (screen-history)

```html
<!-- index.html 추가 -->
<div id="screen-history" class="screen">
  <div class="sub-header">
    <button class="icon-btn btn-back" data-action="back" aria-label="뒤로가기">
      <svg>...</svg>
    </button>
    <h2 class="sub-title">게임 기록</h2>
    <div class="sub-header-right"></div>
  </div>

  <!-- 필터 탭 -->
  <div class="history-filters">
    <button class="history-filter active" data-filter="all">전체</button>
    <button class="history-filter" data-filter="classic">클래식</button>
    <button class="history-filter" data-filter="timeAttack">타임어택</button>
    <button class="history-filter" data-filter="daily">일일 도전</button>
  </div>

  <!-- 게임 목록 -->
  <div class="history-list" id="history-list">
    <!-- JS로 동적 생성 -->
  </div>

  <div class="history-empty" style="display:none;">
    <p>완료한 게임이 없습니다.</p>
  </div>
</div>
```

### 2.2 히스토리 목록 아이템 렌더링

```javascript
// screens/history.js

function renderHistoryItem(entry) {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.dataset.id = entry.id;

    const diffLabel = DIFFICULTY_LABELS[entry.difficulty] || entry.difficulty;
    const modeLabel = entry.mode === 'timeAttack' ? '타임어택' : '클래식';
    const dateStr = new Date(entry.completedAt).toLocaleDateString('ko-KR');
    const timeStr = formatTime(entry.time);

    item.innerHTML = `
        <div class="history-item-info">
            <div class="history-item-top">
                <span class="history-date">${dateStr}</span>
                <span class="history-mode">${modeLabel}</span>
                <span class="history-size">${entry.boardSize}×${entry.boardSize}</span>
            </div>
            <div class="history-item-bottom">
                <span class="history-difficulty">${diffLabel}</span>
                <span class="history-score">${entry.score.toLocaleString()}점</span>
                <span class="history-time">${timeStr}</span>
            </div>
        </div>
        <div class="history-item-actions">
            <button class="btn btn-sm btn-primary" data-action="replay">재도전</button>
            <button class="btn btn-sm btn-secondary" data-action="print">인쇄</button>
        </div>
    `;

    return item;
}
```

### 2.3 재도전 게임 시작 로직

```javascript
// screens/history.js

function onReplayClick(entryId) {
    const entry = getGameHistoryById(entryId);
    if (!entry) return;

    _app.navigate('game', {
        replay: true,
        difficulty: entry.difficulty,
        mode: entry.mode,
        boardSize: entry.boardSize,
        puzzle: entry.puzzle,
        solution: entry.solution,
        given: entry.given,
        duration: entry.mode === 'timeAttack' ? getRecommendedDuration(entry.difficulty) : undefined,
    });
}
```

### 2.4 game.js 확장 - 재도전 지원

`onShow()` 에서 `replay` 파라미터 처리:

```javascript
// game.js - onShow() 확장 (약 189행)
function onShow(params) {
    // ... 기존 코드

    if (params.replay && params.puzzle) {
        startReplayGame(params);
    } else if (params.loadSaved) {
        restoreSavedGame();
    } else if (params.daily) {
        // ... 기존 코드
    }
}

/**
 * 히스토리에서 가져온 퍼즐로 새 게임 시작.
 */
function startReplayGame(params) {
    _app.board.newGameFromPuzzle(
        params.puzzle,
        params.solution,
        params.given,
        params.difficulty,
        params.mode,
        { boardSize: params.boardSize, duration: params.duration }
    );

    const boardSize = params.boardSize || 9;
    document.body.dataset.gridSize = String(boardSize);
    if (_app.gridUI?.rebuild) _app.gridUI.rebuild(boardSize);
    if (_app.highlightUI) _app.highlightUI._gridSize = boardSize;
    if (_app.numberpadUI?.rebuild) _app.numberpadUI.rebuild(boardSize);

    if (params.mode === 'timeAttack' && params.duration) {
        _app.board.timer.setCountdown(true);
        _app.board.timer.setDuration(params.duration);
        _app.board.timer.onTimeUp(() => handleTimeUp());
    }

    _app.board.timer.onTick((formatted) => {
        if (timerValueEl && _app.settings.timer) {
            timerValueEl.textContent = formatted;
        }
    });

    resetGameUI(params.difficulty);
    renderFullGrid();
    updateGamesStarted(params.difficulty);
}
```

### 2.5 Board 클래스 확장 - newGameFromPuzzle()

```javascript
// board.js 추가
/**
 * 기존 퍼즐 데이터로 새 게임 시작 (재도전용).
 */
newGameFromPuzzle(puzzle, solution, given, difficulty, mode, options = {}) {
    const boardSize = options.boardSize || 9;
    this.boardSize = boardSize;
    this.blockSize = getBlockSize(boardSize);

    this._board = puzzle.map(row => [...row]);     // deep copy
    this._solution = solution.map(row => [...row]);
    this._given = given.map(row => [...row]);
    this._initialPuzzle = puzzle.map(row => [...row]);

    this._difficulty = difficulty;
    this.mode = mode || 'classic';
    this._score = 0;
    this._mistakes = 0;
    this._hints = 3;
    this._gameOver = false;
    this._dailyDate = null;

    this.notes.clear();
    this.history.clear();
    this.timer.reset();
    this.timer.start();
}
```

### 2.6 메인 화면 버튼 추가

```html
<!-- index.html screen-main 내부, btn-new-game 아래 -->
<button class="btn btn-secondary btn-history" data-navigate="history">
  게임 기록
</button>
```

---

## 3. F5 - 일자별 플레이 모드 확장

### 3.1 daily.js 변경 사항

현재 코드 (daily.js:189행):
```javascript
const isFuture = dateObj > today && dateStr !== todayStr;
```

변경:
```javascript
// 미래 날짜도 플레이 가능하게 변경
const isFuture = dateObj > today && dateStr !== todayStr;
// isFuture는 스타일 용도로만 사용, 클릭 차단 제거
```

**renderCalendar() 수정 상세** (daily.js:186-221행):

```javascript
// 변경 전 (213행)
if (!isFuture) {
    cell.addEventListener('click', () => { ... });
}

// 변경 후: 미래 날짜도 클릭 가능
cell.addEventListener('click', () => {
    _selectedDate = dateStr;
    renderCalendar();
});

// 미래 날짜 스타일은 유지 (시각적 구분)
if (isFuture) cell.classList.add('future');
```

### 3.2 달력 범위 확장

현재: 과거 8개월만 표시
변경: 과거 6개월 + 미래 2개월 (총 8개월 유지)

```javascript
// daily.js renderMonthTabs() 변경

const MONTHS_PAST = 6;
const MONTHS_FUTURE = 2;

for (let i = MONTHS_PAST - 1; i >= -MONTHS_FUTURE; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push(d);
}
```

### 3.3 미래 날짜 CSS 스타일

```css
/* screens.css 추가 */
.calendar-day.future {
    opacity: 0.7;
}
.calendar-day.future .day-number::after {
    content: '';  /* 미래 표시 제거, 단순 투명도로 구분 */
}
```

### 3.4 daily-seed.js 검증

`getDailySeed(date)` 와 `getDailyDifficulty(date)` 모두 임의 Date 파라미터를 이미 지원하므로 변경 불필요:

```javascript
// daily-seed.js:31 - 이미 임의 Date 지원
export function getDailySeed(date) {
    const d = date instanceof Date ? date : new Date();
    // ...
}
```

---

## 4. F6 - 인쇄모드

### 4.1 화면 구조 (screen-print)

```html
<!-- index.html 추가 -->
<div id="screen-print" class="screen">
  <div class="sub-header">
    <button class="icon-btn btn-back" data-action="back" aria-label="뒤로가기">
      <svg>...</svg>
    </button>
    <h2 class="sub-title">인쇄</h2>
    <div class="sub-header-right">
      <button class="btn btn-text" data-action="do-print">인쇄하기</button>
    </div>
  </div>

  <!-- 레이아웃 선택 -->
  <div class="print-layout-options">
    <button class="print-layout-option active" data-layout="single">
      <span class="layout-icon">▣</span>
      <span class="layout-label">1개 (A4)</span>
    </button>
    <button class="print-layout-option" data-layout="quad">
      <span class="layout-icon">⊞</span>
      <span class="layout-label">4개 모아찍기</span>
    </button>
  </div>

  <!-- 퍼즐 선택 (4개 모아찍기용) -->
  <div class="print-puzzle-select" style="display:none;">
    <p class="print-select-hint">인쇄할 퍼즐을 최대 4개 선택하세요</p>
    <div class="print-puzzle-list" id="print-puzzle-list">
      <!-- JS 동적 생성 -->
    </div>
  </div>

  <!-- 인쇄 미리보기 -->
  <div class="print-preview" id="print-preview">
    <!-- JS로 퍼즐 그리드 렌더링 -->
  </div>
</div>
```

### 4.2 인쇄 퍼즐 렌더링

CSS Grid 기반 정적 퍼즐 렌더링 (Canvas 대신 DOM 사용으로 인쇄 품질 확보):

```javascript
// screens/print.js

/**
 * 인쇄용 퍼즐 그리드를 DOM으로 생성.
 *
 * @param {GameHistoryEntry} entry
 * @param {string} [size='large'] - 'large' (1개) 또는 'small' (4개 모아찍기)
 * @returns {HTMLElement}
 */
function createPrintGrid(entry, size = 'large') {
    const container = document.createElement('div');
    container.className = `print-grid print-grid-${size}`;
    container.dataset.boardSize = String(entry.boardSize);

    // 퍼즐 정보 헤더
    const header = document.createElement('div');
    header.className = 'print-grid-header';
    header.innerHTML = `
        <span>${entry.dailyDate || new Date(entry.completedAt).toLocaleDateString('ko-KR')}</span>
        <span>${DIFFICULTY_LABELS[entry.difficulty]}</span>
        <span>${entry.boardSize}×${entry.boardSize}</span>
    `;
    container.appendChild(header);

    // 그리드 테이블
    const table = document.createElement('table');
    table.className = 'print-sudoku-table';
    const boardSize = entry.boardSize;
    const blockSize = getBlockSize(boardSize);

    for (let r = 0; r < boardSize; r++) {
        const tr = document.createElement('tr');
        for (let c = 0; c < boardSize; c++) {
            const td = document.createElement('td');
            td.className = 'print-cell';

            // 블록 경계선
            if (r % blockSize.rows === 0 && r > 0) td.classList.add('block-top');
            if (c % blockSize.cols === 0 && c > 0) td.classList.add('block-left');

            // 주어진 숫자만 표시 (빈칸은 비워둠)
            if (entry.given[r][c]) {
                td.textContent = String(entry.puzzle[r][c]);
                td.classList.add('given');
            }

            tr.appendChild(td);
        }
        table.appendChild(tr);
    }

    container.appendChild(table);
    return container;
}
```

### 4.3 A4 인쇄 CSS 레이아웃

```css
/* css/print.css */

@media print {
    /* 모든 화면 요소 숨기기 */
    #app > *:not(#screen-print),
    #navbar,
    .sub-header,
    .print-layout-options,
    .print-puzzle-select,
    .print-select-hint {
        display: none !important;
    }

    #screen-print {
        position: static !important;
        overflow: visible !important;
    }

    /* A4 페이지 설정 */
    @page {
        size: A4 portrait;
        margin: 15mm;
    }

    /* 단일 퍼즐 (A4 전체) */
    .print-grid-large {
        width: 100%;
        max-width: 180mm;
        margin: 0 auto;
        page-break-after: always;
    }

    .print-grid-large .print-sudoku-table {
        width: 100%;
        border-collapse: collapse;
    }

    .print-grid-large .print-cell {
        width: 20mm;
        height: 20mm;
        text-align: center;
        vertical-align: middle;
        font-size: 18pt;
        border: 0.5pt solid #999;
    }

    /* 4개 모아찍기 (2x2 그리드) */
    .print-preview-quad {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10mm;
        page-break-after: always;
    }

    .print-grid-small {
        width: 100%;
    }

    .print-grid-small .print-sudoku-table {
        width: 100%;
        border-collapse: collapse;
    }

    .print-grid-small .print-cell {
        width: 9mm;
        height: 9mm;
        text-align: center;
        vertical-align: middle;
        font-size: 9pt;
        border: 0.3pt solid #999;
    }

    /* 블록 경계선 (두꺼운 선) */
    .print-cell.block-top {
        border-top: 2pt solid #333;
    }
    .print-cell.block-left {
        border-left: 2pt solid #333;
    }

    /* 주어진 숫자: 볼드 */
    .print-cell.given {
        font-weight: bold;
        color: #000;
    }

    /* 외곽선 */
    .print-sudoku-table {
        border: 2pt solid #333;
    }
}
```

### 4.4 인쇄 실행 로직

```javascript
// screens/print.js

function onPrintClick() {
    window.print();
}
```

### 4.5 진입 경로

1. **히스토리에서 진입**: `history.js`에서 `navigate('print', { entries: [entry] })`
2. **일일 도전에서 진입**: `daily.js`에 인쇄 버튼 추가, 완료된 날짜 선택 시 활성화
3. **4개 모아찍기**: `history.js`에서 체크박스 다중 선택 → `navigate('print', { entries: [e1,e2,e3,e4] })`

---

## 5. app.js 라우터 확장

### 5.1 임포트 추가

```javascript
// app.js 상단
import { initHistoryScreen } from './screens/history.js';
import { initPrintScreen } from './screens/print.js';
```

### 5.2 초기화 추가

```javascript
// app.js init() 내부
initHistoryScreen(app);
initPrintScreen(app);
```

### 5.3 CSS 파일 추가

```html
<!-- index.html head -->
<link rel="stylesheet" href="css/print.css">
```

### 5.4 서비스 워커 캐시 업데이트

```javascript
// sw.js - 캐시 리스트에 신규 파일 추가
const CACHE_FILES = [
    // ... 기존 파일
    'js/screens/history.js',
    'js/screens/print.js',
    'css/print.css',
];
```

---

## 6. 데이터 흐름 다이어그램

### 6.1 게임 완료 → 아카이브 저장

```
game-complete 이벤트
  → game.js onGameComplete()
    → navigate('complete', params)
      → complete.js onShow()
        → updateStats()
        → saveGameHistory(entry)  ← 신규
        → clearGame()
```

### 6.2 재도전 흐름

```
screen-history
  → 목록에서 "재도전" 클릭
    → navigate('game', { replay: true, puzzle, solution, given, ... })
      → game.js onShow()
        → startReplayGame(params)
          → board.newGameFromPuzzle()
          → GridUI.rebuild()
          → renderFullGrid()
```

### 6.3 인쇄 흐름

```
screen-history 또는 screen-daily
  → "인쇄" 클릭
    → navigate('print', { entries: [...] })
      → print.js onShow()
        → createPrintGrid() × N
        → 미리보기 렌더링
  → "인쇄하기" 클릭
    → window.print()
    → @media print CSS 적용
```

---

## 7. 파일 변경 매트릭스

| 파일 | F4 재도전 | F5 일자별 | F6 인쇄 | 공통 |
|------|:---------:|:---------:|:-------:|:----:|
| `storage.js` | | | | ✅ 히스토리 함수 + 마이그레이션 |
| `board.js` | ✅ newGameFromPuzzle | | | ✅ getInitialPuzzle, toJSON |
| `complete.js` | | | | ✅ saveGameHistory 호출 |
| `app.js` | ✅ import + init | | ✅ import + init | |
| `index.html` | ✅ screen-history | | ✅ screen-print | ✅ CSS link |
| `daily.js` | | ✅ 미래날짜 허용 | ✅ 인쇄버튼 | |
| `game.js` | ✅ startReplayGame | | | |
| `main.js` | ✅ 기록 버튼 | | | |
| `screens/history.js` | ✅ 신규 | | | |
| `screens/print.js` | | | ✅ 신규 | |
| `css/print.css` | | | ✅ 신규 | |
| `css/screens.css` | ✅ history 스타일 | ✅ future 스타일 | ✅ print 스타일 | |
| `sw.js` | ✅ 캐시 추가 | | ✅ 캐시 추가 | |
