# WarmHub Viewer Plugin

This example demonstrates how to create a custom AEF viewer plugin for domain-specific entry types.

## Overview

The WarmHub plugin provides specialized visualization for belief-conditioned ReAct agents, rendering:

- `warmhub.belief.query` - Belief state queries with hypothesis snapshots
- `warmhub.belief.update` - Belief state updates from assertions
- `warmhub.react.step` - ReAct agent reasoning steps
- `warmhub.react.episode` - Episode-level summaries with metrics

## Usage

### With the AEF CLI

```bash
# From the repository root
bun aef view trace.jsonl --plugin examples/warmhub-viewer/plugin.ts -o output.html
```

### Programmatically

```typescript
import { generateHtml, PluginRegistry } from '@warmautomation/aef';
import { warmhubPlugin } from './examples/warmhub-viewer/plugin.js';

const registry = new PluginRegistry();
registry.register(warmhubPlugin);

const html = generateHtml(entries, {}, registry);
```

### Run the Example

```bash
bun examples/warmhub-viewer/view.ts
# Or with custom files:
bun examples/warmhub-viewer/view.ts my-trace.jsonl my-output.html
```

## Creating Your Own Plugin

### 1. Define Your Plugin

```typescript
import type { ViewerPlugin } from '@warmautomation/aef';

export const myPlugin: ViewerPlugin = {
  // Namespace pattern - matches entry types like "myvendor.category.type"
  namespace: 'myvendor.*',
  name: 'My Plugin',
  description: 'Visualization for my custom entries',
  version: '1.0.0',

  // Render individual entries
  renderEntry(entry, ctx) {
    if (entry.type === 'myvendor.custom.entry') {
      return {
        html: `<div>Custom rendering for ${entry.id}</div>`,
        entryId: entry.id,
        type: entry.type,
        cssClasses: ['my-custom-entry'],
      };
    }
    return null; // Let default renderer handle it
  },

  // Optional: aggregate data across entries
  aggregations: [
    {
      name: 'summary',
      types: ['myvendor.custom.entry'],
      position: 'header', // or 'footer'
      render(entries, ctx) {
        return `<div>Found ${entries.length} custom entries</div>`;
      },
    },
  ],

  // Optional: custom CSS
  styles: `
    .my-custom-entry {
      border-left: 3px solid #3b82f6;
    }
  `,

  // Optional: custom JavaScript
  scripts: `
    console.log('My plugin loaded');
  `,
};
```

### 2. Plugin Interface

```typescript
interface ViewerPlugin {
  readonly namespace: string;        // Pattern like "vendor.*" or "vendor.category.*"
  readonly name: string;             // Display name
  readonly description?: string;     // Optional description
  readonly version?: string;         // Semantic version

  renderEntry?(entry: AEFEntry, ctx: RenderContext): RenderedEntry | null;
  aggregations?: PluginAggregation[];
  styles?: string;
  scripts?: string;
  initialize?(): void | Promise<void>;
}
```

### 3. Namespace Patterns

The `namespace` field determines which entry types your plugin handles:

| Pattern | Matches |
|---------|---------|
| `vendor.*` | `vendor.anything`, `vendor.foo.bar` |
| `vendor.category.*` | `vendor.category.x`, `vendor.category.y` |
| `vendor.specific.type` | Only exact match |

### 4. Render Context

```typescript
interface RenderContext {
  sessionId: string;
  entryIndex: number;
  totalEntries: number;
  options: ViewerOptions;
}
```

### 5. Rendered Entry

```typescript
interface RenderedEntry {
  html: string;           // HTML content to render
  entryId: string;        // Entry ID for navigation
  type: string;           // Entry type
  cssClasses?: string[];  // Additional CSS classes
}
```

## WarmHub Extension Schema

### warmhub.belief.query

Captures a belief state query with hypothesis snapshots.

```typescript
{
  type: 'warmhub.belief.query',
  query: string,                    // The question being answered
  snapshot: {
    hypotheses: Array<{
      id: string,                   // Hypothesis identifier
      desc: string,                 // Description
      b: number,                    // Belief (0-1)
      d: number,                    // Disbelief (0-1)
      u: number,                    // Uncertainty (0-1)
    }>,
    assertions: number,             // Number of assertions made
    finish_ready: boolean,          // Whether finish gate is satisfied
    leading?: string,               // ID of leading hypothesis
  }
}
```

### warmhub.belief.update

Records an assertion that updates belief state.

```typescript
{
  type: 'warmhub.belief.update',
  assertion: {
    id: string,                     // Assertion ID
    type: string,                   // Assertion type (fact, inference, etc.)
    content?: string,               // Assertion content
    consistent_with?: string[],     // Hypothesis IDs this supports
    inconsistent_with?: string[],   // Hypothesis IDs this contradicts
  },
  snapshot_after?: BeliefSnapshot,  // Optional updated snapshot
}
```

### warmhub.react.step

A single ReAct reasoning step.

```typescript
{
  type: 'warmhub.react.step',
  step: number,                     // Step number
  thought?: string,                 // Agent's reasoning
  action: string,                   // Action taken
  action_arg?: string,              // Action argument
  observation?: string,             // Result of action
  latency_ms?: number,              // Step duration
  tokens?: { input: number; output: number },
}
```

### warmhub.react.episode

Episode-level summary with metrics.

```typescript
{
  type: 'warmhub.react.episode',
  question_id: string,
  question: string,
  gold_answer: string,
  predicted_answer?: string | null,
  status: string,                   // success, failure, etc.
  metrics: {
    em: number,                     // Exact match score
    f1: number,                     // F1 score
    tool_calls: number,
    total_latency_ms: number,
    total_tokens: number,
  },
  belief_metrics?: {
    hypothesis_reversals: number,
    final_confidence: number,
    uncertainty_reduction: number,
    finish_gate_respected: boolean,
  },
}
```

## Testing

Run the plugin tests:

```bash
bun test examples/warmhub-viewer/plugin.test.ts
```

## Files

- `plugin.ts` - The WarmHub plugin implementation
- `plugin.test.ts` - Plugin tests
- `sample-trace.jsonl` - Example AEF file with WarmHub entries
- `view.ts` - Example script for generating HTML
