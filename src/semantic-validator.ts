/**
 * Semantic Validation for AEF
 *
 * This module implements cross-entry validation rules that cannot be
 * expressed in JSON Schema. These rules enforce the normative requirements
 * (MUST/SHOULD) from the AEF specification.
 */

import type { AEFEntry } from './types.js';

// =============================================================================
// Types
// =============================================================================

export interface SemanticError {
  /** Rule identifier (e.g., "session-start-first") */
  rule: string;
  /** Human-readable error message */
  message: string;
  /** Spec reference (e.g., "§4.1") */
  specRef: string;
  /** Affected entry IDs */
  entryIds: string[];
  /** Line number in source file (if known) */
  line?: number;
}

export interface SemanticWarning extends SemanticError {}

export interface SemanticValidationResult {
  /** True if no MUST violations found */
  valid: boolean;
  /** MUST violations */
  errors: SemanticError[];
  /** SHOULD violations */
  warnings: SemanticWarning[];
}

// =============================================================================
// Helper Types
// =============================================================================

interface IndexedEntry {
  entry: AEFEntry;
  index: number;
}

// =============================================================================
// Main Validator
// =============================================================================

/**
 * Validate semantic constraints across a set of AEF entries.
 *
 * This validates MUST requirements that require cross-entry analysis:
 * - Session boundary ordering
 * - Sequence monotonicity
 * - Tool call/result correlation
 * - Parent ID chain validity
 */
