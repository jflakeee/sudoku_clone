# 기능별 상세 테스트 시나리오 체크리스트

> 작성일: 2026-03-03
> 대상: Phase 1~3 총 23개 신규 기능
> 테스트 도구: Playwright E2E (Chromium)
> 기반: 기존 148개 테스트 + `19-diagonal-variant.spec.js` 패턴
> 참조: `brainstorm_features_20260227.txt`, 팀 리더 기능 명세

---

## Phase 1: 즉시 구현 (6개)

---

### Phase 1-1: Anti-Knight 변형

**파일**: `tests/20-anti-knight.spec.js`
**설명**: 나이트(체스) 이동 위치에 같은 숫자 불가. `variant='anti-knight'`

#### Mode Select UI 테스트
- [ ] 1-1.01 mode-select에서 `.variant-option[data-variant="anti-knight"]` 표시 확인
- [ ] 1-1.02 anti-knight 클릭 시 `active` 클래스 적용, 기존 standard/diagonal의 `active` 해제
- [ ] 1-1.03 standard 변형이 기본 선택 상태 (anti-knight는 비활성)
- [ ] 1-1.04 인쇄 모드(`forPrint`)에서 `.variant-section` 숨김 확인

#### Game Info Bar 테스트
- [ ] 1-1.05 anti-knight 게임 시작 후 `.info-variant` visible, `.variant-value` 텍스트 "안티나이트"
- [ ] 1-1.06 standard 게임에서는 `.info-variant` hidden

#### 퍼즐 생성 테스트
- [ ] 1-1.07 `page.evaluate`로 `board.variant === 'anti-knight'` 확인
- [ ] 1-1.08 solution 검증: 모든 셀에 대해 나이트 위치(row+-2,col+-1 / row+-1,col+-2)에 같은 숫자 없음
  ```javascript
  // page.evaluate에서 solution[r][c] !== solution[r+dr][c+dc] for all knight offsets
  ```

#### 충돌 검증 테스트
- [ ] 1-1.09 빈 셀에 나이트 위치 셀과 같은 숫자(오답) 입력 시 `.error` 클래스 적용
- [ ] 1-1.10 `checkConflicts(board, row, col, num, 9, null, 'anti-knight')` 호출 시 나이트 위치 충돌 반환
- [ ] 1-1.11 보드 경계 밖 나이트 위치는 무시 (예: (0,0)에서 (-2,1) 무시)

#### 하이라이트 테스트
- [ ] 1-1.12 셀 선택 시 행/열/블록 + 나이트 위치 셀에 `.highlighted` 적용
- [ ] 1-1.13 standard 게임에서는 나이트 위치 하이라이트 없음

#### 메모(Notes) 테스트
- [ ] 1-1.14 숫자 배치 시 나이트 위치 셀의 메모에서 해당 숫자 자동 제거
  ```javascript
  // app.board.notes.toggle(knightRow, knightCol, num) → 배치 후 notes.get()에 num 없음
  ```

#### 저장/로드 테스트
- [ ] 1-1.15 게임 저장 → 메인 → "계속하기" 후 `board.variant === 'anti-knight'` 유지
- [ ] 1-1.16 로드 후 나이트 위치 충돌 검증 정상 작동

#### 히스토리/재도전 테스트
- [ ] 1-1.17 완료 후 `localStorage.sudoku_gameHistory[0].variant === 'anti-knight'`
- [ ] 1-1.18 히스토리 화면에서 `.badge-anti-knight` 뱃지 표시
- [ ] 1-1.19 `.btn-replay` 클릭 후 `board.variant === 'anti-knight'` 유지
- [ ] 1-1.20 재도전 게임 `solveEntirePuzzle()` 후 `#screen-complete.active` 전환

---

### Phase 1-2: Anti-King 변형

**파일**: `tests/21-anti-king.spec.js`
**설명**: 대각선 인접(킹 이동) 8방향 셀에 같은 숫자 불가. `variant='anti-king'`

#### Mode Select UI 테스트
- [ ] 1-2.01 `.variant-option[data-variant="anti-king"]` 클릭 시 `active` 적용
- [ ] 1-2.02 다른 variant 버튼 active 해제

#### Game Info Bar 테스트
- [ ] 1-2.03 게임 시작 후 `.variant-value` 텍스트 "안티킹"
- [ ] 1-2.04 4x4 보드에서도 anti-king 게임 시작 가능

#### 퍼즐 생성 테스트
- [ ] 1-2.05 `board.variant === 'anti-king'` 확인
- [ ] 1-2.06 solution에서 킹 이동 8방향 인접 셀에 같은 숫자 없음 검증
  ```javascript
  // offsets: [-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]
  // 행/열 인접은 표준 규칙과 겹치므로 대각선 4방향이 추가 제약
  ```

#### 충돌 검증 테스트
- [ ] 1-2.07 킹 대각선 인접 셀에 같은 숫자 입력 시 `.error` 클래스 적용
- [ ] 1-2.08 보드 모서리(0,0) 셀에서 경계 밖 킹 위치 무시

#### 하이라이트 테스트
- [ ] 1-2.09 셀 선택 시 킹 이동 위치에 `.highlighted` 적용

#### 메모 테스트
- [ ] 1-2.10 킹 위치 셀 메모 자동 제거 확인

#### 저장/로드/히스토리 테스트
- [ ] 1-2.11 저장 후 로드 시 `variant === 'anti-king'` 유지
- [ ] 1-2.12 히스토리 `variant: 'anti-king'` 저장, `.badge-anti-king` 표시
- [ ] 1-2.13 재도전 시 variant 유지 및 완료 가능

---

### Phase 1-3: 자동 메모 채우기

