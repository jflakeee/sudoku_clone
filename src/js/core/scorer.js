/**
 * Sudoku Score Calculator
 *
 * Handles point calculation for individual cell inputs and game completion
 * bonuses, scaled by difficulty.
 *
 * Scoring rules (derived from Sudoku.com analysis):
 *   - Base cell score: 250 points
 *   - Difficulty multipliers: easy=1, normal=1.5, hard=2, expert=2.5, master=3
 *   - Notes penalty: using notes on a cell reduces its score by 25%
 *   - Time decay: score decreases slightly for slower inputs
 *   - Completion bonus: large bonus scaled by difficulty, reduced by mistakes and time
 *
 * @module scorer
 */

/** Base points awarded per correct cell input. */
const BASE_CELL_SCORE = 250;

/** Base bonus points awarded when the puzzle is completed. */
const BASE_COMPLETION_BONUS = 1000;

/**
 * Difficulty-to-multiplier mapping.
 *
 * @type {Record<string, number>}
 */
const DIFFICULTY_MULTIPLIERS = {
    easy:   1,
    normal: 1.5,
    hard:   2,
    expert: 2.5,
    master: 3,
};

/**
 * Get the score multiplier for a given difficulty level.
 *
 * @param {string} difficulty - One of 'easy', 'normal', 'hard', 'expert', 'master'
 * @returns {number} Multiplier value (defaults to 1 for unknown difficulty)
 */
export function getDifficultyMultiplier(difficulty) {
    return DIFFICULTY_MULTIPLIERS[difficulty] ?? 1;
}

/**
 * Calculate the score earned for a single correct cell input.
 *
 * Scoring formula:
 *   score = BASE (250) * difficulty_multiplier
 *           * notes_factor (0.75 if notes were used, 1.0 otherwise)
 *           * time_factor  (decays for slow inputs, minimum 0.5)
 *
 * The time factor uses a gentle exponential decay so that faster solvers
 * are rewarded without excessively punishing slower players.
 *
 * @param {string} difficulty - Difficulty level
 * @param {boolean} hasNotes - Whether the player used notes/pencil marks on this cell
 * @param {number} time - Elapsed game time in seconds at the moment of input
 * @returns {number} Points earned (integer, rounded down)
 */
export function calculateCellScore(difficulty, hasNotes, time) {
    const multiplier = getDifficultyMultiplier(difficulty);

    // Notes penalty: 25% reduction when notes were consulted
    const notesFactor = hasNotes ? 0.75 : 1.0;

    // Time decay: gentle exponential decay, floor of 0.5
    // At t=0 factor is 1.0, at t=600 (~10 min) factor is ~0.55, minimum 0.5
    const timeFactor = Math.max(0.5, Math.exp(-0.001 * time));

    const score = BASE_CELL_SCORE * multiplier * notesFactor * timeFactor;

    return Math.floor(score);
}

/**
 * Calculate the bonus score awarded when the entire puzzle is completed.
 *
 * Bonus formula:
 *   bonus = BASE_COMPLETION (1000) * difficulty_multiplier
 *           * mistake_factor (reduced by 20% per mistake)
 *           * time_factor    (faster completion = larger bonus, minimum 0.3)
 *
 * @param {string} difficulty - Difficulty level
 * @param {number} mistakes - Total number of mistakes made during the game
 * @param {number} time - Total elapsed time in seconds
 * @returns {number} Bonus points (integer, rounded down)
 */
export function calculateCompletionBonus(difficulty, mistakes, time) {
    const multiplier = getDifficultyMultiplier(difficulty);

    // Mistake penalty: 20% reduction per mistake, floor at 0
    const mistakeFactor = Math.max(0, 1 - 0.2 * mistakes);

    // Time factor: decays over time, minimum 0.3
    // At t=0 factor is 1.0, at t=1800 (30 min) factor is ~0.41, minimum 0.3
    const timeFactor = Math.max(0.3, Math.exp(-0.0005 * time));

    const bonus = BASE_COMPLETION_BONUS * multiplier * mistakeFactor * timeFactor;

    return Math.floor(bonus);
}
