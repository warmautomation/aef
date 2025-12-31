/**
 * ALF Validator
 *
 * Validates ALF entries against the JSON Schema.
 */

import type { AnyALFEntry } from './types.js';

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Validate an ALF entry against the core schema
 */
export function validateALFEntry(_entry: unknown): ValidationResult {
  // TODO: Implement with AJV
  return { valid: true };
}

/**
 * Validate a JSONL file line by line
 */
export async function validateALFFile(
  _filePath: string
): Promise<{ valid: boolean; lineErrors: Map<number, string[]> }> {
  // TODO: Implement
  return { valid: true, lineErrors: new Map() };
}
