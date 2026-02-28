# F6 - 인쇄모드 설계문서

> 작성일: 2026-02-28
> 기능 ID: F6
> 의존성: 공통 인프라 (게임 히스토리 아카이브), F4 (히스토리 화면)

---

## 1. 기능 정의

### 1.1 사용자 스토리
- 사용자는 완료한 퍼즐을 A4 용지에 인쇄할 수 있다.
- 1개 퍼즐을 A4 전체에 크게 인쇄하거나, 4개를 모아서 인쇄할 수 있다.
- 인쇄 시 퍼즐의 초기 상태(빈칸)만 표시되어 종이에서 다시 풀 수 있다.
- 퍼즐 상단에 날짜, 난이도, 보드 크기 정보가 표시된다.

### 1.2 범위
- A4 portrait 레이아웃
- 단일 인쇄 (1 퍼즐/페이지)
- 모아찍기 (4 퍼즐/페이지, 2×2 그리드)
- 지원 보드: 4×4 ~ 16×16 (단, 4개 모아찍기는 12×12 이하 권장)
- 정답 별도 인쇄 옵션

### 1.3 범위 외
- PDF 내보내기 (window.print()의 PDF 저장으로 대체)
- 커스텀 용지 크기
- 가로 방향 인쇄
- 해결된 퍼즐 인쇄 (정답 포함)

---

## 2. 사용자 플로우

### 2.1 히스토리에서 진입 (단일 인쇄)

```
[screen-history]
    │
    ▼ 게임 항목의 [인쇄] 버튼 클릭
[screen-print]
    │
    ├── 레이아웃: [1개 A4] / 4개 모아찍기
    ├── 미리보기: 퍼즐 그리드 표시
    │
    ▼ [인쇄하기] 클릭
window.print() → 브라우저 인쇄 대화상자
```

### 2.2 히스토리에서 진입 (4개 모아찍기)

```
[screen-history]
    │
    ▼ [다중 선택] 모드 활성화 → 최대 4개 체크
    ▼ [선택 인쇄] 버튼 클릭
[screen-print]
    │
    ├── 레이아웃: 1개 A4 / [4개 모아찍기]
    ├── 미리보기: 2×2 그리드로 4개 퍼즐 표시
    │
    ▼ [인쇄하기] 클릭
window.print()
```

### 2.3 일일 도전에서 진입

```
[screen-daily]
    │
    ▼ 완료된 날짜 선택 → [인쇄] 버튼 표시
[screen-print] (해당 일일 퍼즐 1개)
```

---

## 3. 신규 파일

### 3.1 screens/print.js (~150줄)

