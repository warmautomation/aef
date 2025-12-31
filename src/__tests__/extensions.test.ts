/**
 * Extension Validation Tests
 *
 * Tests the extension model: warmhub.belief.*, warmhub.react.*, and custom extensions.
 */

import { describe, it, expect } from 'bun:test';
import { validateAEFEntry } from '../validator.js';
import { isCoreEntry, isExtensionEntry, hasValidBaseFields } from '../types.js';
import { reactpocAdapter } from '../adapters/reactpoc.js';

describe('Extension validation', () => {
  describe('warmhub.belief.query entries', () => {
    const validBeliefQuery = {
      v: 1,
      id: '0194a1b2c3d4-e5f6',
      ts: 1704067200000,
      type: 'warmhub.belief.query',
      sid: 'session-abc123',
      query: 'What is the capital of France?',
      snapshot: {
        hypotheses: [
          { id: 'h1', desc: 'Paris', b: 0.85, d: 0.05, u: 0.10 },
        ],
        assertions: 5,
        finish_ready: true,
        leading: 'h1',
      },
    };

    it('validates warmhub.belief.query entries with valid base fields', () => {
      const result = validateAEFEntry(validBeliefQuery);
      expect(result.valid).toBe(true);
      expect(result.entryType).toBe('extension');
    });

    it('classifies as extension, not core', () => {
      expect(isCoreEntry(validBeliefQuery as any)).toBe(false);
      expect(isExtensionEntry(validBeliefQuery as any)).toBe(true);
    });
  });

  describe('warmhub.belief.update entries', () => {
    const validBeliefUpdate = {
      v: 1,
      id: '0194a1b2c3d5-f7g8',
      ts: 1704067201000,
      type: 'warmhub.belief.update',
      sid: 'session-abc123',
      pid: '0194a1b2c3d4-e5f6',
      assertion: {
        id: 'a5',
        type: 'evidence',
        content: 'Paris is the capital of France',
        consistent_with: ['h1'],
        inconsistent_with: ['h2'],
      },
      deltas: [
        { hyp: 'h1', db: 0.10, dd: 0.00, du: -0.10 },
      ],
    };

    it('validates warmhub.belief.update entries', () => {
      const result = validateAEFEntry(validBeliefUpdate);
      expect(result.valid).toBe(true);
      expect(result.entryType).toBe('extension');
    });
  });

  describe('warmhub.react.step entries', () => {
    const validReactStep = {
      v: 1,
      id: '0194a1b2c3d6-h9i0',
      ts: 1704067202000,
      type: 'warmhub.react.step',
      sid: 'session-abc123',
      seq: 17,
      step: 3,
      thought: 'I found that Paris is the capital.',
      action: 'search',
      action_arg: 'France capital city official',
      observation: 'The official capital of France is Paris...',
      latency_ms: 1250,
      tokens: { input: 512, output: 128 },
    };

    it('validates warmhub.react.step entries', () => {
      const result = validateAEFEntry(validReactStep);
      expect(result.valid).toBe(true);
      expect(result.entryType).toBe('extension');
    });

    it('classifies as extension', () => {
      expect(isExtensionEntry(validReactStep as any)).toBe(true);
    });
  });

  describe('warmhub.react.episode entries', () => {
    const validReactEpisode = {
      v: 1,
      id: '0194a1b2c3d7-j1k2',
      ts: 1704067210000,
      type: 'warmhub.react.episode',
      sid: 'session-abc123',
      seq: 25,
      question_id: 'hotpot_q_12345',
      question: 'What is the capital of France?',
      gold_answer: 'Paris',
      predicted_answer: 'Paris',
      status: 'success',
      metrics: {
        em: 1.0,
        f1: 1.0,
        tool_calls: 3,
        total_latency_ms: 8500,
        total_tokens: 2048,
      },
      belief_metrics: {
        hypothesis_reversals: 0,
        final_confidence: 0.95,
        uncertainty_reduction: 0.85,
        finish_gate_respected: true,
      },
    };

    it('validates warmhub.react.episode entries', () => {
      const result = validateAEFEntry(validReactEpisode);
      expect(result.valid).toBe(true);
      expect(result.entryType).toBe('extension');
    });
  });

  describe('unknown extensions', () => {
    it('passes unknown extensions with valid base fields', () => {
      const entry = {
        v: 1,
        id: '0194a1b2c3d4-e5f6',
        ts: 1704067200000,
        type: 'acme.custom.widget',
        sid: 'session-abc123',
        customField: 'allowed',
        nestedData: { foo: 'bar', count: 42 },
      };
      const result = validateAEFEntry(entry);
      expect(result.valid).toBe(true);
      expect(result.entryType).toBe('extension');
    });

    it('passes extensions with any additional fields', () => {
      const entry = {
        v: 1,
        id: '0194a1b2c3d4-e5f6',
        ts: 1704067200000,
        type: 'vendor.category.subtype',
        sid: 'session-abc123',
        // Arbitrary extension-specific fields
        widget_count: 5,
        widget_names: ['a', 'b', 'c'],
        config: { enabled: true, timeout: 5000 },
      };
      const result = validateAEFEntry(entry);
      expect(result.valid).toBe(true);
    });

    it('rejects extensions with missing base fields', () => {
      const entry = {
        v: 1,
        id: '0194a1b2c3d4-e5f6',
        // missing ts
        type: 'vendor.custom.type',
        sid: 'session-abc123',
      };
      const result = validateAEFEntry(entry);
      expect(result.valid).toBe(false);
    });
  });

  describe('entry classification', () => {
    it('correctly classifies core types', () => {
      const coreTypes = [
        'session.start',
        'session.end',
        'message',
        'tool.call',
        'tool.result',
        'error',
      ];

      for (const type of coreTypes) {
        const entry = {
          v: 1,
          id: 'test-id',
          ts: Date.now(),
          type,
          sid: 'test-session',
        };
        expect(isCoreEntry(entry as any)).toBe(true);
        expect(isExtensionEntry(entry as any)).toBe(false);
      }
    });

    it('correctly classifies extension types', () => {
      const extensionTypes = [
        'warmhub.belief.query',
        'warmhub.belief.update',
        'warmhub.react.step',
        'warmhub.react.episode',
        'langchain.chain.start',
        'acme.custom.widget',
        'vendor.category.type',
      ];

      for (const type of extensionTypes) {
        const entry = {
          v: 1,
          id: 'test-id',
          ts: Date.now(),
          type,
          sid: 'test-session',
        };
        expect(isCoreEntry(entry as any)).toBe(false);
        expect(isExtensionEntry(entry as any)).toBe(true);
      }
    });

    it('does not classify single-dot types as extensions', () => {
      // Extensions must have at least 2 dots (vendor.category.type)
      const singleDotType = {
        v: 1,
        id: 'test-id',
        ts: Date.now(),
        type: 'custom.type', // only 1 dot
        sid: 'test-session',
      };
      expect(isExtensionEntry(singleDotType as any)).toBe(false);
    });
  });

  describe('base field validation', () => {
    it('hasValidBaseFields returns true for valid entries', () => {
      const entry = {
        v: 1,
        id: 'test-id',
        ts: 1704067200000,
        type: 'warmhub.belief.query',
        sid: 'session-123',
      };
      expect(hasValidBaseFields(entry)).toBe(true);
    });

    it('hasValidBaseFields returns false for missing v', () => {
      const entry = {
        id: 'test-id',
        ts: 1704067200000,
        type: 'warmhub.belief.query',
        sid: 'session-123',
      };
      expect(hasValidBaseFields(entry)).toBe(false);
    });

    it('hasValidBaseFields returns false for wrong v value', () => {
      const entry = {
        v: 2, // only 1 is valid
        id: 'test-id',
        ts: 1704067200000,
        type: 'warmhub.belief.query',
        sid: 'session-123',
      };
      expect(hasValidBaseFields(entry)).toBe(false);
    });

    it('hasValidBaseFields returns false for non-string id', () => {
      const entry = {
        v: 1,
        id: 12345, // should be string
        ts: 1704067200000,
        type: 'warmhub.belief.query',
        sid: 'session-123',
      };
      expect(hasValidBaseFields(entry)).toBe(false);
    });

    it('hasValidBaseFields returns false for non-number ts', () => {
      const entry = {
        v: 1,
        id: 'test-id',
        ts: '2024-01-01', // should be number
        type: 'warmhub.belief.query',
        sid: 'session-123',
      };
      expect(hasValidBaseFields(entry)).toBe(false);
    });

    it('hasValidBaseFields returns false for null', () => {
      expect(hasValidBaseFields(null)).toBe(false);
    });

    it('hasValidBaseFields returns false for non-object', () => {
      expect(hasValidBaseFields('string')).toBe(false);
      expect(hasValidBaseFields(123)).toBe(false);
      expect(hasValidBaseFields(undefined)).toBe(false);
    });
  });

  describe('reserved namespace handling', () => {
    it('allows alf.* extensions', () => {
      const entry = {
        v: 1,
        id: 'test-id',
        ts: 1704067200000,
        type: 'alf.future.feature',
        sid: 'session-123',
        data: { enabled: true },
      };
      const result = validateAEFEntry(entry);
      expect(result.valid).toBe(true);
      expect(result.entryType).toBe('extension');
    });

    it('allows otel.* extensions', () => {
      const entry = {
        v: 1,
        id: 'test-id',
        ts: 1704067200000,
        type: 'otel.span.event',
        sid: 'session-123',
        traceId: 'abc123',
        spanId: 'def456',
      };
      const result = validateAEFEntry(entry);
      expect(result.valid).toBe(true);
      expect(result.entryType).toBe('extension');
    });
  });
});