export function validateSemantics(entries: AEFEntry[]): SemanticValidationResult {
  const errors: SemanticError[] = [];
  const warnings: SemanticWarning[] = [];

  if (entries.length === 0) {
    return { valid: true, errors, warnings };
  }

  // Build indexes for efficient lookups
  const entryById = new Map<string, IndexedEntry>();
  const sessionEntries = new Map<string, number[]>();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    entryById.set(entry.id, { entry, index: i });

    const sessionIndexes = sessionEntries.get(entry.sid) ?? [];
    sessionIndexes.push(i);
    sessionEntries.set(entry.sid, sessionIndexes);
  }

  // Run MUST validations
  validateSessionBoundaries(entries, sessionEntries, errors);
  validateSessionContiguity(entries, sessionEntries, errors);
  validateSeqMonotonicity(entries, sessionEntries, errors);
  validateToolCorrelation(entries, errors);
  validateErrorRequired(entries, errors);
  validatePidExists(entries, entryById, errors);
  validateDepsExist(entries, entryById, errors);

  // Run SHOULD validations
  validateTimestampMonotonicity(entries, sessionEntries, warnings);
  validateIdUniqueness(entries, warnings);
  validateResultExpected(entries, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// MUST Rules
// =============================================================================

/**
 * §4.1, §4.2: session.start MUST be first, session.end MUST be last
 */
function validateSessionBoundaries(
  entries: AEFEntry[],
  sessionEntries: Map<string, number[]>,
  errors: SemanticError[]
): void {
  for (const [sid, indexes] of sessionEntries) {
    if (indexes.length === 0) continue;

    const firstIndex = indexes[0];
    const lastIndex = indexes[indexes.length - 1];
    const firstEntry = entries[firstIndex];
    const lastEntry = entries[lastIndex];

    // Check if there's a session.start anywhere in this session
    const hasSessionStart = indexes.some((i) => entries[i].type === 'session.start');
    const hasSessionEnd = indexes.some((i) => entries[i].type === 'session.end');

    // If session.start exists, it MUST be first
    if (hasSessionStart && firstEntry.type !== 'session.start') {
      const startEntry = entries[indexes.find((i) => entries[i].type === 'session.start')!];
      errors.push({
        rule: 'session-start-first',
        message: `session.start must be first entry for session '${sid}', but found '${firstEntry.type}' first`,
        specRef: '§3.1.4',
        entryIds: [startEntry.id, firstEntry.id],
      });
    }

    // If session.end exists, it MUST be last
    if (hasSessionEnd && lastEntry.type !== 'session.end') {
      const endEntry = entries[indexes.find((i) => entries[i].type === 'session.end')!];
      errors.push({
        rule: 'session-end-last',
        message: `session.end must be last entry for session '${sid}', but found '${lastEntry.type}' last`,
        specRef: '§3.1.4',
        entryIds: [endEntry.id, lastEntry.id],
      });
    }
  }
}

/**
 * §3.1.4: Entries from same session MUST NOT be interleaved with other sessions
 */
function validateSessionContiguity(
  entries: AEFEntry[],
  sessionEntries: Map<string, number[]>,
  errors: SemanticError[]
): void {
  for (const [sid, indexes] of sessionEntries) {
    if (indexes.length <= 1) continue;

    // Check if all indexes are contiguous
    for (let i = 1; i < indexes.length; i++) {
      const expected = indexes[i - 1] + 1;
      const actual = indexes[i];

      // If there's a gap, check if entries from other sessions are in between
      if (actual !== expected) {
        // Find which session(s) are interleaved
        const interleaved = new Set<string>();
        for (let j = expected; j < actual; j++) {
          if (entries[j].sid !== sid) {
            interleaved.add(entries[j].sid);
          }
        }

        if (interleaved.size > 0) {
          errors.push({
            rule: 'session-contiguous',
            message: `Session '${sid}' entries are interleaved with session(s): ${[...interleaved].join(', ')}`,
            specRef: '§3.1.4',
            entryIds: [entries[indexes[i - 1]].id, entries[actual].id],
          });
          break; // Only report first interleaving per session
        }
      }
    }
  }
}

/**
 * §3.2.1: seq MUST be monotonically increasing within session
 */
function validateSeqMonotonicity(
  entries: AEFEntry[],
  sessionEntries: Map<string, number[]>,
  errors: SemanticError[]
): void {
  for (const [sid, indexes] of sessionEntries) {
    let lastSeq: number | undefined;
    let lastSeqEntryId: string | undefined;

    for (const index of indexes) {
      const entry = entries[index];
      if (entry.seq === undefined) continue;

      if (lastSeq !== undefined && entry.seq <= lastSeq) {
        errors.push({
          rule: 'seq-monotonic',
          message: `seq must be monotonically increasing: found ${entry.seq} after ${lastSeq} in session '${sid}'`,
          specRef: '§3.2.1',
          entryIds: [lastSeqEntryId!, entry.id],
        });
      }

      lastSeq = entry.seq;
      lastSeqEntryId = entry.id;
    }
  }
}

/**
 * §4.4, §4.5: tool.result.call_id MUST match a tool.call.call_id
 */
function validateToolCorrelation(entries: AEFEntry[], errors: SemanticError[]): void {
  const callIds = new Set<string>();

  // Collect all tool.call call_ids
  for (const entry of entries) {
    if (entry.type === 'tool.call') {
      const callId = (entry as AEFEntry & { call_id?: string }).call_id;
      if (callId) {
        callIds.add(callId);
      }
    }
  }

  // Check all tool.result call_ids have matching tool.call
  for (const entry of entries) {
    if (entry.type === 'tool.result') {
      const callId = (entry as AEFEntry & { call_id?: string }).call_id;
      if (callId && !callIds.has(callId)) {
        errors.push({
          rule: 'call-id-match',
          message: `tool.result has call_id '${callId}' with no matching tool.call`,
          specRef: '§4.4/§4.5',
          entryIds: [entry.id],
        });
      }
    }
  }
}

/**
 * §4.5: error MUST be present when success=false
 */
function validateErrorRequired(entries: AEFEntry[], errors: SemanticError[]): void {
  for (const entry of entries) {
    if (entry.type === 'tool.result') {
      const toolResult = entry as AEFEntry & {
        success: boolean;
        error?: { message: string };
      };

      if (toolResult.success === false) {
        if (!toolResult.error || typeof toolResult.error.message !== 'string') {
          errors.push({
            rule: 'error-required',
            message: `tool.result with success=false must have error.message`,
            specRef: '§4.5',
            entryIds: [entry.id],
          });
        }
      }
    }
  }
}

/**
 * §6.2: pid MUST reference an earlier entry in the file
 */
function validatePidExists(
  entries: AEFEntry[],
  entryById: Map<string, IndexedEntry>,
  errors: SemanticError[]
): void {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry.pid) continue;

    const parent = entryById.get(entry.pid);
    if (!parent) {
      errors.push({
        rule: 'pid-exists',
        message: `pid '${entry.pid}' references non-existent entry`,
        specRef: '§6.2',
        entryIds: [entry.id],
      });
    } else if (parent.index >= i) {
      errors.push({
        rule: 'pid-exists',
        message: `pid '${entry.pid}' references a future entry (must be earlier)`,
        specRef: '§6.2',
        entryIds: [entry.id, entry.pid],
      });
    } else if (parent.entry.sid !== entry.sid) {
      errors.push({
        rule: 'pid-same-session',
        message: `pid references entry in different session`,
        specRef: '§3.1.4',
        entryIds: [entry.id, entry.pid],
      });
    }
  }
}

