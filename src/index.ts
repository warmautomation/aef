/**
 * ALF - Agent Log Format
 *
 * Normalized log format for AI coding agents.
 */

// Types
export * from './types.js';

// Validator
export { validateALFEntry, validateALFFile } from './validator.js';

// Adapters
export { reactpocAdapter } from './adapters/reactpoc.js';
export { claudeCodeAdapter } from './adapters/claude-code.js';
export type { LogAdapter } from './adapters/adapter.js';
