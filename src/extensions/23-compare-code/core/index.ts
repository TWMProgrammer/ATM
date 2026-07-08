// ======================================
// COMPARE CODE — CORE INDEX | MARK: INDEX
// ======================================

/**
 * Clean interface for importing the comparison engine and its types.
 * This layer is browser-safe (no VS Code / Node APIs) and is shared by the
 * bundled webview UI.
 */

// Main comparison engine (LCS-based with movement detection)
export { ComparisonEngine } from './comparison-engine';

// Myers diff algorithm (optimized for large files)
export { MyersAlgorithm } from './myers-algorithm';

// Intelligent algorithm selector
export { AlgorithmSelector, type AlgorithmType } from './algorithm-selector';

// Shared types
export type {
  ComparisonResult,
  ComparisonLine,
  ComparisonStats,
  LineOperation,
  LineType,
  LineOperationType,
} from './types';
