# 스도쿠 리그 - 상세 구현 체크리스트 (23개 기능)

> 작성일: 2026-03-03
> 기반 코드 분석: validator.js, solver.js, board.js, notes.js, hints.js, grid.js, highlight.js, mode-select.js, complete.js, settings.js, storage.js, achievements.js, scorer.js, daily-seed.js, generator.js, puzzle-worker.js, board-config.js, app.js, index.html, themes.css

---

## Phase 1: 새로운 변형 규칙 (6개)

---

### Phase 1-1: Anti-Knight 변형

> 나이트(체스)가 이동할 수 있는 위치에 같은 숫자 불가

#### 코어 로직
- [ ] `src/js/core/validator.js`: `getKnightCells(row, col, boardSize)` 함수 신규 추가 — 나이트 오프셋 `[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]`로 범위 내 셀 반환
- [ ] `src/js/core/validator.js`: `checkConflicts()` (L104) — `variant === 'anti-knight'` 분기 추가, `getKnightCells()` 결과에 대해 `check(r, c)` 호출
- [ ] `src/js/core/solver.js`: `isValid()` (L25) — `variant === 'anti-knight'` 분기 추가, 나이트 오프셋 위치 검사
- [ ] `src/js/core/solver.js`: `getCandidates()` (L74) — variant 인자 이미 전달되므로 `isValid` 변경만으로 자동 적용
- [ ] `src/js/core/generator.js`: `generateCompleteBoard()` (L79), `removeCells()` (L126) — variant 인자 이미 전달되므로 자동 적용
- [ ] `src/js/core/puzzle-worker.js`: `isValid()` (L40) — 인라인 복사본에 anti-knight 나이트 오프셋 검사 추가

#### 게임 상태
- [ ] `src/js/game/board.js`: `Board.variant` (L105) — 'anti-knight' 값 지원 (기존 `'standard'|'diagonal'`에 추가)
- [ ] `src/js/game/notes.js`: `removeFromRelated()` (L95) — `variant === 'anti-knight'` 분기 추가, 나이트 위치 셀 메모에서도 숫자 삭제

#### 힌트
- [ ] `src/js/game/hints.js`: `findNakedSingle()` (L235) — variant 인자 이미 solver.getCandidates에 전달되므로 자동 적용
- [ ] `src/js/game/hints.js`: `getHint()` (L53) — anti-knight에 대한 추가 힌트 전략은 선택사항 (기존 fallback으로 충분)

#### UI
- [ ] `src/js/ui/grid.js`: `_buildGrid()` (L292) — `variant === 'anti-knight'` 시 시각적 표시는 선택사항 (나이트 이동 범위가 고정이 아니므로 하이라이트 시에만 표시)
- [ ] `src/js/ui/highlight.js`: `highlightSelection()` (L79) — `variant === 'anti-knight'` 시 `getKnightCells()` 결과를 `relatedCells`에 추가
- [ ] `src/index.html`: `.variant-options` (L113~L122) — anti-knight variant-option 버튼 추가: `<button class="variant-option" data-variant="anti-knight"><span class="mode-name">나이트</span><span class="mode-desc">+ 나이트 규칙</span></button>`
- [ ] `src/js/screens/mode-select.js`: 기존 variantOptions 이벤트 핸들러 (L68~L74) — data-variant 값으로 자동 처리되므로 변경 불필요

#### CSS
- [ ] `src/css/grid.css`: `.cell.knight-related` 등 선택적 시각 스타일 추가 (선택사항)

#### 저장/기록
- [ ] `src/js/screens/complete.js`: `onShow()` (L103) — `board.variant` 이미 historyEntry에 포함 (L179)
- [ ] `src/js/screens/history.js`: 뱃지 표시 — `.badge-anti-knight` CSS 클래스 추가

---

### Phase 1-2: Anti-King 변형

> 킹(체스)이 이동할 수 있는 대각선 인접 위치에 같은 숫자 불가

#### 코어 로직
- [ ] `src/js/core/validator.js`: `getKingCells(row, col, boardSize)` 함수 신규 추가 — 킹 오프셋 `[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]`로 범위 내 셀 반환 (행/열은 이미 체크하므로 대각선 4방향만 실질적 추가)
- [ ] `src/js/core/validator.js`: `checkConflicts()` (L104) — `variant === 'anti-king'` 분기 추가
- [ ] `src/js/core/solver.js`: `isValid()` (L25) — `variant === 'anti-king'` 분기 추가, 대각선 인접 4칸 검사 `[[-1,-1],[-1,1],[1,-1],[1,1]]`
- [ ] `src/js/core/puzzle-worker.js`: `isValid()` (L40) — 인라인 복사본에 anti-king 검사 추가