/**
 * §6.2: All IDs in deps MUST reference earlier entries
 */
function validateDepsExist(
  entries: AEFEntry[],
  entryById: Map<string, IndexedEntry>,
  errors: SemanticError[]
): void {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry.deps || entry.deps.length === 0) continue;

    for (const depId of entry.deps) {
      const dep = entryById.get(depId);
      if (!dep) {
        errors.push({
          rule: 'deps-exist',
          message: `deps contains '${depId}' which references non-existent entry`,
          specRef: '§6.2',
          entryIds: [entry.id],
        });
      } else if (dep.index >= i) {
        errors.push({
          rule: 'deps-exist',
          message: `deps contains '${depId}' which references a future entry (must be earlier)`,
          specRef: '§6.2',
          entryIds: [entry.id, depId],
        });
      } else if (dep.entry.sid !== entry.sid) {
        errors.push({
          rule: 'deps-same-session',
          message: `deps contains entry from different session`,
          specRef: '§3.1.4',
          entryIds: [entry.id, depId],
        });
      }
    }
  }
}

// =============================================================================
// SHOULD Rules (Warnings)
// =============================================================================

/**
 * §3.1.2: Timestamps SHOULD be monotonically increasing within session
 */
function validateTimestampMonotonicity(
  entries: AEFEntry[],
  sessionEntries: Map<string, number[]>,
  warnings: SemanticWarning[]
): void {
  for (const [sid, indexes] of sessionEntries) {
    let lastTs: number | undefined;
    let lastTsEntryId: string | undefined;

    for (const index of indexes) {
      const entry = entries[index];

      if (lastTs !== undefined && entry.ts < lastTs) {
        warnings.push({
          rule: 'ts-monotonic',
          message: `Timestamp decreased from ${lastTs} to ${entry.ts} in session '${sid}'`,
          specRef: '§3.1.2',
          entryIds: [lastTsEntryId!, entry.id],
        });
      }

      lastTs = entry.ts;
      lastTsEntryId = entry.id;
    }
  }
}

/**
 * §3.1.1: Entry IDs SHOULD be unique
 */
function validateIdUniqueness(entries: AEFEntry[], warnings: SemanticWarning[]): void {
  const seen = new Map<string, number>();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const previous = seen.get(entry.id);

    if (previous !== undefined) {
      warnings.push({
        rule: 'id-unique',
        message: `Duplicate entry ID '${entry.id}' found at positions ${previous} and ${i}`,
        specRef: '§3.1.1',
        entryIds: [entry.id],
      });
    }

    seen.set(entry.id, i);
  }
}

/**
 * §4.5: result SHOULD be present when success=true
 */
function validateResultExpected(entries: AEFEntry[], warnings: SemanticWarning[]): void {
  for (const entry of entries) {
    if (entry.type === 'tool.result') {
      const toolResult = entry as AEFEntry & {
        success: boolean;
        result?: unknown;
      };

      if (toolResult.success === true && toolResult.result === undefined) {
        warnings.push({
          rule: 'result-expected',
          message: `tool.result with success=true should have result field`,
          specRef: '§4.5',
          entryIds: [entry.id],
        });
      }
    }
  }
}
