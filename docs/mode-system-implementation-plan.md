# 모드 시스템 (타임어택 / 서바이벌) 구현 계획

**작성일**: 2026-02-27
**상태**: 분석 완료, 구현 대기
**담당**: game-analyzer

---

## 1. 개요

현재 스도쿠 리그는 **일반 모드** (무제한 시간)만 지원합니다. 타임어택/서바이벌 모드 시스템 추가를 위한 상세 구현 계획입니다.

### 목표
- Timer 카운트다운 확장
- Storage 모드별 분리
- 라우팅 모드 선택 단계 추가
- 게임/완료 화면 모드별 분기
- 통계 모드별 추적

---

## 2. 핵심 컴포넌트 분석

### 2.1 Timer (게임/timer.js, 135줄)

#### 현재 구조
```javascript
class Timer {
    _elapsed: number              // 누적 경과시간 (ms)
    _startTimestamp: number       // performance.now()
    _running: boolean
    _onTick: Function             // 1초마다 콜백

    start()                       // 시작/재개
    pause()                       // 일시정지
    reset()                       // 리셋
    getElapsed()                  // 경과 초 반환 (정수)
    getFormatted()                // "MM:SS" 반환
    setElapsed(seconds)           // 저장된 시간 복구
    onTick(callback)              // 콜백 등록
}
```

#### 확장 방안
```javascript
// 새 속성
_duration: number | null         // 제한 시간 (타임어택용, ms)
_isCountdown: boolean            // 카운트다운 모드 플래그

// 새 메서드
setDuration(seconds) {
    this._duration = seconds * 1000;
}

setCountdown(isCountdown) {
    this._isCountdown = isCountdown;
}

isTimeUp() {
    return this._isCountdown && this.getElapsed() <= 0;
}

getElapsed() {  // 수정
    let total = this._elapsed;
    if (this._running && this._startTimestamp !== null) {
        total += performance.now() - this._startTimestamp;
    }
    const elapsed = Math.floor(total / 1000);

    if (this._isCountdown && this._duration) {
        return Math.max(0, Math.floor((this._duration - total) / 1000));
    }
    return elapsed;
}
```

**호환성**: 기존 코드 영향 없음 (기본값 유지)

---

### 2.2 Scorer (코어/scorer.js, 104줄)

#### 현재 점수 공식

**셀 점수**:
```
score = 250 × difficulty_multiplier × notesFactor × timeFactor

- difficulty_multiplier: easy=1, normal=1.5, hard=2, expert=2.5, master=3
- notesFactor: 0.75 (메모 사용) | 1.0
- timeFactor: max(0.5, exp(-0.001 × time))  // 시간 패널티
```

**완료 보너스**:
```
bonus = 1000 × difficulty_multiplier × mistakeFactor × timeFactor

- mistakeFactor: max(0, 1 - 0.2 × mistakes)
- timeFactor: max(0.3, exp(-0.0005 × time))
```

#### 타임어택 확장

```javascript
export function calculateTimeAttackBonus(
    difficulty,      // 난이도
    remainingSeconds, // 남은 시간
    mistakes,         // 실수 횟수
    totalTimeLimit    // 제한시간 (예: 180초)
) {
    const multiplier = getDifficultyMultiplier(difficulty);

    // 남은 시간 보너스 (시간을 많이 남길수록 큼)
    const timeBonus = remainingSeconds / totalTimeLimit;  // 0.0 ~ 1.0

    // 실수 페널티 (동일)
    const mistakeFactor = Math.max(0, 1 - 0.2 * mistakes);

    // 보너스 = 500 (기본) × 난이도배수 × 시간보너스 × 실수페널티
    const bonus = 500 * multiplier * timeBonus * mistakeFactor;

    return Math.floor(bonus);
}
```

**예시**:
- Expert 난이도, 60초 남음, 1개 실수, 180초 제한
- 보너스 = 500 × 2.5 × (60/180) × (1 - 0.2×1)
- = 500 × 2.5 × 0.333 × 0.8 = **333점**

---

### 2.3 Storage (유틸/storage.js, 340줄)

#### 현재 키 구조
```
sudoku_currentGame    // 진행 중 게임
sudoku_stats          // 난이도별 통계 (일괄)
sudoku_settings       // 사용자 설정
sudoku_dailyChallenge // 일일도전
```

#### 모드별 분리 전략 (권장)

```
sudoku_stats_normal      // 일반 모드
sudoku_stats_timeAttack  // 타임어택 모드
sudoku_stats_survival    // 서바이벌 모드
```

#### 구현 코드