#### 게임 상태
- [ ] `src/js/game/board.js`: `Board.variant` — 'anti-king' 값 지원
- [ ] `src/js/game/notes.js`: `removeFromRelated()` — `variant === 'anti-king'` 분기, 킹 인접 셀 메모 삭제

#### UI
- [ ] `src/js/ui/highlight.js`: `highlightSelection()` — `variant === 'anti-king'` 시 킹 인접 셀 하이라이트
- [ ] `src/index.html`: `.variant-options` — anti-king variant-option 버튼 추가
- [ ] `src/js/screens/history.js`: `.badge-anti-king` 뱃지

---

### Phase 1-3: Windoku (Hyper Sudoku) 변형

> 추가 4개의 3x3 윈도우 영역에도 1-9 유일 규칙 적용

#### 코어 로직
- [ ] `src/js/core/validator.js`: `getWindokuCells(row, col, boardSize)` 함수 신규 추가 — 4개 윈도우 영역 좌표: (1,1)-(3,3), (1,5)-(3,7), (5,1)-(7,3), (5,5)-(7,7) (9x9 전용)
- [ ] `src/js/core/validator.js`: `checkConflicts()` — `variant === 'windoku'` 분기, 셀이 윈도우 영역에 포함되면 같은 윈도우 셀 검사
- [ ] `src/js/core/solver.js`: `isValid()` — `variant === 'windoku'` 분기, 윈도우 영역 중복 검사
- [ ] `src/js/core/puzzle-worker.js`: `isValid()` — 인라인에 windoku 검사 추가

#### 게임 상태
- [ ] `src/js/game/board.js`: variant에 'windoku' 추가
- [ ] `src/js/game/notes.js`: `removeFromRelated()` — windoku 윈도우 셀 메모 삭제

#### UI
- [ ] `src/js/ui/grid.js`: `_buildGrid()` — `variant === 'windoku'` 시 윈도우 영역 셀에 `.windoku-window` CSS 클래스 부여
- [ ] `src/js/ui/highlight.js`: `highlightSelection()` — windoku 윈도우 영역 하이라이트
- [ ] `src/css/grid.css`: `.cell.windoku-window` 스타일 추가 — 배경색 `rgba(primary, 0.05)` 등
- [ ] `src/index.html`: variant-option 버튼 추가
- [ ] `src/js/screens/mode-select.js`: windoku 선택 시 boardSize를 9x9로 강제 (다른 크기 미지원)

#### 보드 크기 제한
- [ ] windoku는 9x9 전용 — mode-select에서 windoku 선택 시 다른 boardSize 비활성화 로직 추가

---

### Phase 1-4: X-Sudoku (대각선 강화) 변형

> 기존 diagonal과 동일하지만, 추가 시각 효과/점수 보너스 차별화 (또는 diagonal의 다른 이름으로 통합)
> **참고**: 기존 diagonal 변형이 이미 구현되어 있으므로, 이 Phase는 diagonal을 X-Sudoku로 리브랜딩하거나 추가 규칙을 넣는 것으로 변경

#### 대안: Sandwich Sudoku
> 1과 boardSize 사이에 있는 숫자들의 합이 행/열 양끝에 표시된 힌트 숫자와 같아야 함

- [ ] `src/js/core/validator.js`: `checkSandwichConstraint(board, row, col, boardSize)` — 행/열별 샌드위치 합 검증 (완성된 행/열에 대해서만)
- [ ] `src/js/core/solver.js`: sandwich 변형에 맞는 isValid 추가 제약
- [ ] `src/js/core/generator.js`: 샌드위치 힌트 숫자 생성 로직
- [ ] `src/js/game/board.js`: `_sandwichClues` 필드 추가 — `{ rows: number[], cols: number[] }`
- [ ] `src/js/ui/grid.js`: 행/열 바깥에 샌드위치 숫자 표시 UI
- [ ] `src/css/grid.css`: 샌드위치 힌트 숫자 스타일

---

### Phase 1-5: Even/Odd 변형

> 특정 셀이 짝수/홀수만 허용

