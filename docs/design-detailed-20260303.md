# 스도쿠 리그 - 23개 기능 상세 구현 계획

> 작성일: 2026-03-03
> 대상 버전: v3
> 참조: design-detailed-20260228.md, design-comprehensive-20260228.md
> 현재 상태: 148개 E2E 테스트, variant(standard/diagonal) 지원 완료

---

## Phase 1: 즉시 구현 (6개 기능)

---

### 1. Anti-Knight 변형

#### 1.1 기능 설명
나이트(체스 기사)가 이동할 수 있는 8개 위치에 같은 숫자가 올 수 없는 추가 제약.
나이트 오프셋: `(+/-1, +/-2)`, `(+/-2, +/-1)` = 8방향.

#### 1.2 수정 파일 목록

| 파일 | 위치 | 변경 내용 |
|------|------|-----------|
| `src/js/core/validator.js` | `checkConflicts()` ~104행 | `variant === 'antiKnight'` 분기 추가, 나이트 오프셋 8개 체크 |
| `src/js/core/validator.js` | 신규 함수 | `getKnightCells(row, col, boardSize)` 추가 |
| `src/js/core/solver.js` | `isValid()` ~25행 | `variant === 'antiKnight'` 분기 추가, 나이트 위치 체크 |
| `src/js/core/solver.js` | `getCandidates()` ~74행 | variant 파라미터 전달 (이미 지원) |
| `src/js/core/generator.js` | `generateCompleteBoard()` ~79행 | variant 전달 (이미 지원) |
| `src/js/core/generator.js` | `removeCells()` ~126행 | variant 전달 (이미 지원) |
| `src/js/core/puzzle-worker.js` | `isValid()` ~40행 | 나이트 체크 인라인 추가 |
| `src/js/game/board.js` | `newGame()` ~121행 | variant 값 확장 (이미 `options.variant` 사용) |
| `src/js/game/notes.js` | `removeFromRelated()` ~95행 | `variant === 'antiKnight'` 분기, 나이트 위치 메모 제거 |
| `src/js/game/hints.js` | `getHint()` ~53행 | `findLastInKnight()` 추가 |
| `src/js/ui/grid.js` | `_buildGrid()` ~292행 | 나이트 셀에 `.anti-knight` CSS 클래스 (선택 셀 기준 동적) |
| `src/js/ui/highlight.js` | `highlightSelection()` ~79행 | `variant === 'antiKnight'` 시 나이트 셀 하이라이트 |
| `src/js/screens/mode-select.js` | ~68행 | variant 옵션에 `antiKnight` 버튼 추가 |
| `src/index.html` | mode-select variant-options ~113행 | `<button class="variant-option" data-variant="antiKnight">` 추가 |
| `css/main.css` 또는 `css/grid.css` | 신규 | `.anti-knight` 하이라이트 스타일 |

#### 1.3 데이터 구조 변경

```javascript
// variant 타입 확장
// 기존: 'standard' | 'diagonal'
// 변경: 'standard' | 'diagonal' | 'antiKnight'
```

Board.variant, getState(), loadState(), toJSON()는 이미 문자열 기반이므로 변경 불필요.
히스토리 entry.variant에도 자동 저장.

#### 1.4 코드 패턴

```javascript
// validator.js - 신규 함수
const KNIGHT_OFFSETS = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1],
];

export function getKnightCells(row, col, boardSize = 9) {
    const cells = [];
    for (const [dr, dc] of KNIGHT_OFFSETS) {
        const r = row + dr, c = col + dc;
        if (r >= 0 && r < boardSize && c >= 0 && c < boardSize) {
            cells.push({ row: r, col: c });
        }
    }
    return cells;
}

// checkConflicts() 내부 추가
if (variant === 'antiKnight') {
    for (const [dr, dc] of KNIGHT_OFFSETS) {
        const r = row + dr, c = col + dc;
        if (r >= 0 && r < boardSize && c >= 0 && c < boardSize) {
            check(r, c);
        }
    }
}

// solver.js isValid() 내부 추가
if (variant === 'antiKnight') {
    const KNIGHT_OFFSETS = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (const [dr, dc] of KNIGHT_OFFSETS) {
        const r = row + dr, c = col + dc;
        if (r >= 0 && r < boardSize && c >= 0 && c < boardSize) {
            if (board[r][c] === num) return false;
        }
    }
}
```

#### 1.5 UI 변경

- mode-select 화면: `.variant-options`에 "Anti-Knight" 버튼 추가
  - `<button class="variant-option" data-variant="antiKnight"><span class="mode-name">나이트</span><span class="mode-desc">+ 나이트 이동 금지</span></button>`
- 하이라이트: 선택한 셀의 나이트 위치 8개를 `highlighted` 클래스로 표시
- game info-bar: `.info-variant`에 "나이트" 텍스트 표시
- 그리드: 나이트 셀에는 정적 CSS 배경 불필요 (동적 하이라이트만)

#### 1.6 선행 조건
- 없음 (diagonal 변형 패턴 그대로 따름)

#### 1.7 예상 작업량
- 코어 엔진: validator + solver + generator + puzzle-worker 수정 (~50줄 추가)
- notes/hints: ~30줄 추가
- UI: highlight + mode-select + HTML + CSS (~40줄)
- 테스트: ~15개 케이스

---

### 2. Anti-King 변형

#### 2.1 기능 설명
킹(체스 왕)이 이동할 수 있는 대각인접 4개 위치에 같은 숫자가 올 수 없는 추가 제약.
킹 오프셋: `(+/-1, +/-1)` = 4방향 (대각 인접).
주의: 행/열 인접은 표준 스도쿠 규칙이 이미 커버하므로 대각 인접 4개만 추가.

#### 2.2 수정 파일 목록

Anti-Knight와 완전히 동일한 파일 목록. 오프셋만 다름.

| 파일 | 변경 내용 |
|------|-----------|
| `src/js/core/validator.js` | `getKingCells()` 추가, `checkConflicts()`에 `antiKing` 분기 |
| `src/js/core/solver.js` | `isValid()`에 `antiKing` 분기 |
| `src/js/core/puzzle-worker.js` | 킹 체크 인라인 |
| `src/js/game/notes.js` | `removeFromRelated()`에 킹 위치 메모 제거 |
| `src/js/game/hints.js` | `findLastInKing()` 추가 |
| `src/js/ui/highlight.js` | 킹 위치 하이라이트 |
| `src/js/screens/mode-select.js` | `antiKing` 버튼 |
| `src/index.html` | variant 버튼 |

#### 2.3 코드 패턴

```javascript
const KING_OFFSETS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

export function getKingCells(row, col, boardSize = 9) {
    const cells = [];
    for (const [dr, dc] of KING_OFFSETS) {
        const r = row + dr, c = col + dc;
        if (r >= 0 && r < boardSize && c >= 0 && c < boardSize) {
            cells.push({ row: r, col: c });
        }
    }
    return cells;
}
```

#### 2.4 UI 변경
- `<button class="variant-option" data-variant="antiKing"><span class="mode-name">킹</span><span class="mode-desc">+ 대각인접 금지</span></button>`
- info-bar: "킹" 텍스트

#### 2.5 선행 조건
- 없음 (Anti-Knight과 병렬 구현 가능)

#### 2.6 예상 작업량
- Anti-Knight과 동일 (~50줄 코어 + ~30줄 UI)
- 테스트: ~12개 케이스

---

### 3. 자동 메모 채우기

#### 3.1 기능 설명
현재 보드 상태에서 각 빈 셀에 가능한 모든 후보 숫자를 자동으로 메모에 채움.
기존 메모를 전부 덮어쓰기(옵션) 또는 비어있는 셀에만 추가.