**파일**: `tests/22-auto-notes.spec.js`
**설명**: 툴바 버튼으로 모든 빈 셀에 가능한 후보 숫자 일괄 입력

#### UI 테스트
- [ ] 1-3.01 툴바에 자동 메모 버튼(`.btn-auto-notes` 또는 `[data-action="auto-notes"]`) 표시
- [ ] 1-3.02 버튼 클릭 시 모든 빈 셀에 후보 숫자 메모 채워짐
- [ ] 1-3.03 채워진 후 `.cell-notes` display 변경 (숫자 표시)

#### 후보 계산 정확성 테스트
- [ ] 1-3.04 각 빈 셀의 메모가 행/열/블록에 없는 숫자만 포함
  ```javascript
  // page.evaluate에서 각 빈 셀의 notes.get(r,c) 검증
  ```
- [ ] 1-3.05 diagonal 변형에서 대각선 제약도 반영한 후보 계산
- [ ] 1-3.06 anti-knight 변형에서 나이트 제약 반영한 후보 계산
- [ ] 1-3.07 given 셀에는 메모 미적용

#### 동작 테스트
- [ ] 1-3.08 이미 메모가 있는 셀도 덮어쓰기 (새 후보로 갱신)
- [ ] 1-3.09 이미 숫자가 입력된 셀(user-input)에는 메모 미적용
- [ ] 1-3.10 자동 메모 후 수동으로 메모 편집 가능

#### 실행취소 테스트
- [ ] 1-3.11 자동 메모 실행 후 Undo로 이전 상태 복원 가능
- [ ] 1-3.12 Undo 시 모든 셀 메모가 자동 메모 이전 상태로 복원

---

### Phase 1-4: 스트릭 시스템

**파일**: `tests/23-streak-system.spec.js`
**설명**: 매일 1게임 이상 완료 시 연속 카운트. `lastPlayDate`/`currentStreak`/`longestStreak`

#### 메인 화면 표시 테스트
- [ ] 1-4.01 메인 화면에 `.streak-badge` 표시 (불꽃 아이콘 `.streak-icon` + 일수 `.streak-count`)
- [ ] 1-4.02 스트릭 0일 시 `.streak-count` 텍스트 "0"
- [ ] 1-4.03 localStorage에 스트릭 데이터 시딩 후 `.streak-count` 해당 값 표시

#### 스트릭 증가 테스트
- [ ] 1-4.04 게임 완료 시 `currentStreak` 1 증가
  ```javascript
  // localStorage에 lastPlayDate: 어제 ISO, currentStreak: 5 시딩
  // startNewGame → solveEntirePuzzle → 스트릭 6 확인
  ```
- [ ] 1-4.05 같은 날 두 번째 게임 완료 시 스트릭 미증가 (중복 방지)
- [ ] 1-4.06 `longestStreak`이 `currentStreak`보다 작으면 갱신

#### 스트릭 리셋 테스트
- [ ] 1-4.07 하루 이상 미플레이 후 게임 완료 시 `currentStreak` 1로 리셋
  ```javascript
  // lastPlayDate를 3일 전으로 시딩 → 게임 완료 → currentStreak === 1
  ```
- [ ] 1-4.08 리셋 후 `longestStreak`은 유지 (기존 최고값 보존)

#### 프로필/통계 연동 테스트
- [ ] 1-4.09 프로필 또는 통계 화면에 현재/최장 스트릭 표시
- [ ] 1-4.10 일일 도전 완료 시에도 스트릭 업데이트

#### 저장 테스트
- [ ] 1-4.11 `sudoku_settings` 또는 별도 키에 `lastPlayDate`, `currentStreak`, `longestStreak` 저장
- [ ] 1-4.12 새로고침 후 스트릭 데이터 유지

---

### Phase 1-5: 실수 자동 표시 토글

**파일**: `tests/24-auto-error-check.spec.js`
**설명**: 설정 ON 시 입력 즉시 solution 대비 체크, 오류 셀 빨간 표시

#### 설정 UI 테스트
- [ ] 1-5.01 설정 화면에 "실수 자동 표시" 토글 표시
- [ ] 1-5.02 기본값 확인 (ON 또는 OFF)
- [ ] 1-5.03 토글 변경 시 `sudoku_settings.autoErrorCheck` 저장

#### ON 상태 동작 테스트
- [ ] 1-5.04 오답 입력 시 즉시 `.error` 클래스 적용 (빨간 표시)
- [ ] 1-5.05 정답 입력 시 `.error` 클래스 미적용
- [ ] 1-5.06 오답 셀에 다른 숫자(정답) 재입력 시 `.error` 제거
- [ ] 1-5.07 오답 입력이 실수 카운트에 반영

#### OFF 상태 동작 테스트
- [ ] 1-5.08 OFF 시 오답 입력해도 `.error` 클래스 미적용
- [ ] 1-5.09 OFF 시 충돌(같은 행/열/블록 중복)만 표시 (solution 대비 체크 안 함)
- [ ] 1-5.10 OFF → ON 전환 시 이미 입력된 오답에 `.error` 소급 적용

#### 게임 진행 중 토글 테스트
- [ ] 1-5.11 게임 중 설정 변경 시 즉시 반영 (새 게임 불필요)
- [ ] 1-5.12 ON/OFF 전환 시 기존 입력 셀 상태 갱신

---

### Phase 1-6: 셀 컬러 마킹

**파일**: `tests/25-cell-color-marking.spec.js`
**설명**: 풀이 추론용 4~6색 팔레트. 툴바에 컬러 버튼, Board에 color 필드

#### UI 테스트
- [ ] 1-6.01 툴바에 컬러 마킹 버튼(`.btn-color` 또는 `[data-action="color"]`) 표시
- [ ] 1-6.02 컬러 버튼 클릭 시 팔레트(`.color-palette`) 표시 (4~6색)
- [ ] 1-6.03 팔레트에서 색상 선택 시 활성 색상 표시