#### 코어 로직
- [ ] `src/js/core/validator.js`: `checkEvenOddConstraint(num, row, col, evenOddMap)` — 셀의 짝수/홀수 제약 검증
- [ ] `src/js/core/solver.js`: `isValid()` — `variant === 'even-odd'` 시 evenOddMap 기반 추가 검증
- [ ] `src/js/core/generator.js`: 완성 보드에서 evenOddMap 생성 (일부 셀에 짝/홀 표시)

#### 게임 상태
- [ ] `src/js/game/board.js`: `_evenOddMap` 필드 추가 — `number[][] (0=제약없음, 1=홀수, 2=짝수)`
- [ ] `src/js/game/board.js`: `getState()` / `loadState()` — evenOddMap 직렬화 포함

#### UI
- [ ] `src/js/ui/grid.js`: `_buildGrid()` — even-odd 셀에 `.cell-even` / `.cell-odd` 클래스 추가 (원형/사각형 배경 마커)
- [ ] `src/css/grid.css`: `.cell-even`, `.cell-odd` 스타일 — 배경에 원형(짝수) 또는 다이아몬드(홀수) 마커
- [ ] `src/index.html`: variant-option 추가

---

### Phase 1-6: Killer Sudoku 변형

> 점선 영역(케이지)의 합이 지정된 수와 같아야 함. 같은 케이지 내 숫자 중복 불가.

#### 코어 로직
- [ ] `src/js/core/validator.js`: `getCageCells(row, col, cages)` — 셀이 속한 케이지의 모든 셀 반환
- [ ] `src/js/core/validator.js`: `checkCageConstraint(board, cage, boardSize)` — 케이지 합 검증 + 케이지 내 중복 검사
- [ ] `src/js/core/validator.js`: `checkConflicts()` — `variant === 'killer'` 분기, 같은 케이지 셀 충돌 검사
- [ ] `src/js/core/solver.js`: `isValid()` — killer 케이지 규칙 (같은 케이지 중복 불가 + 부분합 초과 검사)
- [ ] `src/js/core/generator.js`: `generateKillerCages(solution, boardSize)` — 완성 보드에서 케이지 영역 + 합 생성

#### 게임 상태
- [ ] `src/js/game/board.js`: `_cages` 필드 추가 — `Array<{cells: {row,col}[], sum: number}>`
- [ ] `src/js/game/board.js`: `getState()` / `loadState()` — cages 직렬화
- [ ] `src/js/game/notes.js`: `removeFromRelated()` — killer 케이지 셀 메모 삭제

#### UI
- [ ] `src/js/ui/grid.js`: `_buildGrid()` — 케이지 테두리(점선) 렌더링 + 좌상단 합 숫자 표시
- [ ] `src/js/ui/highlight.js`: `highlightSelection()` — 같은 케이지 셀 하이라이트
- [ ] `src/css/grid.css`: `.cage-border-*` 점선 테두리 스타일, `.cage-sum` 합 숫자 스타일
- [ ] `src/index.html`: variant-option 추가

---

## Phase 2: 게임 경험 개선 (8개)

---

### Phase 2-1: 자동 메모 채우기

> 빈 셀에 가능한 후보 숫자를 자동으로 메모에 채우는 기능

#### 코어 로직
- [ ] `src/js/core/solver.js`: `getCandidates()` (L74) — 이미 존재, 그대로 활용

#### 게임 상태
- [ ] `src/js/game/board.js` 또는 별도 유틸: `autoFillNotes()` 메서드 추가 — 모든 빈 셀의 `getCandidates()` 결과를 `notes.toggle()`으로 설정
- [ ] `src/js/game/board.js`: undo 지원 — history에 'autoNotes' 타입 push (복원 시 이전 notes 상태 전체 복구)

#### UI
- [ ] `src/js/ui/toolbar.js`: 자동 메모 버튼 추가 또는 메모 버튼 장탐(long-press) 동작으로 구현
- [ ] `src/index.html`: `.toolbar`에 자동 메모 버튼 추가 (SVG 아이콘 + "자동" 라벨)
- [ ] `src/css/main.css` 또는 `screens.css`: 자동 메모 버튼 스타일

#### 설정
- [ ] `src/js/utils/storage.js`: `getDefaultSettings()` (L52) — `autoNotes: false` 기본값 추가
- [ ] `src/js/screens/settings.js`: 자동 메모 토글 설정 항목
- [ ] `src/index.html`: 설정 화면 `#screen-settings` — 자동 메모 토글 행 추가

---

### Phase 2-2: 오류 자동 표시 (실시간 검증)