#### 3.2 수정 파일 목록

| 파일 | 위치 | 변경 내용 |
|------|------|-----------|
| `src/js/game/input.js` | 신규 메서드 | `autoFillNotes()` 추가 |
| `src/js/game/board.js` | 없음 | Board 변경 불필요 (notes, solver 이미 존재) |
| `src/js/ui/toolbar.js` | constructor ~22행 | `_autoNotesBtn` 참조 추가 |
| `src/js/screens/game.js` | 툴바 이벤트 핸들러 | `autoNotes` 액션 처리 |
| `src/index.html` | toolbar ~195행 | "자동 메모" 버튼 추가 |
| `css/main.css` | 신규 | 5번째 툴바 버튼 스타일 조정 |

#### 3.3 새로 추가할 파일
- 없음

#### 3.4 코드 패턴

```javascript
// input.js - 신규 메서드
autoFillNotes() {
    if (this._board.isGameOver()) return;

    const board = this._board.getBoard();
    const boardSize = this._board.boardSize;
    const blockSize = this._board.blockSize;
    const variant = this._board.variant;
    const updated = [];

    for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
            if (board[r][c] !== 0) continue;
            if (this._board.isGiven(r, c)) continue;

            const candidates = getCandidates(board, r, c, boardSize, blockSize, variant);
            // 기존 메모 클리어 후 후보 설정
            this._board.notes.clear(r, c);
            for (const num of candidates) {
                this._board.notes.toggle(r, c, num);
            }
            updated.push({ row: r, col: c, notes: [...candidates] });
        }
    }

    // UI 업데이트 이벤트
    for (const cell of updated) {
        this._dispatch('cell-updated', {
            row: cell.row, col: cell.col,
            value: 0, state: '', notes: cell.notes,
        });
    }
}
```

#### 3.5 UI 변경

```html
<!-- toolbar에 추가 -->
<button class="tool-btn" data-action="autoNotes">
    <svg class="tool-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 4h16v16H4z"/>
        <text x="12" y="15" text-anchor="middle" font-size="10" fill="currentColor" stroke="none">A</text>
    </svg>
    <span class="tool-label">자동메모</span>
</button>
```

- 툴바 5개 버튼: flex로 균등 배분 (기존 4개 → 5개)
- 아이콘: 연필+A 또는 격자+A 디자인

#### 3.6 선행 조건
- `getCandidates()` import 필요 (solver.js에서)

#### 3.7 예상 작업량
- input.js: ~30줄
- HTML/CSS: ~15줄
- game.js 이벤트: ~5줄
- 테스트: ~5개

---

### 4. 스트릭 시스템 (연속 플레이)

#### 4.1 기능 설명
매일 게임을 플레이하면 연속 플레이 일수(streak)가 증가.
1일이라도 빠지면 리셋. 동결권(freeze) 아이템으로 1일 보호 가능.
메인 화면 상단에 불꽃 아이콘 + 숫자로 표시.

#### 4.2 수정 파일 목록

| 파일 | 위치 | 변경 내용 |
|------|------|-----------|
| `src/js/utils/storage.js` | KEYS 객체 ~17행 | `STREAK: 'sudoku_streak'` 추가 |
| `src/js/utils/storage.js` | 신규 함수들 | `loadStreak()`, `saveStreak()`, `updateStreak()` |
| `src/js/screens/complete.js` | `onShow()` ~103행 | `updateStreak()` 호출 |
| `src/js/screens/main.js` | `onShow()` | 스트릭 배지 업데이트 |
| `src/index.html` | screen-main ~28행 | `.streak-badge` 이미 존재, JS로 값 설정 |

#### 4.3 데이터 구조

```javascript
// storage.js 신규 데이터 구조
/**
 * @typedef {Object} StreakData
 * @property {string} lastPlayDate - 마지막 플레이 날짜 'YYYY-MM-DD'
 * @property {number} currentStreak - 현재 연속 일수
 * @property {number} longestStreak - 역대 최장 연속 일수
 * @property {number} freezeCount - 남은 동결권 수 (기본 0)
 */

function getDefaultStreak() {
    return {
        lastPlayDate: '',
        currentStreak: 0,
        longestStreak: 0,
        freezeCount: 0,
    };
}
```

#### 4.4 코드 패턴

```javascript
// storage.js
export function loadStreak() {
    const stored = readJSON(KEYS.STREAK);
    if (!stored || typeof stored !== 'object') return getDefaultStreak();
    return { ...getDefaultStreak(), ...stored };
}

export function saveStreak(data) {
    writeJSON(KEYS.STREAK, data);
}

export function updateStreak() {
    const streak = loadStreak();
    const today = new Date().toISOString().slice(0, 10);

    if (streak.lastPlayDate === today) return streak; // 이미 오늘 업데이트됨

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    if (streak.lastPlayDate === yesterdayStr) {
        // 연속
        streak.currentStreak++;
    } else if (streak.lastPlayDate) {
        // 끊김 - 동결권 체크
        const daysBefore = new Date();
        daysBefore.setDate(daysBefore.getDate() - 2);
        const twoDaysAgoStr = daysBefore.toISOString().slice(0, 10);

        if (streak.lastPlayDate === twoDaysAgoStr && streak.freezeCount > 0) {
            streak.freezeCount--;
            streak.currentStreak++;
        } else {
            streak.currentStreak = 1;
        }
    } else {
        streak.currentStreak = 1;
    }

    if (streak.currentStreak > streak.longestStreak) {
        streak.longestStreak = streak.currentStreak;
    }

    streak.lastPlayDate = today;
    saveStreak(streak);
    return streak;
}

// main.js - 스트릭 배지 업데이트
function updateStreakBadge() {
    const streak = loadStreak();
    const countEl = document.querySelector('.streak-count');
    if (countEl) countEl.textContent = String(streak.currentStreak);
}
```

#### 4.5 UI 변경
- `.streak-badge`는 이미 HTML에 존재 (`src/index.html:28-31`)
- JS에서 `loadStreak().currentStreak` 값을 `.streak-count`에 반영
- 스트릭 > 0일 때 불꽃 아이콘에 CSS 애니메이션 추가 가능

#### 4.6 선행 조건
- 없음

#### 4.7 예상 작업량
- storage.js: ~40줄
- complete.js: ~3줄
- main.js: ~10줄
- 테스트: ~8개

---

### 5. 실수 자동 표시 토글

#### 5.1 기능 설명
설정에서 "실수 자동 표시" 옵션을 켜면, 잘못된 숫자를 입력했을 때 해당 셀을 즉시 빨간색으로 표시.
현재는 실수 카운터만 증가하고 셀은 잠시 shake 후 `error` 클래스 제거.
이 옵션이 켜지면 오답 셀에 `error` 클래스가 유지됨.

#### 5.2 수정 파일 목록

| 파일 | 위치 | 변경 내용 |
|------|------|-----------|
| `src/js/utils/storage.js` | `getDefaultSettings()` ~52행 | `autoCheckMistakes: false` 추가 |
| `src/js/screens/settings.js` | 없음 | 토글 자동 처리됨 (data-setting 기반) |
| `src/js/screens/game.js` | `cell-updated` 이벤트 핸들러 | `autoCheckMistakes` 체크하여 error 상태 유지/제거 |
| `src/index.html` | screen-settings ~532행 | 새 토글 행 추가 |

#### 5.3 코드 패턴