#### 마킹 동작 테스트
- [ ] 1-6.04 색상 선택 후 셀 클릭 시 해당 셀에 배경색 적용 (`.cell[data-color="red"]` 등)
- [ ] 1-6.05 이미 컬러가 있는 셀에 다른 색 선택 시 색상 교체
- [ ] 1-6.06 같은 색 재선택 시 컬러 제거 (토글)
- [ ] 1-6.07 "지우기" 색상 옵션으로 컬러 제거
- [ ] 1-6.08 given 셀에도 컬러 마킹 가능

#### 게임 상태 관리 테스트
- [ ] 1-6.09 컬러 마킹이 `board.getState()`에 포함 (cells color 데이터)
- [ ] 1-6.10 저장 후 로드 시 컬러 마킹 유지
- [ ] 1-6.11 숫자 입력은 컬러 마킹에 영향 없음 (독립)

#### 실행취소 테스트
- [ ] 1-6.12 컬러 마킹 후 Undo로 마킹 제거 가능
- [ ] 1-6.13 Undo → Redo 시 마킹 복원

#### 다크모드/테마 호환성 테스트
- [ ] 1-6.14 다크 모드에서 컬러 마킹 가시성 확인
- [ ] 1-6.15 테마 스킨과 컬러 마킹 병존 확인

---

## Phase 2: 높은 가치 (8개)

---

### Phase 2-1: XP/레벨 시스템

**파일**: `tests/26-xp-level.spec.js`
**설명**: 퍼즐 완료 시 XP 획득, 누적 XP로 레벨업. `storage`에 `xp`/`level` 키

#### XP 획득 테스트
- [ ] 2-1.01 게임 완료 시 완료 화면에 획득 XP 표시 (`.xp-earned`)
- [ ] 2-1.02 난이도별 XP 차등: easy < normal < hard < expert < master
  ```javascript
  // easy 완료 후 XP 확인, expert 완료 후 XP 확인 → expert > easy
  ```
- [ ] 2-1.03 실수 0 시 보너스 XP
- [ ] 2-1.04 시간 기반 보너스 XP (빠를수록 높음)

#### 레벨 표시 테스트
- [ ] 2-1.05 메인 화면에 현재 레벨 표시 (`.player-level`)
- [ ] 2-1.06 XP 프로그레스바 표시 (`.xp-progress`) — 현재 레벨 내 진행률
- [ ] 2-1.07 프로필 화면에 상세 레벨/XP/다음 레벨까지 정보

#### 레벨업 연출 테스트
- [ ] 2-1.08 XP 누적으로 레벨업 시 토스트/모달 알림
- [ ] 2-1.09 레벨업 시 칭호 변경 반영 (Phase 2-7 연동)

#### 저장 테스트
- [ ] 2-1.10 localStorage에 `xp`, `level` 저장
- [ ] 2-1.11 새로고침 후 레벨/XP 유지
- [ ] 2-1.12 일일 도전 완료 시에도 XP 획득

---

### Phase 2-2: 주간 챌린지

**파일**: `tests/27-weekly-challenge.spec.js`
**설명**: 매주 특별 규칙 챌린지 자동 생성, 진행도 추적, 완료 보상

#### 화면 진입 테스트
- [ ] 2-2.01 메인 화면에 주간 챌린지 카드(`.weekly-challenge-card`) 표시
- [ ] 2-2.02 카드에 이번 주 챌린지 제목/규칙 표시 (예: "노노트 위크")
- [ ] 2-2.03 카드 클릭 시 주간 챌린지 상세/게임 진입

#### 챌린지 생성 테스트
- [ ] 2-2.04 같은 주 접속 시 동일 챌린지 (시드 기반 결정론적)
  ```javascript
  // weekly-seed.js 기반 — 같은 주 날짜들에 동일 시드
  ```
- [ ] 2-2.05 다음 주 접속 시 다른 챌린지
- [ ] 2-2.06 챌린지 규칙이 게임에 적용됨 (예: 메모 비활성화)

#### 진행도 추적 테스트
- [ ] 2-2.07 챌린지 진행률 표시 (예: "3/5 완료")
- [ ] 2-2.08 챌린지 조건 미충족 완료는 카운트 안 됨
- [ ] 2-2.09 진행도 localStorage 저장

#### 완료 보상 테스트
- [ ] 2-2.10 챌린지 완료 시 보상 알림 (XP 보너스 등)
- [ ] 2-2.11 이미 완료한 챌린지 재플레이 시 보상 미지급

---

### Phase 2-3: Even/Odd 변형

**파일**: `tests/28-even-odd.spec.js`
**설명**: 특정 셀에 짝수/홀수 마커, 해당 셀에 짝홀 제약. `variant='even-odd'`

#### UI 테스트
- [ ] 2-3.01 `.variant-option[data-variant="even-odd"]` 클릭 시 active
- [ ] 2-3.02 게임 시작 후 `.variant-value` 텍스트 "이븐오드" 또는 "짝홀"
- [ ] 2-3.03 짝수 마커 셀에 `.even-marker` CSS 클래스 (회색 원 등)
- [ ] 2-3.04 홀수 마커 셀에 `.odd-marker` CSS 클래스 (회색 사각형 등)
- [ ] 2-3.05 마커 없는 셀에는 짝홀 제약 미적용

#### 규칙 검증 테스트
- [ ] 2-3.06 짝수 마커 셀에 홀수 입력 시 `.error`
- [ ] 2-3.07 홀수 마커 셀에 짝수 입력 시 `.error`
- [ ] 2-3.08 짝수 마커 셀에 짝수 입력 시 정상
- [ ] 2-3.09 표준 행/열/블록 규칙도 동시 적용