> 입력 즉시 solution과 비교하지 않고, 행/열/블록 중복만으로 오류 표시

#### UI 로직
- [ ] `src/js/game/input.js`: `onNumberInput()` — 설정에 따라 오류 자동 하이라이트 모드 전환
- [ ] `src/js/ui/grid.js`: `updateCell()` (L78) — `state === 'conflict'` 클래스 추가 지원
- [ ] `src/js/ui/highlight.js`: `highlightConflicts(board, boardSize, variant)` 신규 메서드 — 모든 셀에 대해 `checkConflicts()` 실행하여 충돌 셀에 `.conflict` 클래스 추가

#### 설정
- [ ] `src/js/utils/storage.js`: `getDefaultSettings()` — `autoErrorHighlight: false` 추가
- [ ] `src/index.html`: 설정 화면에 "오류 자동 표시" 토글 추가
- [ ] `src/js/screens/settings.js`: `applySettingImmediately()` — `autoErrorHighlight` 처리

#### CSS
- [ ] `src/css/grid.css`: `.cell.conflict` 스타일 — 빨간 배경 등

---

### Phase 2-3: 통계 고도화 (변형/보드크기별 분리)

> 통계를 variant, boardSize별로 분리 저장/표시

#### 저장소
- [ ] `src/js/utils/storage.js`: `getStatsKey(mode)` (L205) → `getStatsKey(mode, boardSize, variant)` 확장 — 키에 boardSize/variant 포함
- [ ] `src/js/utils/storage.js`: 하위호환 — 기존 키 없는 경우 기본 통계 반환

#### 완료 화면
- [ ] `src/js/screens/complete.js`: `updateStats()` (L258) — boardSize, variant 인자 추가하여 분리 저장

#### 통계 화면
- [ ] `src/js/screens/stats.js`: boardSize/variant 필터 셀렉트 추가
- [ ] `src/index.html`: `#screen-stats` — boardSize 필터 드롭다운, variant 필터 드롭다운 추가

#### 랭킹 화면
- [ ] `src/js/screens/ranking.js`: boardSize/variant 필터 추가
- [ ] `src/index.html`: `#screen-ranking` — 필터 셀렉트에 boardSize/variant 옵션 추가

---

### Phase 2-4: 일일 도전 캘린더 개선

> 변형(variant) 일일 도전, 난이도 표시, 보상 시스템

#### 일일 도전 로직
- [ ] `src/js/utils/daily-seed.js`: `getDailyVariant(date)` 신규 함수 — 요일 기반 변형 순환 (월=standard, 화=diagonal, 수=anti-knight 등)
- [ ] `src/js/screens/daily.js`: 일일 도전 시작 시 `getDailyVariant()` 호출하여 variant 결정

#### 캘린더 UI
- [ ] `src/js/screens/daily.js`: 캘린더 날짜 셀에 난이도 아이콘/색상 표시
- [ ] `src/js/screens/daily.js`: 캘린더 날짜 셀에 변형 뱃지 표시
- [ ] `src/css/screens.css`: 캘린더 셀 내 난이도/변형 뱃지 스타일

#### 보상
- [ ] `src/js/utils/achievements.js`: `ACHIEVEMENTS` 배열 — 일일 도전 관련 업적 추가 (예: '변형 마스터' = 모든 변형으로 일일도전 완료)

---

### Phase 2-5: 힌트 시스템 고도화

> Hidden Single, Naked Pair, Pointing Pair 등 고급 전략 힌트

#### 힌트 전략 추가
- [ ] `src/js/game/hints.js`: `findHiddenSingle(board, solution, boardSize, blockSize, variant)` 신규 — 특정 숫자가 행/열/블록에서 한 셀에만 들어갈 수 있는 경우
- [ ] `src/js/game/hints.js`: `findNakedPair(board, solution, boardSize, blockSize, variant)` 신규 — 같은 유닛(행/열/블록)에서 2셀이 같은 2후보를 공유하는 경우
- [ ] `src/js/game/hints.js`: `findPointingPair(board, solution, boardSize, blockSize, variant)` 신규 — 블록 내 후보가 한 행/열에만 존재하는 경우
- [ ] `src/js/game/hints.js`: `getHint()` (L53) — 우선순위 체인에 새 전략 삽입: lastInRow → lastInCol → lastInBlock → lastInDiagonal → **hiddenSingle → nakedPair → pointingPair** → nakedSingle → direct