```javascript
// storage.js getDefaultSettings()에 추가
autoCheckMistakes: false,

// game.js - cell-updated 이벤트 핸들러 수정
// 기존: error 상태 셀을 1초 후 user-input으로 변경
// 변경: autoCheckMistakes가 true면 error 클래스 유지
document.addEventListener('cell-updated', (e) => {
    const { row, col, value, state } = e.detail;
    // ... 기존 코드 ...

    if (state === 'error') {
        if (_app.settings.autoCheckMistakes) {
            // error 상태 유지 - 올바른 값 입력 시까지
            gridUI.updateCell(row, col, value, 'error');
        } else {
            // 기존 동작: 1초 후 error 제거
            setTimeout(() => {
                gridUI.updateCell(row, col, value, 'user-input');
            }, 1000);
        }
    }
});
```

#### 5.4 UI 변경

```html
<!-- settings 화면에 추가 -->
<div class="setting-row">
    <span class="setting-label">실수 자동 표시</span>
    <label class="toggle-switch">
        <input type="checkbox" data-setting="autoCheckMistakes">
        <span class="toggle-slider"></span>
    </label>
</div>
```

#### 5.5 선행 조건
- 없음

#### 5.6 예상 작업량
- storage.js: ~1줄
- game.js: ~10줄 수정
- HTML: ~6줄
- 테스트: ~4개

---

### 6. 셀 컬러 마킹

#### 6.1 기능 설명
사용자가 셀에 색상 마커를 지정할 수 있음. 풀이 전략 시각화에 활용.
4~6가지 색상 팔레트 제공. 두 번 탭하면 색상 제거.

#### 6.2 수정 파일 목록

| 파일 | 위치 | 변경 내용 |
|------|------|-----------|
| `src/js/game/board.js` | 셀 데이터 | `_cellColors` 2D 배열 추가 (null 또는 색상 인덱스) |
| `src/js/game/board.js` | `getState()` / `loadState()` | cellColors 직렬화/복원 |
| `src/js/game/input.js` | 신규 | `setColor(colorIdx)`, `_colorMode` 상태 |
| `src/js/ui/grid.js` | `updateCell()` | 셀 배경색 적용 |
| `src/js/ui/toolbar.js` | 신규 | 컬러 팔레트 토글 |
| `src/index.html` | toolbar 아래 | 컬러 팔레트 UI |
| `css/main.css` 또는 `css/grid.css` | 신규 | `.cell-color-1` ~ `.cell-color-6` 배경색 |

#### 6.3 데이터 구조

```javascript
// board.js 추가
this._cellColors = Board._emptyGrid(this.boardSize); // 0 = 무색, 1-6 = 색상

// getState()에 추가
cellColors: this._cellColors.map(r => [...r]),

// loadState()에 추가
this._cellColors = savedState.cellColors || Board._emptyGrid(this.boardSize);
```

#### 6.4 코드 패턴

```javascript
// input.js
_colorMode = false;
_selectedColor = 0;

toggleColorMode() {
    this._colorMode = !this._colorMode;
    return this._colorMode;
}

setColor(colorIdx) {
    if (!this._selectedCell) return;
    const { row, col } = this._selectedCell;
    const current = this._board._cellColors[row][col];
    // 같은 색 다시 누르면 제거
    this._board._cellColors[row][col] = (current === colorIdx) ? 0 : colorIdx;
    this._dispatch('cell-color-changed', { row, col, color: this._board._cellColors[row][col] });
}
```

#### 6.5 UI 변경

```html
<!-- 툴바 아래 또는 numberpad 위에 컬러 팔레트 -->
<div class="color-palette" style="display:none;">
    <button class="color-btn" data-color="1" style="background:#FFE082;"></button>
    <button class="color-btn" data-color="2" style="background:#A5D6A7;"></button>
    <button class="color-btn" data-color="3" style="background:#90CAF9;"></button>
    <button class="color-btn" data-color="4" style="background:#F48FB1;"></button>
    <button class="color-btn" data-color="5" style="background:#CE93D8;"></button>
    <button class="color-btn" data-color="6" style="background:#FFAB91;"></button>
    <button class="color-btn color-clear" data-color="0">X</button>
</div>
```

```css
/* 셀 컬러 마킹 */
.cell.cell-color-1 { background-color: rgba(255, 224, 130, 0.4); }
.cell.cell-color-2 { background-color: rgba(165, 214, 167, 0.4); }
.cell.cell-color-3 { background-color: rgba(144, 202, 249, 0.4); }
.cell.cell-color-4 { background-color: rgba(244, 143, 177, 0.4); }
.cell.cell-color-5 { background-color: rgba(206, 147, 216, 0.4); }
.cell.cell-color-6 { background-color: rgba(255, 171, 145, 0.4); }
```

#### 6.6 선행 조건
- 없음

#### 6.7 예상 작업량
- board.js: ~15줄
- input.js: ~25줄
- grid.js: ~10줄
- HTML/CSS: ~30줄
- game.js 이벤트: ~15줄
- 테스트: ~8개

---

## Phase 2: 높은 가치 (8개 기능)

---

### 7. XP/레벨 시스템

#### 7.1 기능 설명
게임 완료 시 XP(경험치) 획득. XP 누적으로 레벨 업.
난이도/모드/실수/시간에 따라 XP 차등 지급.
메인 화면에 현재 레벨 + 경험치 바 표시.

#### 7.2 수정 파일 목록

| 파일 | 위치 | 변경 내용 |
|------|------|-----------|
| `src/js/utils/storage.js` | KEYS, 신규 함수 | `PLAYER_XP: 'sudoku_playerXP'`, `loadPlayerXP()`, `savePlayerXP()` |
| `src/js/core/scorer.js` | 신규 함수 | `calculateXP(difficulty, time, mistakes, mode)` |
| `src/js/screens/complete.js` | `onShow()` | XP 계산, 저장, 레벨업 표시 |
| `src/js/screens/main.js` | `onShow()` | 레벨 바 업데이트 |
| `src/index.html` | screen-main | 레벨 UI 추가 |
| `css/screens.css` | 신규 | 레벨 바 스타일 |

#### 7.3 데이터 구조

```javascript
/**
 * @typedef {Object} PlayerXPData
 * @property {number} totalXP - 누적 XP
 * @property {number} level - 현재 레벨 (1부터)
 */

// 레벨 테이블 (누적 XP 기준)
const LEVEL_THRESHOLDS = [
    0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500,   // L1-L10
    5500, 6600, 7800, 9100, 10500, 12000, 13600, 15300, 17100, 19000, // L11-L20
    // ... 50레벨까지
];

function getLevelFromXP(totalXP) {
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (totalXP >= LEVEL_THRESHOLDS[i]) return i + 1;
    }
    return 1;
}
```

#### 7.4 코드 패턴

```javascript
// scorer.js
export function calculateXP(difficulty, time, mistakes, mode) {
    const base = { easy: 20, normal: 35, hard: 50, expert: 75, master: 100 };
    let xp = base[difficulty] || 20;
    // 실수 감점
    xp = Math.max(5, xp - mistakes * 5);
    // 타임어택 보너스
    if (mode === 'timeAttack') xp = Math.floor(xp * 1.3);
    return xp;
}

// complete.js onShow() 내부
const xpEarned = calculateXP(difficulty, time, mistakes, mode);
const xpData = loadPlayerXP();
const prevLevel = getLevelFromXP(xpData.totalXP);
xpData.totalXP += xpEarned;
const newLevel = getLevelFromXP(xpData.totalXP);
xpData.level = newLevel;
savePlayerXP(xpData);
if (newLevel > prevLevel) {
    // 레벨업 축하 표시
}
```

#### 7.5 UI 변경

