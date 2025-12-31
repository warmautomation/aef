/**
 * AEF Validator
 *
 * Validates AEF entries against the JSON Schema.
 */

import Ajv, { type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import coreSchema from './schema/core.schema.json' with { type: 'json' };
import { isCoreEntry, isExtensionEntry, hasValidBaseFields } from './types.js';

// Initialize AJV with the core schema (cross-runtime compatible)
const AjvConstructor = (Ajv as any).default || Ajv;
const addFormatsFunc = (addFormats as any).default || addFormats;
const ajv = new AjvConstructor({ allErrors: true, strict: false });
addFormatsFunc(ajv);
const validate = ajv.compile(coreSchema);

/**
 * Result of validating an AEF entry
 */
export interface ValidationResult {
  /** Whether the entry is valid */
  valid: boolean;
  /** Validation errors (if any) */
  errors?: string[];
  /** Type of entry: core, extension, or invalid */
  entryType: 'core' | 'extension' | 'invalid';
}

/**
 * Validate an AEF entry against the core schema
 */
export function validateAEFEntry(entry: unknown): ValidationResult {
  // First check if it's a valid object with base fields
  if (!hasValidBaseFields(entry)) {
    return {
      valid: false,
      errors: ['Entry must be an object with required base fields: v, id, ts, type, sid'],
      entryType: 'invalid',
    };
  }

  // Validate against the schema
  const valid = validate(entry);

  if (!valid) {
    const errors = validate.errors?.map((e: ErrorObject) => {
      const path = e.instancePath || '/';
      return `${path}: ${e.message}`;
    });

    return {
      valid: false,
      errors,
      entryType: 'invalid',
    };
  }

  // Classify the entry type
  if (isCoreEntry(entry)) {
    return { valid: true, entryType: 'core' };
  }

  if (isExtensionEntry(entry)) {
    return { valid: true, entryType: 'extension' };
  }

  // Valid base fields but unknown type pattern
  return { valid: true, entryType: 'extension' };
}

/**
 * Result for streaming validation
 */
export interface StreamValidationResult {
  line: number;
  result: ValidationResult;
  entry?: unknown;
}

/**
 * Validate AEF entries from an async iterable of JSONL lines
 */
export async function* validateAEFStream(
  lines: AsyncIterable<string>
): AsyncGenerator<StreamValidationResult> {
  let lineNumber = 0;

  for await (const line of lines) {
    lineNumber++;

    // Skip empty lines
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    // Parse JSON
    let entry: unknown;
    try {
      entry = JSON.parse(trimmed);
    } catch (e) {
      yield {
        line: lineNumber,
        result: {
          valid: false,
          errors: [`Invalid JSON: ${e instanceof Error ? e.message : 'parse error'}`],
          entryType: 'invalid',
        },
      };
      continue;
    }

    // Validate entry
    const result = validateAEFEntry(entry);
    yield { line: lineNumber, result, entry };
  }
}

/**
 * Validate a JSONL file and collect all errors
 */
export async function validateAEFFile(
  filePath: string
): Promise<{ valid: boolean; lineErrors: Map<number, string[]>; stats: ValidationStats }> {
  const file = Bun.file(filePath);
  const text = await file.text();
  const lines = text.split('\n');

  const lineErrors = new Map<number, string[]>();
  const stats: ValidationStats = {
    total: 0,
    core: 0,
    extension: 0,
    invalid: 0,
  };

  // Create an async iterable from the lines
  async function* lineIterator(): AsyncIterable<string> {
    for (const line of lines) {
      yield line;
    }
  }

  for await (const { line, result } of validateAEFStream(lineIterator())) {
    stats.total++;

    if (result.valid) {
      if (result.entryType === 'core') {
        stats.core++;
      } else {
        stats.extension++;
      }
    } else {
      stats.invalid++;
      if (result.errors) {
        lineErrors.set(line, result.errors);
      }
    }
  }

  return {
    valid: lineErrors.size === 0,
    lineErrors,
    stats,
  };
}

/**
 * Statistics from validation
 */
export interface ValidationStats {
  total: number;
  core: number;
  extension: number;
  invalid: number;
}