#### 힌트 메시지
- [ ] `src/js/game/hints.js`: 각 전략별 한국어 메시지 정의 (예: `"이 행에서 ${value}가 들어갈 수 있는 위치는 이곳뿐입니다."`)

#### 힌트 UI 개선
- [ ] `src/js/ui/grid.js` 또는 `highlight.js`: 힌트 적용 시 관련 셀 강조 (어떤 행/열/블록의 제약으로 결정되었는지 시각화)

---

### Phase 2-6: 게임 난이도 동적 조절

> 게임 진행 중 난이도 표시 및 실시간 진행률

#### 진행률 표시
- [ ] `src/js/game/board.js`: `getProgress()` 신규 메서드 — `(채워진 셀 수 / 전체 빈 셀 수) * 100`
- [ ] `src/index.html`: `#screen-game .game-info-bar` — 진행률 바 요소 추가: `<div class="info-progress"><div class="progress-fill"></div></div>`
- [ ] `src/js/screens/game.js`: 셀 입력마다 진행률 바 업데이트

#### CSS
- [ ] `src/css/screens.css` 또는 `main.css`: `.info-progress` 프로그레스바 스타일

---

### Phase 2-7: 게임 리플레이 기능 개선

> 완료된 게임의 풀이 과정을 단계별로 재생

#### 기록 확장
- [ ] `src/js/screens/complete.js`: `onShow()` historyEntry에 `moves` 필드 추가 — 게임 중 입력 순서 기록
- [ ] `src/js/game/board.js`: `_moveLog` 배열 신규 필드 — `setCellValue()` 호출 시 `{row, col, num, time}` push
- [ ] `src/js/game/board.js`: `getState()` / `loadState()` — moveLog 직렬화/역직렬화

#### 리플레이 UI
- [ ] `src/js/screens/history.js` 또는 별도 `replay.js`: 리플레이 화면 — 타이머 바 + 재생/일시정지/속도조절 버튼
- [ ] `src/index.html`: `#screen-replay` 화면 추가 (또는 게임 화면 재활용)
- [ ] `src/js/app.js`: `navigate('replay', { historyId })` 라우트 추가

---

### Phase 2-8: 멀티 언어 지원 (i18n)

> 한국어/영어 전환

#### i18n 인프라
- [ ] `src/js/utils/i18n.js` 신규 파일: `t(key)` 번역 함수, `setLocale(locale)`, `getLocale()`
- [ ] `src/js/utils/i18n.js`: 한국어/영어 번역 사전 정의 — 모든 UI 텍스트 키-값

#### 번역 적용
- [ ] `src/index.html`: 정적 텍스트를 `data-i18n="key"` 속성으로 마킹
- [ ] `src/js/app.js`: `init()` 시 `i18n.setLocale()` 호출, DOM 텍스트 일괄 교체
- [ ] `src/js/screens/*.js`: 동적 텍스트 생성 부분 `t()` 함수 사용으로 변경

#### 설정
- [ ] `src/js/utils/storage.js`: `getDefaultSettings()` — `locale: 'ko'` 기본값 추가
- [ ] `src/index.html`: 설정 화면 — 언어 선택 드롭다운/토글 추가
- [ ] `src/js/screens/settings.js`: 언어 변경 시 페이지 텍스트 즉시 갱신

---

## Phase 3: 소셜/경쟁/고급 기능 (9개)

---

### Phase 3-1: 멀티플레이어 대전 모드

> 같은 퍼즐을 동시에 풀면서 경쟁

#### 백엔드
- [ ] 별도 서버 필요 — WebSocket 또는 WebRTC 기반 실시간 통신
- [ ] 서버: 방 생성/참여 API, 퍼즐 동기화, 진행 상태 브로드캐스트
- [ ] 서버: 게임 종료 판정 (먼저 완료한 플레이어 승리)

#### 클라이언트
- [ ] `src/js/screens/multiplayer.js` 신규: 로비/방 목록/매칭 UI
- [ ] `src/js/game/board.js`: 상대방 진행률 수신 처리
- [ ] `src/index.html`: `#screen-multiplayer` 화면 추가
- [ ] `src/index.html`: `#screen-game` — 상대방 진행률 바 추가
- [ ] `src/js/app.js`: 멀티플레이어 네비게이션 라우트 추가

#### UI
- [ ] 상대방 진행률/점수 실시간 표시
- [ ] 승리/패배 결과 화면

---

### Phase 3-2: 리더보드 (온라인 랭킹)

> 전역 랭킹 시스템 — 서버 기반