```html
<!-- main 화면에 레벨 바 추가 (best-score-section 위에) -->
<div class="level-section">
    <div class="level-info">
        <span class="level-badge">Lv. 1</span>
        <span class="level-xp">0 / 100 XP</span>
    </div>
    <div class="level-progress-bar">
        <div class="level-progress-fill" style="width: 0%"></div>
    </div>
</div>
```

#### 7.6 선행 조건
- 없음

#### 7.7 예상 작업량
- storage.js: ~20줄
- scorer.js: ~15줄
- complete.js: ~15줄
- main.js: ~15줄
- HTML/CSS: ~30줄
- 테스트: ~8개

---

### 8. 주간 챌린지

#### 8.1 기능 설명
매주 특별한 규칙의 챌린지 제공 (예: "이번 주 5개 Expert 클리어", "실수 없이 3회 클리어" 등).
주간 단위로 자동 갱신. 완료 시 보너스 XP/업적 부여.

#### 8.2 수정 파일 목록

| 파일 | 위치 | 변경 내용 |
|------|------|-----------|
| `src/js/utils/weekly-challenge.js` | 신규 파일 | 챌린지 정의, 진행도 추적 |
| `src/js/utils/storage.js` | KEYS | `WEEKLY_CHALLENGE: 'sudoku_weeklyChallenge'` |
| `src/js/screens/weekly.js` | 신규 파일 | 주간 챌린지 화면 |
| `src/js/screens/complete.js` | `onShow()` | 챌린지 진행도 업데이트 |
| `src/js/app.js` | import + init | `initWeeklyScreen(app)` |
| `src/index.html` | 신규 화면 | `screen-weekly` |
| `css/screens.css` | 신규 | 챌린지 카드 스타일 |

#### 8.3 새로 추가할 파일
- `src/js/utils/weekly-challenge.js` - 챌린지 정의 + 로직
- `src/js/screens/weekly.js` - 화면 컨트롤러

#### 8.4 데이터 구조

```javascript
/**
 * @typedef {Object} WeeklyChallenge
 * @property {string} weekId - 'YYYY-WNN' (ISO 주번호)
 * @property {Array<{type: string, target: number, current: number, desc: string}>} tasks
 * @property {boolean} completed - 모든 태스크 완료 여부
 * @property {number} rewardXP - 보상 XP
 */

// 챌린지 유형 10+가지
const CHALLENGE_TYPES = [
    { type: 'winCount', desc: '{n}회 승리', target: [3, 5, 7] },
    { type: 'noMistake', desc: '실수 없이 {n}회', target: [1, 2, 3] },
    { type: 'difficulty', desc: '{diff} 이상 {n}회', target: [1, 2, 3] },
    { type: 'timeUnder', desc: '{n}분 이내 클리어 {m}회', target: [1, 2] },
    { type: 'dailyStreak', desc: '일일도전 {n}일 연속', target: [3, 5, 7] },
    { type: 'boardSize', desc: '{size}x{size} 보드 {n}회', target: [1, 2] },
    { type: 'totalScore', desc: '총 {n}점 이상 획득', target: [5000, 10000] },
    { type: 'variant', desc: '변형 규칙 {n}회', target: [1, 2, 3] },
    { type: 'perfectWeek', desc: '이번 주 매일 플레이', target: [7] },
    { type: 'speedRun', desc: '{n}분 이내 {diff} 클리어', target: [1] },
];
```

#### 8.5 코드 패턴

```javascript
// weekly-challenge.js
export function getWeekId(date = new Date()) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function generateWeeklyChallenge(weekId) {
    // seed 기반 3개 태스크 선택
    const seed = hashString(weekId);
    const rng = seededRandom(seed);
    // ... 3개 랜덤 선택
}

export function updateChallengeProgress(weeklyData, gameResult) {
    // gameResult: { difficulty, mode, time, mistakes, score, boardSize, variant }
    for (const task of weeklyData.tasks) {
        // 각 태스크 유형별 진행도 체크
    }
}
```

#### 8.6 UI 변경
- 메인 화면에 "주간 챌린지" 카드 추가 (일일도전 카드 아래)
- 전용 화면: 챌린지 목록 + 진행도 바 + 보상 표시
- 프로필 메뉴에 "주간 챌린지" 항목 추가

#### 8.7 선행 조건
- XP/레벨 시스템 (보상으로 XP 부여)

#### 8.8 예상 작업량
- weekly-challenge.js: ~150줄
- weekly.js: ~100줄
- storage.js: ~20줄
- complete.js: ~10줄
- HTML/CSS: ~60줄
- 테스트: ~15개

---

### 9. Even/Odd 변형

#### 9.1 기능 설명
보드의 특정 셀들이 짝수(even) 또는 홀수(odd) 제약을 가짐.
짝수 셀: 2, 4, 6, 8만 가능. 홀수 셀: 1, 3, 5, 7, 9만 가능.
시각적으로 원형(짝수) / 사각형(홀수) 마커로 표시.

#### 9.2 수정 파일 목록

| 파일 | 위치 | 변경 내용 |
|------|------|-----------|
| `src/js/core/validator.js` | `checkConflicts()` | even/odd 위반 체크 |
| `src/js/core/solver.js` | `isValid()` | even/odd 제약 체크, `getCandidates()` 필터 |
| `src/js/core/generator.js` | `generatePuzzle()` | even/odd 마커 생성 로직 |
| `src/js/core/puzzle-worker.js` | 인라인 | even/odd 체크 |
| `src/js/game/board.js` | 신규 필드 | `_evenOddMap` 2D 배열 ('e'|'o'|null) |
| `src/js/ui/grid.js` | `_buildGrid()` | 셀에 even/odd 마커 DOM 추가 |
| `src/js/ui/grid.js` | `renderBoard()` | even/odd 마커 표시 |
| `src/index.html` | mode-select | variant 옵션 추가 |

#### 9.3 데이터 구조

```javascript
// board.js
this._evenOddMap = null; // boardSize x boardSize, null | 'e' | 'o'

// getState() / toJSON()에 포함
evenOddMap: this._evenOddMap,

// generator에서 퍼즐 반환 시 포함
return { board, solution, given, difficulty, variant, evenOddMap };
```

#### 9.4 코드 패턴

```javascript
// generator.js - even/odd 마커 생성
function generateEvenOddMap(solution, boardSize) {
    const map = Array.from({ length: boardSize }, () => Array(boardSize).fill(null));
    // 전체 셀의 30-50%에 마커 부여
    const positions = shuffle(allPositions);
    const count = Math.floor(boardSize * boardSize * 0.4);
    for (let i = 0; i < count; i++) {
        const { row, col } = positions[i];
        map[row][col] = solution[row][col] % 2 === 0 ? 'e' : 'o';
    }
    return map;
}

// solver.js isValid() 추가
if (variant === 'evenOdd' && evenOddMap) {
    const marker = evenOddMap[row][col];
    if (marker === 'e' && num % 2 !== 0) return false;
    if (marker === 'o' && num % 2 === 0) return false;
}
```

#### 9.5 UI 변경

```css
.cell .even-marker {
    position: absolute; top: 2px; right: 2px;
    width: 8px; height: 8px;
    border-radius: 50%;
    background: rgba(41, 121, 255, 0.3);
}
.cell .odd-marker {
    position: absolute; top: 2px; right: 2px;
    width: 8px; height: 8px;
    border-radius: 2px;
    background: rgba(255, 152, 0, 0.3);
}
```

#### 9.6 선행 조건
- variant 시스템이 evenOddMap 데이터를 solver/generator에 전달하는 방식 설계 필요
- solver.js의 `isValid()`, `getCandidates()` 시그니처에 `evenOddMap` 추가 또는 context 객체로 묶기