#### 퍼즐 생성 테스트
- [ ] 2-3.10 solution에서 짝수 마커 셀은 짝수, 홀수 마커 셀은 홀수 검증
- [ ] 2-3.11 `board.variant === 'even-odd'` 확인

#### 저장/로드/히스토리 테스트
- [ ] 2-3.12 `getState()`에 마커 맵(`evenOddMap`) 포함
- [ ] 2-3.13 저장 후 로드 시 마커 시각적 유지
- [ ] 2-3.14 히스토리 `variant: 'even-odd'` + 마커 데이터 저장
- [ ] 2-3.15 재도전 시 동일 마커 배치

---

### Phase 2-4: Windoku (Hyper Sudoku)

**파일**: `tests/29-windoku.spec.js`
**설명**: 9x9 전용, 4개 추가 3x3 영역에 1~9 각 1회 제약. `variant='windoku'`

#### UI 테스트
- [ ] 2-4.01 `.variant-option[data-variant="windoku"]` 클릭 시 active
- [ ] 2-4.02 게임 시작 후 `.variant-value` 텍스트 "윈도쿠"
- [ ] 2-4.03 4개 윈도쿠 영역 셀에 `.windoku-zone` CSS 클래스 (배경색 구분)
- [ ] 2-4.04 standard 게임에는 `.windoku-zone` 클래스 없음

#### 윈도쿠 영역 검증
- [ ] 2-4.05 영역 위치 정확성: (1,1)-(3,3), (1,5)-(3,7), (5,1)-(7,3), (5,5)-(7,7)
- [ ] 2-4.06 `.windoku-zone` 셀 수 = 36개 (4영역 x 9셀)

#### 규칙 검증 테스트
- [ ] 2-4.07 같은 윈도쿠 영역 내 같은 숫자 입력 시 충돌 에러
- [ ] 2-4.08 다른 윈도쿠 영역 셀에는 같은 숫자 허용
- [ ] 2-4.09 윈도쿠 영역 밖 셀에는 윈도쿠 규칙 미적용

#### 하이라이트 테스트
- [ ] 2-4.10 윈도쿠 영역 셀 선택 시 같은 영역 셀 `.highlighted`
- [ ] 2-4.11 윈도쿠 영역 밖 셀 선택 시 윈도쿠 하이라이트 없음

#### 퍼즐 생성 테스트
- [ ] 2-4.12 solution에서 각 윈도쿠 영역 내 1~9 고유 확인

#### 보드 크기 제한 테스트
- [ ] 2-4.13 9x9에서만 windoku 활성화 (4x4, 6x6 선택 시 windoku 비활성/숨김)

#### 저장/로드/히스토리 테스트
- [ ] 2-4.14 저장 후 로드 시 variant + `.windoku-zone` 유지
- [ ] 2-4.15 히스토리 `variant: 'windoku'` 저장, 재도전 시 유지

---

### Phase 2-5: 완료 축하 애니메이션 강화

**파일**: `tests/30-complete-animation.spec.js`
**설명**: Canvas 컨페티/파티클, CSS 셀 웨이브, 골든 글로우. `complete.js`에서 트리거

#### 컨페티 테스트
- [ ] 2-5.01 게임 완료 시 `#confetti-area`에 컨페티 파티클 생성
- [ ] 2-5.02 컨페티 개수 > 0 확인 (`#confetti-area` 자식 요소 카운트)
- [ ] 2-5.03 타임어택 실패 시 컨페티 미표시

#### 셀 웨이브 애니메이션 테스트
- [ ] 2-5.04 완료 시 `.cell.wave` 클래스 순차 적용 확인
- [ ] 2-5.05 웨이브 애니메이션이 좌상단→우하단 순서로 진행
- [ ] 2-5.06 웨이브 완료 후 `.wave` 클래스 자동 제거

#### 골든 글로우 테스트
- [ ] 2-5.07 완료 화면(`.complete-title`) 또는 그리드에 골든 글로우 효과 적용
- [ ] 2-5.08 다크 모드에서도 글로우 가시성 확인

#### Canvas 파티클 테스트
- [ ] 2-5.09 Canvas 기반 파티클이 있다면 `<canvas>` 요소 존재 확인
- [ ] 2-5.10 파티클 애니메이션이 일정 시간 후 자동 종료

---

### Phase 2-6: 풀이 시간 추이 그래프

**파일**: `tests/31-time-graph.spec.js`
**설명**: gameHistory 데이터로 난이도별 풀이 시간 꺾은선 차트. Canvas API

#### 화면 진입 테스트
- [ ] 2-6.01 통계 화면에 "풀이 시간 추이" 섹션 또는 탭 표시
- [ ] 2-6.02 데이터 없을 때 "데이터가 부족합니다" 메시지 표시

#### 그래프 렌더링 테스트
- [ ] 2-6.03 gameHistory에 3개 이상 항목 시딩 후 `<canvas>` 요소 렌더링
- [ ] 2-6.04 Canvas가 0이 아닌 너비/높이를 가짐
- [ ] 2-6.05 난이도별 필터: easy/normal/hard 선택 시 그래프 갱신

#### 데이터 정확성 테스트
- [ ] 2-6.06 X축: 날짜(완료일), Y축: 풀이 시간(초)
- [ ] 2-6.07 히스토리 항목 추가 후 그래프에 반영 확인
  ```javascript
  // localStorage에 테스트 데이터 시딩 → 화면 재진입 → canvas 확인
  ```

#### 반응형 테스트
- [ ] 2-6.08 화면 크기 변경 시 그래프 리사이즈

---

