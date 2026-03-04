/**
 * Puzzle URL Sharing
 *
 * Encodes and decodes puzzle data for URL-based sharing.
 * Uses Base64-encoded JSON with hex-encoded cell values.
 *
 * @module utils/puzzle-share
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encode a puzzle into a compact URL-safe string.
 *
 * @param {number[][]} puzzle  - 2D array of numbers (0 = empty).
 * @param {number[][]} solution - 2D array of solution numbers.
 * @param {number} boardSize - Board dimension (4, 6, 9, 12, 16).
 * @param {string} [variant='standard'] - Puzzle variant.
 * @returns {string} Base64-encoded puzzle code.
 */
export function encodePuzzle(puzzle, solution, boardSize, variant) {
    const flat = puzzle.flat();
    // For boardSize > 9, use 2-char hex to handle values 10+
    const hexFn = boardSize > 9
        ? n => n.toString(16).padStart(2, '0')
        : n => n.toString(16);
    const encoded = flat.map(hexFn).join('');

    const flatSol = solution.flat();
    const encodedSol = flatSol.map(hexFn).join('');

    const data = {
        p: encoded,
        s: encodedSol,
        b: boardSize,
    };

    // Only include variant if not standard
    if (variant && variant !== 'standard') {
        data.v = variant;
    }

    const json = JSON.stringify(data);
    return btoa(json);
}

/**
 * Decode a puzzle code back into puzzle data.
 *
 * @param {string} code - Base64-encoded puzzle code.
 * @returns {{ puzzle: number[][], solution: number[][], given: number[][], boardSize: number, variant: string } | null}
 *   Decoded puzzle data, or null if the code is invalid.
 */
export function decodePuzzle(code) {
    try {
        const json = atob(code);
        const data = JSON.parse(json);
        const boardSize = data.b || 9;

        // Validate required fields
        if (!data.p || !data.s) return null;

        // For boardSize > 9, cells use two hex chars (e.g. '0a' for 10)
        let flatPuzzle, flatSolution;

        if (boardSize > 9) {
            // Two-char hex encoding
            flatPuzzle = [];
            for (let i = 0; i < data.p.length; i += 2) {
                flatPuzzle.push(parseInt(data.p.slice(i, i + 2), 16));
            }
            flatSolution = [];
            for (let i = 0; i < data.s.length; i += 2) {
                flatSolution.push(parseInt(data.s.slice(i, i + 2), 16));
            }
        } else {
            // Single-char hex encoding
            flatPuzzle = data.p.split('').map(c => parseInt(c, 16));
            flatSolution = data.s.split('').map(c => parseInt(c, 16));
        }

        // Validate sizes
        const expectedLen = boardSize * boardSize;
        if (flatPuzzle.length !== expectedLen || flatSolution.length !== expectedLen) {
            return null;
        }

        // Validate no NaN values
        if (flatPuzzle.some(isNaN) || flatSolution.some(isNaN)) {
            return null;
        }

        // Reshape to 2D
        const puzzle = [];
        const solution = [];
        const given = [];
        for (let r = 0; r < boardSize; r++) {
            const pRow = flatPuzzle.slice(r * boardSize, (r + 1) * boardSize);
            const sRow = flatSolution.slice(r * boardSize, (r + 1) * boardSize);
            puzzle.push(pRow);
            solution.push(sRow);
            given.push(pRow.map(v => v > 0 ? 1 : 0));
        }

        return {
            puzzle,
            solution,
            given,
            boardSize,
            variant: data.v || 'standard',
        };
    } catch {
        return null;
    }
}