#### 9.7 예상 작업량
- 코어 (validator/solver/generator/worker): ~80줄
- board.js: ~20줄
- grid.js: ~30줄
- HTML/CSS: ~20줄
- 테스트: ~15개

---

### 10. Windoku 변형

#### 10.1 기능 설명
9x9 보드에 4개의 추가 영역(윈도우)이 있으며, 각 윈도우 내에서도 1-9가 한 번씩만 등장.
4개 윈도우 좌표:
- W1: 행1-3, 열1-3
- W2: 행1-3, 열5-7
- W3: 행5-7, 열1-3
- W4: 행5-7, 열5-7

#### 10.2 수정 파일 목록

| 파일 | 위치 | 변경 내용 |
|------|------|-----------|
| `src/js/core/validator.js` | 신규 함수 | `getWindokuCells(row, col)`, `checkConflicts()` 확장 |
| `src/js/core/solver.js` | `isValid()` | Windoku 영역 체크 |
| `src/js/core/puzzle-worker.js` | 인라인 | Windoku 체크 |
| `src/js/game/notes.js` | `removeFromRelated()` | Windoku 영역 메모 제거 |
| `src/js/ui/grid.js` | `_buildGrid()` | Windoku 셀에 `.windoku` CSS 클래스 |
| `src/js/ui/highlight.js` | `highlightSelection()` | Windoku 영역 하이라이트 |
| `css/grid.css` | 신규 | `.windoku` 배경색 |

#### 10.3 코드 패턴

```javascript
// validator.js
const WINDOKU_REGIONS = [
    { startRow: 1, startCol: 1, size: 3 }, // W1
    { startRow: 1, startCol: 5, size: 3 }, // W2
    { startRow: 5, startCol: 1, size: 3 }, // W3
    { startRow: 5, startCol: 5, size: 3 }, // W4
];

export function getWindokuRegion(row, col) {
    for (const region of WINDOKU_REGIONS) {
        if (row >= region.startRow && row < region.startRow + region.size &&
            col >= region.startCol && col < region.startCol + region.size) {
            return region;
        }
    }
    return null;
}

export function getWindokuCells(row, col) {
    const region = getWindokuRegion(row, col);
    if (!region) return [];
    const cells = [];
    for (let r = region.startRow; r < region.startRow + region.size; r++) {
        for (let c = region.startCol; c < region.startCol + region.size; c++) {
            cells.push({ row: r, col: c });
        }
    }
    return cells;
}
```

#### 10.4 UI 변경
- Windoku 셀에 `--windoku-bg` CSS 변수 기반 배경색
- 라이트: `rgba(255, 152, 0, 0.08)`, 다크: `rgba(255, 152, 0, 0.12)`

#### 10.5 선행 조건
- 9x9 보드에서만 지원 (다른 크기 비활성화)

#### 10.6 예상 작업량
- 코어: ~60줄
- UI: ~30줄
- CSS: ~15줄
- 테스트: ~12개

---

### 11. 완료 축하 애니메이션 강화

#### 11.1 기능 설명
현재 `createConfetti()`로 간단한 컨페티 효과만 제공.
Canvas 기반 풍선/폭죽 애니메이션 + CSS 웨이브 효과 추가.
게임 완료 화면 전환 시 트리거.

#### 11.2 수정 파일 목록

| 파일 | 위치 | 변경 내용 |
|------|------|-----------|
| `src/js/ui/animations.js` | 기존 | `createFireworks()`, `createBalloons()` 추가 |
| `src/js/screens/complete.js` | `onShow()` ~202행 | 애니메이션 유형 선택 로직 |
| `css/animations.css` | 기존 | 풍선/폭죽 CSS 키프레임 |

#### 11.3 코드 패턴

```javascript
// animations.js
export function createFireworks(container, count = 5) {
    const canvas = document.createElement('canvas');
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
    canvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const particles = [];
    // 폭죽 파티클 시스템
    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            const x = Math.random() * canvas.width;
            const y = canvas.height * 0.3 + Math.random() * canvas.height * 0.3;
            for (let p = 0; p < 30; p++) {
                particles.push({
                    x, y,
                    vx: (Math.random() - 0.5) * 8,
                    vy: (Math.random() - 0.5) * 8 - 2,
                    color: `hsl(${Math.random() * 360}, 80%, 60%)`,
                    life: 1,
                });
            }
        }, i * 300);
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // ... 파티클 업데이트 & 그리기 ...
        if (particles.some(p => p.life > 0)) requestAnimationFrame(animate);
        else canvas.remove();
    }
    requestAnimationFrame(animate);
}
```

#### 11.4 선행 조건
- 없음

#### 11.5 예상 작업량
- animations.js: ~80줄
- complete.js: ~10줄
- CSS: ~20줄
- 테스트: ~3개 (visual 확인)

---

### 12. 풀이 시간 그래프

#### 12.1 기능 설명
게임 기록 데이터를 기반으로 풀이 시간 추이 그래프 표시.
난이도별 필터, 최근 N게임 선택 가능.
Canvas API로 선 그래프 + 평균선 렌더링.

#### 12.2 수정 파일 목록

| 파일 | 위치 | 변경 내용 |
|------|------|-----------|
| `src/js/screens/stats.js` | 기존 확장 | 그래프 렌더링 함수 추가 |
| `src/js/utils/chart.js` | 신규 파일 | Canvas 기반 차트 유틸리티 |
| `src/index.html` | screen-stats | `<canvas id="time-chart">` 추가 |
| `css/screens.css` | 기존 | 차트 컨테이너 스타일 |

#### 12.3 새로 추가할 파일
- `src/js/utils/chart.js` - Canvas 차트 렌더링 유틸리티

#### 12.4 코드 패턴

```javascript
// chart.js
export function drawLineChart(canvas, data, options = {}) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * 2; // HiDPI
    canvas.height = height * 2;
    ctx.scale(2, 2);

    const padding = { top: 20, right: 20, bottom: 30, left: 50 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    // Y축: 시간(초), X축: 게임 인덱스
    const maxY = Math.max(...data.map(d => d.time), 60);
    const minY = 0;

    // 배경 + 그리드라인
    // 데이터 포인트 & 선
    // 평균선 (점선)
    // X/Y 라벨
}
```

#### 12.5 UI 변경
- 통계 화면 "시간" 섹션 아래에 차트 영역 추가
- 가로 스크롤 가능 (게임 수 많을 때)

#### 12.6 선행 조건
- 게임 히스토리 데이터 (이미 구현됨)

#### 12.7 예상 작업량
- chart.js: ~120줄
- stats.js: ~30줄
- HTML/CSS: ~20줄
- 테스트: ~5개

---

### 13. 칭호/프로필 시스템

#### 13.1 기능 설명
레벨/업적 기반으로 칭호 부여. 프로필 카드에 선택한 칭호 표시.
칭호 예: "초보자", "스도쿠 입문자", "퍼즐 장인", "마스터 풀이사" 등.

#### 13.2 수정 파일 목록

| 파일 | 위치 | 변경 내용 |
|------|------|-----------|
| `src/js/utils/titles.js` | 신규 파일 | 칭호 정의 + 조건 체크 |
| `src/js/utils/storage.js` | 신규 | `PLAYER_TITLE: 'sudoku_playerTitle'`, `loadTitle()`, `saveTitle()` |
| `src/js/screens/profile.js` | 기존 확장 | 프로필 카드 + 칭호 선택기 |
| `src/index.html` | screen-profile | 프로필 카드 UI |
| `css/screens.css` | 기존 | 프로필 카드 스타일 |