### Phase 2-7: 칭호/프로필 카드

**파일**: `tests/32-title-profile.spec.js`
**설명**: 레벨+업적 기반 칭호(초보자→장인→그랜드마스터), 프로필 카드

#### 칭호 표시 테스트
- [ ] 2-7.01 프로필 화면에 현재 칭호 표시 (`.player-title`)
- [ ] 2-7.02 메인 화면에 칭호 표시 (선택적)
- [ ] 2-7.03 레벨 1~5: "초보자" 칭호
- [ ] 2-7.04 레벨 증가에 따라 칭호 변경 (예: "견습생" → "장인" → "그랜드마스터")

#### 프로필 카드 테스트
- [ ] 2-7.05 프로필 화면에 카드형 UI (`.profile-card`)
- [ ] 2-7.06 카드에 레벨, 칭호, 총 게임수, 평균 시간 표시
- [ ] 2-7.07 카드 디자인이 다크/라이트 모드에서 정상 표시

#### 칭호 업데이트 테스트
- [ ] 2-7.08 레벨업 시 칭호 자동 갱신
  ```javascript
  // localStorage에 level 값 시딩 → 프로필 진입 → 칭호 텍스트 확인
  ```
- [ ] 2-7.09 칭호 데이터 localStorage 저장

---

### Phase 2-8: 퍼즐 결과 공유

**파일**: `tests/33-result-share.spec.js`
**설명**: Wordle 스타일 이모지 그리드 + Web Share API + 클립보드 폴백

#### UI 테스트
- [ ] 2-8.01 완료 화면에 "결과 공유" 버튼(`.btn-share-result` 또는 `[data-action="share"]`) 표시
- [ ] 2-8.02 타임어택 실패 시에도 공유 버튼 표시 여부 (선택적)

#### 이모지 그리드 생성 테스트
- [ ] 2-8.03 공유 버튼 클릭 시 이모지 기반 결과 텍스트 생성
  ```
  예: "스도쿠 리그 🏆
  난이도: 쉬움 | 시간: 03:45
  ⬛🟩⬛🟩⬛🟩⬛🟩⬛
  ..."
  ```
- [ ] 2-8.04 결과 텍스트에 난이도, 시간, 실수 횟수 포함
- [ ] 2-8.05 보드 크기별 올바른 그리드 생성 (4x4, 9x9 등)

#### 클립보드 복사 테스트
- [ ] 2-8.06 `navigator.share` 미지원 환경에서 클립보드 복사 폴백
- [ ] 2-8.07 복사 성공 시 "복사 완료!" 피드백 표시 (`.share-copied`)
- [ ] 2-8.08 클립보드 내용에 이모지 그리드 포함

#### Web Share API 테스트
- [ ] 2-8.09 `navigator.share` 지원 환경에서 OS 공유 다이얼로그 호출 확인
  ```javascript
  // page.evaluate에서 navigator.share 모킹 후 호출 여부 확인
  ```

---

## Phase 3: 큰 가치 (9개)

---

### Phase 3-1: 퍼즐 URL/QR 공유

**파일**: `tests/34-puzzle-share.spec.js`
**설명**: 퍼즐 데이터를 Base64 URL 인코딩, Canvas QR 코드 생성

#### URL 생성 테스트
- [ ] 3-1.01 히스토리 항목에 "퍼즐 공유" 버튼 표시 (`.btn-share-puzzle`)
- [ ] 3-1.02 클릭 시 공유 URL 생성 (URL에 `?puzzle=` 파라미터)
- [ ] 3-1.03 URL의 puzzle 파라미터가 Base64 인코딩 데이터
- [ ] 3-1.04 클립보드에 URL 복사 + "복사 완료" 피드백

#### URL 수신/로드 테스트
- [ ] 3-1.05 `?puzzle=...` 파라미터 포함 URL 접속 시 해당 퍼즐 자동 로드
- [ ] 3-1.06 로드된 퍼즐의 난이도/보드크기/variant 정확성
- [ ] 3-1.07 잘못된 puzzle 파라미터 시 에러 처리 (메인 화면 표시)
- [ ] 3-1.08 파라미터 없는 일반 접속 시 기존 메인 화면 표시

#### QR 코드 테스트
- [ ] 3-1.09 "QR 코드" 버튼 클릭 시 QR 이미지 표시 (Canvas 렌더링)
- [ ] 3-1.10 QR 코드가 공유 URL을 인코딩

#### 데이터 무결성 테스트
- [ ] 3-1.11 공유 URL → 로드 → 풀이 → 완료 가능 (정답 검증 통과)

---

### Phase 3-2: 리그/시즌 시스템

**파일**: `tests/35-league-season.spec.js`
**설명**: 4주 단위 시즌, 6단계 티어(Bronze~Legend), 가상 라이벌 9명

#### 시즌 화면 테스트
- [ ] 3-2.01 메인 화면에 시즌 배너(`.season-banner`) 또는 탭 표시
- [ ] 3-2.02 시즌 잔여 기간 표시
- [ ] 3-2.03 현재 티어 배지 표시 (`.tier-badge`)

#### 티어 시스템 테스트
- [ ] 3-2.04 6단계 티어 존재: Bronze, Silver, Gold, Platinum, Diamond, Legend
- [ ] 3-2.05 포인트 누적에 따라 티어 승격
  ```javascript
  // localStorage에 시즌 데이터 시딩 → 화면에서 티어 확인
  ```
- [ ] 3-2.06 시즌 종료 시 티어 리셋 (또는 한 단계 강등)

#### 가상 라이벌 테스트
- [ ] 3-2.07 라이벌 목록 9명 표시 (시드 기반 이름 생성)
- [ ] 3-2.08 라이벌 점수가 시간에 따라 변동 (시드 기반)
- [ ] 3-2.09 내 순위와 라이벌 순위 비교 표시

