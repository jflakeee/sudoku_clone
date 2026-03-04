/**
 * Title / Profile System
 *
 * Titles are unlocked based on level (from XP system) and achievements.
 * Users can select an active title to display on their profile.
 *
 * @module utils/titles
 */

import { loadActiveTitle, saveActiveTitle } from './storage.js';
import { loadUnlocked } from './achievements.js';
import { loadUserXP, getLevelFromXP } from './xp.js';

// ---------------------------------------------------------------------------
// Title definitions
// ---------------------------------------------------------------------------

const TITLES = [
    // Level-based titles
    { id: 'beginner', label: '초보자', minLevel: 1, description: '스도쿠의 세계에 오신 것을 환영합니다' },
    { id: 'apprentice', label: '견습생', minLevel: 5, description: '기초를 다지는 중' },
    { id: 'solver', label: '풀이사', minLevel: 10, description: '꾸준히 퍼즐을 풀고 있습니다' },
    { id: 'enthusiast', label: '매니아', minLevel: 20, description: '스도쿠에 빠져들고 있습니다' },
    { id: 'expert', label: '전문가', minLevel: 30, description: '전문적인 실력을 갖추었습니다' },
    { id: 'master', label: '마스터', minLevel: 50, description: '스도쿠의 달인' },
    { id: 'grandmaster', label: '그랜드마스터', minLevel: 75, description: '최고의 경지에 도달했습니다' },
    { id: 'legend', label: '전설', minLevel: 99, description: '스도쿠 전설' },
    // Achievement-based titles
    { id: 'streak_master', label: '꾸준왕', requires: 'streak_30', description: '30일 연속 플레이' },
    { id: 'speed_demon', label: '스피드러너', requires: 'speedRun', description: '빠른 풀이의 달인' },
    { id: 'perfectionist', label: '완벽주의자', requires: 'perfect20', description: '실수 없는 풀이의 장인' },
    { id: 'all_rounder', label: '올라운더', requires: 'allDifficulty', description: '모든 난이도 클리어' },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get all title definitions.
 *
 * @returns {typeof TITLES}
 */
export function getAllTitles() {
    return TITLES;
}

/**
 * Get titles that the user has unlocked.
 *
 * @param {number} level - Current user level.
 * @param {Record<string, string>} achievements - Unlocked achievement map.
 * @returns {typeof TITLES}
 */
export function getUnlockedTitles(level, achievements) {
    return TITLES.filter(t => {
        if (t.minLevel && level >= t.minLevel) return true;
        if (t.requires && achievements[t.requires]) return true;
        return false;
    });
}

/**
 * Get the user's currently active title id.
 *
 * @returns {string}
 */
export function getActiveTitle() {
    return loadActiveTitle();
}

/**
 * Set the user's active title.
 *
 * @param {string} titleId
 */
export function setActiveTitle(titleId) {
    saveActiveTitle(titleId);
}

/**
 * Get the label for the currently active title.
 *
 * @returns {string}
 */
export function getActiveTitleLabel() {
    const activeId = getActiveTitle();
    const title = TITLES.find(t => t.id === activeId);
    return title ? title.label : '초보자';
}

/**
 * Convenience: get the full current title info for the user.
 *
 * @returns {{ level: number, titleId: string, titleLabel: string, unlockedTitles: typeof TITLES }}
 */
export function getUserTitleInfo() {
    const xpData = loadUserXP();
    const levelInfo = getLevelFromXP(xpData.totalXP);
    const achievements = loadUnlocked();
    const unlockedTitles = getUnlockedTitles(levelInfo.level, achievements);
    const activeId = getActiveTitle();

    // Validate that active title is actually unlocked
    const isUnlocked = unlockedTitles.some(t => t.id === activeId);
    const titleId = isUnlocked ? activeId : 'beginner';
    const titleLabel = TITLES.find(t => t.id === titleId)?.label || '초보자';

    return {
        level: levelInfo.level,
        titleId,
        titleLabel,
        unlockedTitles,
    };
}