```javascript
// --- Storage 함수 확장 ---

const MODES = ['normal', 'timeAttack', 'survival'];

function getStatsKey(mode = 'normal') {
    if (!MODES.includes(mode)) mode = 'normal';
    return `sudoku_stats_${mode}`;
}

export function loadStats(mode = 'normal') {
    const key = getStatsKey(mode);
    const stored = readJSON(key);
    if (!stored || typeof stored !== 'object') {
        return getDefaultStats();
    }

    // 병합 (기존 로직 동일)
    const merged = getDefaultStats();
    for (const diff of DIFFICULTIES) {
        if (stored[diff] && typeof stored[diff] === 'object') {
            merged[diff] = { ...merged[diff], ...stored[diff] };
            merged[diff].highScores = {
                ...getDefaultDifficultyStats().highScores,
                ...(stored[diff].highScores || {}),
            };
        }
    }
    return merged;
}

export function saveStats(stats, mode = 'normal') {
    const key = getStatsKey(mode);
    writeJSON(key, stats);
}

// --- 마이그레이션 (app.js init에서 한 번만 실행) ---

function migrateStorageIfNeeded() {
    // 기존 sudoku_stats를 sudoku_stats_normal으로 이전
    const oldStats = readJSON('sudoku_stats');
    if (oldStats && !readJSON('sudoku_stats_normal')) {
        writeJSON('sudoku_stats_normal', oldStats);
        try { localStorage.removeItem('sudoku_stats'); } catch {}
    }
}
```

#### 게임 상태에 mode 필드 추가

```javascript
// currentGame 구조에 추가
{
    mode: 'normal' | 'timeAttack' | 'survival',  // NEW
    difficulty: string,
    board: number[],
    solution: number[],
    // ... 기존 필드
}
```

---

## 3. 라우팅 & UI 플로우

### 3.1 현재 플로우
```
main → [난이도모달] → game → complete → main
```

### 3.2 신규 플로우
```
main → [모드모달] → [난이도모달] → game → complete → main
```

### 3.3 모드 모달 구현 (app.js)

```javascript
// HTML (index.html 추가)
<div id="mode-modal" class="modal" style="display: none;">
    <div class="modal-content">
        <h2>게임 모드 선택</h2>
        <div class="mode-option" data-mode="normal">
            <div class="mode-name">일반 모드</div>
            <div class="mode-desc">무제한 시간</div>
        </div>
        <div class="mode-option" data-mode="timeAttack">
            <div class="mode-name">타임어택</div>
            <div class="mode-desc">3분 안에 완료</div>
        </div>
        <div class="mode-option" data-mode="survival">
            <div class="mode-name">서바이벌</div>
            <div class="mode-desc">실수 3개까지</div>
        </div>
    </div>
</div>

// JavaScript (app.js)
let selectedMode = 'normal';

function showModeModal() {
    const modal = document.getElementById('mode-modal');
    if (modal) modal.style.display = '';
}

function hideModeModal() {
    const modal = document.getElementById('mode-modal');
    if (modal) modal.style.display = 'none';
}

// 모달에서 모드 선택 시
const modeModal = document.getElementById('mode-modal');
if (modeModal) {
    modeModal.querySelectorAll('.mode-option').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedMode = btn.getAttribute('data-mode');
            hideModeModal();
            showDifficultyModal();  // 난이도 모달로 진행
        });
    });
}

// 난이도 선택 시 (기존 코드 수정)
difficultyModal.querySelectorAll('.difficulty-option').forEach(btn => {
    btn.addEventListener('click', () => {
        const difficulty = btn.getAttribute('data-difficulty');
        hideDifficultyModal();
        navigate('game', {
            mode: selectedMode,      // NEW
            difficulty,
            daily: false,
            loadSaved: false
        });
    });
});
```

---

## 4. 게임 화면 구현 (screens/game.js)

### 4.1 모드별 분기 포인트

#### 분기 1: 게임 시작 (startNewGame)
```javascript
function startNewGame(difficulty, dailyDate, mode = 'normal') {
    _app.board.newGame(difficulty, dailyDate, mode);

    // 모드별 타이머 초기화
    if (mode === 'timeAttack') {
        _app.board.timer.setDuration(180);      // 3분
        _app.board.timer.setCountdown(true);
    } else {
        _app.board.timer.setCountdown(false);
    }

    // 타이머 틱 콜백
    _app.board.timer.onTick((formatted) => {
        if (timerValueEl && _app.settings.timer) {
            timerValueEl.textContent = formatted;

            // 모드별 UI
            if (mode === 'timeAttack') {
                const remaining = _app.board.timer.getElapsed();
                if (remaining <= 10) {
                    timerValueEl.classList.add('timer-danger');
                } else if (remaining <= 30) {
                    timerValueEl.classList.add('timer-warning');
                }
            }
        }
    });

    resetGameUI(difficulty, mode);
    renderFullGrid();
    updateGamesStarted(difficulty, mode);
}
```