describe('ReActPOC adapter extension output', () => {
  // These tests verify the adapter produces valid extension entries

  async function* linesFromArray(lines: string[]): AsyncIterable<string> {
    for (const line of lines) {
      yield line;
    }
  }

  async function collectEntries(lines: string[]) {
    const entries = [];
    for await (const entry of reactpocAdapter.parse(linesFromArray(lines))) {
      entries.push(entry);
    }
    return entries;
  }

  const sampleEpisode = JSON.stringify({
    questionId: 'test-q-123',
    question: 'What is 2 + 2?',
    goldAnswer: '4',
    predictedAnswer: '4',
    status: 'success',
    steps: [
      {
        stepNumber: 1,
        thought: 'This is a simple math problem.',
        action: 'calculate',
        actionArg: '2 + 2',
        observation: '4',
        latencyMs: 100,
        inputTokens: 50,
        outputTokens: 10,
      },
    ],
    metrics: {
      em: 1.0,
      f1: 1.0,
      toolCalls: 1,
      totalLatencyMs: 100,
      totalTokens: 60,
    },
    beliefTrace: [
      {
        step: 1,
        type: 'beliefQuery',
        content: 'What is 2 + 2?',
        beliefSnapshot: {
          hypotheses: [
            { id: 'H1', description: 'The answer is 4', b: 0.9, d: 0.02, u: 0.08 },
          ],
          assertionCount: 0,
          finishReady: true,
          leadingHypothesis: 'H1',
        },
      },
    ],
    beliefMetrics: {
      hypothesisReversals: 0,
      finalConfidence: 0.9,
      uncertaintyReduction: 0.8,
      finishGateRespected: true,
    },
  });

  it('produces valid warmhub.react.step entries', async () => {
    const entries = await collectEntries([sampleEpisode]);
    const reactSteps = entries.filter((e) => e.type === 'warmhub.react.step');

    expect(reactSteps.length).toBe(1);

    for (const step of reactSteps) {
      const result = validateAEFEntry(step);
      expect(result.valid).toBe(true);
      expect(result.entryType).toBe('extension');
    }
  });

  it('produces valid warmhub.react.episode entries', async () => {
    const entries = await collectEntries([sampleEpisode]);
    const episodes = entries.filter((e) => e.type === 'warmhub.react.episode');

    expect(episodes.length).toBe(1);

    const episode = episodes[0] as any;
    expect(episode.question_id).toBe('test-q-123');
    expect(episode.status).toBe('success');
    expect(episode.metrics.em).toBe(1.0);

    const result = validateAEFEntry(episode);
    expect(result.valid).toBe(true);
    expect(result.entryType).toBe('extension');
  });

  it('produces valid warmhub.belief.query entries', async () => {
    const entries = await collectEntries([sampleEpisode]);
    const beliefQueries = entries.filter((e) => e.type === 'warmhub.belief.query');

    expect(beliefQueries.length).toBe(1);

    const query = beliefQueries[0] as any;
    expect(query.snapshot.hypotheses).toHaveLength(1);
    expect(query.snapshot.hypotheses[0].id).toBe('H1');
    expect(query.snapshot.finish_ready).toBe(true);

    const result = validateAEFEntry(query);
    expect(result.valid).toBe(true);
    expect(result.entryType).toBe('extension');
  });

  it('produces all valid entries for complete episode', async () => {
    const entries = await collectEntries([sampleEpisode]);

    // Should have: session.start, user message, react.step, tool.call, tool.result,
    // belief.query, react.episode, assistant message, session.end
    expect(entries.length).toBeGreaterThanOrEqual(8);

    for (const entry of entries) {
      const result = validateAEFEntry(entry);
      expect(result.valid).toBe(true);
    }
  });
});