#### 시즌 전환 테스트
- [ ] 3-2.10 시즌 종료 후 새 시즌 시작 시 데이터 리셋
- [ ] 3-2.11 이전 시즌 결과 기록 보존

---

### Phase 3-3: 보상/해금 콘텐츠

**파일**: `tests/36-rewards-unlock.spec.js`
**설명**: 잠금 테마 10+개, 프로필 프레임, 레벨/업적/시즌으로 해금

#### 보상 목록 테스트
- [ ] 3-3.01 프로필 또는 보상 화면에 전체 보상 목록 표시
- [ ] 3-3.02 잠금 보상에 자물쇠 아이콘 + 해금 조건 텍스트
- [ ] 3-3.03 해금된 보상에 사용 가능 표시

#### 테마 해금 테스트
- [ ] 3-3.04 특정 레벨 도달 시 테마 해금
  ```javascript
  // localStorage에 level: 10 시딩 → 보상 화면에서 해금 확인
  ```
- [ ] 3-3.05 해금된 테마 설정 화면에서 선택 가능
- [ ] 3-3.06 미해금 테마는 설정에서 선택 불가

#### 프로필 프레임 해금 테스트
- [ ] 3-3.07 업적 달성으로 프로필 프레임 해금
- [ ] 3-3.08 프레임 프로필 카드에 적용 가능

#### 저장 테스트
- [ ] 3-3.09 해금 상태 localStorage 저장
- [ ] 3-3.10 새로고침 후 해금 상태 유지

---

### Phase 3-4: Killer Sudoku

**파일**: `tests/37-killer-sudoku.spec.js`
**설명**: 점선 케이지 + 합산 제약. `variant='killer'`

#### UI 테스트
- [ ] 3-4.01 `.variant-option[data-variant="killer"]` 클릭 시 active
- [ ] 3-4.02 게임 시작 후 `.variant-value` 텍스트 "킬러"
- [ ] 3-4.03 케이지 테두리 점선(`.cage-border` 또는 SVG 오버레이) 렌더링
- [ ] 3-4.04 각 케이지 좌상단에 합계 숫자(`.cage-sum`) 표시

#### 케이지 시각화 테스트
- [ ] 3-4.05 케이지 셀들이 동일한 `data-cage-id` 속성 공유
- [ ] 3-4.06 다크 모드에서 케이지 테두리/합계 가시성 확인
- [ ] 3-4.07 인쇄 화면에서 케이지 렌더링 확인

#### 규칙 검증 테스트
- [ ] 3-4.08 같은 케이지 내 중복 숫자 입력 시 충돌 에러
- [ ] 3-4.09 케이지 전체 채워졌을 때 합계 != 목표 시 에러 표시
- [ ] 3-4.10 표준 행/열/블록 규칙도 동시 적용

#### 퍼즐 생성 테스트
- [ ] 3-4.11 solution이 모든 케이지 합계 조건 충족
- [ ] 3-4.12 각 케이지 내 숫자 고유성 확인
- [ ] 3-4.13 케이지 크기 2~5 범위

#### 하이라이트 테스트
- [ ] 3-4.14 셀 선택 시 같은 케이지 셀 하이라이트

#### 저장/로드/히스토리 테스트
- [ ] 3-4.15 `getState()`에 `cages` 배열 포함
- [ ] 3-4.16 히스토리 `variant: 'killer'` + `cages` 저장, 재도전 시 동일 케이지 배치

---

### Phase 3-5: 단계적 힌트 (기법명 표시)

**파일**: `tests/38-step-hints.spec.js`
**설명**: 3단계 힌트 (방향→기법명→정답+설명). Naked Single, Hidden Pair, X-Wing 등 인식

#### 힌트 단계 테스트
- [ ] 3-5.01 1단계 힌트: "이 행을 살펴보세요" 방향 텍스트 (`.hint-direction`)
- [ ] 3-5.02 2단계 힌트: "Naked Single 기법 적용" 기법명 표시 (`.hint-technique`)
- [ ] 3-5.03 3단계 힌트: 정답 공개 + 풀이 설명 (`.hint-solution`)
- [ ] 3-5.04 같은 셀에 힌트 버튼 연속 클릭 시 단계 진행 (1→2→3)

#### 힌트 UI 테스트
- [ ] 3-5.05 힌트 패널(`.hint-panel`) 또는 토스트에 단계 내용 표시
- [ ] 3-5.06 관련 셀 하이라이트 (기법 적용 대상 셀 강조)
- [ ] 3-5.07 힌트 패널 닫기/해제 가능

#### 설정 호환성 테스트
- [ ] 3-5.08 `smartHints: false` 시 기존 1단계(직접 정답) 동작
- [ ] 3-5.09 `smartHints: true` 시 3단계 힌트 활성

#### 기법 감지 테스트
- [ ] 3-5.10 Naked Single 상황에서 올바른 기법 감지
- [ ] 3-5.11 Hidden Single 상황에서 올바른 기법 감지
- [ ] 3-5.12 기법 미감지 시 기본 "이 셀을 확인하세요" 폴백

---

### Phase 3-6: 사운드 효과

**파일**: `tests/39-sound-effects.spec.js`
**설명**: Web Audio API. 숫자입력/오류/행열완성/퍼즐완료. 설정 ON/OFF

#### 설정 테스트
- [ ] 3-6.01 설정 화면에 "사운드" 토글 (`sound` 설정)
- [ ] 3-6.02 OFF 시 모든 사운드 미재생
- [ ] 3-6.03 ON/OFF 저장 후 새로고침 시 유지