#### 분기 2: UI 초기화 (resetGameUI)
```javascript
function resetGameUI(difficulty, mode = 'normal') {
    if (difficultyValueEl) {
        difficultyValueEl.textContent = DIFFICULTY_LABELS[difficulty] || difficulty;
    }

    // 모드별 타이머 스타일
    if (timerValueEl) {
        timerValueEl.textContent = '00:00';
        if (mode === 'timeAttack') {
            timerValueEl.style.color = '#FF6B6B';  // 빨강
        } else {
            timerValueEl.style.color = 'inherit';
        }
    }

    // 기존 UI 리셋...
}
```

#### 분기 3: 시간 초과 체크 (매 입력 시)
```javascript
document.addEventListener('cell-updated', (e) => {
    onCellUpdated(e.detail);

    // 타임어택 모드: 시간 초과 체크
    if (_app.board.mode === 'timeAttack' && _app.board.timer.isTimeUp()) {
        if (_app.board && _app.board.timer) {
            _app.board.timer.pause();
        }
        handleTimeExpired();
    }
});

function handleTimeExpired() {
    clearGame();
    setTimeout(() => {
        _app.navigate('complete', {
            mode: 'timeAttack',
            isTimeout: true,  // NEW
            time: _app.board.timer.getElapsed(),
            score: 0,  // 타임어택은 시간 초과 시 0점
            difficulty: _app.board.getDifficulty(),
            mistakes: _app.board.getMistakes().current,
        });
    }, 500);
}
```

#### 분기 4: 게임 완료 (onGameComplete)
```javascript
function onGameComplete(detail) {
    if (_app.board && _app.board.timer) {
        _app.board.timer.pause();
    }

    const difficulty = _app.board?.getDifficulty() || 'easy';
    const mode = _app.board?.mode || 'normal';
    const mistakes = _app.board?.getMistakes().current || 0;
    let score = detail.score;

    // 모드별 점수 계산
    if (mode === 'timeAttack') {
        const remaining = _app.board.timer.getElapsed();
        const timeAttackBonus = calculateTimeAttackBonus(
            difficulty,
            remaining,
            mistakes,
            180  // 3분 제한
        );
        score = timeAttackBonus;
    }

    const completeParams = {
        mode,          // NEW
        score,
        time: detail.time,
        difficulty,
        mistakes,
        isDaily,
        remainingTime: mode === 'timeAttack' ? _app.board.timer.getElapsed() : null,
    };

    animateCompletionWave(_app.gridUI, () => {
        _app.navigate('complete', completeParams);
    });
}
```

---

## 5. 완료 화면 구현 (screens/complete.js)

### 5.1 모드별 결과 표시

```javascript
function onShow(params) {
    const {
        mode = 'normal',
        score = 0,
        time = 0,
        difficulty = 'easy',
        mistakes = 0,
        isDaily = false,
        isTimeout = false,
        remainingTime = null,
    } = params;

    // --- 기본 정보 표시 ---
    if (difficultyEl) {
        difficultyEl.textContent = DIFFICULTY_LABELS[difficulty] || difficulty;
    }
    if (timeEl) {
        timeEl.textContent = formatTime(time);
    }

    // --- 점수 카운트업 애니메이션 ---
    if (scoreEl) {
        scoreEl.textContent = '0';
        const finalScore = isTimeout ? 0 : score;
        animateScoreCountUp(scoreEl, finalScore, 1500);
    }

    // --- 모드별 메시지 ---
    if (messageEl) {
        let message = '';

        if (isTimeout) {
            message = '⏱️ 시간 초과! 타임어택 실패';
        } else if (mode === 'timeAttack') {
            message = `✨ 타임어택 완료! 남은 시간: ${remainingTime}초`;
        } else if (mode === 'survival') {
            message = `🎯 ${Math.floor(time / 60)}분 생존 성공!`;
        } else {
            // 일반 모드: 기존 best time 메시지
            const recordMessage = updateStats(difficulty, score, time, mistakes, mode);
            message = recordMessage || '';
        }

        if (_app.settings.statsMessage) {
            messageEl.textContent = message;
        }
    }

    // --- 통계 업데이트 ---
    if (!isTimeout) {
        updateStats(difficulty, score, time, mistakes, mode);
    }

    // --- 고점 표시 업데이트 ---
    updateHighScoreDisplay(difficulty, mode);

    // --- 기타 처리 (컨페티 등) ---
    clearGame();
    if (confettiArea && !isTimeout) {
        confettiArea.innerHTML = '';
        createConfetti(confettiArea, 50);
    }
}

// updateStats 함수 수정
function updateStats(difficulty, score, time, mistakes, mode = 'normal') {
    const stats = loadStats(mode);  // NEW: 모드 파라미터
    const ds = stats[difficulty];
    if (!ds) return '';

    let message = '';

    // ... 기존 로직 동일 (gamesWon, bestTime 등)

    saveStats(stats, mode);  // NEW: 모드 파라미터

    return message;
}
```

