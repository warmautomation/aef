/**
 * ReActPOC Adapter
 *
 * Transforms ReActPOC belief-conditioned agent traces into AEF format.
 *
 * ReActPOC Log Format:
 * - Location: logs/*_traces_*.jsonl
 * - Structure: Episode-level JSONL (one episode per line)
 * - Contains: questionId, question, goldAnswer, steps[], beliefTrace[], metrics
 */

import type { LogAdapter } from './adapter.js';
import { generateId } from './adapter.js';
import type {
  AnyAEFEntry,
  SessionStart,
  SessionEnd,
  Message,
  ToolCall,
  ToolResult,
} from '../types.js';

// =============================================================================
// ReActPOC Source Types
// =============================================================================

/** ReAct step in an episode */
interface RPStep {
  stepNumber: number;
  thought?: string;
  action: string;
  actionArg?: string;
  observation?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  rawLLMOutput?: string;
}

/** Hypothesis in belief state */
interface RPHypothesis {
  id: string;
  description: string;
  b: number; // belief
  d: number; // disbelief
  u: number; // uncertainty
}

/** Belief state snapshot */
interface RPBeliefSnapshot {
  hypotheses: RPHypothesis[];
  assertionCount: number;
  finishReady: boolean;
  leadingHypothesis?: string;
}

/** Belief trace entry */
interface RPBeliefTrace {
  step: number;
  type: 'beliefQuery' | 'beliefUpdate' | 'assertion';
  content?: string;
  beliefSnapshot?: RPBeliefSnapshot;
  assertion?: {
    id: string;
    type: string;
    content?: string;
    consistentWith?: string[];
    inconsistentWith?: string[];
  };
}

/** Episode metrics */
interface RPMetrics {
  em: number;
  f1: number;
  toolCalls: number;
  totalLatencyMs: number;
  totalTokens: number;
}

/** Belief-specific metrics */
interface RPBeliefMetrics {
  hypothesisReversals: number;
  getBeliefStateCalls?: number;
  updateBeliefStateCalls?: number;
  assertionsRecorded: number;
  finalConfidence: number;
  uncertaintyReduction: number;
  finishGateRespected: boolean;
}

/** Complete episode result */
interface RPEpisode {
  questionId: string;
  question: string;
  goldAnswer: string;
  predictedAnswer?: string | null;
  status: 'success' | 'max_steps' | 'error' | 'parse_failure' | 'timeout';
  steps: RPStep[];
  metrics: RPMetrics;
  beliefTrace?: RPBeliefTrace[];
  beliefMetrics?: RPBeliefMetrics;
}

// =============================================================================
// AEF Extension Types (warmhub.react.*, warmhub.belief.*)
// =============================================================================

/** warmhub.react.step extension entry */
interface ReactStepEntry extends AnyAEFEntry {
  type: 'warmhub.react.step';
  step: number;
  thought?: string;
  action: string;
  action_arg?: string;
  observation?: string;
  latency_ms?: number;
  tokens?: { input: number; output: number };
}

/** warmhub.react.episode extension entry */
interface ReactEpisodeEntry extends AnyAEFEntry {
  type: 'warmhub.react.episode';
  question_id: string;
  question: string;
  gold_answer: string;
  predicted_answer?: string | null;
  status: string;
  metrics: {
    em: number;
    f1: number;
    tool_calls: number;
    total_latency_ms: number;
    total_tokens: number;
  };
  belief_metrics?: {
    hypothesis_reversals: number;
    final_confidence: number;
    uncertainty_reduction: number;
    finish_gate_respected: boolean;
  };
}

/** warmhub.belief.query extension entry */
interface BeliefQueryEntry extends AnyAEFEntry {
  type: 'warmhub.belief.query';
  query: string;
  snapshot: {
    hypotheses: Array<{
      id: string;
      desc: string;
      b: number;
      d: number;
      u: number;
    }>;
    assertions: number;
    finish_ready: boolean;
    leading?: string;
  };
}

/** warmhub.belief.update extension entry */
interface BeliefUpdateEntry extends AnyAEFEntry {
  type: 'warmhub.belief.update';
  assertion: {
    id: string;
    type: string;
    content?: string;
    consistent_with?: string[];
    inconsistent_with?: string[];
  };
  snapshot_after?: BeliefQueryEntry['snapshot'];
}

// =============================================================================
// Adapter Implementation
// =============================================================================

/**
 * Adapter for ReActPOC belief-conditioned agent traces.
 * Transforms episode-centric format to event-centric AEF entries.
 */
