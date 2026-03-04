/**
 * Variant Rules Registry
 *
 * Provides a centralized registry for Sudoku variant rules.
 * Each variant defines extra constraints (additional cell groups)
 * and visual styling (CSS classes) beyond standard row/col/block rules.
 *
 * To add a new variant, call `registerVariant()` with a VariantRule object.
 * The core engine uses `getExtraCells()` and `getCSSClass()` to query
 * variant-specific behavior without hard-coded branching.
 *
 * @module core/variant-rules
 */

/** @type {Map<string, VariantRule>} */
const VARIANT_REGISTRY = new Map();

/**
 * @typedef {Object} VariantRule
 * @property {string} key - Unique variant identifier (e.g. 'standard', 'diagonal')
 * @property {string} label - Display name (Korean)
 * @property {string} description - Rule description (Korean)
 * @property {function(number, number, number): {row: number, col: number}[]} getExtraCells
 *   Given (row, col, boardSize), return additional constrained cells
 *   (excluding the cell itself).
 * @property {function(number, number, number): string|null} getCSSClass
 *   Given (row, col, boardSize), return extra CSS class name or null.
 * @property {number[]} supportedSizes - Supported board sizes
 */

/**
 * Register a variant rule in the global registry.
 *
 * @param {VariantRule} rule
 */
export function registerVariant(rule) {
    VARIANT_REGISTRY.set(rule.key, rule);
}

/**
 * Get a registered variant rule by key.
 *
 * @param {string} key - Variant identifier
 * @returns {VariantRule|null}
 */
export function getVariantRule(key) {
    return VARIANT_REGISTRY.get(key) || null;
}

/**
 * Get extra constrained cells for a given variant at (row, col).
 * Returns an empty array for 'standard' or unknown variants.
 *
 * @param {string} variantKey - Variant identifier
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @param {number} boardSize - Board dimension
 * @param {object} [extraData] - Extra variant data (e.g. cages for killer)
 * @returns {{row: number, col: number}[]}
 */
export function getExtraCells(variantKey, row, col, boardSize, extraData) {
    const rule = VARIANT_REGISTRY.get(variantKey);
    if (!rule) return [];
    return rule.getExtraCells(row, col, boardSize, extraData);
}

/**
 * Get extra CSS class for a cell in a given variant.
 * Returns null for 'standard' or unknown variants.
 *
 * @param {string} variantKey - Variant identifier
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @param {number} boardSize - Board dimension
 * @returns {string|null}
 */
export function getCSSClass(variantKey, row, col, boardSize) {
    const rule = VARIANT_REGISTRY.get(variantKey);
    if (!rule) return null;
    return rule.getCSSClass(row, col, boardSize);
}

/**
 * Get all registered variant rules.
 *
 * @returns {VariantRule[]}
 */
export function getAllVariants() {
    return Array.from(VARIANT_REGISTRY.values());
}

// ---------------------------------------------------------------------------
// Built-in variant: standard (no extra rules)
// ---------------------------------------------------------------------------

registerVariant({
    key: 'standard',
    label: '기본',
    description: '표준 스도쿠 규칙',
    getExtraCells: () => [],
    getCSSClass: () => null,
    supportedSizes: [4, 6, 9, 12, 16],
});

// ---------------------------------------------------------------------------
// Built-in variant: diagonal
// ---------------------------------------------------------------------------

registerVariant({
    key: 'diagonal',
    label: '대각선',
    description: '주대각선, 부대각선에 각 숫자 1회',
    getExtraCells: (row, col, boardSize) => {
        const cells = [];
        // Main diagonal (row === col)
        if (row === col) {
            for (let i = 0; i < boardSize; i++) {
                if (i !== row) cells.push({ row: i, col: i });
            }
        }
        // Anti-diagonal (row + col === boardSize - 1)
        if (row + col === boardSize - 1) {
            for (let i = 0; i < boardSize; i++) {
                if (i !== row) cells.push({ row: i, col: boardSize - 1 - i });
            }
        }
        return cells;
    },
    getCSSClass: (row, col, boardSize) => {
        if (row === col || row + col === boardSize - 1) return 'diagonal';
        return null;
    },
    supportedSizes: [4, 6, 9, 12, 16],
});