---

## 6. 통계 화면 확장 (screens/stats.js, 선택사항)

### 6.1 모드별 탭 추가

```javascript
const MODES = ['normal', 'timeAttack', 'survival'];
const DIFFICULTIES = ['easy', 'normal', 'hard', 'expert', 'master'];

let _activeMode = 'normal';
let _activeDifficulty = 'easy';

function renderStats() {
    const allStats = loadStats(_activeMode);  // NEW: 모드 파라미터
    const stats = allStats[_activeDifficulty] || {};

    // ... 기존 render 로직
}

// HTML에 모드 탭 추가
// <div id="mode-tabs" class="mode-tabs">
//   <button class="mode-tab" data-mode="normal">일반</button>
//   <button class="mode-tab" data-mode="timeAttack">타임어택</button>
//   <button class="mode-tab" data-mode="survival">서바이벌</button>
// </div>

function initStatsScreen(app) {
    _app = app;

    // 모드 탭 핸들러 추가
    const modeTabs = document.getElementById('mode-tabs');
    if (modeTabs) {
        modeTabs.addEventListener('click', (e) => {
            const tab = e.target.closest('.mode-tab');
            if (tab) {
                _activeMode = tab.getAttribute('data-mode');
                updateModeTabUI();
                renderStats();
            }
        });
    }

    // 기존 difficulty 탭 로직...
}

function updateModeTabUI() {
    const tabs = document.querySelectorAll('.mode-tab');
    tabs.forEach(tab => {
        if (tab.getAttribute('data-mode') === _activeMode) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}
```

---

## 7. 구현 순서 (Phase별)

### Phase 1: 코어 로직 (3~4시간)
1. **timer.js**: setDuration, setCountdown, isTimeUp 메서드 추가
2. **scorer.js**: calculateTimeAttackBonus 함수 추가
3. **storage.js**: 모드별 키 분리, 마이그레이션 함수
4. **board.js**: mode 필드 추가, newGame(mode) 파라미터

### Phase 2: 라우팅 (1~2시간)
5. **app.js**: showModeModal, hideModeModal, 모드 선택 핸들러
6. **index.html**: mode-modal HTML 추가

### Phase 3: 게임 화면 (2~3시간)
7. **game.js**: 4개 분기 포인트 구현
   - startNewGame(mode)
   - resetGameUI(mode)
   - 시간 초과 체크
   - 모드별 점수 계산

### Phase 4: 완료 화면 (1~2시간)
8. **complete.js**: onShow(params.mode) 처리, 모드별 메시지
9. **main.js**: 모드 모달 연결 확인

### Phase 5: 선택사항 (1시간)
10. **stats.js**: 모드별 탭 추가
11. **settings.js**: 타임어택 시간 설정 추가 (필요시)

### Phase 6: 마무리 (2~3시간)
12. **테스트**: 각 모드별 E2E 테스트
13. **마이그레이션**: localStorage 자동 마이그레이션 테스트
14. **sw.js**: CACHE_NAME 업데이트 (`sudoku-v4`)

---

## 8. 주의사항

### 8.1 하위 호환성
- 모든 새 파라미터는 기본값 설정 (mode='normal')
- 기존 게임 저장파일에 mode 없으면 'normal'으로 처리
- localStorage 마이그레이션 자동 실행

### 8.2 UI 스타일
- 타이머 색상: 일반(검정) vs 타임어택(빨강)
- CSS 클래스: `.timer-warning` (30초↓), `.timer-danger` (10초↓)

### 8.3 성능
- Timer.isTimeUp() 체크는 매 cell-updated 이벤트마다 (영향 미미)
- Storage 키가 3개로 증가 (모드당 1개 통계)

---

## 9. 검증 체크리스트

- [ ] Timer 카운트다운 동작 확인
- [ ] 타임어택 3분 제한 작동
- [ ] 시간 초과 → complete 화면 전환
- [ ] Storage 모드별 분리 (stats_normal 등)
- [ ] 마이그레이션: 기존 stats → stats_normal
- [ ] 모드 모달 → 난이도 모달 → 게임 플로우
- [ ] 완료 화면 모드별 메시지 표시
- [ ] 통계 화면 모드별 데이터 확인 (선택사항)
- [ ] E2E 테스트 (일반 / 타임어택 / 서바이벌)
- [ ] Service Worker 캐시 갱신

---

## 10. 참고 자료

- **상세 분석**: `memory/game-layer-analysis.md` (633줄)
- **메모리**: `memory/MEMORY.md` (게임 레이어 섹션)

---

**다음 단계**: Phase 1 구현 승인 대기