#### 백엔드
- [ ] 서버: 점수 제출 API (difficulty, mode, boardSize, variant, score, time)
- [ ] 서버: 리더보드 조회 API (기간별, 난이도별, 변형별 필터)
- [ ] 서버: 유저 인증 (닉네임 + 간단 토큰)

#### 클라이언트
- [ ] `src/js/screens/ranking.js`: 온라인 리더보드 탭 추가 (기존 로컬 랭킹 옆)
- [ ] `src/js/screens/complete.js`: 게임 완료 시 점수 서버 제출
- [ ] `src/js/utils/api.js` 신규: 서버 통신 래퍼 (fetch 기반)
- [ ] `src/index.html`: `#screen-ranking` — "로컬" / "온라인" 탭 추가

#### 닉네임
- [ ] `src/js/utils/storage.js`: `getDefaultSettings()` — `nickname: ''` 추가
- [ ] `src/js/screens/settings.js`: 닉네임 입력 필드

---

### Phase 3-3: 퍼즐 공유/불러오기

> URL 또는 코드로 퍼즐 공유

#### 인코딩
- [ ] `src/js/utils/puzzle-share.js` 신규: `encodePuzzle(puzzle, boardSize, variant)` → Base64/URL-safe 문자열
- [ ] `src/js/utils/puzzle-share.js`: `decodePuzzle(code)` → `{puzzle, solution, given, boardSize, variant}` 복원

#### 공유 UI
- [ ] `src/js/screens/complete.js` 또는 `history.js`: "공유" 버튼 추가 — 클립보드 복사 또는 Web Share API
- [ ] `src/index.html`: 완료 화면에 공유 버튼 추가

#### 불러오기
- [ ] `src/js/app.js`: URL 파라미터 `?puzzle=` 감지하여 자동 게임 시작
- [ ] `src/js/screens/main.js`: "퍼즐 불러오기" 버튼 추가 — 코드 입력 모달

---

### Phase 3-4: 사용자 프로필 시스템

> 레벨, 경험치, 프로필 커스터마이징

#### 경험치/레벨
- [ ] `src/js/utils/profile.js` 신규: `getLevel(xp)`, `getXPForLevel(level)`, `addXP(amount)` — 레벨 곡선 정의
- [ ] `src/js/utils/storage.js`: KEYS에 `USER_PROFILE` 추가, `loadProfile()` / `saveProfile()` 함수

#### 경험치 획득
- [ ] `src/js/screens/complete.js`: 게임 완료 시 난이도/모드/변형 기반 XP 부여
- [ ] `src/js/utils/profile.js`: XP 계산 공식 — 기본 XP + 난이도 보너스 + 무실수 보너스

#### 프로필 UI
- [ ] `src/js/screens/profile.js`: 레벨/XP 바 표시
- [ ] `src/index.html`: `#screen-profile` — 레벨 뱃지, XP 프로그레스 바, 통계 요약 추가
- [ ] `src/css/screens.css`: 레벨 뱃지, XP 바 스타일

#### 프로필 아바타
- [ ] `src/js/screens/profile.js`: 아바타 선택 UI (프리셋 아이콘 또는 이모지)
- [ ] `src/js/utils/storage.js`: 프로필에 avatar 필드

---

### Phase 3-5: 튜토리얼 고도화

> 인터랙티브 튜토리얼 (실제 셀 클릭으로 학습)

#### 튜토리얼 데이터
- [ ] `src/js/screens/tutorial.js`: 단계별 퍼즐 데이터 정의 — 미리 만든 간단한 4x4 또는 부분 9x9 보드
- [ ] `src/js/screens/tutorial.js`: 각 단계의 목표 (예: "이 셀에 7을 입력하세요") 및 완료 조건

#### 인터랙티브 UI
- [ ] `src/js/screens/tutorial.js`: 미니 게임 보드 렌더링 — `GridUI` 재활용
- [ ] `src/js/screens/tutorial.js`: 하이라이트 화살표/포인터 오버레이 — 특정 셀이나 버튼을 가리키는 시각적 안내
- [ ] `src/index.html`: `#screen-tutorial` — 인터랙티브 튜토리얼 영역 추가 (슬라이드 대체)

#### 변형 규칙 튜토리얼
- [ ] 각 변형(대각선, 나이트, 킹, 윈도쿠, 킬러)에 대한 전용 튜토리얼 슬라이드/단계

---

### Phase 3-6: 오프라인 PWA 개선

> 완전한 오프라인 지원 + 설치 프롬프트