// ---------------------------------------------------------------------------
// Built-in variant: anti-knight
// ---------------------------------------------------------------------------

registerVariant({
    key: 'anti-knight',
    label: '안티나이트',
    description: '나이트 이동 위치에 같은 숫자 불가',
    getExtraCells: (row, col, boardSize) => {
        const offsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        return offsets
            .map(([dr, dc]) => ({ row: row + dr, col: col + dc }))
            .filter(c => c.row >= 0 && c.row < boardSize && c.col >= 0 && c.col < boardSize);
    },
    getCSSClass: () => null,
    supportedSizes: [9],
});

// ---------------------------------------------------------------------------
// Built-in variant: anti-king
// ---------------------------------------------------------------------------

registerVariant({
    key: 'anti-king',
    label: '안티킹',
    description: '대각선 인접 셀에 같은 숫자 불가',
    getExtraCells: (row, col, boardSize) => {
        const offsets = [[-1,-1],[-1,1],[1,-1],[1,1]];
        return offsets
            .map(([dr, dc]) => ({ row: row + dr, col: col + dc }))
            .filter(c => c.row >= 0 && c.row < boardSize && c.col >= 0 && c.col < boardSize);
    },
    getCSSClass: () => null,
    supportedSizes: [9],
});

// ---------------------------------------------------------------------------
// Built-in variant: even-odd
// ---------------------------------------------------------------------------

registerVariant({
    key: 'even-odd',
    label: '짝홀',
    description: '표시된 셀은 짝수 또는 홀수만 가능',
    getExtraCells: () => [],
    getCSSClass: () => null,
    supportedSizes: [9],
    hasExtraData: true,
});

// ---------------------------------------------------------------------------
// Built-in variant: killer
// ---------------------------------------------------------------------------

registerVariant({
    key: 'killer',
    label: '킬러',
    description: '점선 영역의 합이 표시된 숫자와 같아야 함',
    getExtraCells: (row, col, boardSize, extraData) => {
        if (!extraData || !extraData.cages) return [];
        for (const cage of extraData.cages) {
            if (cage.cells.some(c => c.row === row && c.col === col)) {
                return cage.cells.filter(c => c.row !== row || c.col !== col);
            }
        }
        return [];
    },
    getCSSClass: () => null,
    supportedSizes: [9],
    hasExtraData: true,
});

// ---------------------------------------------------------------------------
// Built-in variant: windoku
// ---------------------------------------------------------------------------

registerVariant({
    key: 'windoku',
    label: '윈도쿠',
    description: '추가 4개 3x3 윈도우 영역에 1-9',
    getExtraCells: (row, col, boardSize) => {
        if (boardSize !== 9) return [];
        const windows = [
            { rStart: 1, cStart: 1 },
            { rStart: 1, cStart: 5 },
            { rStart: 5, cStart: 1 },
            { rStart: 5, cStart: 5 },
        ];
        const cells = [];
        for (const w of windows) {
            if (row >= w.rStart && row < w.rStart + 3 && col >= w.cStart && col < w.cStart + 3) {
                for (let r = w.rStart; r < w.rStart + 3; r++) {
                    for (let c = w.cStart; c < w.cStart + 3; c++) {
                        if (r !== row || c !== col) cells.push({ row: r, col: c });
                    }
                }
            }
        }
        return cells;
    },
    getCSSClass: (row, col, boardSize) => {
        if (boardSize !== 9) return null;
        const windows = [
            { rStart: 1, cStart: 1 },
            { rStart: 1, cStart: 5 },
            { rStart: 5, cStart: 1 },
            { rStart: 5, cStart: 5 },
        ];
        for (const w of windows) {
            if (row >= w.rStart && row < w.rStart + 3 && col >= w.cStart && col < w.cStart + 3) {
                return 'windoku-window';
            }
        }
        return null;
    },
    supportedSizes: [9],
});
