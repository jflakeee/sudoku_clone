# 신규 기능 상세 테스트 계획 체크리스트

> 작성일: 2026-02-27
> 테스트 도구: Playwright E2E
> 참조: `docs/implementation_plan_20260227.md`, `docs/implementation_checklist_new.md`
> 분석 방법: 에이전트 팀 (Phase A/B 분석기 + Phase C/D/E 분석기 + 회귀 테스트 분석기) 병렬 분석
> 기존 테스트: 9개 파일, 61개 테스트
> 총 신규 항목: Phase A(23) + B(25) + C(113) + D(66) + E(23) + 회귀(12) + 통합(12) = **약 274개**

---

## 목차

1. [기존 테스트 수정 계획](#1-기존-테스트-수정-계획)
2. [Phase A: 모드 시스템 테스트](#2-phase-a-모드-시스템-테스트)
3. [Phase B: 타임어택 모드 테스트](#3-phase-b-타임어택-모드-테스트)
4. [Phase C: 엔진 리팩터링 테스트](#4-phase-c-엔진-리팩터링-테스트)
5. [Phase D: UI 동적화 테스트](#5-phase-d-ui-동적화-테스트)
6. [Phase E: 대형 보드 최적화 테스트](#6-phase-e-대형-보드-최적화-테스트)
7. [회귀 테스트 전략](#7-회귀-테스트-전략)
8. [통합 E2E 시나리오 테스트](#8-통합-e2e-시나리오-테스트)
9. [요약 통계](#9-요약-통계)

---

## 1. 기존 테스트 수정 계획

### 1.1 helpers.js 수정 (최우선)

#### startNewGame() — Phase A 필수 수정

```javascript
// 변경 전
async function startNewGame(page, difficulty = 'easy') {
    await page.click('.btn-new-game');
    await page.waitForSelector('#difficulty-modal', { state: 'visible' });
    await page.click(`.difficulty-option[data-difficulty="${difficulty}"]`);
    await page.waitForSelector('#screen-game.active');
}

// 변경 후
async function startNewGame(page, difficulty = 'easy', options = {}) {
    const { mode = 'classic', duration, boardSize } = options;
    await page.click('.btn-new-game');
    await page.waitForSelector('#screen-mode-select.active');
    if (mode !== 'classic') {
        await page.click(`.game-mode-option[data-game-mode="${mode}"]`);
    }
    if (mode === 'timeAttack' && duration) {
        await page.click(`.time-option[data-duration="${duration}"]`);
    }
    if (boardSize && boardSize !== 9) {
        await page.click(`.size-option[data-size="${boardSize}"]`);
    }
    await page.click('[data-action="select-mode"]');
    await page.waitForSelector('#difficulty-modal', { state: 'visible' });
    await page.click(`.difficulty-option[data-difficulty="${difficulty}"]`);
    await page.waitForSelector('#screen-game.active');
}
```

#### solveEntirePuzzle() — Phase C 수정

```javascript
// 변경: r < 9, c < 9 → boardSize 동적 참조
async function solveEntirePuzzle(page) {
    await page.evaluate(async () => {
        const mod = await import('./js/app.js');
        const app = mod.default;
        const board = app.board.getBoard();
        const solution = app.board.getSolution();
        const size = app.board.boardSize || 9;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] === 0) {
                    app.input.selectCell(r, c);
                    app.input.inputNumber(solution[r][c]);
                }
            }
        }
    });
}
```

#### 신규 헬퍼 — setTimerElapsed()

```javascript
async function setTimerElapsed(page, elapsedMs) {
    await page.evaluate(async (ms) => {
        const mod = await import('./js/app.js');
        const app = mod.default;
        app.board.timer._elapsed = ms;
    }, elapsedMs);
}
```

### 1.2 기존 테스트 파일별 수정 항목

#### 01-navigation.spec.js

- [ ] 테스트 #6 "difficulty modal opens and closes" — 모드 선택 화면 경유 플로우로 변경 (Phase A)

#### 06-screens.spec.js

- [ ] 테스트 #10 "difficulty modal has 5 difficulty options" — 모드 선택 화면 경유 후 난이도 모달 접근 (Phase A)

#### 나머지 7개 파일

- 기본값 `boardSize=9`, `mode='classic'` 전략으로 **수정 불필요** (helpers.js 수정으로 자동 호환)

### 1.3 영향도 총괄 매트릭스

| 파일 | 테스트 수 | 직접 수정 | 간접 영향 (helpers) |
|------|:--:|:--:|:--:|
| helpers.js | (공통) | 2 함수 | - |
| 01-navigation.spec.js | 6 | 1 | 0 |
| 02-game-basics.spec.js | 7 | 0 | 7 (startNewGame) |
| 03-input-and-tools.spec.js | 7 | 0 | 7 |
| 04-game-completion.spec.js | 6 | 0 | 6 |
| 05-persistence.spec.js | 4 | 0 | 4 |
| 06-screens.spec.js | 10 | 1 | 0 |
| 07-dark-mode.spec.js | 5 | 0 | 0 |
| 08-keyboard.spec.js | 8 | 0 | 8 |
| 09-enhanced-ui.spec.js | 8 | 0 | 8 |
| **총계** | **61** | **2** | **40** |

---

## 2. Phase A: 모드 시스템 테스트

> 신규 파일: `tests/10-mode-select.spec.js` | 23개 테스트

---

### A-1. describe('Mode Select Screen — UI') — 9개

- [ ] **A-1-1** `test('mode select screen displays on new game click')`
  - 카테고리: UI
  - Given: 메인 화면 / When: `.btn-new-game` 클릭 / Then: `#screen-mode-select.active`, navbar 숨김

- [ ] **A-1-2** `test('mode select shows classic and time attack options')`
  - 카테고리: UI
  - Then: `.game-mode-option` 2개, "클래식"/"타임어택" 텍스트

- [ ] **A-1-3** `test('classic mode is selected by default')`
  - 카테고리: UI
  - Then: `[data-game-mode="classic"].active`, `.timed-section` display:none

- [ ] **A-1-4** `test('clicking time attack shows time duration options')`
  - 카테고리: UI
  - When: 타임어택 클릭 / Then: `.timed-section` 표시, `.time-option` 4개

- [ ] **A-1-5** `test('switching back to classic hides time duration options')`
  - 카테고리: UI
  - When: 클래식 재클릭 / Then: `.timed-section` 숨김

- [ ] **A-1-6** `test('time duration options show correct values')`
  - 카테고리: UI
  - Then: 5분/10분/15분/20분, `[data-duration="600"]` 기본 `.active`

- [ ] **A-1-7** `test('selecting different time duration updates active state')`
  - 카테고리: UI
  - When: 5분 클릭 / Then: `[data-duration="300"].active`, `[data-duration="600"]` 비활성

- [ ] **A-1-8** `test('board size section is hidden (reserved for Phase D)')`
  - 카테고리: UI
  - Then: `.board-size-section` display:none

- [ ] **A-1-9** `test('"다음" button is visible')`
  - 카테고리: UI
  - Then: `[data-action="select-mode"]` 표시, "다음" 텍스트

### A-2. describe('Mode Select — Navigation Flow') — 5개

- [ ] **A-2-1** `test('classic mode → difficulty modal → game start')`
  - 카테고리: 통합
  - 플로우: 새 게임 → 모드 선택 → 다음 → 난이도(easy) → `#screen-game.active`

- [ ] **A-2-2** `test('time attack mode → difficulty modal → game start')`
  - 카테고리: 통합
  - 플로우: 타임어택 → 5분 → 다음 → 난이도(easy) → `#screen-game.active`

- [ ] **A-2-3** `test('back button on mode select returns to main')`
  - 카테고리: UI
  - When: `[data-action="back"]` 클릭 / Then: `#screen-main.active`, navbar 표시

- [ ] **A-2-4** `test('difficulty modal close returns to mode select (not main)')`
  - 카테고리: 엣지케이스
  - When: 모달 닫기 / Then: `#screen-mode-select.active`

- [ ] **A-2-5** `test('game screen back button returns to main (not mode select)')`
  - 카테고리: 통합
  - When: 게임 화면 뒤로가기 / Then: `#screen-main.active`

### A-3. describe('Mode Select — Game State') — 4개

- [ ] **A-3-1** `test('game in classic mode has mode="classic"')`
  - 카테고리: 로직
  - Then: `app.board.mode === 'classic'`

- [ ] **A-3-2** `test('game in timeAttack mode has mode="timeAttack"')`
  - 카테고리: 로직
  - Then: `app.board.mode === 'timeAttack'`

- [ ] **A-3-3** `test('saved game preserves mode field')`
  - 카테고리: 로직
  - Then: localStorage `sudoku_currentGame` → `mode === 'timeAttack'`

- [ ] **A-3-4** `test('continue restores game with correct mode')`
  - 카테고리: 통합
  - 플로우: 타임어택 시작 → 뒤로 → 계속하기 → mode 확인

### A-4. describe('Mode Select — Statistics Separation') — 3개

- [ ] **A-4-1** `test('classic stats use key "sudoku_stats"')`
  - 카테고리: 로직
  - Then: 클래식 완료 후 `sudoku_stats` 에 gamesWon ≥ 1, `sudoku_stats_timeAttack` null

- [ ] **A-4-2** `test('timeAttack stats use key "sudoku_stats_timeAttack"')`
  - 카테고리: 로직
  - Then: 타임어택 완료 후 키 분리 확인

- [ ] **A-4-3** `test('stats screen shows classic mode stats by default')`
  - 카테고리: 통합
  - Then: 프로필 → 통계 → `[data-stat="gamesWon"]` 표시

### A-5. describe('Mode Select — Backward Compatibility') — 2개

- [ ] **A-5-1** `test('updated startNewGame helper works (mode-select step)')`
  - 카테고리: 회귀
  - Then: 수정된 헬퍼로 기존 플로우 동작 확인

- [ ] **A-5-2** `test('old saved game without mode field loads as classic')`
  - 카테고리: 엣지케이스
  - Given: mode 필드 없는 옛 데이터 / Then: `app.board.mode === 'classic'`

---

## 3. Phase B: 타임어택 모드 테스트

> 신규 파일: `tests/11-time-attack.spec.js` | 25개 테스트

---

### B-1. describe('Time Attack — Game Start') — 5개

- [ ] **B-1-1** `test('starting time attack shows countdown timer')`
  - 카테고리: 통합
  - Then: `.timer-value` 에 "10:00", 2초 후 감소

- [ ] **B-1-2** `test('starting with 5 min shows 05:00')`
  - 카테고리: 로직
  - Then: `.timer-value` === "05:00"

- [ ] **B-1-3** `test('starting with 15 min shows 15:00')`
  - 카테고리: 로직

- [ ] **B-1-4** `test('starting with 20 min shows 20:00')`
  - 카테고리: 로직

- [ ] **B-1-5** `test('classic mode timer still counts up from 00:00')`
  - 카테고리: 회귀
  - Then: 초기값 "00:00", 2초 후 증가

### B-2. describe('Time Attack — Countdown Behavior') — 4개

- [ ] **B-2-1** `test('timer decreases over time')`
  - 카테고리: 로직
  - Given: 5분 / When: 3초 대기 / Then: "04:57" 이하

- [ ] **B-2-2** `test('timer warning class at 30 seconds')`
  - 카테고리: UI
  - When: elapsed를 duration-30초로 설정 / Then: `.info-timer.timer-warning`

- [ ] **B-2-3** `test('timer danger class at 10 seconds')`
  - 카테고리: UI
  - When: elapsed를 duration-10초로 설정 / Then: `.info-timer.timer-danger`

- [ ] **B-2-4** `test('no warning class when above 30 seconds')`
  - 카테고리: 엣지케이스
  - Then: `.timer-warning`, `.timer-danger` 모두 없음

### B-3. describe('Time Attack — Time Up / Game Over') — 6개

- [ ] **B-3-1** `test('time up navigates to complete screen with failure')`
  - 카테고리: 통합
  - When: 시간 초과 트리거 / Then: `#screen-complete.active`, "시간 초과" 메시지

- [ ] **B-3-2** `test('time up complete screen has no confetti')`
  - 카테고리: UI
  - Then: confetti 요소 없음/숨김

- [ ] **B-3-3** `test('time up shows score earned so far')`
  - 카테고리: 로직
  - Then: `.complete-score` ≥ 0

- [ ] **B-3-4** `test('completing within time shows success')`
  - 카테고리: 통합
  - When: `solveEntirePuzzle` / Then: 성공 메시지, confetti 표시

- [ ] **B-3-5** `test('completing within time shows bonus score')`
  - 카테고리: 로직
  - Then: 보너스 점수 영역 표시, bonus > 0

- [ ] **B-3-6** `test('completing shows remaining time message')`
  - 카테고리: UI
  - Then: "N초 남기고 완료" 형태 메시지

### B-4. describe('Time Attack — Pause') — 2개

- [ ] **B-4-1** `test('pausing stops the countdown')`
  - 카테고리: 로직
  - When: pause / Then: 2초 후 remaining 동일 (±1초)

- [ ] **B-4-2** `test('resuming restarts the countdown')`
  - 카테고리: 로직
  - When: resume / Then: 2초 후 remaining 감소

### B-5. describe('Time Attack — Statistics') — 3개

- [ ] **B-5-1** `test('time attack win saved to timeAttack stats')`
  - 카테고리: 로직
  - Then: `sudoku_stats_timeAttack` → gamesWon ≥ 1

- [ ] **B-5-2** `test('time attack loss saved to timeAttack stats')`
  - 카테고리: 로직
  - Then: gamesStarted ≥ 1, gamesWon === 0

- [ ] **B-5-3** `test('time attack stats separate from classic stats')`
  - 카테고리: 통합
  - Then: 양쪽 키에 각각 gamesWon === 1

### B-6. describe('Time Attack — Edge Cases') — 5개

- [ ] **B-6-1** `test('3 mistakes game over before time up')`
  - 카테고리: 엣지케이스
  - When: 시간 여유 + 실수 3회 / Then: 실수 한도 게임오버

- [ ] **B-6-2** `test('time up before 3 mistakes')`
  - 카테고리: 엣지케이스
  - When: 실수 1회 + 시간 초과 / Then: "시간 초과" 메시지

- [ ] **B-6-3** `test('time attack save includes countdown state')`
  - 카테고리: 로직
  - Then: localStorage에 mode, timer 상태 저장

- [ ] **B-6-4** `test('continue time attack resumes countdown')`
  - 카테고리: 통합
  - When: 뒤로 → 계속하기 / Then: 카운트다운 재개

- [ ] **B-6-5** `test('new game from complete goes through mode select')`
  - 카테고리: 통합
  - When: 완료 화면 "새 게임" / Then: `#screen-mode-select.active`

---

## 4. Phase C: 엔진 리팩터링 테스트

> 신규 파일 3개 | 113개 테스트

---

### C-1. board-config.js — `tests/12-board-config.spec.js` (14개)

- [ ] **C-CFG-01** `BOARD_CONFIGS has entries for 4,6,9,12,16`
- [ ] **C-CFG-02** `4x4 config: size=4, blockRows=2, blockCols=2, numRange=4, totalCells=16`
- [ ] **C-CFG-03** `6x6 config: non-square block (2x3)`
- [ ] **C-CFG-04** `9x9 config matches legacy values`
- [ ] **C-CFG-05** `12x12 config: blockRows=3, blockCols=4`
- [ ] **C-CFG-06** `16x16 config: blockRows=4, blockCols=4`
- [ ] **C-CFG-07** `getBlockSize returns {rows, cols} for each size`
- [ ] **C-CFG-08** `getBlockSize throws for unsupported size (5, 7)`
- [ ] **C-CFG-09** `getDifficultyRange returns [min,max] for each size/difficulty`
- [ ] **C-CFG-10** `getDifficultyRange throws for unsupported size`
- [ ] **C-CFG-11** `getDifficultyRange falls back to easy for unknown difficulty`
- [ ] **C-CFG-12** `all difficulty ranges satisfy min <= max`
- [ ] **C-CFG-13** `totalCells === size * size for all configs`
- [ ] **C-CFG-14** `blockRows * blockCols === size for all configs`

### C-2. solver.js — `tests/13-multi-size-engine.spec.js` (25개)

**isValid (9개)**

- [ ] **C-SOL-01** `isValid rejects duplicate in row (4x4)`
- [ ] **C-SOL-02** `isValid rejects duplicate in col (4x4)`
- [ ] **C-SOL-03** `isValid rejects duplicate in 2x2 block (4x4)`
- [ ] **C-SOL-04** `isValid accepts valid placement (4x4)`
- [ ] **C-SOL-05** `isValid handles 2x3 block correctly (6x6)` — **비정사각 특수 케이스**
- [ ] **C-SOL-06** `isValid rejects duplicate in 2x3 block (6x6)`
- [ ] **C-SOL-07** `isValid with default params (9x9 backward compat)` — 회귀
- [ ] **C-SOL-08** `isValid handles 3x4 block (12x12)`
- [ ] **C-SOL-09** `isValid handles 4x4 block (16x16)`

**getCandidates (6개)**

- [ ] **C-SOL-10** `getCandidates correct set (4x4)` — 범위 1-4
- [ ] **C-SOL-11** `getCandidates correct set (6x6)` — 범위 1-6
- [ ] **C-SOL-12** `getCandidates correct set (9x9)` — 회귀
- [ ] **C-SOL-13** `getCandidates correct set (12x12)` — 범위 1-12
- [ ] **C-SOL-14** `getCandidates correct set (16x16)` — 범위 1-16
- [ ] **C-SOL-15** `getCandidates returns empty for filled cell`

**solve (6개)**

- [ ] **C-SOL-16** `solve finds solution for 4x4`
- [ ] **C-SOL-17** `solve finds solution for 6x6`
- [ ] **C-SOL-18** `solve finds solution for 9x9` — 회귀
- [ ] **C-SOL-19** `solve finds solution for 12x12`
- [ ] **C-SOL-20** `solve finds solution for 16x16`
- [ ] **C-SOL-21** `solve returns null for unsolvable board`

**countSolutions (4개)**

- [ ] **C-SOL-22** `countSolutions returns 1 for unique puzzle (4x4)`
- [ ] **C-SOL-23** `countSolutions returns 1 for unique puzzle (6x6)`
- [ ] **C-SOL-24** `countSolutions returns 1 for unique puzzle (9x9)` — 회귀
- [ ] **C-SOL-25** `countSolutions returns 2+ for ambiguous board`

### C-3. generator.js (21개)

- [ ] **C-GEN-01** `generates valid 4x4 puzzle` — board/solution/given 크기 검증
- [ ] **C-GEN-02** `4x4 puzzle has unique solution`
- [ ] **C-GEN-03** `4x4 board values in range 0-4`
- [ ] **C-GEN-04** `4x4 solution values in range 1-4`
- [ ] **C-GEN-05** `4x4 easy has 5-6 empty cells`
- [ ] **C-GEN-06** `generates valid 6x6 puzzle`
- [ ] **C-GEN-07** `6x6 puzzle has unique solution`
- [ ] **C-GEN-08** `6x6 solution valid with 2x3 blocks` — **비정사각 검증**
- [ ] **C-GEN-09** `6x6 board values in range 0-6`
- [ ] **C-GEN-10** `generates valid 9x9 puzzle (regression)`
- [ ] **C-GEN-11** `9x9 puzzle has unique solution (regression)`
- [ ] **C-GEN-12** `9x9 easy has 36-40 empty cells (regression)`
- [ ] **C-GEN-13** `generates valid 12x12 puzzle`
- [ ] **C-GEN-14** `12x12 puzzle has unique solution`
- [ ] **C-GEN-15** `12x12 board values in range 0-12`
- [ ] **C-GEN-16** `12x12 solution has valid 3x4 blocks`
- [ ] **C-GEN-17** `generates valid 16x16 puzzle`
- [ ] **C-GEN-18** `16x16 puzzle has unique solution`
- [ ] **C-GEN-19** `16x16 board values in range 0-16`
- [ ] **C-GEN-20** `default boardSize still creates 9x9`
- [ ] **C-GEN-21** `all difficulty levels work for each board size`

### C-4. validator.js (18개)

- [ ] **C-VAL-01** `getRowCells returns N cells for each size`
- [ ] **C-VAL-02** `getColCells returns N cells for each size`
- [ ] **C-VAL-03** `getBlockCells correct cells for 4x4 (2x2 block)`
- [ ] **C-VAL-04** `getBlockCells correct cells for 6x6 (2x3 block)` — **비정사각**
- [ ] **C-VAL-05** `getBlockCells correct cells for 6x6 block at (2,3)`
- [ ] **C-VAL-06** `getBlockCells correct cells for 9x9 (3x3)` — 회귀
- [ ] **C-VAL-07** `getBlockCells correct cells for 12x12 (3x4 block)`
- [ ] **C-VAL-08** `getBlockCells correct cells for 16x16 (4x4 block)`
- [ ] **C-VAL-09** `checkConflicts finds row conflict (4x4)`
- [ ] **C-VAL-10** `checkConflicts finds col conflict (6x6)`
- [ ] **C-VAL-11** `checkConflicts finds block conflict (6x6 2x3)`
- [ ] **C-VAL-12** `checkConflicts returns empty for valid placement (9x9)`
- [ ] **C-VAL-13** `checkConflicts rejects num > boardSize (4x4, num=5)`
- [ ] **C-VAL-14** `checkConflicts uses key row*12+col for 12x12`
- [ ] **C-VAL-15** `validateMove checks against solution for each size`
- [ ] **C-VAL-16** `isBoardComplete checks all NxN cells`
- [ ] **C-VAL-17** `getRowCells default param returns 9 cells` — 하위 호환
- [ ] **C-VAL-18** `getBlockCells default params returns 9 cells` — 하위 호환

### C-5. notes.js — `tests/14-multi-size-notes-hints.spec.js` (14개)

- [ ] **C-NOT-01** `Notes constructor creates 4x4 grid`
- [ ] **C-NOT-02** `Notes constructor creates 6x6 grid`
- [ ] **C-NOT-03** `Notes constructor creates 9x9 grid (default)` — 회귀
- [ ] **C-NOT-04** `toggle within boardSize range (4x4: 1-4 OK, 5 rejected)`
- [ ] **C-NOT-05** `removeFromRelated clears row for 4x4`
- [ ] **C-NOT-06** `removeFromRelated clears col for 6x6`
- [ ] **C-NOT-07** `removeFromRelated clears 2x3 block for 6x6` — **비정사각**
- [ ] **C-NOT-08** `removeFromRelated clears 3x3 block for 9x9` — 회귀
- [ ] **C-NOT-09** `removeFromRelated clears 3x4 block for 12x12`
- [ ] **C-NOT-10** `removeFromRelated clears 4x4 block for 16x16`
- [ ] **C-NOT-11** `toJSON/fromJSON roundtrip for 4x4`
- [ ] **C-NOT-12** `toJSON/fromJSON roundtrip for 6x6`
- [ ] **C-NOT-13** `fromJSON rejects wrong-sized data (9x9 → 4x4 Notes)`
- [ ] **C-NOT-14** `fromJSON filters values > boardSize`

### C-6. hints.js (10개)

- [ ] **C-HNT-01** `findLastInRow detects single empty in row (4x4)`
- [ ] **C-HNT-02** `findLastInRow works for 6x6`
- [ ] **C-HNT-03** `findLastInCol works for 4x4`
- [ ] **C-HNT-04** `findLastInBlock detects for 6x6 (2x3)` — **비정사각**
- [ ] **C-HNT-05** `findLastInBlock iterates correct blocks for 12x12`
- [ ] **C-HNT-06** `findNakedSingle uses getCandidates with boardSize (6x6)`
- [ ] **C-HNT-07** `findDirectReveal iterates NxN cells (4x4)`
- [ ] **C-HNT-08** `getHint returns valid hint for each board size`
- [ ] **C-HNT-09** `getHint with default params works for 9x9` — 회귀
- [ ] **C-HNT-10** `getHint hint.value matches solution at hint position`

### C-7. board.js 통합 (11개)

- [ ] **C-BRD-01** `Board(4) creates 4x4 grids`
- [ ] **C-BRD-02** `Board(6) creates 6x6 grids`
- [ ] **C-BRD-03** `Board() default creates 9x9` — 회귀
- [ ] **C-BRD-04** `newGame boardSize=4 generates 4x4 puzzle`
- [ ] **C-BRD-05** `newGame boardSize=6 generates 6x6 puzzle`
- [ ] **C-BRD-06** `newGame without boardSize generates 9x9` — 회귀
- [ ] **C-BRD-07** `getState includes boardSize field`
- [ ] **C-BRD-08** `loadState restores boardSize`
- [ ] **C-BRD-09** `loadState defaults boardSize to 9 for legacy data`
- [ ] **C-BRD-10** `getNumberCount iterates correct boardSize range`
- [ ] **C-BRD-11** `Notes instance created with correct boardSize/blockSize`

---

## 5. Phase D: UI 동적화 테스트

> 신규 파일 5개 | 66개 테스트

---

### D-1. 동적 그리드 — `tests/15-dynamic-grid.spec.js` (16개)

- [ ] **D-GRD-01** `4x4 grid renders 16 cells`
- [ ] **D-GRD-02** `6x6 grid renders 36 cells`
- [ ] **D-GRD-03** `9x9 grid renders 81 cells (regression)`
- [ ] **D-GRD-04** `12x12 grid renders 144 cells`
- [ ] **D-GRD-05** `16x16 grid renders 256 cells`
- [ ] **D-GRD-06** `4x4 block-right at col=1 (mod 2)`
- [ ] **D-GRD-07** `6x6 block-right at col=2,5 (blockCols=3)`
- [ ] **D-GRD-08** `6x6 block-bottom at row=1,3 (blockRows=2)`
- [ ] **D-GRD-09** `9x9 block borders match 3x3 blocks (regression)`
- [ ] **D-GRD-10** `12x12 block-right at col=3,7,11 (blockCols=4)`
- [ ] **D-GRD-11** `16x16 block-right at col=3,7,11 (blockCols=4)`
- [ ] **D-GRD-12** `grid-template-columns = repeat(N, 1fr)`
- [ ] **D-GRD-13** `cell notes container has boardSize note spans`
- [ ] **D-GRD-14** `body[data-grid-size] matches board size`
- [ ] **D-GRD-15** `4x4 given cells have values 1-4, .given class`
- [ ] **D-GRD-16** `renderBoard correctly renders NxN board`

### D-2. 동적 숫자패드 — `tests/16-dynamic-numberpad.spec.js` (13개)

- [ ] **D-NUM-01** `4x4 game shows 4 number buttons`
- [ ] **D-NUM-02** `6x6 game shows 6 number buttons`
- [ ] **D-NUM-03** `9x9 game shows 9 number buttons (regression)`
- [ ] **D-NUM-04** `12x12 game shows 12 number buttons`
- [ ] **D-NUM-05** `16x16 game shows 16 number buttons`
- [ ] **D-NUM-06** `4x4 buttons labeled 1-4`
- [ ] **D-NUM-07** `buttons have correct data-number attributes`
- [ ] **D-NUM-08** `clicking button inputs value in selected cell (4x4)`
- [ ] **D-NUM-09** `completed number button gets completed class (4x4, count=4)`
- [ ] **D-NUM-10** `completed threshold matches boardSize (6x6, count=6)`
- [ ] **D-NUM-11** `12x12 numberpad has flex-wrap layout`
- [ ] **D-NUM-12** `16x16 numberpad has flex-wrap layout`
- [ ] **D-NUM-13** `numberpad rebuild clears and recreates buttons`

### D-3. 하이라이트 — `tests/17-multi-size-highlight.spec.js` (10개)

- [ ] **D-HLT-01** `highlights correct row for 4x4 (4 cells)`
- [ ] **D-HLT-02** `highlights correct col for 4x4 (4 cells)`
- [ ] **D-HLT-03** `highlights correct 2x2 block for 4x4`
- [ ] **D-HLT-04** `highlights correct 2x3 block for 6x6` — **비정사각**
- [ ] **D-HLT-05** `6x6 block at (1,3) covers rows 0-1, cols 3-5`
- [ ] **D-HLT-06** `same-number highlight works for 4x4`
- [ ] **D-HLT-07** `same-number iterates NxN cells (not 9x9)`
- [ ] **D-HLT-08** `clearAll removes highlights from all NxN cells`
- [ ] **D-HLT-09** `highlight dedup uses row*N+col key (12x12)`
- [ ] **D-HLT-10** `9x9 highlight works unchanged (regression)`

### D-4. CSS 크기별 스타일 (8개)

- [ ] **D-CSS-01** `4x4 cell font-size larger than 9x9`
- [ ] **D-CSS-02** `16x16 cell font-size smaller than 9x9`
- [ ] **D-CSS-03** `4x4 grid max-width is 240px`
- [ ] **D-CSS-04** `16x16 grid max-width is 100%`
- [ ] **D-CSS-05** `4x4 notes grid is 2x2`
- [ ] **D-CSS-06** `6x6 notes grid is 3x2`
- [ ] **D-CSS-07** `12x12 notes grid is 4x3`
- [ ] **D-CSS-08** `16x16 notes grid is 4x4`

### D-5. 키보드 입력 — `tests/18-multi-size-keyboard.spec.js` (13개)

- [ ] **D-KEY-01** `number keys 1-4 work for 4x4`
- [ ] **D-KEY-02** `number key 5 is ignored for 4x4`
- [ ] **D-KEY-03** `number keys 1-6 work for 6x6`
- [ ] **D-KEY-04** `number key 7 is ignored for 6x6`
- [ ] **D-KEY-05** `number keys 1-9 work for 9x9 (regression)`
- [ ] **D-KEY-06** `number keys 1-9 work for 12x12 (10+ via UI only)`
- [ ] **D-KEY-07** `arrow keys navigate within 4x4 bounds (0-3)`
- [ ] **D-KEY-08** `ArrowRight at col=3 stays at col=3 for 4x4`
- [ ] **D-KEY-09** `ArrowDown at row=5 stays at row=5 for 6x6`
- [ ] **D-KEY-10** `initial arrow position uses center of grid`
- [ ] **D-KEY-11** `Backspace erases for any board size`
- [ ] **D-KEY-12** `N key toggles notes for any board size`
- [ ] **D-KEY-13** `Escape deselects for any board size`

### D-6. 반응형 레이아웃 — `tests/19-responsive-layout.spec.js` (6개)

- [ ] **D-RES-01** `9x9 mobile layout is vertical (428x926)`
- [ ] **D-RES-02** `12x12 tablet layout shows sidebar (768x1024)`
- [ ] **D-RES-03** `16x16 tablet layout shows sidebar (768x1024)`
- [ ] **D-RES-04** `12x12 mobile layout is still vertical (428x926)`
- [ ] **D-RES-05** `4x4 grid centered and compact on mobile (max-width: 240px)`
- [ ] **D-RES-06** `16x16 cells readable on tablet (font-size > 0)`

---

## 6. Phase E: 대형 보드 최적화 테스트

> 신규 파일 2개 | 23개 테스트

---

### E-1. Web Worker — `tests/20-web-worker.spec.js` (6개)

- [ ] **E-WRK-01** `12x12 puzzle generated via Web Worker`
- [ ] **E-WRK-02** `16x16 puzzle generated via Web Worker`
- [ ] **E-WRK-03** `9x9 puzzle generated synchronously (no Worker)`
- [ ] **E-WRK-04** `4x4 puzzle generated synchronously`
- [ ] **E-WRK-05** `Worker returns valid puzzle data (board/solution/given)`
- [ ] **E-WRK-06** `Worker puzzle has unique solution`

### E-2. 로딩 UI (6개)

- [ ] **E-LOD-01** `loading overlay appears during 12x12 generation`
- [ ] **E-LOD-02** `loading overlay appears during 16x16 generation`
- [ ] **E-LOD-03** `loading overlay hidden after generation completes`
- [ ] **E-LOD-04** `loading overlay not shown for 9x9`
- [ ] **E-LOD-05** `loading message includes board size ("16x16")`
- [ ] **E-LOD-06** `loading spinner has rotation animation`

### E-3. Worker 에러 처리 (3개)

- [ ] **E-ERR-01** `Worker timeout shows error message`
- [ ] **E-ERR-02** `Worker failure allows retry`
- [ ] **E-ERR-03** `Worker terminated on game cancel (back button)`

### E-4. 성능 벤치마크 — `tests/21-performance.spec.js` (8개)

> `test.slow()` 사용, 별도 실행 권장

- [ ] **E-PERF-01** `4x4 puzzle generation under 100ms`
- [ ] **E-PERF-02** `6x6 puzzle generation under 500ms`
- [ ] **E-PERF-03** `9x9 puzzle generation under 2s`
- [ ] **E-PERF-04** `12x12 puzzle generation under 10s` — test.slow()
- [ ] **E-PERF-05** `16x16 puzzle generation under 60s` — test.slow()
- [ ] **E-PERF-06** `4x4 solve under 10ms`
- [ ] **E-PERF-07** `9x9 solve under 100ms`
- [ ] **E-PERF-08** `grid rendering under 100ms for 16x16`

---

## 7. 회귀 테스트 전략

### 7.1 Phase별 회귀 게이트

#### Phase A 완료 후

```
사전 수정: helpers.js, 01-navigation#6, 06-screens#10
게이트: 61개 기존 테스트 전체 통과
검증 포인트:
- [ ] 모든 기존 테스트가 모드 선택 화면 경유 후 정상 동작
- [ ] 기본 모드(classic) 자동 적용
- [ ] 계속하기(continue) 버튼은 모드 선택 없이 바로 game으로
```

#### Phase B 완료 후

```
사전 수정: 없음 (Phase A에서 완료)
게이트: 61개 + Phase A/B 신규 테스트 전체 통과
검증 포인트:
- [ ] 클래식 모드 기존 플로우 전체 정상
- [ ] 타임어택 통계가 클래식 통계와 분리
```

#### Phase C 완료 후

```
사전 수정: helpers.js solveEntirePuzzle()
게이트: 61개 기존 테스트 전체 통과
검증 포인트:
- [ ] 모든 기존 9x9 테스트가 boardSize=9 기본값으로 통과
- [ ] 4x4/6x6 퍼즐 생성 가능 (unit-level)
```

#### Phase D 완료 후

```
사전 수정: 09-enhanced-ui#1 (선택, page.evaluate 루프)
게이트: 61개 + 모든 신규 테스트 통과
검증 포인트:
- [ ] 동적 그리드/numberpad 후 기존 셀렉터 유효
- [ ] CSS nth-child 제거 후 블록 테두리 정상
```

#### Phase E 완료 후

```
사전 수정: 없음
게이트: 전체 테스트 통과
검증 포인트:
- [ ] 12x12 Worker 5초 이내, 16x16 Worker 30초 이내
- [ ] 기존 9x9 이하 동기 생성 성능 무영향
```

### 7.2 9x9 기본값 호환성 체크리스트

- [ ] `generatePuzzle('easy')` → boardSize=9
- [ ] `isValid(board, r, c, num)` → boardSize=9
- [ ] `getBlockCells(r, c)` → 3x3 블록
- [ ] `Board()` → boardSize=9
- [ ] `Notes()` → boardSize=9
- [ ] `getHint(board, solution, notes)` → boardSize=9
- [ ] 키보드 범위 1-9 유지
- [ ] numberpad 버튼 9개 유지

### 7.3 데이터 마이그레이션 테스트

- [ ] 기존 `sudoku_currentGame` (mode/boardSize 없음) → 기본값 적용
- [ ] 기존 `sudoku_stats` → classic 모드로 자동 인식
- [ ] `migrateStorageIfNeeded()` 정상 실행
- [ ] 빈 localStorage 첫 실행 시 마이그레이션 스킵

---

## 8. 통합 E2E 시나리오 테스트

> 12개 시나리오

### 8.1 풀 플로우 (5개)

- [ ] **INT-01** 클래식 풀 플로우: 모드 선택(classic) → 난이도(easy) → 풀이 → 완료 → 축하 메시지
- [ ] **INT-02** 타임어택 성공: 모드(timeAttack) → 10분 → 풀이 → 완료 → 보너스 점수
- [ ] **INT-03** 타임어택 실패: 모드(timeAttack) → 5분 → 시간 초과 → "시간 초과!" + confetti 없음
- [ ] **INT-04** 4x4 풀 플로우: 모드 → 4x4 → 풀이 → 완료 (16셀, 2x2 블록, 숫자패드 4개)
- [ ] **INT-05** 16x16 풀 플로우: 모드 → 16x16 → 로딩 UI → 게임 (256셀, timeout 60초)

### 8.2 모드/크기 전환 (3개)

- [ ] **INT-06** 클래식 게임 중 → 메인 → 타임어택 시작 → 뒤로 → 계속하기 → 최신 게임 복원
- [ ] **INT-07** 9x9 완료 → 4x4 완료 → 9x9 통계 보존 확인
- [ ] **INT-08** 다크 모드 + 타임어택 + 16x16 조합 — 경고 애니메이션/그리드 가독성

### 8.3 엣지 케이스 (4개)

- [ ] **INT-09** 빈 localStorage 첫 실행 → 마이그레이션 에러 없음 → 새 게임 가능
- [ ] **INT-10** 구버전 데이터 (mode/boardSize 없음) → 앱 로드 → classic/9x9 기본값
- [ ] **INT-11** 타임어택 게임 중 새로고침 → 잔여 시간 복원, 카운트다운 계속
- [ ] **INT-12** 모드 선택 화면에서 뒤로가기 → 메인 복귀, 기존 게임 무영향

---

## 9. 요약 통계

### 신규 테스트 파일

| 파일 | Phase | 테스트 수 |
|------|-------|:--:|
| `10-mode-select.spec.js` | A | 23 |
| `11-time-attack.spec.js` | B | 25 |
| `12-board-config.spec.js` | C | 14 |
| `13-multi-size-engine.spec.js` | C | 75 |
| `14-multi-size-notes-hints.spec.js` | C | 24 |
| `15-dynamic-grid.spec.js` | D | 24 |
| `16-dynamic-numberpad.spec.js` | D | 13 |
| `17-multi-size-highlight.spec.js` | D | 10 |
| `18-multi-size-keyboard.spec.js` | D | 13 |
| `19-responsive-layout.spec.js` | D | 6 |
| `20-web-worker.spec.js` | E | 15 |
| `21-performance.spec.js` | E | 8 |
| **합계** | | **250** |

### Phase별 총합

| Phase | 항목 수 | 카테고리 분포 |
|-------|:--:|------|
| A — 모드 시스템 | 23 | UI: 12, 통합: 5, 로직: 4, 엣지케이스: 2 |
| B — 타임어택 | 25 | 로직: 10, 통합: 5, UI: 5, 엣지케이스: 4, 회귀: 1 |
| C — 엔진 리팩터링 | 113 | 엔진 단위: 102, 통합: 11 |
| D — UI 동적화 | 66 | UI: 53, 통합: 13 |
| E — 대형 보드 | 23 | 성능: 8, 통합: 6, UI: 6, 에러: 3 |
| 회귀/마이그레이션 | 12 | 회귀: 8, 마이그레이션: 4 |
| 통합 시나리오 | 12 | E2E: 12 |
| **총계** | **274** | |

### 기존 테스트 수정

| 대상 | 수정 내용 | Phase |
|------|----------|-------|
| `helpers.js` `startNewGame()` | 모드 선택 화면 경유 | A |
| `helpers.js` `solveEntirePuzzle()` | boardSize 동적 참조 | C |
| `01-navigation#6` | 난이도 모달 플로우 변경 | A |
| `06-screens#10` | 난이도 모달 플로우 변경 | A |
| **나머지 57개** | **수정 불필요** (기본값 호환) | - |

### 보드 크기별 특수 테스트

| 크기 | 블록 | 정사각 | 집중 테스트 ID |
|------|------|:--:|------|
| 4x4 | 2x2 | O | 기본 케이스 |
| **6x6** | **2x3** | **X** | **C-SOL-05~06, C-VAL-04~05, C-NOT-07, C-HNT-04, D-GRD-07~08, D-HLT-04~05** |
| 9x9 | 3x3 | O | 회귀 (기존 61개) |
| 12x12 | 3x4 | X | C-VAL-07, C-GEN-16, C-NOT-09, E-WRK-01 |
| 16x16 | 4x4 | O | E-PERF-05, E-WRK-02, D-RES-03/06 |

---

> 이 문서는 에이전트 팀 (Phase A/B 분석기 + Phase C/D/E 분석기 + 회귀 테스트 분석기)이 기존 9개 테스트 파일(61개 테스트)과 소스코드를 분석하여 작성되었습니다.
