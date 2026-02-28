/**
 * Board Configuration Module
 * Centralized board size configuration for multi-size Sudoku support.
 * @module core/board-config
 */

export const BOARD_CONFIGS = {
    4:  { size: 4,  blockRows: 2, blockCols: 2, numRange: 4,  totalCells: 16  },
    6:  { size: 6,  blockRows: 2, blockCols: 3, numRange: 6,  totalCells: 36  },
    9:  { size: 9,  blockRows: 3, blockCols: 3, numRange: 9,  totalCells: 81  },
    12: { size: 12, blockRows: 3, blockCols: 4, numRange: 12, totalCells: 144 },
    16: { size: 16, blockRows: 4, blockCols: 4, numRange: 16, totalCells: 256 },
};

export const DIFFICULTY_RANGES_BY_SIZE = {
    4: {
        easy: [5, 6], normal: [7, 8], hard: [9, 10],
        expert: [10, 11], master: [11, 12],
    },
    6: {
        easy: [14, 16], normal: [17, 20], hard: [21, 24],
        expert: [25, 28], master: [29, 32],
    },
    9: {
        easy: [36, 40], normal: [41, 46], hard: [47, 51],
        expert: [52, 55], master: [56, 60],
    },
    12: {
        easy: [60, 72], normal: [73, 88], hard: [89, 103],
        expert: [104, 115], master: [116, 126],
    },
    16: {
        easy: [110, 128], normal: [129, 154], hard: [155, 179],
        expert: [180, 200], master: [201, 220],
    },
};

export function getBlockSize(boardSize) {
    const config = BOARD_CONFIGS[boardSize];
    if (!config) throw new Error(`Unsupported board size: ${boardSize}`);
    return { rows: config.blockRows, cols: config.blockCols };
}

export function getDifficultyRange(boardSize, difficulty) {
    const ranges = DIFFICULTY_RANGES_BY_SIZE[boardSize];
    if (!ranges) throw new Error(`Unsupported board size: ${boardSize}`);
    return ranges[difficulty] || ranges.easy;
}
