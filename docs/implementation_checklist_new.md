# 신규 기능 상세 구현 체크리스트

> 작성일: 2026-02-27
> 참조: `docs/implementation_plan_20260227.md`
> 분석 방법: 에이전트 팀이 실제 소스코드를 읽어 정확한 라인번호 기재
> 총 항목: Phase A(29) + B(22) + C(~75) + D(~40) + E(~10) = **약 176개**

---

## 목차

- [Phase A: 모드 시스템 기반 (기능 1 — 클래식 모드 분리)](#phase-a-모드-시스템-기반)
- [Phase B: 타임어택 모드 (기능 3)](#phase-b-타임어택-모드)
- [Phase C: 엔진 리팩터링 (기능 2 — 9x9 파라미터화)](#phase-c-엔진-리팩터링)
- [Phase D: UI 동적화 (기능 2 — 동적 렌더링)](#phase-d-ui-동적화)
- [Phase E: 대형 보드 최적화 (기능 2 — 성능)](#phase-e-대형-보드-최적화)
- [공통: 테스트](#공통-테스트)

---

## Phase A: 모드 시스템 기반

> 난이도: 하 | 파일 8개 | 항목 29개

---

### A-1. src/index.html

- [ ] [라인 57~58 사이] `screen-main` 과 `screen-game` 사이에 `screen-mode-select` 화면 HTML 블록 삽입 (약 50줄, 모드 선택 UI)
- [ ] [라인 53] `data-action="new-game"` 속성 유지 (동작은 app.js에서 변경)

### A-2. src/js/screens/mode-select.js (신규 파일)

- [ ] [신규] `ModeSelectScreen` 클래스 생성: `_selectedMode='classic'`, `_selectedDuration=600`, `_selectedBoardSize=9`
- [ ] [신규] `onShow()` 메서드: 버튼 이벤트 바인딩, `.game-mode-option` 클릭 시 `_onModeSelect(mode)` 호출
- [ ] [신규] `_onModeSelect(mode)` 메서드: 타임어택 선택 시 `.timed-section` 표시/숨김
- [ ] [신규] `_onNext()` 메서드: `app.showDifficultyModal({ mode, duration, boardSize })` 호출
- [ ] [신규] `onHide()` 메서드: 이벤트 정리
- [ ] [신규] `initModeSelectScreen(app)` export 함수

### A-3. src/js/app.js

- [ ] [라인 29 근처] `import { initModeSelectScreen } from './screens/mode-select.js';` 추가
- [ ] [라인 248] `showDifficultyModal()` → `showDifficultyModal(modeParams = {})` 시그니처 변경, `this._pendingModeParams = modeParams;` 추가
- [ ] [라인 481] `navigate('game', { difficulty, ... })` → `navigate('game', { difficulty, ...this._pendingModeParams })` 로 확장
- [ ] [라인 341 근처] `initModeSelectScreen(app);` 호출 추가
- [ ] [라인 502~503] `handleGlobalAction` 내 `case 'new-game'`: `showDifficultyModal()` → `navigate('mode-select')` 변경
- [ ] [라인 35] `NAVBAR_SCREENS` Set 변경 없음 확인 (mode-select는 navbar 비표시)
- [ ] [라인 58] `app` 객체에 `_pendingModeParams: {}` 프로퍼티 추가

### A-4. src/js/screens/main.js

- [ ] [라인 73~77] `btnNewGame` 클릭 핸들러: `app.showDifficultyModal()` → `app.navigate('mode-select')` 변경

### A-5. src/js/game/board.js

- [ ] [라인 52~53] constructor 내에 `this.mode = 'classic';` 추가
- [ ] [라인 101] `newGame(difficulty, dailyDate)` → `newGame(difficulty, dailyDate, mode = 'classic', options = {})` 시그니처 변경
- [ ] [라인 124~133] newGame 내부에 `this.mode = mode;` 추가
- [ ] [라인 184~200] `getState()` 반환 객체에 `mode: this.mode` 필드 추가
- [ ] [라인 146~176] `loadState()` 에서 `this.mode = savedState.mode || 'classic';` 추가

### A-6. src/js/utils/storage.js

- [ ] [라인 17~22] `getStatsKey(mode)` 헬퍼 함수 추가
- [ ] [라인 200~201] `saveStats(stats)` → `saveStats(stats, mode = 'classic')` 시그니처 변경
- [ ] [라인 201] `writeJSON(KEYS.STATS, stats)` → `writeJSON(getStatsKey(mode), stats)` 변경
- [ ] [라인 210~230] `loadStats()` → `loadStats(mode = 'classic')` 시그니처 변경
- [ ] [라인 211] `readJSON(KEYS.STATS)` → `readJSON(getStatsKey(mode))` 변경

### A-7. src/css/screens.css

- [ ] [파일 끝, 라인 1150 이후] 모드 선택 화면 전용 스타일 약 50줄 추가 (`.mode-content`, `.game-mode-options`, `.game-mode-option`, `.time-duration-grid`, `.time-option`, `.mode-actions`)

### A-8. src/sw.js

- [ ] [라인 5] `CACHE_NAME = 'sudoku-v3'` → `'sudoku-v4'` 변경
- [ ] [라인 7~43] `PRECACHE_URLS` 에 `'./js/screens/mode-select.js'` 추가

---

## Phase B: 타임어택 모드

> 난이도: 중 | 파일 5개 | 항목 22개

---

### B-1. src/js/game/timer.js

- [ ] [라인 20~32, constructor] 프로퍼티 3개 추가: `_isCountdown = false`, `_duration = 0`, `_onTimeUp = null`
- [ ] [라인 49~53, start() setInterval 콜백] 카운트다운 시간 초과 체크 추가: `if (this._isCountdown && this.isTimeUp()) { this.pause(); if (this._onTimeUp) this._onTimeUp(); }`
- [ ] [라인 86~92, getElapsed()] 카운트다운 분기 추가: `_isCountdown && _duration` 일 때 `Math.max(0, Math.floor((this._duration - total) / 1000))` 반환
- [ ] [라인 76~79, reset()] `_isCountdown = false`, `_duration = 0`, `_onTimeUp = null` 초기화 추가
- [ ] [라인 134 뒤] 메서드 4개 추가: `setCountdown(bool)`, `setDuration(seconds)`, `onTimeUp(callback)`, `getRemaining()`, `isTimeUp()`

### B-2. src/js/core/scorer.js

- [ ] [라인 103 뒤] `calculateTimeAttackBonus(difficulty, remainingSeconds, totalSeconds, mistakes)` 함수 추가 (약 15줄)

### B-3. src/js/screens/game.js

**분기 1: 게임 시작**
- [ ] [라인 215~216] `startNewGame(difficulty, dailyDate)` → `startNewGame(difficulty, dailyDate, mode = 'classic', options = {})` 시그니처 변경
- [ ] [라인 216] `_app.board.newGame(difficulty, dailyDate)` → `_app.board.newGame(difficulty, dailyDate, mode, options)` 호출 변경
- [ ] [라인 216~217 사이] 타임어택 모드 타이머 설정 블록 추가 (setCountdown, setDuration, onTimeUp)

**분기 2: 타이머 UI 경고**
- [ ] [라인 219~223, onTick 콜백] 카운트다운 경고 클래스 토글 추가 (`timer-warning`, `timer-danger`)

**분기 3: 시간 초과 게임오버**
- [ ] [라인 579 뒤] `handleTimeUp()` 함수 추가 (약 15줄: pause → navigate('complete', { mode, success: false }))

**분기 4: 완료 시 잔여 시간 전달**
- [ ] [라인 496~503, completeParams] `mode: _app.board?.mode || 'classic'` 필드 추가
- [ ] [라인 503 뒤] 타임어택 시 `remainingTime`, `totalTime`, `success: true` 추가

**onShow 파라미터 전달**
- [ ] [라인 199] `startNewGame(params.difficulty || 'easy', date)` → mode/options 전달 추가
- [ ] [라인 201] `startNewGame(params.difficulty)` → mode/options 전달 추가

### B-4. src/js/screens/complete.js

- [ ] [라인 10] `import { calculateTimeAttackBonus } from '../core/scorer.js';` 추가
- [ ] [라인 103~154] params 디스트럭처링에 `mode`, `success`, `remainingTime`, `totalTime`, `message` 추가
- [ ] [라인 130~136] 모드별 메시지 분기 추가 (타임어택 성공/실패)
- [ ] [라인 152~153] 타임어택 보너스 점수 표시 영역 추가
- [ ] [라인 153~154] 타임어택 실패 시 confetti 미표시, 아이콘/제목 변경

### B-5. src/css/animations.css

- [ ] [라인 313 뒤] 타이머 경고 애니메이션 추가 (약 30줄):
  - `@keyframes timerWarningPulse` (30초↓ 파란 펄스)
  - `@keyframes timerDangerPulse` (10초↓ 빨간 급박 펄스)
  - `.info-timer.timer-warning/danger/expired .info-value` 스타일

---

## Phase C: 엔진 리팩터링

> 난이도: 상 | 파일 9개 | 항목 ~75개

---

### C-1. src/js/core/board-config.js (신규 파일)

- [ ] [신규] `BOARD_CONFIGS` 객체 — 4/6/9/12/16 크기별 설정 (size, blockRows, blockCols, numRange, totalCells)
- [ ] [신규] `DIFFICULTY_RANGES_BY_SIZE` 객체 — 크기별 난이도 범위
- [ ] [신규] `getBlockSize(boardSize)` 헬퍼 함수
- [ ] [신규] `getDifficultyRange(boardSize, difficulty)` 헬퍼 함수

### C-2. src/js/core/solver.js (하드코딩 8곳)

- [ ] [라인 1] `import { getBlockSize } from './board-config.js';` 추가
- [ ] [라인 20] `isValid(board, row, col, num)` → `isValid(board, row, col, num, boardSize = 9, blockSize = null)` + null 체크
- [ ] [라인 22] `c < 9` → `c < boardSize` 행 검사
- [ ] [라인 27] `r < 9` → `r < boardSize` 열 검사
- [ ] [라인 32] `Math.floor(row / 3) * 3` → `Math.floor(row / blockSize.rows) * blockSize.rows`
- [ ] [라인 33] `Math.floor(col / 3) * 3` → `Math.floor(col / blockSize.cols) * blockSize.cols`
- [ ] [라인 34] `blockRow + 3` → `blockRow + blockSize.rows`
- [ ] [라인 35] `blockCol + 3` → `blockCol + blockSize.cols`
- [ ] [라인 51] `getCandidates` 시그니처 → `(board, row, col, boardSize = 9, blockSize = null)`
- [ ] [라인 58] `num <= 9` → `num <= boardSize`
- [ ] [라인 59] isValid 호출에 `boardSize, blockSize` 전달
- [ ] [라인 75] `findBestEmptyCell` 시그니처 → `(board, boardSize = 9, blockSize = null)`
- [ ] [라인 77] `minCandidates = 10` → `boardSize + 1`
- [ ] [라인 79] `r < 9` → `r < boardSize`
- [ ] [라인 80] `c < 9` → `c < boardSize`
- [ ] [라인 82] getCandidates 호출에 `boardSize, blockSize` 전달
- [ ] [라인 103] `solve` 시그니처 → `(board, boardSize = 9, blockSize = null)`
- [ ] [라인 120] `solveInPlace` 시그니처/호출 수정
- [ ] [라인 121] findBestEmptyCell 호출에 `boardSize, blockSize` 전달
- [ ] [라인 127] getCandidates 호출에 `boardSize, blockSize` 전달
- [ ] [라인 151] `countSolutions` 시그니처 → `(board, boardSize = 9, blockSize = null, limit = 2)`
- [ ] [라인 168, 171, 180, 186] 내부 재귀 호출에 `boardSize, blockSize` 전달

### C-3. src/js/core/generator.js (하드코딩 9곳)

- [ ] [라인 16] `import { getBlockSize, getDifficultyRange } from './board-config.js';` 추가
- [ ] [라인 24-30] `DIFFICULTY_RANGES` → `getDifficultyRange()` 호출로 대체
- [ ] [라인 63-65] `createEmptyBoard()` → `createEmptyBoard(boardSize = 9)`, `length: 9` → `boardSize`
- [ ] [라인 73] `generateCompleteBoard()` → `generateCompleteBoard(boardSize = 9, blockSize = null)`
- [ ] [라인 74] `createEmptyBoard()` → `createEmptyBoard(boardSize)`
- [ ] [라인 83] `pos === 81` → `pos === boardSize * boardSize`
- [ ] [라인 85] `pos / 9` → `pos / boardSize`
- [ ] [라인 86] `pos % 9` → `pos % boardSize`
- [ ] [라인 89] `shuffle([1..9])` → `shuffle(Array.from({ length: boardSize }, (_, i) => i + 1))`
- [ ] [라인 92] isValid 호출에 `boardSize, blockSize` 전달
- [ ] [라인 115] `removeCells` 시그니처에 `boardSize, blockSize` 추가
- [ ] [라인 118] `length: 81` → `length: boardSize * boardSize`
- [ ] [라인 119] `i / 9` → `i / boardSize`
- [ ] [라인 120] `i % 9` → `i % boardSize`
- [ ] [라인 135] countSolutions 호출에 `boardSize, blockSize` 전달
- [ ] [라인 163] `generatePuzzle(difficulty)` → `generatePuzzle(difficulty, boardSize = 9, dailyDate = null)`
- [ ] [라인 164] `DIFFICULTY_RANGES[difficulty]` → `getDifficultyRange(boardSize, difficulty)`
- [ ] [라인 176] generateCompleteBoard 호출에 `boardSize, blockSize` 전달
- [ ] [라인 180] removeCells 호출에 `boardSize, blockSize` 전달

### C-4. src/js/core/validator.js (하드코딩 15곳)

- [ ] [신규] `import { getBlockSize } from './board-config.js';` 추가
- [ ] [라인 16] `getRowCells(row)` → `getRowCells(row, boardSize = 9)`
- [ ] [라인 18] `c < 9` → `c < boardSize`
- [ ] [라인 30] `getColCells(col)` → `getColCells(col, boardSize = 9)`
- [ ] [라인 32] `r < 9` → `r < boardSize`
- [ ] [라인 45] `getBlockCells(row, col)` → `getBlockCells(row, col, boardSize = 9, blockSize = null)` + null 체크
- [ ] [라인 47] `row / 3 * 3` → `row / blockSize.rows * blockSize.rows`
- [ ] [라인 48] `col / 3 * 3` → `col / blockSize.cols * blockSize.cols`
- [ ] [라인 50] `blockRow + 3` → `blockRow + blockSize.rows`
- [ ] [라인 51] `blockCol + 3` → `blockCol + blockSize.cols`
- [ ] [라인 72] `checkConflicts` 시그니처에 `boardSize, blockSize` 추가 + null 체크
- [ ] [라인 73] `num > 9` → `num > boardSize`
- [ ] [라인 84] `r * 9 + c` → `r * boardSize + c`
- [ ] [라인 93] `c < 9` → `c < boardSize`
- [ ] [라인 96] `r < 9` → `r < boardSize`
- [ ] [라인 99-102] 블록 계산 4곳 → `blockSize.rows/cols` 사용
- [ ] [라인 122] `validateMove` 시그니처에 `boardSize` 추가
- [ ] [라인 131] `isBoardComplete(board, solution)` → `isBoardComplete(board, solution, boardSize)` 호출
- [ ] [라인 145] `isBoardComplete` 시그니처에 `boardSize = 9` 추가
- [ ] [라인 146] `r < 9` → `r < boardSize`
- [ ] [라인 147] `c < 9` → `c < boardSize`

### C-5. src/js/game/board.js (하드코딩 6곳 + 구조 변경)

- [ ] [라인 12] `import { getBlockSize } from '../core/board-config.js';` 추가
- [ ] [라인 52-53] constructor 파라미터 `boardSize = 9` 추가, `this.boardSize`, `this.blockSize` 속성 추가
- [ ] [라인 54, 57] `Board._emptyGrid()` → `Board._emptyGrid(boardSize)` 호출 (2곳)
- [ ] [라인 60] `Board._emptyBoolGrid()` → `Board._emptyBoolGrid(boardSize)` 호출
- [ ] [라인 63] `new Notes()` → `new Notes(boardSize, this.blockSize)` 호출
- [ ] [라인 101] newGame에 boardSize 갱신 로직 추가
- [ ] [라인 116, 121] `generatePuzzle(difficulty)` → `generatePuzzle(difficulty, this.boardSize)` 호출 (2곳)
- [ ] [라인 135] `new Notes()` → `new Notes(this.boardSize, this.blockSize)` 호출
- [ ] [라인 149-151] loadState 내 `_emptyGrid()/_emptyBoolGrid()` → `(this.boardSize)` 전달 (3곳)
- [ ] [라인 160] loadState 내 `new Notes()` → `new Notes(this.boardSize, this.blockSize)`
- [ ] [신규] loadState에 `this.boardSize = savedState.boardSize || 9` 복원 추가
- [ ] [라인 185-199] getState()에 `boardSize: this.boardSize` 추가
- [ ] [라인 268-269] validateMove 호출에 `this.boardSize` 전달
- [ ] [라인 273] checkConflicts 호출에 `this.boardSize, this.blockSize` 전달
- [ ] [라인 408] isBoardComplete 호출에 `this.boardSize` 전달
- [ ] [라인 474] `r < 9` → `r < this.boardSize` (getNumberCount)
- [ ] [라인 475] `c < 9` → `c < this.boardSize`
- [ ] [라인 537] `_emptyGrid()` → `_emptyGrid(boardSize = 9)`, `length: 9` → `boardSize`
- [ ] [라인 547] `_emptyBoolGrid()` → `_emptyBoolGrid(boardSize = 9)`, `length: 9` → `boardSize`

### C-6. src/js/game/notes.js (하드코딩 10곳)

- [ ] [신규] `import { getBlockSize } from '../core/board-config.js';` 추가
- [ ] [라인 20] constructor 시그니처 → `(boardSize = 9, blockSize = null)`, `this.boardSize`, `this.blockSize` 추가
- [ ] [라인 22] `Notes._createEmptyGrid()` → `Notes._createEmptyGrid(this.boardSize)`
- [ ] [라인 81] `c < 9` → `c < this.boardSize` (removeFromRelated 행)
- [ ] [라인 86] `r < 9` → `r < this.boardSize` (열)
- [ ] [라인 91-94] 블록 계산 4곳 → `this.blockSize.rows/cols` 사용
- [ ] [라인 141] `data.length !== 9` → `!== this.boardSize`
- [ ] [라인 142] `_createEmptyGrid()` → `_createEmptyGrid(this.boardSize)`
- [ ] [라인 147] `row.length !== 9` → `!== this.boardSize`
- [ ] [라인 148] `length: 9` → `length: this.boardSize`
- [ ] [라인 152] `n <= 9` → `n <= this.boardSize`
- [ ] [라인 168-169] `_createEmptyGrid()` → `_createEmptyGrid(boardSize = 9)`, `length: 9` → `boardSize` (2곳)

### C-7. src/js/game/hints.js (하드코딩 14곳)

- [ ] [라인 18] `import { getBlockSize } from '../core/board-config.js';` 추가
- [ ] [라인 49] `getHint` 시그니처 → `(board, solution, notes, boardSize = 9, blockSize = null, useSmartHints = true)` + null 체크
- [ ] [라인 51, 55, 59, 63, 67, 71] 모든 헬퍼 호출에 `boardSize, blockSize` 전달 (6곳)
- [ ] [라인 96-101] `findLastInRow` 시그니처 + 루프 2곳 `< 9` → `< boardSize`
- [ ] [라인 131-136] `findLastInCol` 시그니처 + 루프 2곳 `< 9` → `< boardSize`
- [ ] [라인 166-177] `findLastInBlock` 시그니처 + 블록 루프 6곳 (3→blockSize.rows/cols)
- [ ] [라인 212-214] `findNakedSingle` 시그니처 + 루프 2곳 + getCandidates 호출 수정
- [ ] [라인 217] `getCandidates(board, r, c)` → `getCandidates(board, r, c, boardSize, blockSize)`
- [ ] [라인 241, 245-246] `findDirectReveal` 시그니처 + 루프 2곳

### C-8. src/js/game/input.js (1곳)

- [ ] [라인 206-210] `getHint(...)` 호출에 `board.boardSize, board.blockSize` 파라미터 추가

### C-9. src/js/core/scorer.js

- [ ] 크기별 추가 점수 배율 필요 시 `getDifficultyMultiplier`에 `boardSize` 파라미터 추가 (선택)

---

## Phase D: UI 동적화

> 난이도: 상 | 파일 8개 | 항목 ~40개

---

### D-1. src/js/ui/grid.js (하드코딩 12곳)

- [ ] [신규] `import { getBlockSize } from '../core/board-config.js';` 추가
- [ ] [라인 34] constructor → `(containerEl, gridSize = 9)`, `this._gridSize`, `this._blockSize` 추가
- [ ] [라인 58-59] renderBoard 루프: `r < 9`, `c < 9` → `this._gridSize`
- [ ] [라인 122] showNotes: `n <= 9` → `n <= this._gridSize`
- [ ] [라인 149] getCell: `row * 9 + col` → `row * this._gridSize + col`
- [ ] [라인 183] animateWave: `totalCells = 81` → `this._gridSize * this._gridSize`
- [ ] [라인 187-188] animateWave 루프: `r < 9`, `c < 9` → `this._gridSize`
- [ ] [라인 295-296] _buildGrid 루프: `r < 9`, `c < 9` → `this._gridSize`
- [ ] [라인 303] _buildGrid 블록 경계: `c % 3` → `c % this._blockSize.cols`
- [ ] [라인 304] _buildGrid 블록 경계: `r % 3` → `r % this._blockSize.rows`
- [ ] [라인 316] _buildGrid 노트: `n <= 9` → `n <= this._gridSize`
- [ ] [라인 343] _clearNotes: `n <= 9` → `n <= this._gridSize`
- [ ] [신규] `rebuild(gridSize)` 메서드 추가 — 크기 변경 시 그리드 재구성
- [ ] [신규] `_injectDynamicCSS()` 메서드 추가 — nth-child 대체 동적 CSS

### D-2. src/js/ui/highlight.js (하드코딩 5곳)

- [ ] [라인 42] constructor → `(gridUIOrEl, gridSize = 9)`, `this._gridSize` 추가
- [ ] [라인 81-83] getRowCells/getColCells/getBlockCells 호출에 `this._gridSize` 전달
- [ ] [라인 89] `pos.row * 9 + pos.col` → `pos.row * this._gridSize + pos.col`
- [ ] [라인 105-106] same-number 루프: `r < 9`, `c < 9` → `this._gridSize`
- [ ] [라인 122-123] clearAll 루프: `r < 9`, `c < 9` → `this._gridSize`

### D-3. src/js/ui/numberpad.js (동적 버튼)

- [ ] [라인 27] constructor → `(containerEl, maxNumber = 9)`, `this._maxNumber` 추가
- [ ] [라인 35] `n <= 9` → `n <= this._maxNumber` 버튼 캐싱
- [ ] [라인 53] `n <= 9` → `n <= this._maxNumber` updateCounts
- [ ] [라인 59] `count >= 9` → `count >= this._maxNumber` 완료 판정
- [ ] [라인 82] `num <= 9` → `num <= this._maxNumber` 입력 범위
- [ ] [라인 97] `num <= 9` → `num <= this._maxNumber` 하이라이트 범위
- [ ] [신규] `rebuild(maxNumber)` 메서드 추가

### D-4. src/js/ui/animations.js (하드코딩 4곳)

- [ ] [라인 190] `animateCompletionWave` 시그니처에 `gridSize = 9` 추가
- [ ] [라인 200] `r < 9` → `r < gridSize`
- [ ] [라인 201] `c < 9` → `c < gridSize`

### D-5. src/css/grid.css (하드코딩 8곳)

- [ ] [라인 18-19] `repeat(9, 1fr)` → JS에서 동적 설정 또는 CSS 변수
- [ ] [라인 48-49] `.cell:nth-child(9n)` 제거 → `block-right` 클래스로 대체
- [ ] [라인 53-55] `.cell:nth-child(n+73):nth-child(-n+81)` 제거 → JS에서 마지막 행 처리
- [ ] [라인 60-61] `.cell:nth-child(9n+3)` 제거 → `block-left` 클래스로 대체
- [ ] [라인 64-65] `.cell:nth-child(9n+6)` 제거 → `block-left` 클래스로 대체
- [ ] [라인 70-72] `.cell:nth-child(n+19):nth-child(-n+27)` 제거 → `block-top` 클래스로 대체
- [ ] [라인 75-77] `.cell:nth-child(n+46):nth-child(-n+54)` 제거 → `block-top` 클래스로 대체
- [ ] [신규] `.cell.block-left`, `.cell.block-top` 스타일 추가
- [ ] [신규] 크기별 셀 폰트: `body[data-grid-size="4/6/9/12/16"] .cell { font-size: ... }`
- [ ] [신규] 크기별 그리드 max-width: `body[data-grid-size="4"] .sudoku-grid { max-width: 240px; }` 등
- [ ] [신규] 크기별 노트 그리드: `body[data-grid-size="4/6/12/16"] .cell-notes { grid-template-columns: ... }`
- [ ] [신규] 크기별 숫자패드: `body[data-grid-size="12/16"] .numberpad { flex-wrap: wrap; }`

### D-6. src/index.html

- [ ] [라인 139-149] 정적 numberpad 버튼 9개 제거 → `<div class="numberpad" id="numberpad"></div>` (동적 생성)
- [ ] [Phase A에서 추가된 모드 선택 화면] `.board-size-section` 의 `style="display:none;"` 제거하여 활성화

### D-7. src/js/app.js (키보드 + data-grid-size)

- [ ] [라인 375] `key <= '9'` → `num >= 1 && num <= Math.min(app.board?.boardSize || 9, 9)` 동적화
- [ ] [라인 388-389] 기본 위치 `4` → `Math.floor((app.board?.boardSize || 9) / 2)`
- [ ] [라인 393] `Math.min(8, row + 1)` → `Math.min((app.board?.boardSize || 9) - 1, row + 1)`
- [ ] [라인 395] `Math.min(8, col + 1)` → `Math.min((app.board?.boardSize || 9) - 1, col + 1)`
- [ ] [신규] 게임 시작 시 `document.body.dataset.gridSize = String(boardSize);` 설정
- [ ] [라인 320-322] GridUI/HighlightUI/NumberpadUI 생성자에 초기 gridSize 전달

### D-8. src/css/screens.css (반응형)

- [ ] [신규] 태블릿 사이드바 레이아웃 추가: `@media (min-width: 768px) { body[data-grid-size="12/16"] #screen-game { flex-direction: row; } }`

---

## Phase E: 대형 보드 최적화

> 난이도: 상 | 파일 4개 | 항목 ~10개

---

### E-1. src/js/core/puzzle-worker.js (신규 파일)

- [ ] [신규] Web Worker 파일 생성
- [ ] [신규] `self.onmessage` 핸들러 — difficulty, boardSize 수신
- [ ] [신규] generator + solver 로직 실행 (importScripts 또는 inline)
- [ ] [신규] `self.postMessage({ puzzle })` 결과 반환
- [ ] [신규] try-catch 에러 핸들링 + `self.postMessage({ error })`

### E-2. src/js/game/board.js (비동기 생성)

- [ ] [라인 101] `newGame` → `async newGame` 변경
- [ ] [신규] `async _generateAsync(difficulty, boardSize)` 메서드 추가
- [ ] [신규] boardSize >= 12 분기: Worker 비동기 생성, else 동기 생성
- [ ] [신규] Worker 인스턴스 관리 (생성/종료)

### E-3. src/index.html (로딩 UI)

- [ ] [신규] `#screen-game` 내 퍼즐 생성 로딩 오버레이 HTML 추가

### E-4. src/css/screens.css (로딩 스피너)

- [ ] [신규] `.puzzle-loading` 오버레이 스타일
- [ ] [신규] `.loading-spinner` 회전 애니메이션
- [ ] [신규] `@keyframes spinner-rotate` 키프레임

---

## 공통: 테스트

---

### 기존 테스트 수정

- [ ] `01-navigation.spec.js` — 모드 선택 화면 네비게이션 테스트 추가
- [ ] `02-game-basics.spec.js` — boardSize 파라미터화 호환성 확인
- [ ] `03-input-and-tools.spec.js` — 동적 numberpad/키보드 범위 확인
- [ ] `04-game-completion.spec.js` — 타임어택 완료/실패 테스트 추가
- [ ] `05-persistence.spec.js` — mode, boardSize 저장/로드 확인
- [ ] `06-screens.spec.js` — 모드 선택 화면 테스트 추가
- [ ] `08-keyboard.spec.js` — 동적 키보드 범위 확인
- [ ] `09-enhanced-ui.spec.js` — 동적 그리드 크기 확인

### 신규 테스트

- [ ] Phase A: 모드 선택 → 난이도 선택 → 게임 시작 플로우
- [ ] Phase A: 모드별 통계 분리 확인
- [ ] Phase B: 타임어택 카운트다운 표시
- [ ] Phase B: 30초/10초 경고 애니메이션
- [ ] Phase B: 시간 초과 게임오버
- [ ] Phase B: 타임어택 보너스 점수
- [ ] Phase B: 일시정지 시 카운트다운 정지
- [ ] Phase C: 4x4 퍼즐 생성/풀이/검증
- [ ] Phase C: 6x6 퍼즐 생성/풀이/검증 (비정사각 블록 2x3)
- [ ] Phase C: 9x9 회귀 테스트 (기존 61개 전체 통과)
- [ ] Phase C: 12x12 퍼즐 생성/풀이/검증
- [ ] Phase C: 16x16 퍼즐 생성/풀이/검증
- [ ] Phase C: 각 크기별 유일해 검증
- [ ] Phase C: 각 크기별 힌트/메모 정확성
- [ ] Phase D: 4x4/6x6/16x16 그리드 렌더링
- [ ] Phase D: 동적 숫자패드 (4/6/9/12/16 버튼)
- [ ] Phase D: 반응형 레이아웃 (모바일/태블릿)
- [ ] Phase E: 12x12 Web Worker 생성 (5초 이내)
- [ ] Phase E: 16x16 Web Worker 생성 (30초 이내)
- [ ] Phase E: 로딩 UI 표시/숨김

---

## 요약 통계

| Phase | 파일 수 | 신규 파일 | 체크 항목 |
|-------|:--:|:--:|:--:|
| A — 모드 시스템 | 8 | 1 | 29 |
| B — 타임어택 | 5 | 0 | 22 |
| C — 엔진 리팩터링 | 9 | 1 | ~75 |
| D — UI 동적화 | 8 | 0 | ~40 |
| E — 대형 보드 | 4 | 1 | ~10 |
| 테스트 | 8+신규 | 0 | 28 |
| **총계** | **22개 수정 + 3개 신규** | **3** | **약 204개** |

---

> 이 문서는 에이전트 팀(Phase A+B 분석기 + Phase C+D+E 분석기)이 실제 소스코드를 읽어 정확한 라인번호를 기재하여 작성되었습니다.
