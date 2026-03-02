/**
 * Achievements System
 *
 * Defines all achievements, evaluates unlock conditions against current data,
 * and persists unlock timestamps to localStorage.
 *
 * @module utils/achievements
 */

import { loadStats, loadDailyChallenge, loadGameHistory } from './storage.js';

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'sudoku_achievements';

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const ACHIEVEMENT_CATEGORIES = [
    { key: 'beginner', label: '첫걸음' },
    { key: 'skill', label: '실력' },
    { key: 'daily', label: '일일도전' },
    { key: 'challenge', label: '도전' },
];

// ---------------------------------------------------------------------------
// Achievement definitions
// ---------------------------------------------------------------------------

export const ACHIEVEMENTS = [
    // --- 첫걸음 (4) ---
    {
        id: 'firstWin', category: 'beginner', icon: '\u2B50', title: '첫 승리',
        desc: '게임 1회 승리',
        check: (d) => d.totalWins >= 1,
    },
    {
        id: 'firstDaily', category: 'beginner', icon: '\uD83D\uDCC5', title: '첫 일일도전',
        desc: '일일 도전 1회 완료',
        check: (d) => d.dailyCompleted >= 1,
    },
    {
        id: 'firstPerfect', category: 'beginner', icon: '\uD83D\uDC8E', title: '완벽한 시작',
        desc: '실수 없이 1회 승리',
        check: (d) => d.totalNoMistake >= 1,
    },
    {
        id: 'firstTimeAttack', category: 'beginner', icon: '\u23F0', title: '시간과의 싸움',
        desc: '타임어택 1회 승리',
        check: (d) => d.timeAttackWins >= 1,
    },

    // --- 실력 (6) ---
    {
        id: 'win10', category: 'skill', icon: '\uD83C\uDFC5', title: '10승 달성',
        desc: '총 10회 승리',
        check: (d) => d.totalWins >= 10,
    },
    {
        id: 'win50', category: 'skill', icon: '\uD83C\uDF96\uFE0F', title: '50승 달성',
        desc: '총 50회 승리',
        check: (d) => d.totalWins >= 50,
    },
    {
        id: 'win100', category: 'skill', icon: '\uD83D\uDC51', title: '100승 달성',
        desc: '총 100회 승리',
        check: (d) => d.totalWins >= 100,
    },
    {
        id: 'perfect5', category: 'skill', icon: '\uD83D\uDCAF', title: '완벽주의자',
        desc: '실수 없이 5회 승리',
        check: (d) => d.totalNoMistake >= 5,
    },
    {
        id: 'perfect20', category: 'skill', icon: '\uD83C\uDF1F', title: '장인의 손길',
        desc: '실수 없이 20회 승리',
        check: (d) => d.totalNoMistake >= 20,
    },
    {
        id: 'hardClear', category: 'skill', icon: '\u2694\uFE0F', title: '고수의 길',
        desc: '어려움 이상 난이도 승리',
        check: (d) => d.hardPlusWins >= 1,
    },

    // --- 일일도전 (5) ---
    {
        id: 'daily7', category: 'daily', icon: '\uD83D\uDDD3\uFE0F', title: '주간 전사',
        desc: '일일 도전 7회 완료',
        check: (d) => d.dailyCompleted >= 7,
    },
    {
        id: 'daily30', category: 'daily', icon: '\uD83D\uDCC6', title: '월간 마스터',
        desc: '일일 도전 30회 완료',
        check: (d) => d.dailyCompleted >= 30,
    },
    {
        id: 'streak3', category: 'daily', icon: '\uD83D\uDD25', title: '연승 3일',
        desc: '일일 도전 3연승',
        check: (d) => d.dailyStreak >= 3,
    },
    {
        id: 'streak7', category: 'daily', icon: '\u26A1', title: '연승 7일',
        desc: '일일 도전 7연승',
        check: (d) => d.dailyStreak >= 7,
    },
    {
        id: 'streak30', category: 'daily', icon: '\uD83C\uDF0B', title: '연승 30일',
        desc: '일일 도전 30연승',
        check: (d) => d.dailyStreak >= 30,
    },

    // --- 도전 (5) ---
    {
        id: 'speedRun', category: 'challenge', icon: '\uD83D\uDE80', title: '스피드러너',
        desc: '5분 이내 클리어',
        check: (d) => d.bestTime > 0 && d.bestTime <= 300,
    },
    {
        id: 'scoreKing', category: 'challenge', icon: '\uD83D\uDCB0', title: '점수왕',
        desc: '단일 게임 10,000점 이상',
        check: (d) => d.bestScore >= 10000,
    },
    {
        id: 'allDifficulty', category: 'challenge', icon: '\uD83C\uDFAF', title: '올라운더',
        desc: '5개 난이도 모두 승리',
        check: (d) => d.difficultiesWon >= 5,
    },
    {
        id: 'bigBoard', category: 'challenge', icon: '\uD83D\uDD32', title: '빅 보드',
        desc: '12\u00D712 이상 보드 클리어',
        check: (d) => d.bigBoardCleared,
    },
    {
        id: 'marathon', category: 'challenge', icon: '\uD83C\uDFC3', title: '마라톤',
        desc: '총 플레이 시간 10시간 달성',
        check: (d) => d.totalPlayTime >= 36000,
    },
];

