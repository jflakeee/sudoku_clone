# F4 - 과거 플레이 재도전 모드 설계문서

> 작성일: 2026-02-28
> 기능 ID: F4
> 의존성: 공통 인프라 (게임 히스토리 아카이브)

---

## 1. 기능 정의

### 1.1 사용자 스토리
- 사용자는 이전에 완료한 퍼즐을 다시 플레이할 수 있다.
- 동일한 퍼즐(같은 빈칸 배치)이 제공되어 더 나은 점수/시간에 도전할 수 있다.
- 완료한 게임의 모드, 난이도, 점수, 소요시간을 목록에서 확인할 수 있다.

### 1.2 범위
- 성공한 게임만 아카이브 (타임어택 실패 제외)
- 재도전 시 기존 모드(클래식/타임어택) 유지
- 재도전 결과도 통계에 반영
- 재도전 결과도 히스토리에 추가 저장

### 1.3 범위 외
- 게임 리플레이 (수 순서 재생) - 미포함
- 미완료 게임 아카이브 - 미포함
- 다른 사용자와 기록 비교 - 미포함

---

## 2. 사용자 플로우

```
[메인 화면]
    │
    ▼ "게임 기록" 버튼 클릭
[screen-history]
    │
    ├── 필터 탭: 전체 / 클래식 / 타임어택 / 일일도전
    │
    ├── 게임 목록 (최신순)
    │   ├── 항목: 날짜, 모드, 크기, 난이도, 점수, 시간
    │   ├── [재도전] 버튼 → game 화면 (replay 모드)
    │   └── [인쇄] 버튼 → print 화면
    │
    └── 빈 상태: "완료한 게임이 없습니다."
```

---

## 3. 수정 파일 상세

### 3.1 index.html - 메인 화면 버튼 추가

위치: `screen-main > .main-content` 내부, `.btn-new-game` 뒤

```html
<button class="btn btn-secondary btn-history" data-navigate="history">
  게임 기록
</button>
```

### 3.2 index.html - screen-history 화면 추가

위치: `screen-rules` 뒤, `difficulty-modal` 앞

```html
<div id="screen-history" class="screen">
  <div class="sub-header">
    <button class="icon-btn btn-back" data-action="back" aria-label="뒤로가기">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
    </button>
    <h2 class="sub-title">게임 기록</h2>
    <div class="sub-header-right"></div>
  </div>

  <div class="history-filters" id="history-filters">
    <button class="history-filter active" data-filter="all">전체</button>
    <button class="history-filter" data-filter="classic">클래식</button>
    <button class="history-filter" data-filter="timeAttack">타임어택</button>
    <button class="history-filter" data-filter="daily">일일 도전</button>
  </div>

  <div class="history-list" id="history-list"></div>

  <div class="history-empty" id="history-empty" style="display:none;">
    <p>완료한 게임이 없습니다.</p>
  </div>
</div>
```

### 3.3 screens/history.js (신규)

```
파일 위치: src/js/screens/history.js
예상 줄 수: ~180줄
```

**모듈 구조:**
```javascript
// 의존성
import { loadGameHistory, getGameHistoryById } from '../utils/storage.js';

// 상수
const DIFFICULTY_LABELS = { easy: '쉬움', normal: '보통', ... };
const ITEMS_PER_PAGE = 20;  // 무한 스크롤 단위

// 모듈 상태
let _app = null;
let _currentFilter = 'all';
let _displayedCount = 0;

// 공개 함수
export function initHistoryScreen(app) { ... }

// 내부 함수
function onShow() { ... }
function renderList(filter) { ... }
function renderHistoryItem(entry) { ... }
function onReplayClick(entryId) { ... }
function onPrintClick(entryId) { ... }
function formatTime(seconds) { ... }
```

**핵심 로직:**

1. `initHistoryScreen(app)`:
   - DOM 참조 캐시
   - 필터 탭 클릭 이벤트 등록
   - `screen-show` 이벤트 리스너 (screen === 'history')
   - 목록 이벤트 위임 (replay/print 버튼)