```javascript
/**
 * Print Screen Controller
 *
 * Renders puzzle grids for printing with A4 layout options.
 *
 * @module screens/print
 */

import { getGameHistoryById } from '../utils/storage.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIFFICULTY_LABELS = {
    easy: '쉬움', normal: '보통', hard: '어려움',
    expert: '전문가', master: '마스터',
};

// Block size mapping (boardSize → { rows, cols })
const BLOCK_SIZES = {
    4: { rows: 2, cols: 2 },
    6: { rows: 2, cols: 3 },
    9: { rows: 3, cols: 3 },
    12: { rows: 3, cols: 4 },
    16: { rows: 4, cols: 4 },
};

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let _app = null;
let _entries = [];       // 인쇄 대상 GameHistoryEntry[]
let _layout = 'single';  // 'single' | 'quad'

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------

let screenEl = null;
let previewEl = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function initPrintScreen(app) {
    _app = app;
    screenEl = document.getElementById('screen-print');
    if (!screenEl) return;

    previewEl = document.getElementById('print-preview');

    // 레이아웃 선택 버튼
    screenEl.querySelectorAll('.print-layout-option').forEach(btn => {
        btn.addEventListener('click', () => {
            screenEl.querySelectorAll('.print-layout-option')
                .forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _layout = btn.dataset.layout;
            renderPreview();
        });
    });

    // 인쇄 버튼
    const printBtn = screenEl.querySelector('[data-action="do-print"]');
    if (printBtn) {
        printBtn.addEventListener('click', () => window.print());
    }

    // screen-show 리스너
    document.addEventListener('screen-show', (e) => {
        const detail = e.detail;
        if (detail.screen === 'print') {
            onShow(detail.params || {});
        }
    });
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

function onShow(params) {
    // params.entries: GameHistoryEntry[] 또는
    // params.entryIds: string[] (히스토리 ID 목록)
    if (params.entries) {
        _entries = params.entries;
    } else if (params.entryIds) {
        _entries = params.entryIds
            .map(id => getGameHistoryById(id))
            .filter(Boolean);
    } else {
        _entries = [];
    }

    _layout = _entries.length > 1 ? 'quad' : 'single';

    // 레이아웃 버튼 상태 동기화
    screenEl.querySelectorAll('.print-layout-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.layout === _layout);
    });

    renderPreview();
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderPreview() {
    if (!previewEl) return;
    previewEl.innerHTML = '';

    if (_entries.length === 0) {
        previewEl.innerHTML = '<p class="print-empty">인쇄할 퍼즐이 없습니다.</p>';
        return;
    }

    if (_layout === 'quad') {
        const wrapper = document.createElement('div');
        wrapper.className = 'print-preview-quad';
        const items = _entries.slice(0, 4);
        items.forEach(entry => {
            wrapper.appendChild(createPrintGrid(entry, 'small'));
        });
        previewEl.appendChild(wrapper);
    } else {
        _entries.forEach(entry => {
            previewEl.appendChild(createPrintGrid(entry, 'large'));
        });
    }
}

function createPrintGrid(entry, size) {
    const container = document.createElement('div');
    container.className = `print-grid print-grid-${size}`;

    // 헤더
    const header = document.createElement('div');
    header.className = 'print-grid-header';
    const dateLabel = entry.dailyDate
        || new Date(entry.completedAt).toLocaleDateString('ko-KR');
    const diffLabel = DIFFICULTY_LABELS[entry.difficulty] || entry.difficulty;
    header.textContent =
        `${dateLabel}  |  ${diffLabel}  |  ${entry.boardSize}×${entry.boardSize}`;
    container.appendChild(header);

    // 테이블
    const table = document.createElement('table');
    table.className = 'print-sudoku-table';
    const bs = entry.boardSize;
    const block = BLOCK_SIZES[bs] || { rows: 3, cols: 3 };

    for (let r = 0; r < bs; r++) {
        const tr = document.createElement('tr');
        for (let c = 0; c < bs; c++) {
            const td = document.createElement('td');
            td.className = 'print-cell';

            if (r > 0 && r % block.rows === 0) td.classList.add('block-top');
            if (c > 0 && c % block.cols === 0) td.classList.add('block-left');

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

### 3.2 css/print.css (~120줄)

```css
/* ===== 인쇄 미리보기 (화면) ===== */

.print-layout-options {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    justify-content: center;
}

.print-layout-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 20px;
    border: 2px solid var(--border);
    border-radius: 12px;
    background: transparent;
    cursor: pointer;
    transition: border-color 0.2s;
}

.print-layout-option.active {
    border-color: var(--primary);
    background: var(--primary-light, rgba(41, 121, 255, 0.08));
}

.layout-icon {
    font-size: 1.5rem;
}

.layout-label {
    font-size: 0.85rem;
}

.print-preview {
    padding: 16px;
}

