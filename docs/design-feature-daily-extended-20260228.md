# F5 - 일자별 플레이 모드 확장 설계문서

> 작성일: 2026-02-28
> 기능 ID: F5
> 의존성: 없음 (독립 구현 가능)

---

## 1. 기능 정의

### 1.1 사용자 스토리
- 사용자는 일일 도전 달력에서 미래 날짜를 포함한 모든 날짜를 선택하여 플레이할 수 있다.
- 각 날짜는 고유한 시드 기반 퍼즐을 가지며, 모든 사용자에게 동일한 퍼즐이 제공된다.
- 미래 날짜의 퍼즐도 사전에 플레이 가능하다.

### 1.2 현재 동작
- `daily.js:189` - `const isFuture = dateObj > today && dateStr !== todayStr;`
- `daily.js:213` - `if (!isFuture) { cell.addEventListener('click', ...) }` → 미래 날짜 클릭 차단
- `daily.js:90-93` - 과거 8개월만 탭 생성
- 미래 날짜 셀에 `.future` CSS 클래스 적용 → 흐리게 표시

### 1.3 변경 목표
- 미래 날짜도 클릭 가능 (플레이 가능)
- 달력 범위: 과거 6개월 + 미래 2개월
- 미래 날짜 시각 구분은 유지 (약간 다른 스타일)
- `daily-seed.js` 변경 불필요 (이미 임의 Date 지원)

---

## 2. 사용자 플로우

```
[메인 화면]
    │
    ▼ 하단 네비게이션 "일일 도전" 탭
[screen-daily]
    │
    ├── 월 탭: ... 12월 | 1월 | [2월] | 3월 | 4월
    │                              현재     미래
    ├── 달력 그리드
    │   ├── 과거 날짜: 클릭 가능, 완료 표시
    │   ├── 오늘: 강조 표시, 클릭 가능
    │   └── 미래 날짜: 클릭 가능, 투명도 0.7 표시
    │
    ▼ 날짜 선택 + [플레이] 클릭
[screen-game] (daily=true, date=선택날짜)
```

---

## 3. 수정 파일 상세

### 3.1 daily.js 변경사항

총 변경량: ~15줄 수정

#### 변경 1: 달력 범위 확장 (renderMonthTabs)

**현재 코드 (daily.js:88-93)**:
```javascript
const MONTHS_TO_SHOW = 8;
// ...
for (let i = MONTHS_TO_SHOW - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push(d);
}
```

**변경 후**:
```javascript
const MONTHS_PAST = 6;
const MONTHS_FUTURE = 2;
// ...
for (let i = MONTHS_PAST - 1; i >= -MONTHS_FUTURE; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push(d);
}
```

#### 변경 2: 미래 날짜 클릭 허용 (renderCalendar)

**현재 코드 (daily.js:211-218)**:
```javascript
if (!isFuture) {
    cell.addEventListener('click', () => {
        _selectedDate = dateStr;
        renderCalendar();
    });
}
```

**변경 후**:
```javascript
// 모든 날짜 클릭 가능 (미래 포함)
cell.addEventListener('click', () => {
    _selectedDate = dateStr;
    renderCalendar();
});
```

#### 변경 3: 기본 선택 날짜 로직 유지

현재 코드에서 미래 달 진입 시 첫째 날 선택 (daily.js:174-183) - 변경 불필요:
```javascript
if (!_selectedDate) {
    if (today.getFullYear() === year && today.getMonth() === month) {
        _selectedDate = todayStr;
    } else {
        _selectedDate = formatDate(new Date(year, month, 1));
    }
}
```

### 3.2 CSS 변경 (screens.css)

현재 `.calendar-day.future` 스타일이 존재한다면 유지, 없다면 추가:

```css
/* 미래 날짜: 약간 투명하게 표시하되 클릭 가능 */
.calendar-day.future {
    opacity: 0.7;
    cursor: pointer;  /* 클릭 가능 표시 */
}

.calendar-day.future:hover {
    opacity: 0.85;
}

/* 미래 날짜 선택 시 */
.calendar-day.future.selected {
    opacity: 1;
}
```

---

## 4. daily-seed.js 검증

변경 불필요 확인:

```javascript
// daily-seed.js:31-35 - getDailySeed(date)
// date 파라미터로 임의 Date 객체를 받으며 미래 날짜도 유효한 시드 생성
export function getDailySeed(date) {
    const d = date instanceof Date ? date : new Date();
    const dateString = formatDateString(d);
    return hashString(dateString);  // DJB2 해시 → 결정론적 시드
}

// daily-seed.js:68-72 - getDailyDifficulty(date)
// dayOfMonth 기반 사이클 → 미래 날짜도 동일하게 동작
export function getDailyDifficulty(date) {
    const d = date instanceof Date ? date : new Date();
    const dayOfMonth = d.getDate();
    return DIFFICULTY_CYCLE[(dayOfMonth - 1) % DIFFICULTY_CYCLE.length];
}
```

핵심: 해시 함수(DJB2)는 순수 함수이며 날짜 문자열만으로 시드를 생성하므로,
미래 날짜에 대해서도 동일한 입력 → 동일한 출력이 보장된다.

---

## 5. 엣지 케이스

| 상황 | 처리 |
|------|------|
| 미래 날짜 플레이 후 해당 날짜 도달 | 같은 시드 → 같은 퍼즐 (일관성 유지) |
| 미래 날짜 완료 후 달력 표시 | 완료 표시(dot) 정상 표시 |
| 미래 날짜 스트릭 | 연속 날짜 여부로 판단, 미래 포함 시 스트릭 연결 |
| 미래 달 탭에서 현재 달 아닌 경우 | 첫째 날 자동 선택 (기존 로직) |
| 2개월 이상 미래 | 달력 범위(미래 2개월)로 제한 |

### 5.1 스트릭 동작 정의

현재 스트릭 로직 (`complete.js:293-303`):
```javascript
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
if (daily.completed.includes(yesterdayStr)) {
    daily.streak++;
} else {
    daily.streak = 1;
}
```

미래 날짜 플레이 시: `yesterday`는 "오늘 기준 어제"이므로,
미래 날짜 완료는 스트릭에 직접 영향 없음.
→ 이 동작이 자연스러우므로 변경 불필요.

---

## 6. 테스트 포인트

1. 미래 날짜 셀 클릭 가능 여부
2. 미래 날짜 선택 후 [플레이] 버튼 동작
3. 미래 날짜 퍼즐 생성 정상 여부
4. 미래 날짜 완료 후 달력 완료 표시
5. 월 탭에 미래 2개월 포함 여부
6. 미래 월 탭 클릭 후 달력 정상 렌더링

---

## 7. 구현 난이도

**하** - 기존 코드 약 15줄 수정으로 구현 가능
- `daily.js`: 약 10줄 변경
- `screens.css`: 약 5줄 추가
- 신규 파일 없음
- 기존 테스트 영향 최소 (미래 날짜 클릭 테스트가 없었으므로)