#### Service Worker
- [ ] `src/sw.js`: 캐시 전략 개선 — stale-while-revalidate + 오프라인 폴백 페이지
- [ ] `src/sw.js`: 버전 관리 자동화 — 파일 해시 기반 캐시 무효화
- [ ] `src/sw.js`: 백그라운드 동기화 지원 (온라인 복귀 시 점수 제출 큐 처리)

#### 설치 프롬프트
- [ ] `src/js/app.js`: `beforeinstallprompt` 이벤트 캡처 → 커스텀 설치 배너 표시
- [ ] `src/index.html`: 설치 배너 HTML — 하단 슬라이드업 배너
- [ ] `src/css/main.css`: 설치 배너 스타일

#### 매니페스트
- [ ] `src/manifest.json`: shortcuts 추가 (새 게임, 일일 도전 바로가기)
- [ ] `src/manifest.json`: screenshots 추가 (설치 프리뷰)
- [ ] 앱 아이콘 다양한 크기 — `src/assets/icon-*.png` (192, 512 등)

---

### Phase 3-7: 접근성(A11y) 개선

> 스크린 리더, 키보드 네비게이션, 고대비 모드

#### 키보드 네비게이션
- [ ] `src/js/game/input.js`: 화살표 키로 셀 이동 (←↑→↓)
- [ ] `src/js/game/input.js`: Tab/Shift+Tab으로 빈 셀 간 이동
- [ ] `src/js/ui/grid.js`: 셀에 `tabindex="0"` 및 `role="gridcell"` aria 속성 추가
- [ ] `src/js/ui/grid.js`: `_buildGrid()` — `.sudoku-grid`에 `role="grid"` 추가

#### 스크린 리더
- [ ] `src/js/ui/grid.js`: 셀에 `aria-label` 추가 — "행 3, 열 5, 값 7" 또는 "행 3, 열 5, 빈 셀"
- [ ] `src/js/ui/grid.js`: `updateCell()` — `aria-label` 동적 업데이트
- [ ] `src/js/ui/numberpad.js`: 버튼에 `aria-label` — "숫자 1" 등
- [ ] 라이브 리전: 힌트 메시지, 오류 알림 `role="alert"` 또는 `aria-live="polite"`

#### 고대비 모드
- [ ] `src/css/main.css`: `@media (prefers-contrast: high)` — 테두리/텍스트 대비 강화
- [ ] `src/js/screens/settings.js`: 고대비 모드 수동 토글 옵션

---

### Phase 3-8: 사운드 시스템 고도화

> 실제 효과음 + 배경음 + 사운드 팩

#### 사운드 에셋
- [ ] `src/assets/sounds/` — 효과음 파일: `tap.mp3`, `correct.mp3`, `wrong.mp3`, `complete.mp3`, `hint.mp3`, `undo.mp3`
- [ ] `src/assets/sounds/` — 배경음 파일: `bgm-calm.mp3` (루프)

#### SoundManager 확장
- [ ] `src/js/utils/sound.js`: 배경음 재생/정지/볼륨 조절 메서드 추가
- [ ] `src/js/utils/sound.js`: 효과음 다중 재생 (동시 소리 가능하도록 AudioPool)
- [ ] `src/js/utils/sound.js`: 사운드 프리로드 — `init()` 시 AudioContext에 버퍼 사전 로드

#### 설정
- [ ] `src/js/utils/storage.js`: `getDefaultSettings()` — `bgm: false`, `volume: 0.7` 추가
- [ ] `src/index.html`: 설정 화면 — 배경음 토글, 볼륨 슬라이더 추가
- [ ] `src/js/screens/settings.js`: 볼륨 슬라이더 change 이벤트 → SoundManager 볼륨 적용

---

### Phase 3-9: 퍼포먼스 최적화

> 대형 보드(12x12, 16x16) 렌더링/생성 최적화

#### 렌더링 최적화
- [ ] `src/js/ui/grid.js`: DOM 배치 최적화 — `DocumentFragment` 사용, `requestAnimationFrame` 배치 업데이트
- [ ] `src/js/ui/highlight.js`: `clearAll()` (L135) — 전체 순회 대신 이전 하이라이트 셀 목록 캐싱하여 해당 셀만 클래스 제거
- [ ] `src/js/ui/grid.js`: 큰 보드에서 CSS `contain: layout style` 적용