#### 13.3 새로 추가할 파일
- `src/js/utils/titles.js`

#### 13.4 데이터 구조

```javascript
// titles.js
export const TITLES = [
    { id: 'beginner', name: '초보자', condition: (d) => true }, // 기본
    { id: 'solver', name: '풀이사', condition: (d) => d.totalWins >= 5 },
    { id: 'expert', name: '전문 풀이사', condition: (d) => d.totalWins >= 20 },
    { id: 'master', name: '마스터', condition: (d) => d.level >= 10 },
    { id: 'perfectionist', name: '완벽주의자', condition: (d) => d.totalNoMistake >= 10 },
    { id: 'speedster', name: '스피드러너', condition: (d) => d.bestTime <= 180 },
    { id: 'daily_warrior', name: '일일도전 전사', condition: (d) => d.dailyStreak >= 14 },
    { id: 'legend', name: '전설', condition: (d) => d.level >= 30 && d.totalWins >= 100 },
];
```

#### 13.5 선행 조건
- XP/레벨 시스템 (레벨 기반 칭호)

#### 13.6 예상 작업량
- titles.js: ~40줄
- storage.js: ~10줄
- profile.js: ~40줄
- HTML/CSS: ~40줄
- 테스트: ~6개

---

### 14. 결과 공유 기능

#### 14.1 기능 설명
게임 완료 후 이모지 그리드 형태의 결과를 공유.
Web Share API 우선, 미지원 시 클립보드 복사 폴백.

#### 14.2 수정 파일 목록

| 파일 | 위치 | 변경 내용 |
|------|------|-----------|
| `src/js/screens/complete.js` | 기존 확장 | 공유 버튼 + 생성 로직 |
| `src/js/utils/share.js` | 신규 파일 | 이모지 그리드 생성 + 공유 API 호출 |
| `src/index.html` | screen-complete complete-actions | 공유 버튼 추가 |

#### 14.3 새로 추가할 파일
- `src/js/utils/share.js`

#### 14.4 코드 패턴

```javascript
// share.js
export function generateShareText(params) {
    const { difficulty, time, mistakes, score, boardSize, mode, variant } = params;
    const diffLabel = { easy:'쉬움', normal:'보통', hard:'어려움', expert:'전문가', master:'마스터' };

    let text = `Sudoku League\n`;
    text += `${diffLabel[difficulty] || difficulty} ${boardSize}x${boardSize}`;
    if (variant !== 'standard') text += ` [${variant}]`;
    text += `\n`;
    text += `${formatTime(time)} | ${mistakes === 0 ? 'No Mistake' : `${mistakes} Mistakes`}\n`;
    text += `Score: ${score.toLocaleString()}\n`;

    // 이모지 그리드 (난이도별 색상)
    const colors = { easy: '🟩', normal: '🟨', hard: '🟧', expert: '🟥', master: '🟪' };
    const emoji = colors[difficulty] || '⬜';
    const size = Math.min(boardSize, 9);
    for (let r = 0; r < size; r++) {
        text += emoji.repeat(size) + '\n';
    }

    return text;
}

export async function shareResult(text) {
    if (navigator.share) {
        try {
            await navigator.share({ text });
            return true;
        } catch { /* user cancelled */ }
    }
    // Fallback: clipboard
    try {
        await navigator.clipboard.writeText(text);
        return 'copied';
    } catch {
        return false;
    }
}
```

#### 14.5 UI 변경

```html
<!-- complete-actions에 추가 -->
<button class="btn btn-secondary" data-action="share-result">
    <svg ...>공유 아이콘</svg> 결과 공유
</button>
```

#### 14.6 선행 조건
- 없음

#### 14.7 예상 작업량
- share.js: ~50줄
- complete.js: ~15줄
- HTML/CSS: ~10줄
- 테스트: ~4개

---

## Phase 3: 큰 가치 (9개 기능)

---

### 15. Killer Sudoku 변형

#### 15.1 기능 설명
셀 그룹("케이지")이 주어지고, 각 케이지 내 숫자의 합이 지정된 값이어야 함.
같은 케이지 내 숫자 중복 불가.

#### 15.2 수정 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `src/js/core/validator.js` | 케이지 합 체크, 케이지 내 중복 체크 |
| `src/js/core/solver.js` | 케이지 제약 반영 |
| `src/js/core/generator.js` | 케이지 생성 알고리즘 (DFS 기반 셀 그룹화) |
| `src/js/core/puzzle-worker.js` | 케이지 로직 인라인 |
| `src/js/game/board.js` | `_cages` 배열 (각 케이지: {cells, sum}) |
| `src/js/ui/grid.js` | 케이지 경계선 + 합계 숫자 렌더링 |
| `css/grid.css` | 점선 테두리 + 합계 숫자 스타일 |

#### 15.3 데이터 구조

```javascript
// 케이지 정의
/**
 * @typedef {Object} Cage
 * @property {Array<{row: number, col: number}>} cells - 케이지에 속한 셀들
 * @property {number} sum - 목표 합계
 */

// board.js
this._cages = []; // Cage[]
```

#### 15.4 코드 패턴

```javascript
// 케이지 생성 알고리즘
function generateCages(solution, boardSize) {
    const cages = [];
    const assigned = Array.from({ length: boardSize }, () => Array(boardSize).fill(false));

    for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
            if (assigned[r][c]) continue;
            // DFS로 2-5셀 그룹 생성
            const cage = { cells: [], sum: 0 };
            const maxSize = 2 + Math.floor(Math.random() * 3); // 2-4
            growCage(r, c, cage, maxSize, assigned, solution, boardSize);
            cage.sum = cage.cells.reduce((s, { row, col }) => s + solution[row][col], 0);
            cages.push(cage);
        }
    }
    return cages;
}
```

#### 15.5 UI 변경
- 케이지 경계: 점선 테두리 (블록 경계와 구별)
- 합계 숫자: 케이지 좌상단 셀에 작은 숫자로 표시
- CSS: `.cage-border-top`, `.cage-border-left` 등 클래스

#### 15.6 선행 조건
- variant 시스템 확장 (cages 데이터 전달)

#### 15.7 예상 작업량
- 코어: ~200줄
- UI: ~80줄
- CSS: ~40줄
- 테스트: ~20개

---

### 16. Thermo Sudoku 변형

#### 16.1 기능 설명
보드에 "온도계" 경로가 있으며, 경로를 따라 숫자가 점점 커져야 함.
온도계의 구근(시작)에서 끝까지 오름차순.

#### 16.2 수정 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `src/js/core/validator.js` | 온도계 경로 순서 체크 |
| `src/js/core/solver.js` | 경로 제약 반영 |
| `src/js/core/generator.js` | 온도계 경로 생성 |
| `src/js/game/board.js` | `_thermos` 배열 |
| `src/js/ui/grid.js` | SVG/Canvas로 온도계 경로 렌더링 |
| `css/grid.css` | 온도계 스타일 |

#### 16.3 데이터 구조

```javascript
/**
 * @typedef {Object} Thermo
 * @property {Array<{row: number, col: number}>} path - 구근부터 끝까지 셀 순서
 */
this._thermos = []; // Thermo[]
```

#### 16.4 선행 조건
- variant 시스템 확장

#### 16.5 예상 작업량
- 코어: ~150줄
- UI/SVG 렌더링: ~100줄
- 테스트: ~15개

---

### 17. Arrow Sudoku 변형

#### 17.1 기능 설명
보드에 "화살표"가 있으며, 원(서클) 셀의 숫자는 화살표가 가리키는 셀들의 합과 같아야 함.

