import { describe, it, expect } from 'bun:test';
import { validateSemantics } from '../semantic-validator.js';
import { loadFixture } from './helpers.js';

describe('semantic validation', () => {
  describe('valid fixtures', () => {
    it('accepts minimal-session', async () => {
      const entries = await loadFixture('valid/minimal-session.aef.jsonl');
      const result = validateSemantics(entries);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts tool-flow', async () => {
      const entries = await loadFixture('valid/tool-flow.aef.jsonl');
      const result = validateSemantics(entries);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts multi-tool-session', async () => {
      const entries = await loadFixture('valid/multi-tool-session.aef.jsonl');
      const result = validateSemantics(entries);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts parallel-tools', async () => {
      const entries = await loadFixture('valid/parallel-tools.aef.jsonl');
      const result = validateSemantics(entries);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts with-extensions', async () => {
      const entries = await loadFixture('valid/with-extensions.aef.jsonl');
      const result = validateSemantics(entries);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts empty entries array', () => {
      const result = validateSemantics([]);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('MUST violations', () => {
    describe('session-start-first (§3.1.4)', () => {
      it('rejects session.start not at beginning', async () => {
        const entries = await loadFixture('invalid/session-start-not-first.aef.jsonl');
        const result = validateSemantics(entries);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.rule === 'session-start-first')).toBe(true);
        const error = result.errors.find((e) => e.rule === 'session-start-first');
        expect(error?.specRef).toBe('§3.1.4');
      });
    });

    describe('session-end-last (§3.1.4)', () => {
      it('rejects session.end not at end', async () => {
        const entries = await loadFixture('invalid/session-end-not-last.aef.jsonl');
        const result = validateSemantics(entries);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.rule === 'session-end-last')).toBe(true);
        const error = result.errors.find((e) => e.rule === 'session-end-last');
        expect(error?.specRef).toBe('§3.1.4');
      });
    });

    describe('session-contiguous (§3.1.4)', () => {
      it('rejects interleaved sessions', async () => {
        const entries = await loadFixture('invalid/interleaved-sessions.aef.jsonl');
        const result = validateSemantics(entries);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.rule === 'session-contiguous')).toBe(true);
        const error = result.errors.find((e) => e.rule === 'session-contiguous');
        expect(error?.specRef).toBe('§3.1.4');
      });
    });

    describe('seq-monotonic (§3.2.1)', () => {
      it('rejects decreasing seq values', async () => {
        const entries = await loadFixture('invalid/decreasing-seq.aef.jsonl');
        const result = validateSemantics(entries);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.rule === 'seq-monotonic')).toBe(true);
        const error = result.errors.find((e) => e.rule === 'seq-monotonic');
        expect(error?.specRef).toBe('§3.2.1');
      });

      it('accepts entries without seq (optional field)', () => {
        const entries = [
          { v: 1 as const, id: '01', ts: 1000, type: 'session.start', sid: 's1', agent: 'test' },
          { v: 1 as const, id: '02', ts: 1001, type: 'message', sid: 's1', role: 'user', content: 'hi' },
          { v: 1 as const, id: '03', ts: 1002, type: 'session.end', sid: 's1', status: 'complete' },
        ];
        const result = validateSemantics(entries);
        expect(result.errors.filter((e) => e.rule === 'seq-monotonic')).toHaveLength(0);
      });
    });

    describe('call-id-match (§4.4/§4.5)', () => {
      it('rejects mismatched call_ids', async () => {
        const entries = await loadFixture('invalid/mismatched-call-ids.aef.jsonl');
        const result = validateSemantics(entries);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.rule === 'call-id-match')).toBe(true);
        const error = result.errors.find((e) => e.rule === 'call-id-match');
        expect(error?.specRef).toBe('§4.4/§4.5');
        expect(error?.message).toContain('tc999');
      });

      it('accepts tool.result without call_id when tool.call has none', () => {
        const entries = [
          { v: 1 as const, id: '01', ts: 1000, type: 'session.start', sid: 's1', agent: 'test' },
          { v: 1 as const, id: '02', ts: 1001, type: 'tool.call', sid: 's1', tool: 'bash', args: {} },
          { v: 1 as const, id: '03', ts: 1002, type: 'tool.result', sid: 's1', tool: 'bash', success: true, result: 'ok' },
          { v: 1 as const, id: '04', ts: 1003, type: 'session.end', sid: 's1', status: 'complete' },
        ];
        const result = validateSemantics(entries);
        expect(result.errors.filter((e) => e.rule === 'call-id-match')).toHaveLength(0);
      });
    });

    describe('error-required (§4.5)', () => {
      it('rejects success=false without error', async () => {
        const entries = await loadFixture('invalid/missing-error-on-failure.aef.jsonl');
        const result = validateSemantics(entries);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.rule === 'error-required')).toBe(true);
        const error = result.errors.find((e) => e.rule === 'error-required');
        expect(error?.specRef).toBe('§4.5');
      });

      it('accepts success=false with valid error', () => {
        const entries = [
          { v: 1 as const, id: '01', ts: 1000, type: 'session.start', sid: 's1', agent: 'test' },
          {
            v: 1 as const,
            id: '02',
            ts: 1001,
            type: 'tool.result',
            sid: 's1',
            tool: 'bash',
            success: false,
            error: { message: 'Command failed' },
          },
          { v: 1 as const, id: '03', ts: 1002, type: 'session.end', sid: 's1', status: 'complete' },
        ];
        const result = validateSemantics(entries);
        expect(result.errors.filter((e) => e.rule === 'error-required')).toHaveLength(0);
      });
    });

    describe('pid-exists (§3.2.2)', () => {
      it('rejects pid pointing to future entry', async () => {
        const entries = await loadFixture('invalid/pid-future-ref.aef.jsonl');
        const result = validateSemantics(entries);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.rule === 'pid-exists')).toBe(true);
        const error = result.errors.find((e) => e.rule === 'pid-exists');
        expect(error?.specRef).toBe('§3.2.2');
        expect(error?.message).toContain('future');
      });

      it('rejects pid pointing to non-existent entry', () => {
        const entries = [
          { v: 1 as const, id: '01', ts: 1000, type: 'session.start', sid: 's1', agent: 'test' },
          { v: 1 as const, id: '02', ts: 1001, type: 'message', sid: 's1', role: 'user', content: 'hi', pid: 'nonexistent' },
          { v: 1 as const, id: '03', ts: 1002, type: 'session.end', sid: 's1', status: 'complete' },
        ];
        const result = validateSemantics(entries);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.rule === 'pid-exists')).toBe(true);
        expect(result.errors.find((e) => e.rule === 'pid-exists')?.message).toContain('non-existent');
      });

      it('accepts valid pid chain', () => {
        const entries = [
          { v: 1 as const, id: '01', ts: 1000, type: 'session.start', sid: 's1', agent: 'test' },
          { v: 1 as const, id: '02', ts: 1001, type: 'message', sid: 's1', role: 'user', content: 'hi' },
          { v: 1 as const, id: '03', ts: 1002, type: 'message', sid: 's1', role: 'assistant', content: 'hello', pid: '02' },
          { v: 1 as const, id: '04', ts: 1003, type: 'session.end', sid: 's1', status: 'complete' },
        ];
        const result = validateSemantics(entries);
        expect(result.errors.filter((e) => e.rule === 'pid-exists')).toHaveLength(0);
      });

      it('rejects pid pointing to entry in different session', () => {
        // Two sessions in sequence, second session references first session
        const entries = [
          { v: 1 as const, id: '01', ts: 1000, type: 'session.start', sid: 's1', agent: 'test' },
          { v: 1 as const, id: '02', ts: 1001, type: 'message', sid: 's1', role: 'user', content: 'hi' },
          { v: 1 as const, id: '03', ts: 1002, type: 'session.end', sid: 's1', status: 'complete' },
          { v: 1 as const, id: '04', ts: 2000, type: 'session.start', sid: 's2', agent: 'test' },
          { v: 1 as const, id: '05', ts: 2001, type: 'message', sid: 's2', role: 'user', content: 'hi', pid: '02' }, // cross-session pid
          { v: 1 as const, id: '06', ts: 2002, type: 'session.end', sid: 's2', status: 'complete' },
        ];
        const result = validateSemantics(entries);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.rule === 'pid-same-session')).toBe(true);
        const error = result.errors.find((e) => e.rule === 'pid-same-session');
        expect(error?.specRef).toBe('§3.2.2');
        expect(error?.message).toContain('different session');
      });
    });

    describe('deps-exist (§3.2.3)', () => {
      it('rejects deps containing non-existent IDs', () => {
        const entries = [
          { v: 1 as const, id: '01', ts: 1000, type: 'session.start', sid: 's1', agent: 'test' },
          { v: 1 as const, id: '02', ts: 1001, type: 'message', sid: 's1', role: 'user', content: 'hi', deps: ['nonexistent'] },
          { v: 1 as const, id: '03', ts: 1002, type: 'session.end', sid: 's1', status: 'complete' },
        ];
        const result = validateSemantics(entries);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.rule === 'deps-exist')).toBe(true);
      });

      it('rejects deps containing future entry IDs', () => {
        const entries = [
          { v: 1 as const, id: '01', ts: 1000, type: 'session.start', sid: 's1', agent: 'test' },
          { v: 1 as const, id: '02', ts: 1001, type: 'message', sid: 's1', role: 'user', content: 'hi', deps: ['03'] },
          { v: 1 as const, id: '03', ts: 1002, type: 'message', sid: 's1', role: 'assistant', content: 'hello' },
          { v: 1 as const, id: '04', ts: 1003, type: 'session.end', sid: 's1', status: 'complete' },
        ];
        const result = validateSemantics(entries);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.rule === 'deps-exist')).toBe(true);
        expect(result.errors.find((e) => e.rule === 'deps-exist')?.message).toContain('future');
      });

      it('accepts valid deps arrays', () => {
        const entries = [
          { v: 1 as const, id: '01', ts: 1000, type: 'session.start', sid: 's1', agent: 'test' },
          { v: 1 as const, id: '02', ts: 1001, type: 'tool.result', sid: 's1', tool: 'a', success: true, result: 'r1' },
          { v: 1 as const, id: '03', ts: 1002, type: 'tool.result', sid: 's1', tool: 'b', success: true, result: 'r2' },
          { v: 1 as const, id: '04', ts: 1003, type: 'message', sid: 's1', role: 'assistant', content: 'done', deps: ['02', '03'] },
          { v: 1 as const, id: '05', ts: 1004, type: 'session.end', sid: 's1', status: 'complete' },
        ];
        const result = validateSemantics(entries);
        expect(result.errors.filter((e) => e.rule === 'deps-exist')).toHaveLength(0);
      });

      it('rejects deps containing entry from different session', () => {
        // Two sessions in sequence, second session deps references first session
        const entries = [
          { v: 1 as const, id: '01', ts: 1000, type: 'session.start', sid: 's1', agent: 'test' },
          { v: 1 as const, id: '02', ts: 1001, type: 'tool.result', sid: 's1', tool: 'a', success: true, result: 'r1' },
          { v: 1 as const, id: '03', ts: 1002, type: 'session.end', sid: 's1', status: 'complete' },
          { v: 1 as const, id: '04', ts: 2000, type: 'session.start', sid: 's2', agent: 'test' },
          { v: 1 as const, id: '05', ts: 2001, type: 'tool.result', sid: 's2', tool: 'b', success: true, result: 'r2' },
          { v: 1 as const, id: '06', ts: 2002, type: 'message', sid: 's2', role: 'assistant', content: 'done', deps: ['02', '05'] }, // deps contains s1 entry
          { v: 1 as const, id: '07', ts: 2003, type: 'session.end', sid: 's2', status: 'complete' },
        ];
        const result = validateSemantics(entries);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.rule === 'deps-same-session')).toBe(true);
        const error = result.errors.find((e) => e.rule === 'deps-same-session');
        expect(error?.specRef).toBe('§3.2.3');
        expect(error?.message).toContain('different session');
      });
    });
  });

  describe('SHOULD violations (warnings)', () => {
    describe('ts-monotonic (§3.1.2)', () => {
      it('warns on decreasing timestamps', () => {
        const entries = [
          { v: 1 as const, id: '01', ts: 1000, type: 'session.start', sid: 's1', agent: 'test' },
          { v: 1 as const, id: '02', ts: 999, type: 'message', sid: 's1', role: 'user', content: 'hi' }, // ts decreased
          { v: 1 as const, id: '03', ts: 1002, type: 'session.end', sid: 's1', status: 'complete' },
        ];
        const result = validateSemantics(entries);
        // This is a warning, not an error
        expect(result.valid).toBe(true);
        expect(result.warnings.some((w) => w.rule === 'ts-monotonic')).toBe(true);
      });

      it('allows equal timestamps', () => {
        const entries = [
          { v: 1 as const, id: '01', ts: 1000, type: 'session.start', sid: 's1', agent: 'test' },
          { v: 1 as const, id: '02', ts: 1000, type: 'message', sid: 's1', role: 'user', content: 'hi' }, // same ts is ok
          { v: 1 as const, id: '03', ts: 1001, type: 'session.end', sid: 's1', status: 'complete' },
        ];
        const result = validateSemantics(entries);
        expect(result.warnings.filter((w) => w.rule === 'ts-monotonic')).toHaveLength(0);
      });
    });

    describe('id-unique (§3.1.1)', () => {
      it('warns on duplicate entry IDs', () => {
        const entries = [
          { v: 1 as const, id: '01', ts: 1000, type: 'session.start', sid: 's1', agent: 'test' },
          { v: 1 as const, id: '01', ts: 1001, type: 'message', sid: 's1', role: 'user', content: 'hi' }, // duplicate id
          { v: 1 as const, id: '03', ts: 1002, type: 'session.end', sid: 's1', status: 'complete' },
        ];
        const result = validateSemantics(entries);
        expect(result.valid).toBe(true); // warnings don't fail validation
        expect(result.warnings.some((w) => w.rule === 'id-unique')).toBe(true);
      });
    });

    describe('result-expected (§4.5)', () => {
      it('warns on success=true without result', () => {
        const entries = [
          { v: 1 as const, id: '01', ts: 1000, type: 'session.start', sid: 's1', agent: 'test' },
          { v: 1 as const, id: '02', ts: 1001, type: 'tool.result', sid: 's1', tool: 'bash', success: true }, // no result
          { v: 1 as const, id: '03', ts: 1002, type: 'session.end', sid: 's1', status: 'complete' },
        ];
        const result = validateSemantics(entries);
        expect(result.valid).toBe(true); // warnings don't fail validation
        expect(result.warnings.some((w) => w.rule === 'result-expected')).toBe(true);
      });

      it('accepts success=true with result', () => {
        const entries = [
          { v: 1 as const, id: '01', ts: 1000, type: 'session.start', sid: 's1', agent: 'test' },
          { v: 1 as const, id: '02', ts: 1001, type: 'tool.result', sid: 's1', tool: 'bash', success: true, result: 'output' },
          { v: 1 as const, id: '03', ts: 1002, type: 'session.end', sid: 's1', status: 'complete' },
        ];
        const result = validateSemantics(entries);
        expect(result.warnings.filter((w) => w.rule === 'result-expected')).toHaveLength(0);
      });
    });
  });

  describe('error message quality', () => {
    it('includes rule ID in error', async () => {
      const entries = await loadFixture('invalid/session-start-not-first.aef.jsonl');
      const result = validateSemantics(entries);
      expect(result.errors[0].rule).toBeDefined();
      expect(result.errors[0].rule.length).toBeGreaterThan(0);
    });

    it('includes spec reference in error', async () => {
      const entries = await loadFixture('invalid/session-start-not-first.aef.jsonl');
      const result = validateSemantics(entries);
      expect(result.errors[0].specRef).toMatch(/^§/);
    });

    it('includes affected entry IDs', async () => {
      const entries = await loadFixture('invalid/session-start-not-first.aef.jsonl');
      const result = validateSemantics(entries);
      expect(result.errors[0].entryIds).toBeDefined();
      expect(result.errors[0].entryIds.length).toBeGreaterThan(0);
    });
  });
});
