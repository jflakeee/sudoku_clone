# 스도쿠 리그 - 기능추가 종합 설계문서

> 작성일: 2026-02-28
> 대상 버전: v2 (현재 v1 기반)
> 참조: docs/idea_20260228.txt

---

## 1. 개요

### 1.1 배경
현재 스도쿠 리그는 클래식/타임어택 모드와 일일 도전 기능을 제공한다.
사용자 경험을 확장하기 위해 3가지 신규 기능을 추가한다.

### 1.2 추가 기능 목록

| ID | 기능명 | 설명 |
|----|--------|------|
| F4 | 과거 플레이 재도전 | 완료한 게임을 동일 퍼즐로 다시 플레이 |
| F5 | 일자별 플레이 확장 | 날짜 선택(미래 포함)으로 일자별 퍼즐 플레이 |
| F6 | 인쇄모드 | 플레이한 퍼즐을 A4 용지에 인쇄 (1개/4개) |

### 1.3 공통 선행 요건
세 기능 모두 **완료 게임 아카이브(Game History Archive)** 저장소에 의존한다.
현재 시스템은 게임 완료 시 `clearGame()`으로 저장 데이터를 삭제하므로,
완료된 퍼즐의 초기 상태를 별도로 보관하는 아카이브 레이어가 필요하다.

---

## 2. 현재 아키텍처 요약

### 2.1 기술 스택
- 바닐라 JavaScript (ES Module)
- CSS (4개 파일 분리: main, grid, animations, screens)
- LocalStorage 기반 데이터 영속화
- Service Worker (오프라인 캐시)
- Playwright E2E 테스트 (81개)

### 2.2 주요 모듈 구조

```
src/js/
├── app.js              ← 라우터/네비게이션 (583줄)
├── core/               ← 퍼즐 생성·검증·점수 엔진
├── game/               ← Board 상태, Timer, History, Notes, Input
├── ui/                 ← GridUI, HighlightUI, NumberpadUI, ToolbarUI
├── utils/              ← storage.js, daily-seed.js, sound.js
└── screens/            ← 화면별 컨트롤러 (main, game, complete, daily 등)
```

### 2.3 네비게이션 흐름 (현재)

```
main ──→ mode-select ──→ difficulty-modal ──→ game ──→ complete ──→ main/mode-select
main ──→ daily ──→ game ──→ complete
main ──→ game (loadSaved=true)
main ──→ profile ──→ stats/awards/settings/tutorial/rules
```

### 2.4 저장소 키 (현재)

| 키 | 용도 | 데이터 타입 |
|----|------|-------------|
| `sudoku_currentGame` | 진행 중 게임 상태 | Object (JSON) |
| `sudoku_stats` | 클래식 모드 통계 | Object (난이도별) |
| `sudoku_stats_timeAttack` | 타임어택 통계 | Object (난이도별) |
| `sudoku_settings` | 사용자 설정 | Object |
| `sudoku_dailyChallenge` | 일일 도전 진행 | `{completed: string[], streak: number}` |
| `sudoku_version` | 마이그레이션 버전 | Number (현재 1) |

---

## 3. 신규 아키텍처 설계

### 3.1 네비게이션 확장

```
main ──→ mode-select ──→ ...  (기존)
main ──→ daily ──→ game       (기존 + F5 미래날짜 허용)
main ──→ history ──→ game     (F4 신규)
main ──→ daily ──→ print      (F6 신규, daily에서 인쇄버튼)
main ──→ history ──→ print    (F6 신규, history에서 인쇄버튼)
```

### 3.2 신규 화면

| 화면 ID | 파일 | 목적 |
|---------|------|------|
| `screen-history` | `screens/history.js` | 과거 게임 목록 표시 + 재도전/인쇄 진입 |
| `screen-print` | `screens/print.js` | 인쇄 미리보기 + A4 레이아웃 + window.print() |

### 3.3 저장소 확장

| 키 | 용도 | 데이터 타입 |
|----|------|-------------|
| `sudoku_gameHistory` | 완료 게임 아카이브 | `GameHistoryEntry[]` (최대 200개) |

```javascript
/** @typedef {Object} GameHistoryEntry
 * @property {string}    id          - UUID 또는 타임스탬프 기반 고유 ID
 * @property {string}    date        - 완료 일시 (ISO 8601)
 * @property {string}    difficulty  - 난이도 키
 * @property {string}    mode        - 'classic' | 'timeAttack'
 * @property {number}    boardSize   - 4 | 6 | 9 | 12 | 16
 * @property {number}    score       - 최종 점수
 * @property {number}    time        - 소요 시간 (초)
 * @property {number}    mistakes    - 실수 횟수
 * @property {boolean}   success     - 완료 성공 여부
 * @property {string|null} dailyDate - 일일 도전 날짜 (null이면 일반 게임)
 * @property {number[][]} puzzle     - 초기 퍼즐 상태 (빈칸=0)
 * @property {number[][]} solution   - 정답
 * @property {boolean[][]} given     - 주어진 셀 마스크
 */
```