#### 17.2 수정 파일 목록
- Thermo/Killer와 유사한 파일 구조
- validator, solver, generator, board, grid, CSS

#### 17.3 데이터 구조

```javascript
/**
 * @typedef {Object} Arrow
 * @property {{row: number, col: number}} circle - 합계 셀
 * @property {Array<{row: number, col: number}>} shaft - 화살표 경로 셀들
 */
this._arrows = []; // Arrow[]
```

#### 17.4 선행 조건
- variant 시스템 확장

#### 17.5 예상 작업량
- 코어: ~120줄
- UI: ~80줄
- 테스트: ~12개

---

### 18. 멀티플레이어 (실시간 대결)

#### 18.1 기능 설명
WebSocket 기반 실시간 1:1 대결. 같은 퍼즐을 동시에 풀고 먼저 완료한 사람이 승리.
상대방 진행률 실시간 표시.

#### 18.2 수정 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `src/js/utils/multiplayer.js` | 신규 - WebSocket 클라이언트 |
| `src/js/screens/lobby.js` | 신규 - 매칭 대기실 |
| `src/js/screens/game.js` | 멀티플레이어 모드 분기 |
| `src/index.html` | 대기실 화면, 상대방 진행 바 |
| 백엔드 서버 | 신규 - WebSocket 서버 (Node.js) |

#### 18.3 데이터 구조

```javascript
// multiplayer.js
class MultiplayerClient {
    constructor(serverUrl) {
        this.ws = new WebSocket(serverUrl);
        this.roomId = null;
        this.playerId = null;
    }

    joinRoom(roomId) { /* ... */ }
    sendProgress(percent) { /* ... */ }
    sendComplete(time, score) { /* ... */ }
    onOpponentProgress(callback) { /* ... */ }
    onOpponentComplete(callback) { /* ... */ }
}
```

#### 18.4 선행 조건
- 백엔드 서버 구축 필요
- 사용자 인증 시스템

#### 18.5 예상 작업량
- 클라이언트: ~200줄
- 서버: ~300줄
- UI: ~100줄
- 테스트: ~20개

---

### 19. 퍼즐 에디터

#### 19.1 기능 설명
사용자가 직접 퍼즐을 만들고 공유할 수 있는 에디터.
빈 그리드에 숫자를 배치하면 유일해 검증 후 퍼즐로 저장.

#### 19.2 수정 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `src/js/screens/editor.js` | 신규 - 에디터 화면 |
| `src/js/utils/puzzle-validator.js` | 신규 - 사용자 퍼즐 유효성 검증 |
| `src/index.html` | 에디터 화면 추가 |
| `src/js/app.js` | import + init |

#### 19.3 코드 패턴

```javascript
// editor.js
class PuzzleEditor {
    constructor(gridUI) {
        this._gridUI = gridUI;
        this._board = createEmptyBoard(9);
        this._editMode = 'given'; // 'given' | 'empty'
    }

    placeNumber(row, col, num) {
        this._board[row][col] = num;
        this._gridUI.updateCell(row, col, num, 'given');
    }

    validate() {
        // 1. 현재 배치가 유효한지 (충돌 없는지)
        // 2. 유일한 해가 존재하는지
        const solutions = countSolutions(this._board, 9, null, 2);
        if (solutions === 0) return { valid: false, error: '풀 수 없는 퍼즐' };
        if (solutions > 1) return { valid: false, error: '해가 둘 이상' };
        return { valid: true, solution: solve(this._board) };
    }

    exportAsJSON() {
        return { board: this._board, solution: this.validate().solution };
    }

    exportAsString() {
        // 81자리 문자열 (0=빈칸)
        return this._board.flat().join('');
    }
}
```

#### 19.4 선행 조건
- 없음 (기존 solver/validator 활용)

#### 19.5 예상 작업량
- editor.js: ~150줄
- puzzle-validator.js: ~50줄
- HTML/CSS: ~60줄
- 테스트: ~10개

---

### 20. 오프라인 동기화

#### 20.1 기능 설명
IndexedDB 기반 대용량 데이터 저장. 온라인 전환 시 서버와 동기화.
현재 localStorage 한계(5-10MB)를 넘어서는 히스토리/통계 저장.

#### 20.2 수정 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `src/js/utils/db.js` | 신규 - IndexedDB 래퍼 |
| `src/js/utils/storage.js` | IndexedDB 폴백 |
| `src/js/utils/sync.js` | 신규 - 온라인 동기화 로직 |
| `src/sw.js` | Background Sync API |

#### 20.3 선행 조건
- 백엔드 API 서버
- 사용자 인증

#### 20.4 예상 작업량
- db.js: ~100줄
- sync.js: ~80줄
- storage.js 수정: ~30줄
- 테스트: ~10개

---

### 21. 접근성 강화

#### 21.1 기능 설명
ARIA 속성 완전 지원. 스크린 리더 호환. 키보드 내비게이션 완전 지원.
고대비 모드. 색약 모드.

#### 21.2 수정 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `src/js/ui/grid.js` | ARIA role/label 추가, tabindex 관리 |
| `src/js/ui/highlight.js` | 고대비 클래스 |
| `src/index.html` | 전체 ARIA 속성 보강 |
| `css/main.css` | 고대비/색약 모드 CSS |
| `src/js/screens/settings.js` | 접근성 설정 토글 |

#### 21.3 코드 패턴

```javascript
// grid.js _buildGrid()에 ARIA 추가
cell.setAttribute('role', 'gridcell');
cell.setAttribute('aria-label', `행 ${r+1}, 열 ${c+1}`);
cell.setAttribute('tabindex', '0');

// 값 변경 시
cell.setAttribute('aria-label', `행 ${r+1}, 열 ${c+1}, 값 ${value}`);
```

#### 21.4 선행 조건
- 없음

#### 21.5 예상 작업량
- grid.js: ~30줄
- HTML ARIA: ~50줄
- CSS: ~40줄
- 테스트: ~8개

---

### 22. 퍼포먼스 최적화

#### 22.1 기능 설명
대형 보드(12x12, 16x16)에서의 렌더링 성능 개선.
Web Worker 활용 확장, DOM 업데이트 최소화, CSS containment.

#### 22.2 수정 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `src/js/ui/grid.js` | CSS containment, requestAnimationFrame 배치 업데이트 |
| `src/js/ui/highlight.js` | 배치 classList 변경 |
| `src/js/game/input.js` | 디바운스 처리 |
| `css/grid.css` | `contain: layout style paint` |

#### 22.3 코드 패턴

```javascript
// grid.js - 배치 업데이트
renderBoardBatched(board, given) {
    requestAnimationFrame(() => {
        for (let r = 0; r < this._gridSize; r++) {
            for (let c = 0; c < this._gridSize; c++) {
                // ... 기존 렌더링 ...
            }
        }
    });
}
```

```css
/* grid.css */
.cell {
    contain: layout style paint;
    will-change: transform;
}
```

#### 22.4 선행 조건
- 없음

#### 22.5 예상 작업량
- grid.js: ~20줄 수정
- CSS: ~5줄
- 테스트: 성능 벤치마크

---

### 23. 국제화 (i18n)

#### 23.1 기능 설명
한국어 외 영어, 일본어 지원. 언어 팩 시스템.
설정에서 언어 전환.

#### 23.2 수정 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `src/js/utils/i18n.js` | 신규 - 국제화 유틸리티 |
| `src/js/utils/lang/ko.js` | 신규 - 한국어 팩 |
| `src/js/utils/lang/en.js` | 신규 - 영어 팩 |
| `src/js/utils/lang/ja.js` | 신규 - 일본어 팩 |
| `src/js/utils/storage.js` | settings에 `language: 'ko'` |
| `src/js/screens/settings.js` | 언어 선택 드롭다운 |
| `src/index.html` | `data-i18n` 속성으로 텍스트 키 매핑 |
| 모든 화면 JS | 하드코딩된 한국어 → `t('key')` 호출 |