export const reactpocAdapter: LogAdapter<AsyncIterable<string>> = {
  id: 'reactpoc',
  name: 'ReActPOC Belief Agent',
  patterns: ['logs/*_traces_*.jsonl', 'logs/belief-test_*.jsonl'],

  async *parse(lines: AsyncIterable<string>): AsyncIterable<AnyAEFEntry> {
    for await (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let episode: RPEpisode;
      try {
        episode = JSON.parse(trimmed) as RPEpisode;
      } catch {
        continue;
      }

      // Skip if missing required fields
      if (!episode.questionId || !episode.steps) continue;

      // Generate session ID from question ID
      const sessionId = `reactpoc-${episode.questionId}`;
      const baseTimestamp = Date.now();
      let seq = 0;

      // Emit session.start
      const sessionStartId = generateId();
      const sessionStart: SessionStart = {
        v: 1,
        id: sessionStartId,
        ts: baseTimestamp,
        type: 'session.start',
        sid: sessionId,
        agent: 'reactpoc',
        meta: {
          questionId: episode.questionId,
          goldAnswer: episode.goldAnswer,
        },
      };
      yield sessionStart;

      // Track message count for session summary
      let messageCount = 0;

      // Emit user message with question
      const userMessageId = generateId();
      const userMessage: Message = {
        v: 1,
        id: userMessageId,
        ts: baseTimestamp + 1,
        type: 'message',
        sid: sessionId,
        pid: sessionStartId,
        seq: seq++,
        role: 'user',
        content: episode.question,
      };
      yield userMessage;
      messageCount++;

      // Track parent ID for chaining
      let lastEntryId = userMessageId;
      let currentTimestamp = baseTimestamp + 2;

      // Build belief trace index for quick lookup
      const beliefTraceByStep = new Map<number, RPBeliefTrace[]>();
      if (episode.beliefTrace) {
        for (const bt of episode.beliefTrace) {
          const existing = beliefTraceByStep.get(bt.step) ?? [];
          existing.push(bt);
          beliefTraceByStep.set(bt.step, existing);
        }
      }

      // Process each step
      for (const step of episode.steps) {
        const stepTimestamp = Math.floor(currentTimestamp);
        currentTimestamp += Math.ceil(step.latencyMs ?? 100);

        // Emit warmhub.react.step entry
        const reactStepId = generateId();
        const reactStep: ReactStepEntry = {
          v: 1,
          id: reactStepId,
          ts: stepTimestamp,
          type: 'warmhub.react.step',
          sid: sessionId,
          pid: lastEntryId,
          seq: seq++,
          step: step.stepNumber,
          thought: step.thought,
          action: step.action,
          action_arg: step.actionArg,
          observation: step.observation,
          latency_ms: step.latencyMs ? Math.round(step.latencyMs) : undefined,
          tokens:
            step.inputTokens !== undefined && step.outputTokens !== undefined
              ? { input: step.inputTokens, output: step.outputTokens }
              : undefined,
        };
        yield reactStep;
        lastEntryId = reactStepId;

        // Emit tool.call for this step's action
        const toolCallId = generateId();
        const callId = `step-${step.stepNumber}`;
        const toolCall: ToolCall = {
          v: 1,
          id: toolCallId,
          ts: stepTimestamp,
          type: 'tool.call',
          sid: sessionId,
          pid: reactStepId,
          tool: step.action,
          args: step.actionArg ? { query: step.actionArg } : {},
          call_id: callId,
        };
        yield toolCall;

        // Emit tool.result for this step's observation
        const toolResultId = generateId();
        const toolResult: ToolResult = {
          v: 1,
          id: toolResultId,
          ts: stepTimestamp + 1,
          type: 'tool.result',
          sid: sessionId,
          pid: toolCallId,
          tool: step.action,
          call_id: callId,
          result: step.observation,
          success: true,
          duration_ms: step.latencyMs ? Math.round(step.latencyMs) : undefined,
        };
        yield toolResult;
        lastEntryId = toolResultId;

        // Emit belief trace entries for this step
        const beliefEntries = beliefTraceByStep.get(step.stepNumber) ?? [];
        for (const bt of beliefEntries) {
          if (bt.type === 'beliefQuery' && bt.beliefSnapshot) {
            const beliefQueryId = generateId();
            const beliefQuery: BeliefQueryEntry = {
              v: 1,
              id: beliefQueryId,
              ts: stepTimestamp + 2,
              type: 'warmhub.belief.query',
              sid: sessionId,
              pid: lastEntryId,
              query: bt.content ?? episode.question,
              snapshot: {
                hypotheses: bt.beliefSnapshot.hypotheses.map((h) => ({
                  id: h.id,
                  desc: h.description,
                  b: h.b,
                  d: h.d,
                  u: h.u,
                })),
                assertions: bt.beliefSnapshot.assertionCount,
                finish_ready: bt.beliefSnapshot.finishReady,
                leading: bt.beliefSnapshot.leadingHypothesis,
              },
            };
            yield beliefQuery;
            lastEntryId = beliefQueryId;
          } else if (bt.type === 'beliefUpdate' || bt.type === 'assertion') {
            if (bt.assertion) {
              const beliefUpdateId = generateId();
              const beliefUpdate: BeliefUpdateEntry = {
                v: 1,
                id: beliefUpdateId,
                ts: stepTimestamp + 2,
                type: 'warmhub.belief.update',
                sid: sessionId,
                pid: lastEntryId,
                assertion: {
                  id: bt.assertion.id,
                  type: bt.assertion.type,
                  content: bt.assertion.content,
                  consistent_with: bt.assertion.consistentWith,
                  inconsistent_with: bt.assertion.inconsistentWith,
                },
                snapshot_after: bt.beliefSnapshot
                  ? {
                      hypotheses: bt.beliefSnapshot.hypotheses.map((h) => ({
                        id: h.id,
                        desc: h.description,
                        b: h.b,
                        d: h.d,
                        u: h.u,
                      })),
                      assertions: bt.beliefSnapshot.assertionCount,
                      finish_ready: bt.beliefSnapshot.finishReady,
                      leading: bt.beliefSnapshot.leadingHypothesis,
                    }
                  : undefined,
              };
              yield beliefUpdate;
              lastEntryId = beliefUpdateId;
            }
          }
        }
      }

      // Emit warmhub.react.episode summary
      const finalTimestamp = Math.floor(currentTimestamp);
      const episodeEntryId = generateId();
      const episodeEntry: ReactEpisodeEntry = {
        v: 1,
        id: episodeEntryId,
        ts: finalTimestamp,
        type: 'warmhub.react.episode',
        sid: sessionId,
        pid: lastEntryId,
        seq: seq++,
        question_id: episode.questionId,
        question: episode.question,
        gold_answer: episode.goldAnswer,
        predicted_answer: episode.predictedAnswer,
        status: episode.status,
        metrics: {
          em: episode.metrics.em,
          f1: episode.metrics.f1,
          tool_calls: episode.metrics.toolCalls,
          total_latency_ms: Math.round(episode.metrics.totalLatencyMs),
          total_tokens: episode.metrics.totalTokens,
        },
        belief_metrics: episode.beliefMetrics
          ? {
              hypothesis_reversals: episode.beliefMetrics.hypothesisReversals,
              final_confidence: episode.beliefMetrics.finalConfidence,
              uncertainty_reduction: episode.beliefMetrics.uncertaintyReduction,
              finish_gate_respected: episode.beliefMetrics.finishGateRespected,
            }
          : undefined,
      };
      yield episodeEntry;
      lastEntryId = episodeEntryId;

      // Emit assistant message with answer (if available)
      if (episode.predictedAnswer) {
        const assistantMessageId = generateId();
        const assistantMessage: Message = {
          v: 1,
          id: assistantMessageId,
          ts: finalTimestamp + 1,
          type: 'message',
          sid: sessionId,
          pid: lastEntryId,
          seq: seq++,
          role: 'assistant',
          content: episode.predictedAnswer,
        };
        yield assistantMessage;
        messageCount++;
        lastEntryId = assistantMessageId;
      }

      // Emit session.end
      const sessionEnd: SessionEnd = {
        v: 1,
        id: generateId(),
        ts: finalTimestamp + 2,
        type: 'session.end',
        sid: sessionId,
        status: episode.status === 'success' ? 'complete' : 'error',
        summary: {
          messages: messageCount,
          tool_calls: episode.metrics.toolCalls,
          duration_ms: Math.round(episode.metrics.totalLatencyMs),
          tokens: {
            input: Math.round(episode.metrics.totalTokens * 0.7), // estimate
            output: Math.round(episode.metrics.totalTokens * 0.3),
          },
        },
      };
      yield sessionEnd;
    }
  },
};

export default reactpocAdapter;
