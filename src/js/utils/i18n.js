/**
 * Internationalization (i18n) Module
 *
 * Provides simple key-based translation with Korean as default
 * and English as secondary language.
 *
 * @module utils/i18n
 */

// ---------------------------------------------------------------------------
// Translation dictionaries
// ---------------------------------------------------------------------------

const TRANSLATIONS = {
    ko: {
        // Navigation
        'nav.home': '메인',
        'nav.daily': '일일 도전',
        'nav.profile': '나',
        // Main screen
        'main.newGame': '새 게임',
        'main.continue': '게임 계속하기',
        'main.daily': '일일 도전',
        'main.weekly': '주간 챌린지',
        'main.history': '게임 기록',
        'main.print': '인쇄',
        'main.bestScore': '통산 최고 점수',
        'main.dailyCard': '일일 도전',
        'main.dailyBtn': '계속하기',
        // Mode select
        'mode.title': '게임 모드',
        'mode.gameMode': '게임 모드',
        'mode.classic': '클래식',
        'mode.classicDesc': '무제한 시간',
        'mode.timeAttack': '타임어택',
        'mode.timeAttackDesc': '제한 시간 도전',
        'mode.timeLimit': '제한 시간',
        'mode.boardSize': '보드 크기',
        'mode.variant': '변형 규칙',
        'mode.printCount': '출력 갯수',
        'mode.next': '다음',
        // Variants
        'variant.standard': '기본',
        'variant.standardDesc': '행/열/블록',
        'variant.diagonal': '대각선',
        'variant.diagonalDesc': '+ 대각선 규칙',
        'variant.antiKnight': '안티나이트',
        'variant.antiKnightDesc': '+ 나이트 이동 제약',
        'variant.antiKing': '안티킹',
        'variant.antiKingDesc': '+ 대각 인접 제약',
        'variant.evenOdd': '짝홀',
        'variant.evenOddDesc': '+ 짝수/홀수 제약',
        'variant.windoku': '윈도쿠',
        'variant.windokuDesc': '+ 4개 윈도우 영역',
        // Game
        'game.undo': '실행취소',
        'game.erase': '지우기',
        'game.notes': '메모',
        'game.marking': '마킹',
        'game.hint': '힌트',
        'game.autoNotes': '자동메모',
        'game.difficulty': '난이도',
        'game.variant': '변형',
        'game.mistakes': '실수',
        'game.time': '시간',
        // Difficulty
        'difficulty.select': '난이도 선택',
        'difficulty.easy': '쉬움',
        'difficulty.normal': '보통',
        'difficulty.hard': '어려움',
        'difficulty.expert': '전문가',
        'difficulty.master': '마스터',
        // Complete
        'complete.title': '축하합니다!',
        'complete.score': '점수',
        'complete.time': '시간',
        'complete.difficulty': '난이도',
        'complete.highScores': '최고 점수',
        'complete.today': '오늘',
        'complete.thisWeek': '이번 주',
        'complete.thisMonth': '이번 달',
        'complete.allTime': '통산',
        'complete.share': '결과 공유',
        'complete.newGame': '새 게임',
        'complete.main': '메인',
        // Stats
        'stats.title': '통계',
        'stats.games': '게임',
        'stats.gamesStarted': '시작한 게임',
        'stats.gamesWon': '승리한 게임',
        'stats.winRate': '승률',
        'stats.noMistakeWins': '실수 없이 승리',
        'stats.time': '시간',
        'stats.bestTime': '최고 시간',
        'stats.avgTime': '평균 시간',
        'stats.streaks': '연승',
        'stats.currentStreak': '현재 연승',
        'stats.bestStreak': '최고 연승',
        'stats.highScores': '최고 점수',
        'stats.reset': '통계 초기화',
        // Settings
        'settings.title': '설정',
        'settings.darkMode': '다크 모드',
        'settings.theme': '테마',
        'settings.sound': '사운드',
        'settings.vibration': '진동',
        'settings.autoLock': '자동 잠금',
        'settings.timer': '타이머',
        'settings.scoreAnimation': '점수 애니메이션',
        'settings.animations': '애니메이션 효과',
        'settings.statsMessage': '통계 메시지',
        'settings.smartHints': '스마트 힌트',
        'settings.numberFirst': '숫자 우선 입력',
        'settings.mistakeLimit': '실수 한도',
        'settings.autoCheckMistakes': '실수 자동 표시',
        'settings.language': '언어',
        // Ranking
        'ranking.title': '랭킹',
        'ranking.all': '전체',
        'ranking.thisMonth': '이번 달',
        'ranking.thisWeek': '이번 주',
        'ranking.today': '오늘',
        // Other
        'daily.title': '일일 도전',
        'daily.play': '플레이',
        'awards.title': '어워드',
        'rules.title': '규칙',
        'tutorial.title': '플레이 방법',
        'history.title': '게임 기록',
        'print.title': '인쇄',
        'print.answerKey': '모범답안 (정답 표시)',
        'print.doPrint': '인쇄하기',
        'pause.title': '일시정지',
        'pause.resume': '계속하기',
    },
    en: {
        // Navigation
        'nav.home': 'Home',
        'nav.daily': 'Daily',
        'nav.profile': 'Me',
        // Main screen
        'main.newGame': 'New Game',
        'main.continue': 'Continue Game',
        'main.daily': 'Daily Challenge',
        'main.weekly': 'Weekly Challenge',
        'main.history': 'Game History',
        'main.print': 'Print',
        'main.bestScore': 'All-Time Best Score',
        'main.dailyCard': 'Daily Challenge',
        'main.dailyBtn': 'Continue',
        // Mode select
        'mode.title': 'Game Mode',
        'mode.gameMode': 'Game Mode',
        'mode.classic': 'Classic',
        'mode.classicDesc': 'No time limit',
        'mode.timeAttack': 'Time Attack',
        'mode.timeAttackDesc': 'Beat the clock',
        'mode.timeLimit': 'Time Limit',
        'mode.boardSize': 'Board Size',
        'mode.variant': 'Variant Rules',
        'mode.printCount': 'Print Count',
        'mode.next': 'Next',
        // Variants
        'variant.standard': 'Standard',
        'variant.standardDesc': 'Row/Col/Block',
        'variant.diagonal': 'Diagonal',
        'variant.diagonalDesc': '+ Diagonal rule',
        'variant.antiKnight': 'Anti-Knight',
        'variant.antiKnightDesc': '+ Knight constraint',
        'variant.antiKing': 'Anti-King',
        'variant.antiKingDesc': '+ King constraint',
        'variant.evenOdd': 'Even-Odd',
        'variant.evenOddDesc': '+ Even/Odd constraint',
        'variant.windoku': 'Windoku',
        'variant.windokuDesc': '+ 4 window regions',
        // Game
        'game.undo': 'Undo',
        'game.erase': 'Erase',
        'game.notes': 'Notes',
        'game.marking': 'Mark',
        'game.hint': 'Hint',
        'game.autoNotes': 'Auto Notes',
        'game.difficulty': 'Difficulty',
        'game.variant': 'Variant',
        'game.mistakes': 'Mistakes',
        'game.time': 'Time',
        // Difficulty
        'difficulty.select': 'Select Difficulty',
        'difficulty.easy': 'Easy',
        'difficulty.normal': 'Normal',
        'difficulty.hard': 'Hard',
        'difficulty.expert': 'Expert',
        'difficulty.master': 'Master',
        // Complete
        'complete.title': 'Congratulations!',
        'complete.score': 'Score',
        'complete.time': 'Time',
        'complete.difficulty': 'Difficulty',
        'complete.highScores': 'High Scores',
        'complete.today': 'Today',
        'complete.thisWeek': 'This Week',
        'complete.thisMonth': 'This Month',
        'complete.allTime': 'All Time',
        'complete.share': 'Share Result',
        'complete.newGame': 'New Game',
        'complete.main': 'Home',
        // Stats
        'stats.title': 'Statistics',
        'stats.games': 'Games',
        'stats.gamesStarted': 'Games Started',
        'stats.gamesWon': 'Games Won',
        'stats.winRate': 'Win Rate',
        'stats.noMistakeWins': 'No-Mistake Wins',
        'stats.time': 'Time',
        'stats.bestTime': 'Best Time',
        'stats.avgTime': 'Avg Time',
        'stats.streaks': 'Streaks',
        'stats.currentStreak': 'Current Streak',
        'stats.bestStreak': 'Best Streak',
        'stats.highScores': 'High Scores',
        'stats.reset': 'Reset Stats',
        // Settings
        'settings.title': 'Settings',
        'settings.darkMode': 'Dark Mode',
        'settings.theme': 'Theme',
        'settings.sound': 'Sound',
        'settings.vibration': 'Vibration',
        'settings.autoLock': 'Auto Lock',
        'settings.timer': 'Timer',
        'settings.scoreAnimation': 'Score Animation',
        'settings.animations': 'Animations',
        'settings.statsMessage': 'Stats Message',
        'settings.smartHints': 'Smart Hints',
        'settings.numberFirst': 'Number First Input',
        'settings.mistakeLimit': 'Mistake Limit',
        'settings.autoCheckMistakes': 'Auto Check Mistakes',
        'settings.language': 'Language',
        // Ranking
        'ranking.title': 'Ranking',
        'ranking.all': 'All',
        'ranking.thisMonth': 'This Month',
        'ranking.thisWeek': 'This Week',
        'ranking.today': 'Today',
        // Other
        'daily.title': 'Daily Challenge',
        'daily.play': 'Play',
        'awards.title': 'Awards',
        'rules.title': 'Rules',
        'tutorial.title': 'How to Play',
        'history.title': 'Game History',
        'print.title': 'Print',
        'print.answerKey': 'Answer Key',
        'print.doPrint': 'Print',
        'pause.title': 'Paused',
        'pause.resume': 'Resume',
    },
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentLocale = 'ko';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get a translated string for the given key.
 *
 * @param {string} key - Translation key (e.g. 'nav.home').
 * @returns {string} The translated string, falling back to Korean, then the raw key.
 */
export function t(key) {
    const dict = TRANSLATIONS[currentLocale] || TRANSLATIONS['ko'];
    return dict[key] || TRANSLATIONS['ko'][key] || key;
}

/**
 * Set the active locale and apply translations to all data-i18n elements.
 *
 * @param {string} locale - Locale code (e.g. 'ko', 'en').
 */
export function setLocale(locale) {
    if (TRANSLATIONS[locale]) {
        currentLocale = locale;
    }
    applyTranslations();
}

/**
 * Get the current locale.
 *
 * @returns {string}
 */
export function getLocale() {
    return currentLocale;
}

/**
 * Apply translations to all elements with data-i18n or data-i18n-placeholder attributes.
 */
export function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });
}

/**
 * Get list of supported locale codes.
 *
 * @returns {string[]}
 */
export function getSupportedLocales() {
    return Object.keys(TRANSLATIONS);
}