#### 사운드 트리거 테스트
- [ ] 3-6.04 숫자 입력 시 클릭 사운드 재생 확인
  ```javascript
  // SoundManager.play 호출 모킹 or AudioContext 상태 확인
  ```
- [ ] 3-6.05 오답 입력 시 경고 사운드
- [ ] 3-6.06 행/열/블록 완성 시 벨 사운드
- [ ] 3-6.07 퍼즐 완료 시 팡파레 사운드

#### 음소거 테스트
- [ ] 3-6.08 모바일 무음 모드에서 사운드 미재생 (선택적)
- [ ] 3-6.09 진동(`vibration`) 설정과 독립 작동

---

### Phase 3-7: 마이크로 인터랙션

**파일**: `tests/40-micro-interactions.spec.js`
**설명**: 숫자입력 바운스, 오류 셰이크, 메모 fade, 셀선택 페이드

#### 숫자 입력 바운스 테스트
- [ ] 3-7.01 셀에 숫자 입력 시 `.pop` 클래스 적용 (scale 0.8→1 애니메이션)
- [ ] 3-7.02 `animationend` 후 `.pop` 클래스 자동 제거

#### 오류 셰이크 테스트
- [ ] 3-7.03 오답 입력 시 `.shake` 클래스 적용
- [ ] 3-7.04 `animationend` 후 `.shake` 자동 제거

#### 메모 전환 테스트
- [ ] 3-7.05 메모 표시 시 fade-in 애니메이션
- [ ] 3-7.06 메모 제거 시 fade-out 애니메이션

#### 점수 플로트 테스트
- [ ] 3-7.07 정답 입력 시 `.score-float` 요소 생성 ("+250" 등)
- [ ] 3-7.08 score-float이 위로 떠오르며 사라짐 (1.5초 이내)
- [ ] 3-7.09 `scoreAnimation` 설정 OFF 시 score-float 미표시

---

### Phase 3-8: 컬러블라인드 모드

**파일**: `tests/41-colorblind.spec.js`
**설명**: 접근성 테마, 색상+패턴/아이콘 조합, 커스텀 팔레트

#### 설정 UI 테스트
- [ ] 3-8.01 설정 화면에 "색맹 모드" 옵션 표시
- [ ] 3-8.02 색맹 유형 선택: 적록, 청황, 전색맹 (또는 단일 토글)
- [ ] 3-8.03 선택 시 `body[data-colorblind="protanopia"]` 등 속성 적용

#### 시각적 변경 테스트
- [ ] 3-8.04 에러 셀: 빨간 배경 + X 아이콘 또는 밑줄 (`.error-icon`) 추가
- [ ] 3-8.05 `.highlighted` 셀: 색상 외 패턴(줄무늬/점) 또는 테두리로 구분
- [ ] 3-8.06 `.same-number` 하이라이트에 추가 시각 구분 (테두리 등)
- [ ] 3-8.07 컬러 마킹(Phase 1-6) 사용 시 색상+패턴 조합

#### 테마 호환성 테스트
- [ ] 3-8.08 색맹 모드 + 다크 모드 정상
- [ ] 3-8.09 색맹 모드 + 테마 스킨 정상
- [ ] 3-8.10 OFF 시 기본 스타일 복원

#### 저장 테스트
- [ ] 3-8.11 `sudoku_settings.colorBlind` 저장
- [ ] 3-8.12 새로고침 후 설정 유지

---

### Phase 3-9: 다국어 (i18n)

**파일**: `tests/42-i18n.spec.js`
**설명**: JSON 번역 파일(ko/en/ja), 하드코딩 문자열 추출, 플레이스홀더

#### 언어 전환 테스트
- [ ] 3-9.01 설정 화면에 "언어" 선택 옵션 (한국어/English/日本語)
- [ ] 3-9.02 한국어 선택 시 모든 UI 텍스트 한국어 표시
- [ ] 3-9.03 English 선택 시 모든 UI 텍스트 영어 표시
- [ ] 3-9.04 日本語 선택 시 모든 UI 텍스트 일본어 표시

#### 주요 화면별 번역 확인
- [ ] 3-9.05 메인 화면: "새 게임", "게임 기록", "인쇄" 등 번역
- [ ] 3-9.06 게임 화면: 난이도 라벨, 실수 표시, 툴바 버튼 번역
- [ ] 3-9.07 완료 화면: "점수", "시간", 메시지 번역
- [ ] 3-9.08 설정 화면: 모든 토글 라벨 번역

#### 동적 텍스트 번역 테스트
- [ ] 3-9.09 난이도 라벨 동적 번역 (easy → "Easy" / "쉬움" / "やさしい")
- [ ] 3-9.10 스트릭 메시지 번역 ("7일 연속!" 등)
- [ ] 3-9.11 업적 제목/설명 번역

#### 저장/레이아웃 테스트
- [ ] 3-9.12 언어 설정 `sudoku_settings.language` 저장
- [ ] 3-9.13 새로고침 후 언어 유지
- [ ] 3-9.14 영어 텍스트가 길어져도 레이아웃 깨지지 않음

---

## 공통 테스트 패턴

### 테스트 헬퍼 확장 (`tests/helpers.js`)

```javascript
// 기존 startNewGame에 variant 파라미터 이미 지원됨
await startNewGame(page, 'easy', { variant: 'anti-knight' });
await startNewGame(page, 'easy', { variant: 'anti-king' });
await startNewGame(page, 'easy', { variant: 'even-odd' });
await startNewGame(page, 'easy', { variant: 'windoku' });
await startNewGame(page, 'easy', { variant: 'killer' });
```

### 공통 Playwright 셀렉터 패턴

