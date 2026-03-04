/**
 * Shared Constants
 *
 * Centralised label maps and other constants used across multiple modules.
 *
 * @module utils/constants
 */

// ---------------------------------------------------------------------------
// Difficulty & Variant label maps
// ---------------------------------------------------------------------------

/** Difficulty key to Korean label mapping. */
export const DIFFICULTY_LABELS = {
    easy: '쉬움',
    medium: '보통',
    normal: '보통',
    hard: '어려움',
    expert: '전문가',
    master: '마스터',
};

/** Variant key to Korean label mapping. */
export const VARIANT_LABELS = {
    standard: '기본',
    diagonal: '대각선',
    'anti-knight': '안티나이트',
    'anti-king': '안티킹',
    'even-odd': '짝홀',
    windoku: '윈도쿠',
    killer: '킬러',
};
