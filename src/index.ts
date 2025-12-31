/**
 * AEF - Agent Log Format
 *
 * Normalized log format for AI coding agents.
 */

// Types
export * from './types.js';

// Validator (syntactic - schema-based)
export {
  validateAEFEntry,
  validateAEFFile,
  validateAEFStream,
  type ValidationResult,
  type ValidationStats,
  type StreamValidationResult,
} from './validator.js';

// Semantic Validator (cross-entry constraints)
export {
  validateSemantics,
  type SemanticValidationResult,
  type SemanticError,
  type SemanticWarning,
} from './semantic-validator.js';

// Adapters
export { reactpocAdapter } from './adapters/reactpoc.js';
export { claudeCodeAdapter } from './adapters/claude-code.js';
export type { LogAdapter } from './adapters/adapter.js';

// Viewer exports
export * from './viewer/index.js';