.print-preview-quad {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.print-grid-header {
    text-align: center;
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-bottom: 8px;
}

.print-sudoku-table {
    width: 100%;
    border-collapse: collapse;
    border: 2px solid var(--text-primary);
    table-layout: fixed;
}

.print-cell {
    border: 1px solid var(--border);
    text-align: center;
    vertical-align: middle;
    aspect-ratio: 1;
    font-size: clamp(0.7rem, 2vw, 1rem);
}

.print-cell.given {
    font-weight: bold;
}

.print-cell.block-top {
    border-top: 2px solid var(--text-primary);
}

.print-cell.block-left {
    border-left: 2px solid var(--text-primary);
}

.print-empty {
    text-align: center;
    padding: 40px;
    color: var(--text-secondary);
}

/* ===== @media print ===== */

@media print {
    /* 화면 요소 숨기기 */
    #app > *:not(#screen-print),
    #navbar,
    #screen-print > .sub-header,
    #screen-print > .print-layout-options,
    #screen-print > .print-puzzle-select {
        display: none !important;
    }

    #screen-print {
        position: static !important;
        overflow: visible !important;
        padding: 0 !important;
    }

    .print-preview {
        padding: 0 !important;
    }

    /* 페이지 설정 */
    @page {
        size: A4 portrait;
        margin: 15mm;
    }

    /* 단일 퍼즐 */
    .print-grid-large {
        width: 100%;
        max-width: 170mm;
        margin: 0 auto;
        page-break-after: always;
    }

    .print-grid-large .print-cell {
        font-size: 16pt;
        height: 18mm;
    }

    /* 4개 모아찍기 */
    .print-preview-quad {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8mm;
    }

    .print-grid-small .print-cell {
        font-size: 9pt;
        height: 8mm;
    }

    /* 인쇄용 색상 */
    .print-cell {
        border-color: #999 !important;
        color: #000 !important;
    }

    .print-cell.block-top {
        border-top-color: #333 !important;
        border-top-width: 2pt !important;
    }

    .print-cell.block-left {
        border-left-color: #333 !important;
        border-left-width: 2pt !important;
    }

    .print-sudoku-table {
        border-color: #333 !important;
        border-width: 2pt !important;
    }

    .print-grid-header {
        color: #333 !important;
        font-size: 10pt;
    }

    .print-cell.given {
        color: #000 !important;
        font-weight: bold;
    }
}
```

---

## 4. index.html 추가

위치: `screen-history` 뒤

```html
<!-- ===== Print Screen ===== -->
<div id="screen-print" class="screen">
  <div class="sub-header">
    <button class="icon-btn btn-back" data-action="back" aria-label="뒤로가기">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
    </button>
    <h2 class="sub-title">인쇄</h2>
    <div class="sub-header-right">
      <button class="btn btn-text" data-action="do-print">인쇄하기</button>
    </div>
  </div>

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

  <div class="print-preview" id="print-preview"></div>
</div>
```

---

## 5. A4 레이아웃 상세

### 5.1 단일 퍼즐 (1개/A4)

```
┌─────────────────────────────────┐
│           A4 (210×297mm)        │
│  margin: 15mm                   │
│  ┌───────────────────────────┐  │
│  │  2026-02-28 | 보통 | 9×9  │  │ ← 헤더 (10pt)
│  │                           │  │
│  │  ┌─────┬─────┬─────┐     │  │
│  │  │ 5 · │ · 3 │ · · │     │  │
│  │  │ · · │ 1 9 │ 5 · │     │  │
│  │  │ · 9 │ 8 · │ · 6 │     │  │ ← 9×9 그리드
│  │  ├─────┼─────┼─────┤     │  │    셀 크기: ~18mm
│  │  │ 8 · │ · 6 │ · · │     │  │    글자 크기: 16pt
│  │  │ 4 · │ 8 · │ 3 · │     │  │
│  │  │ · · │ · 2 │ · 1 │     │  │
│  │  ├─────┼─────┼─────┤     │  │
│  │  │ · 6 │ · · │ 2 8 │     │  │
│  │  │ · · │ 4 1 │ 9 · │     │  │
│  │  │ · · │ · 8 │ · 7 │     │  │
│  │  └─────┴─────┴─────┘     │  │
│  │                           │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### 5.2 모아찍기 (4개/A4)