### 3.4 스토리지 마이그레이션 (v1 → v2)

```javascript
// storage.js - migrateStorageIfNeeded() 확장
if (storedVersion < 2) {
    // gameHistory 키 초기화 (기존 데이터 없으므로 빈 배열)
    if (!readJSON('sudoku_gameHistory')) {
        writeJSON('sudoku_gameHistory', []);
    }
}
```

### 3.5 스토리지 용량 관리

LocalStorage 5MB 한도를 고려한 설계:
- 9×9 퍼즐 1개 ≈ 2KB (puzzle + solution + given + 메타데이터)
- 최대 200개 = 약 400KB (안전 범위)
- FIFO 방식: 200개 초과 시 가장 오래된 항목 삭제
- 12×12/16×16 퍼즐은 데이터가 크므로 최대 100개로 별도 제한

---

## 4. 기능별 설계 요약

### 4.1 F4 - 과거 플레이 재도전 모드

**목적**: 이전에 완료한 퍼즐을 동일한 초기 상태로 다시 플레이

**주요 흐름**:
1. 게임 완료 시 `complete.js`에서 아카이브에 퍼즐 데이터 저장
2. 메인 화면에 "기록" 버튼 추가 → `screen-history` 진입
3. 히스토리 목록에서 게임 선택 → 재도전 또는 인쇄
4. 재도전 시 `navigate('game', { replay: true, historyEntry })` → 동일 퍼즐 시작

**영향 파일**: `storage.js`, `complete.js`, `app.js`, `index.html`, 신규 `history.js`

### 4.2 F5 - 일자별 플레이 모드 확장

**목적**: 미래 날짜 포함 모든 날짜의 일일 퍼즐 플레이 가능

**주요 변경**:
1. `daily.js` renderCalendar(): `isFuture` 판정 제거 → 모든 날짜 클릭 가능
2. 미래 날짜는 시각적으로 구분 (아이콘/색상)하되 플레이 가능
3. `daily-seed.js`는 변경 불필요 (이미 임의 Date 파라미터 지원)

**영향 파일**: `daily.js` (약 10줄 수정)

### 4.3 F6 - 인쇄모드

**목적**: 완료한 퍼즐을 A4 용지에 인쇄 (1개 또는 4개 모아찍기)

**주요 흐름**:
1. 히스토리 또는 일일도전 화면에서 인쇄할 퍼즐 선택
2. `screen-print` 진입 → 인쇄 레이아웃 선택 (1개/4개)
3. Canvas 또는 CSS Grid로 퍼즐 렌더링
4. `@media print` CSS로 A4 최적화 + `window.print()` 호출

**신규 파일**: `screens/print.js`, `css/print.css`
**영향 파일**: `app.js`, `index.html`

---

## 5. 구현 우선순위

```
Phase 1: 공통 인프라
  ├── 게임 히스토리 아카이브 (storage.js)
  ├── 스토리지 마이그레이션 v1→v2
  └── complete.js에서 아카이브 저장 로직

Phase 2: F5 - 일자별 플레이 확장 (최소 변경, 빠른 완성)
  └── daily.js 미래날짜 허용

Phase 3: F4 - 과거 플레이 재도전
  ├── screen-history HTML/CSS/JS
  ├── 히스토리 목록 UI
  └── 재도전 로직 (game.js 확장)

Phase 4: F6 - 인쇄모드
  ├── screen-print HTML/CSS/JS
  ├── print.css (@media print)
  ├── 퍼즐 렌더링 (Canvas/CSS Grid)
  └── A4 1개/4개 레이아웃

Phase 5: 통합 테스트 & 서비스 워커 업데이트
  ├── sw.js 캐시 리스트 업데이트
  ├── Playwright 테스트 추가
  └── 크로스 브라우저 인쇄 테스트
```

---

## 6. 비기능 요구사항

| 항목 | 요구사항 |
|------|---------|
| 성능 | 히스토리 목록 200개 로딩 < 100ms |
| 저장 용량 | LocalStorage 사용량 1MB 이내 |
| 호환성 | Chrome 90+, Safari 15+, Firefox 90+ |
| 인쇄 | Chrome/Edge `window.print()` 지원 |
| 접근성 | 키보드 탐색, aria-label 유지 |
| 기존 테스트 | 81개 Playwright 테스트 유지 (regression 없음) |

---

## 7. 리스크 및 완화 방안

| 리스크 | 영향 | 완화 방안 |
|--------|------|----------|
| LocalStorage 용량 초과 | 데이터 손실 | FIFO 200개 제한 + try/catch |
| 대형 보드(16×16) 인쇄 | 글씨 작아짐 | 4개 모아찍기에서 대형 보드 제외 |
| 서비스 워커 캐시 | 신규 파일 미반영 | sw.js 캐시 리스트 업데이트 필수 |
| 미래날짜 시드 변경 | 다른 퍼즐 생성 가능 | daily-seed.js 해시 알고리즘 고정 (DJB2) |
| 브라우저 인쇄 차이 | 레이아웃 깨짐 | @media print 별도 스타일시트 |