2. `renderList(filter)`:
   - `loadGameHistory()` 호출
   - 필터 적용: `all` | `classic` | `timeAttack` | `daily` (dailyDate !== null)
   - 최신순 정렬 (이미 저장 시 unshift)
   - `ITEMS_PER_PAGE` 만큼 렌더링
   - 빈 상태 표시/숨김

3. `onReplayClick(entryId)`:
   - `getGameHistoryById(entryId)` 조회
   - `_app.navigate('game', { replay: true, ... })` 호출

### 3.4 game.js 확장

위치: `onShow()` 함수 내 (189행), `params.loadSaved` 분기 전에 추가

```javascript
if (params.replay && params.puzzle) {
    startReplayGame(params);
    return;
}
```

신규 함수 `startReplayGame(params)` (~30줄):
- `_app.board.newGameFromPuzzle(puzzle, solution, given, difficulty, mode, options)` 호출
- UI 초기화 (GridUI.rebuild, NumberpadUI.rebuild 등)
- 타임어택인 경우 카운트다운 설정
- 타이머 틱 콜백 설정
- `resetGameUI()` + `renderFullGrid()` + `updateGamesStarted()`

### 3.5 board.js 확장

신규 메서드 `newGameFromPuzzle()` (~30줄):
- 퍼즐/솔루션/given deep copy
- 상태 초기화 (score=0, mistakes=0, hints=3)
- 모드/난이도 설정
- 타이머 리셋 + 시작

신규 필드 `_initialPuzzle`:
- `newGame()` 에서 생성 직후 deep copy 저장
- `newGameFromPuzzle()` 에서 파라미터 deep copy 저장
- `toJSON()` 에 포함
- `loadState()` 에서 복원

### 3.6 app.js 확장

```javascript
import { initHistoryScreen } from './screens/history.js';

// init() 내부
initHistoryScreen(app);
```

### 3.7 CSS 스타일 (screens.css 추가)

```css
/* History screen */
.history-filters {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    overflow-x: auto;
}

.history-filter {
    padding: 6px 14px;
    border-radius: 20px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-secondary);
    font-size: 0.85rem;
    white-space: nowrap;
    cursor: pointer;
}

.history-filter.active {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
}

.history-list {
    padding: 0 16px;
}

.history-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid var(--border-light);
}

.history-item-info {
    flex: 1;
}

.history-item-top {
    display: flex;
    gap: 8px;
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-bottom: 4px;
}

.history-item-bottom {
    display: flex;
    gap: 12px;
    font-size: 0.9rem;
}

.history-item-actions {
    display: flex;
    gap: 6px;
}

.btn-sm {
    padding: 4px 10px;
    font-size: 0.8rem;
    border-radius: 6px;
}

.history-empty {
    text-align: center;
    padding: 60px 16px;
    color: var(--text-secondary);
}
```

---

## 4. 엣지 케이스

| 상황 | 처리 |
|------|------|
| 히스토리 비어있음 | "완료한 게임이 없습니다." 빈 상태 표시 |
| 200개 초과 | FIFO로 오래된 항목 자동 삭제 |
| 12×12/16×16 재도전 | Web Worker 생성 우회, 직접 퍼즐 로드 (생성 불필요) |
| 재도전 중 앱 종료 | 일반 게임과 동일 자동저장 작동 |
| 재도전 후 다시 재도전 | 동일 퍼즐로 히스토리에 새 항목 추가 |
| LocalStorage 용량 부족 | try/catch 에서 조용히 실패, 게임은 계속 작동 |
| 히스토리 데이터 손상 | `loadGameHistory()` 에서 빈 배열 반환 |

---

## 5. 접근성

- 필터 탭: `role="tablist"`, 각 탭 `role="tab"`, `aria-selected`
- 목록: `role="list"`, 각 항목 `role="listitem"`
- 버튼: `aria-label` 포함
- 키보드: Tab 키로 목록 항목 간 이동, Enter로 재도전/인쇄

---

## 6. 성능 고려사항

- 히스토리 200개 로딩 시간: JSON.parse < 5ms (측정 필요)
- 초기 렌더링: 20개만 표시, 스크롤 시 추가 로드 (가상 스크롤 불필요 수준)
- 메모리: 200개 × ~2KB = ~400KB (9×9 기준)