```
┌─────────────────────────────────┐
│           A4 (210×297mm)        │
│  margin: 15mm                   │
│  ┌────────────┬────────────┐   │
│  │ 헤더       │ 헤더       │   │
│  │ ┌───┬───┐  │ ┌───┬───┐  │   │
│  │ │   │   │  │ │   │   │  │   │
│  │ ├───┼───┤  │ ├───┼───┤  │   │ ← 셀 크기: ~8mm
│  │ │   │   │  │ │   │   │  │   │    글자 크기: 9pt
│  │ └───┴───┘  │ └───┴───┘  │   │
│  ├────────────┼────────────┤   │
│  │ 헤더       │ 헤더       │   │
│  │ ┌───┬───┐  │ ┌───┬───┐  │   │
│  │ │   │   │  │ │   │   │  │   │
│  │ ├───┼───┤  │ ├───┼───┤  │   │
│  │ │   │   │  │ │   │   │  │   │
│  │ └───┴───┘  │ └───┴───┘  │   │
│  └────────────┴────────────┘   │
└─────────────────────────────────┘
```

---

## 6. 보드 크기별 인쇄 가이드라인

| 보드 | 단일 셀 크기 | 글자 크기 | 4개 셀 크기 | 4개 글자 | 모아찍기 |
|------|:-----------:|:--------:|:----------:|:-------:|:-------:|
| 4×4 | 40mm | 24pt | 18mm | 14pt | 가능 |
| 6×6 | 28mm | 20pt | 13mm | 11pt | 가능 |
| 9×9 | 18mm | 16pt | 8mm | 9pt | 가능 |
| 12×12 | 14mm | 12pt | 6mm | 7pt | 가능 (작음) |
| 16×16 | 10mm | 10pt | 4.5mm | 5pt | **권장하지 않음** |

→ 16×16 모아찍기 시 경고 메시지 표시:
```
"16×16 보드는 모아찍기 시 글씨가 매우 작습니다."
```

---

## 7. 엣지 케이스

| 상황 | 처리 |
|------|------|
| 선택 퍼즐 0개 | "인쇄할 퍼즐이 없습니다." 표시, 인쇄 버튼 비활성화 |
| 4개 모아찍기인데 1~3개만 선택 | 빈 칸은 비워둠 (빈 그리드 공간) |
| 16×16 모아찍기 | 경고 표시, 인쇄는 허용 |
| 혼합 보드 크기 모아찍기 (9×9 + 4×4) | 각 그리드 독립 렌더링 |
| 다크 모드에서 인쇄 | @media print에서 흰 배경 + 검정 글씨 강제 |
| 브라우저 인쇄 → PDF 저장 | CSS @media print 동일 적용 |
| Safari 인쇄 | WebKit 호환 확인 필요 |
| 모바일 인쇄 | 모바일 브라우저 인쇄 지원 제한적, "데스크톱에서 인쇄 권장" 안내 |

---

## 8. 접근성

- 인쇄 미리보기: 시각적 표현이므로 `aria-hidden="true"` 가능
- 인쇄 버튼: `aria-label="퍼즐 인쇄하기"`
- 레이아웃 선택: `role="radiogroup"`, 각 옵션 `role="radio"`

---

## 9. 브라우저 호환성

| 브라우저 | @media print | @page | window.print() |
|---------|:------------:|:-----:|:--------------:|
| Chrome 90+ | ✅ | ✅ | ✅ |
| Edge 90+ | ✅ | ✅ | ✅ |
| Firefox 90+ | ✅ | 부분 | ✅ |
| Safari 15+ | ✅ | 부분 | ✅ |

Firefox/Safari에서 `@page { size: A4 }` 미지원 가능
→ 수동 여백 조정으로 대응 (margin: 15mm 기본값)
