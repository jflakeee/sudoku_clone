/**
 * Sudoku Input Validator
 *
 * Provides move validation, conflict detection, and cell-group helpers
 * for the game engine.
 *
 * @module validator
 */

/**
 * Get all cell positions in the given row.
 *
 * @param {number} row - Row index (0-8)
 * @returns {{row: number, col: number}[]} Array of 9 cell positions
 */
export function getRowCells(row) {
    const cells = [];
    for (let c = 0; c < 9; c++) {
        cells.push({ row, col: c });
    }
    return cells;
}

/**
 * Get all cell positions in the given column.
 *
 * @param {number} col - Column index (0-8)
 * @returns {{row: number, col: number}[]} Array of 9 cell positions
 */
export function getColCells(col) {
    const cells = [];
    for (let r = 0; r < 9; r++) {
        cells.push({ row: r, col });
    }
    return cells;
}

/**
 * Get all cell positions in the 3x3 block that contains (row, col).
 *
 * @param {number} row - Row index (0-8)
 * @param {number} col - Column index (0-8)
 * @returns {{row: number, col: number}[]} Array of 9 cell positions
 */
export function getBlockCells(row, col) {
    const cells = [];
    const blockRow = Math.floor(row / 3) * 3;
    const blockCol = Math.floor(col / 3) * 3;

    for (let r = blockRow; r < blockRow + 3; r++) {
        for (let c = blockCol; c < blockCol + 3; c++) {
            cells.push({ row: r, col: c });
        }
    }

    return cells;
}

/**
 * Find all cells that conflict with placing `num` at (row, col).
 * A conflict means another cell in the same row, column, or 3x3 block
 * already contains the same number.
 *
 * The target cell itself is never included in the result.
 *
 * @param {number[][]} board - 9x9 Sudoku board (0 = empty)
 * @param {number} row - Row index (0-8)
 * @param {number} col - Column index (0-8)
 * @param {number} num - Number to check (1-9)
 * @returns {{row: number, col: number}[]} Array of conflicting cell positions
 */
export function checkConflicts(board, row, col, num) {
    if (num < 1 || num > 9) return [];

    const conflicts = [];
    const seen = new Set();

    /**
     * Helper to add a conflict if the cell holds the same number and
     * isn't the target cell itself.
     */
    const check = (r, c) => {
        if (r === row && c === col) return;
        const key = r * 9 + c;
        if (seen.has(key)) return;
        if (board[r][c] === num) {
            seen.add(key);
            conflicts.push({ row: r, col: c });
        }
    };

    // Row
    for (let c = 0; c < 9; c++) check(row, c);

    // Column
    for (let r = 0; r < 9; r++) check(r, col);

    // 3x3 block
    const blockRow = Math.floor(row / 3) * 3;
    const blockCol = Math.floor(col / 3) * 3;
    for (let r = blockRow; r < blockRow + 3; r++) {
        for (let c = blockCol; c < blockCol + 3; c++) {
            check(r, c);
        }
    }

    return conflicts;
}

/**
 * Validate a player's move by comparing it to the known solution.
 *
 * @param {number[][]} board - Current 9x9 board state
 * @param {number[][]} solution - 9x9 complete solution
 * @param {number} row - Row index (0-8)
 * @param {number} col - Column index (0-8)
 * @param {number} num - Number the player entered (1-9)
 * @returns {{valid: boolean, complete: boolean}} Result object:
 *   - valid: true if num matches the solution at (row, col)
 *   - complete: true if the entire board is now correctly filled
 */
export function validateMove(board, solution, row, col, num) {
    const valid = solution[row][col] === num;

    // If the move is valid, check whether it completes the board.
    // We simulate placing the number first so isBoardComplete can see it.
    let complete = false;
    if (valid) {
        const prev = board[row][col];
        board[row][col] = num;
        complete = isBoardComplete(board, solution);
        board[row][col] = prev;
    }

    return { valid, complete };
}

/**
 * Check whether every cell on the board matches the solution.
 *
 * @param {number[][]} board - Current 9x9 board state
 * @param {number[][]} solution - 9x9 complete solution
 * @returns {boolean} True if all 81 cells match the solution
 */
export function isBoardComplete(board, solution) {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r][c] !== solution[r][c]) {
                return false;
            }
        }
    }
    return true;
}