| 대상 | 셀렉터 |
|------|--------|
| 셀 | `.cell[data-row="R"][data-col="C"]` |
| 셀 값 | `.cell .cell-value` |
| given 셀 | `.cell.given` |
| 에러 셀 | `.cell.error` |
| 선택 셀 | `.cell.selected` |
| 하이라이트 | `.cell.highlighted` |
| 변형 선택 | `.variant-option[data-variant="X"]` |
| 게임 모드 | `.game-mode-option[data-game-mode="X"]` |
| 난이도 모달 | `#difficulty-modal .difficulty-option[data-difficulty="X"]` |
| 보드 크기 | `.size-option[data-size="N"]` |
| 메모 버튼 | `.btn-notes` |
| 힌트 버튼 | `.btn-hints` |
| 지우기 버튼 | `.btn-erase` |
| 실행취소 | `.btn-undo` |
| 넘버패드 | `.numberpad .num-btn[data-number="N"]` |
| info-bar 변형 | `.info-variant .variant-value` |
| 히스토리 진입 | `[data-navigate="history"]` |
| 재도전 | `.btn-replay` |
| 뒤로가기 | `[data-action="back"]` |
| 메인 이동 | `[data-navigate="main"]` |

### 공통 page.evaluate 패턴

```javascript
// 앱 상태 접근
const state = await page.evaluate(async () => {
    const mod = await import('./js/app.js');
    const app = mod.default;
    return {
        variant: app.board.variant,
        boardSize: app.board.boardSize,
        solution: app.board.getSolution(),
        board: app.board.getBoard(),
        score: app.board.getScore(),
        mistakes: app.board.getMistakes().current,
    };
});

// localStorage 직접 접근
const history = await page.evaluate(() => {
    return JSON.parse(localStorage.getItem('sudoku_gameHistory') || '[]');
});

// 설정 확인
const settings = await page.evaluate(() => {
    return JSON.parse(localStorage.getItem('sudoku_settings') || '{}');
});
```

### 테스트 실행 명령

```bash
# 전체 테스트
npx playwright test

# 특정 파일
npx playwright test tests/20-anti-knight.spec.js

# 특정 describe
npx playwright test -g "Anti-Knight"

# UI 모드 (디버깅)
npx playwright test --ui
```

---

## 테스트 수량 요약

| Phase | # | 기능 | 테스트 파일 | 시나리오 수 |
|-------|---|------|------------|:---------:|
| 1 | 1 | Anti-Knight 변형 | `20-anti-knight.spec.js` | 20 |
| 1 | 2 | Anti-King 변형 | `21-anti-king.spec.js` | 13 |
| 1 | 3 | 자동 메모 채우기 | `22-auto-notes.spec.js` | 12 |
| 1 | 4 | 스트릭 시스템 | `23-streak-system.spec.js` | 12 |
| 1 | 5 | 실수 자동 표시 토글 | `24-auto-error-check.spec.js` | 12 |
| 1 | 6 | 셀 컬러 마킹 | `25-cell-color-marking.spec.js` | 15 |
| 2 | 7 | XP/레벨 시스템 | `26-xp-level.spec.js` | 12 |
| 2 | 8 | 주간 챌린지 | `27-weekly-challenge.spec.js` | 11 |
| 2 | 9 | Even/Odd 변형 | `28-even-odd.spec.js` | 15 |
| 2 | 10 | Windoku (Hyper) | `29-windoku.spec.js` | 15 |
| 2 | 11 | 완료 축하 애니메이션 | `30-complete-animation.spec.js` | 10 |
| 2 | 12 | 풀이 시간 추이 그래프 | `31-time-graph.spec.js` | 8 |
| 2 | 13 | 칭호/프로필 카드 | `32-title-profile.spec.js` | 9 |
| 2 | 14 | 퍼즐 결과 공유 | `33-result-share.spec.js` | 9 |
| 3 | 15 | 퍼즐 URL/QR 공유 | `34-puzzle-share.spec.js` | 11 |
| 3 | 16 | 리그/시즌 시스템 | `35-league-season.spec.js` | 11 |
| 3 | 17 | 보상/해금 콘텐츠 | `36-rewards-unlock.spec.js` | 10 |
| 3 | 18 | Killer Sudoku | `37-killer-sudoku.spec.js` | 16 |
| 3 | 19 | 단계적 힌트 (기법명) | `38-step-hints.spec.js` | 12 |
| 3 | 20 | 사운드 효과 | `39-sound-effects.spec.js` | 9 |
| 3 | 21 | 마이크로 인터랙션 | `40-micro-interactions.spec.js` | 9 |
| 3 | 22 | 컬러블라인드 모드 | `41-colorblind.spec.js` | 12 |
| 3 | 23 | 다국어 (i18n) | `42-i18n.spec.js` | 14 |
| | | | **총합** | **277** |

---

## Playwright 설정 참조

```javascript
// playwright.config.js (현재)
module.exports = defineConfig({
    testDir: './tests',
    timeout: 30_000,
    expect: { timeout: 5_000 },
    fullyParallel: true,
    retries: 0,
    workers: 1,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:8899',
        viewport: { width: 428, height: 926 },
        actionTimeout: 10_000,
        screenshot: 'only-on-failure',
    },
    projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
    webServer: {
        command: 'python -m http.server 8899 --directory src',
        port: 8899,
        reuseExistingServer: true,
    },
});
```

---

> 이 문서는 기존 148개 E2E 테스트(01~19)와 동일한 Playwright 패턴을 따릅니다.
> 특히 `19-diagonal-variant.spec.js`가 변형 테스트의 완벽한 템플릿입니다.
> 각 기능 구현 완료 후 해당 테스트 파일을 작성하고 체크박스를 업데이트합니다.
> `tests/helpers.js`의 `startNewGame(page, difficulty, { variant })` 함수를 활용합니다.