#### 생성 최적화
- [ ] `src/js/core/puzzle-worker.js`: DLX (Dancing Links) 알고리즘으로 solver 교체 — 16x16에서 10배+ 빠른 생성
- [ ] `src/js/core/solver.js`: constraint propagation (Arc Consistency) 추가 — 백트래킹 전 후보 사전 축소

#### 메모리 최적화
- [ ] `src/js/game/notes.js`: 큰 보드에서 `Set` 대신 비트마스크 사용 검토 (16x16: 16비트면 충분)
- [ ] `src/js/core/validator.js`: `checkConflicts()` — `seen` Set 대신 비트 배열 사용

---

## 파일별 변경 요약

| 파일 | 영향받는 Phase |
|------|---------------|
| `src/js/core/validator.js` | 1-1, 1-2, 1-3, 1-5, 1-6, 3-9 |
| `src/js/core/solver.js` | 1-1, 1-2, 1-3, 1-4, 1-5, 1-6, 2-5, 3-9 |
| `src/js/core/generator.js` | 1-4, 1-5, 1-6 |
| `src/js/core/puzzle-worker.js` | 1-1, 1-2, 1-3, 1-5, 1-6, 3-9 |
| `src/js/core/board-config.js` | - (변경 불필요) |
| `src/js/core/scorer.js` | - (변경 불필요) |
| `src/js/game/board.js` | 1-1~1-6, 2-1, 2-6, 2-7, 3-4 |
| `src/js/game/notes.js` | 1-1, 1-2, 1-3, 1-6, 3-9 |
| `src/js/game/hints.js` | 2-5 |
| `src/js/game/input.js` | 2-2, 3-7 |
| `src/js/ui/grid.js` | 1-1~1-6, 2-2, 2-5, 3-7, 3-9 |
| `src/js/ui/highlight.js` | 1-1, 1-2, 1-3, 1-6, 2-2, 3-9 |
| `src/js/ui/toolbar.js` | 2-1 |
| `src/js/ui/numberpad.js` | 3-7 |
| `src/js/screens/mode-select.js` | 1-1~1-6 |
| `src/js/screens/complete.js` | 2-3, 2-7, 3-3, 3-4 |
| `src/js/screens/settings.js` | 2-1, 2-2, 2-8, 3-6, 3-8 |
| `src/js/screens/stats.js` | 2-3 |
| `src/js/screens/ranking.js` | 2-3, 3-2 |
| `src/js/screens/history.js` | 1-1, 1-2, 2-7, 3-3 |
| `src/js/screens/daily.js` | 2-4 |
| `src/js/screens/tutorial.js` | 3-5 |
| `src/js/screens/profile.js` | 3-4 |
| `src/js/utils/storage.js` | 2-1, 2-2, 2-3, 2-8, 3-2, 3-4, 3-8 |
| `src/js/utils/achievements.js` | 2-4 |
| `src/js/utils/daily-seed.js` | 2-4 |
| `src/js/utils/sound.js` | 3-8 |
| `src/js/app.js` | 2-7, 2-8, 3-1, 3-3, 3-6 |
| `src/index.html` | 1-1~1-6, 2-1~2-8, 3-1~3-8 |
| `src/css/grid.css` | 1-1, 1-3, 1-5, 1-6, 2-2, 3-9 |
| `src/css/main.css` | 2-1, 2-6, 3-6, 3-7 |
| `src/css/screens.css` | 2-3, 2-4, 3-4 |
| `src/css/themes.css` | - (변경 불필요, 기존 변수 활용) |
| `src/sw.js` | 3-6 |
| `src/manifest.json` | 3-6 |

---

## 우선순위 권장사항

### 즉시 착수 가능 (의존성 없음)
1. Phase 1-1 Anti-Knight — 기존 diagonal 패턴 100% 재활용
2. Phase 1-2 Anti-King — Anti-Knight와 거의 동일한 패턴
3. Phase 2-1 자동 메모 — 기존 getCandidates() 활용
4. Phase 2-6 진행률 표시 — 간단한 UI 추가

### 중간 복잡도
5. Phase 1-3 Windoku — 9x9 전용 제한 필요
6. Phase 2-2 오류 자동 표시 — 설정+UI 연동
7. Phase 2-5 힌트 고도화 — 알고리즘 구현 필요

### 높은 복잡도
8. Phase 1-6 Killer Sudoku — 케이지 생성/렌더링 복잡
9. Phase 2-8 i18n — 전체 코드베이스 영향
10. Phase 3-9 퍼포먼스 — DLX 알고리즘 구현