#### 23.3 새로 추가할 파일
- `src/js/utils/i18n.js`
- `src/js/utils/lang/ko.js`
- `src/js/utils/lang/en.js`
- `src/js/utils/lang/ja.js`

#### 23.4 코드 패턴

```javascript
// i18n.js
let _currentLang = 'ko';
let _messages = {};

const LANG_MODULES = {
    ko: () => import('./lang/ko.js'),
    en: () => import('./lang/en.js'),
    ja: () => import('./lang/ja.js'),
};

export async function setLanguage(lang) {
    const mod = await LANG_MODULES[lang]();
    _messages = mod.default;
    _currentLang = lang;
    applyTranslations();
}

export function t(key, params = {}) {
    let msg = _messages[key] || key;
    for (const [k, v] of Object.entries(params)) {
        msg = msg.replace(`{${k}}`, v);
    }
    return msg;
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
    });
}

// lang/ko.js
export default {
    'main.title': 'Sudoku',
    'main.newGame': '새 게임',
    'main.continue': '게임 계속하기',
    'main.history': '게임 기록',
    'main.print': '인쇄',
    'difficulty.easy': '쉬움',
    'difficulty.normal': '보통',
    // ... 200+ 키
};
```

#### 23.5 선행 조건
- 전체 UI 텍스트 키 매핑 작업 필요 (대규모)

#### 23.6 예상 작업량
- i18n.js: ~60줄
- 각 언어 팩: ~200줄
- HTML data-i18n: ~100개 요소
- 모든 JS 파일 수정: ~500줄 산재
- 테스트: ~15개

---

## 파일 변경 매트릭스 (전체)

| 파일 | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|
| `validator.js` | 1,2 | 9,10 | 15,16,17 |
| `solver.js` | 1,2 | 9,10 | 15,16,17 |
| `generator.js` | (자동) | 9,10 | 15,16,17 |
| `puzzle-worker.js` | 1,2 | 9,10 | 15,16,17 |
| `board.js` | 6 | 9 | 15,16,17 |
| `notes.js` | 1,2 | 10 | |
| `hints.js` | 1,2 | | |
| `input.js` | 3,6 | | 19 |
| `grid.js` | (하이라이트) | 9,10 | 15,16,17,21,22 |
| `highlight.js` | 1,2 | 10 | |
| `mode-select.js` | 1,2 | 9,10 | |
| `toolbar.js` | 3 | | |
| `storage.js` | 4,5 | 7,8,13 | 20,23 |
| `scorer.js` | | 7 | |
| `complete.js` | 4 | 7,8,14 | |
| `main.js` | 4 | 7 | |
| `settings.js` | 5 | | 21,23 |
| `game.js` | 5 | | 18 |
| `stats.js` | | 12 | |
| `profile.js` | | 13 | |
| `animations.js` | | 11 | |
| `achievements.js` | | | |
| `app.js` | | 8 | 18,19 |
| `index.html` | 1,2,3,5,6 | 7,8,12,13,14 | 18,19,21,23 |
| `css/*` | 1,2,6 | 7,8,9,10,11,12,13 | 15,16,17,21,22 |

---

## 구현 의존성 그래프

```
Phase 1 (독립적 - 병렬 구현 가능)
├── 1. Anti-Knight ─────┐
├── 2. Anti-King ───────┤ (variant 패턴 동일)
├── 3. 자동 메모 ───────┤
├── 4. 스트릭 시스템 ───┤
├── 5. 실수 자동 표시 ──┤
└── 6. 셀 컬러 마킹 ────┘

Phase 2
├── 7. XP/레벨 ─────────→ 8. 주간 챌린지 (XP 보상 의존)
│                       └→ 13. 칭호/프로필 (레벨 의존)
├── 9. Even/Odd ────────┐
├── 10. Windoku ────────┤ (variant 시스템 확장)
├── 11. 축하 애니메이션 ─┤ (독립)
├── 12. 시간 그래프 ─────┤ (독립, history 데이터 사용)
└── 14. 결과 공유 ───────┘ (독립)

Phase 3
├── 15. Killer ──────────┐
├── 16. Thermo ──────────┤ (고급 variant, 데이터 전달 아키텍처 공유)
├── 17. Arrow ───────────┘
├── 18. 멀티플레이어 ────→ 백엔드 서버 필요
├── 19. 퍼즐 에디터 ─────→ 독립
├── 20. 오프라인 동기화 ──→ 백엔드 서버 필요
├── 21. 접근성 ──────────→ 독립
├── 22. 퍼포먼스 ────────→ 독립
└── 23. 국제화 ──────────→ 전체 텍스트 리팩터링
```

---

## variant 파라미터 확장 전략

현재 variant 값: `'standard' | 'diagonal'`

### Phase 1 확장
```
'standard' | 'diagonal' | 'antiKnight' | 'antiKing'
```
- 기존 패턴 (문자열 분기) 그대로 유지
- solver/validator/generator/puzzle-worker의 if 분기 추가

### Phase 2 확장
```
'standard' | 'diagonal' | 'antiKnight' | 'antiKing' | 'evenOdd' | 'windoku'
```
- `evenOdd`: 추가 데이터 (`evenOddMap`) 필요 → generator 반환값에 포함
- `windoku`: 고정 좌표 → 추가 데이터 불필요

### Phase 3 확장 (리팩터링 권장)
```
'standard' | 'diagonal' | 'antiKnight' | 'antiKing' | 'evenOdd' | 'windoku' | 'killer' | 'thermo' | 'arrow'
```
- `killer`, `thermo`, `arrow`: 추가 데이터 (cages, thermos, arrows) 필요
- **이 단계에서 variant를 문자열에서 객체로 리팩터링 고려**:

```javascript
// 리팩터링 후
const variant = {
    type: 'killer',
    data: {
        cages: [...],
    },
};
```

---

## 서비스 워커 캐시 관리

각 Phase 완료 시 `src/sw.js`의 캐시 버전 업데이트:
- 현재: `sudoku-v20`
- Phase 1 완료 후: `sudoku-v21`
- Phase 2 완료 후: `sudoku-v22`
- Phase 3 완료 후: `sudoku-v23`

캐시 파일 리스트에 신규 JS/CSS 파일 추가 필수.

---

## 저장소 마이그레이션 계획

### v2 → v3 (Phase 1)
```javascript
if (storedVersion < 3) {
    // streak 데이터 초기화
    if (readJSON(KEYS.STREAK) === null) {
        writeJSON(KEYS.STREAK, getDefaultStreak());
    }
    // settings에 autoCheckMistakes 기본값
    const settings = readJSON(KEYS.SETTINGS);
    if (settings && !('autoCheckMistakes' in settings)) {
        settings.autoCheckMistakes = false;
        writeJSON(KEYS.SETTINGS, settings);
    }
}
```

### v3 → v4 (Phase 2)
```javascript
if (storedVersion < 4) {
    // playerXP 초기화
    if (readJSON(KEYS.PLAYER_XP) === null) {
        writeJSON(KEYS.PLAYER_XP, { totalXP: 0, level: 1 });
    }
    // weeklyChallenge 초기화
    if (readJSON(KEYS.WEEKLY_CHALLENGE) === null) {
        writeJSON(KEYS.WEEKLY_CHALLENGE, null);
    }
}
```