// ---------------------------------------------------------------------------
// Data aggregation
// ---------------------------------------------------------------------------

/**
 * Gather all data needed for achievement condition checks.
 *
 * @returns {object} Aggregated data object passed to each achievement's check().
 */
function gatherData() {
    const classicStats = loadStats('classic');
    const taStats = loadStats('timeAttack');
    const daily = loadDailyChallenge();
    const history = loadGameHistory();

    const DIFFICULTIES = ['easy', 'normal', 'hard', 'expert', 'master'];
    const HARD_PLUS = ['hard', 'expert', 'master'];

    let totalWins = 0;
    let totalNoMistake = 0;
    let hardPlusWins = 0;
    let bestTime = 0;
    let totalPlayTime = 0;
    let difficultiesWon = 0;
    let timeAttackWins = 0;

    for (const diff of DIFFICULTIES) {
        const cs = classicStats[diff] || {};
        const ts = taStats[diff] || {};

        const cWon = cs.gamesWon || 0;
        const tWon = ts.gamesWon || 0;
        totalWins += cWon + tWon;
        totalNoMistake += (cs.noMistakeWins || 0) + (ts.noMistakeWins || 0);
        totalPlayTime += (cs.totalTime || 0) + (ts.totalTime || 0);
        timeAttackWins += tWon;

        if (HARD_PLUS.includes(diff)) {
            hardPlusWins += cWon + tWon;
        }

        if (cWon + tWon > 0) {
            difficultiesWon++;
        }

        // Best time across all difficulties (non-zero)
        for (const st of [cs, ts]) {
            const bt = st.bestTime || 0;
            if (bt > 0 && (bestTime === 0 || bt < bestTime)) {
                bestTime = bt;
            }
        }
    }

    // Best score from game history
    let bestScore = 0;
    let bigBoardCleared = false;
    for (const entry of history) {
        if (typeof entry.score === 'number' && entry.score > bestScore) {
            bestScore = entry.score;
        }
        if (typeof entry.boardSize === 'number' && entry.boardSize >= 12) {
            bigBoardCleared = true;
        }
    }

    return {
        totalWins,
        totalNoMistake,
        hardPlusWins,
        bestTime,
        bestScore,
        totalPlayTime,
        difficultiesWon,
        timeAttackWins,
        bigBoardCleared,
        dailyCompleted: daily.completed.length,
        dailyStreak: daily.streak,
    };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Load unlocked achievement timestamps from localStorage.
 *
 * @returns {Record<string, string>} Map of achievement id → ISO timestamp.
 */
export function loadUnlocked() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch {
        return {};
    }
}

/**
 * Save unlocked achievement timestamps to localStorage.
 *
 * @param {Record<string, string>} data
 */
function saveUnlocked(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Core check
// ---------------------------------------------------------------------------

/**
 * Evaluate all achievements against current game data.
 * Newly unlocked achievements are persisted and returned.
 *
 * @returns {{ newlyUnlocked: Array<{id:string, icon:string, title:string, desc:string}> }}
 */
export function checkAchievements() {
    const data = gatherData();
    const unlocked = loadUnlocked();
    const newlyUnlocked = [];
    const now = new Date().toISOString();

    for (const ach of ACHIEVEMENTS) {
        if (unlocked[ach.id]) continue; // already unlocked
        try {
            if (ach.check(data)) {
                unlocked[ach.id] = now;
                newlyUnlocked.push({
                    id: ach.id,
                    icon: ach.icon,
                    title: ach.title,
                    desc: ach.desc,
                });
            }
        } catch { /* ignore individual check errors */ }
    }

    if (newlyUnlocked.length > 0) {
        saveUnlocked(unlocked);
    }

    return { newlyUnlocked };
}
