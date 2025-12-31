# AEF-Compatible Viewer Transformation Analysis

## Current State Summary

### Existing HTML Formatter (`explainHtmlFormatter.ts`)
- **2840 lines** of tightly-coupled visualization code
- Consumes `EpisodeResult` directly from ReActPOC types
- Generates **monolithic self-contained HTML** with embedded CSS/JS
- **Domain-specific visualizations**:
  - Waterfall timeline (step → LLM call → tool call → API calls → belief snapshots/deltas)
  - Belief trajectory sparklines
  - Evidence linkage matrix
  - Finish gate timeline
  - Wasted steps detection
  - API latency heatmap
  - Answer comparison with word-level diff

### AEF Format (from spec)
- **Core types**: `session.start`, `session.end`, `message`, `tool.call`, `tool.result`, `error`
- **Extensions**: `warmhub.belief.*`, `warmhub.react.*` for domain-specific data
- **Streamable-first**: JSONL append-only format
- **Adapters**: Transform source formats → AEF JSONL

---

## Transformation Scenarios

### Scenario A: Monolithic External Viewer
**Location**: `aef/src/viewer/` as a single package

```
aef/
├── src/
│   ├── adapters/
│   ├── viewer/
│   │   ├── html.ts         # Core HTML generation
│   │   ├── components/     # All visualization components
│   │   └── extensions/     # warmhub-specific renderers
```

**How it works**:
1. ReActPOC runs adapter: `alf convert --adapter reactpoc traces.jsonl > alf.jsonl`
2. Viewer consumes AEF: `alf view alf.jsonl --output report.html`
3. Viewer detects extension types and renders domain-specific views

**Domain extension approach**:
```typescript
// aef/src/viewer/extensions/warmhub.ts
export function renderBeliefQuery(entry: WarmhubBeliefQuery): string { ... }
export function renderReactStep(entry: WarmhubReactStep): string { ... }
```

**Pros**:
- Single package, simple distribution
- All visualization logic in one place
- Extensions bundled with viewer

**Cons**:
- Breaks AEF principle of "no viewer in v0.1"
- Domain extensions tightly coupled to AEF package
- Every new domain requires AEF package changes
- Growing bundle size as extensions accumulate

---

### Scenario B: Plugin Architecture
**Location**: `aef/src/viewer/` with plugin registry

```
aef/
├── src/
│   ├── viewer/
│   │   ├── core.ts         # Core rendering (session.*, message, tool.*)
│   │   ├── registry.ts     # Plugin registration
│   │   └── types.ts        # Plugin interface
│
warmhub-alf-viewer/          # Separate package
├── src/
│   └── plugin.ts           # warmhub.* extension renderers
```

**How it works**:
1. Core viewer handles standard AEF types
2. Plugins register for namespace prefixes: `registry.register('warmhub.*', warmhubPlugin)`
3. Unknown extensions show raw JSON or are skipped

**Domain extension approach**:
```typescript
// warmhub-alf-viewer/src/plugin.ts
export const warmhubPlugin: ViewerPlugin = {
  namespace: 'warmhub.*',
  components: {
    'warmhub.belief.query': BeliefQueryCard,
    'warmhub.belief.update': BeliefUpdateCard,
    'warmhub.react.step': ReactStepCard,
    'warmhub.react.episode': EpisodeSummary,
  },
  aggregators: {
    beliefTrajectory: (entries) => extractTrajectory(entries),
    waterfallData: (entries) => buildWaterfall(entries),
  },
};
```

**Pros**:
- AEF core stays lean
- Domain expertise stays in domain packages
- Independent versioning/release cycles
- Community can add extensions without AEF changes

**Cons**:
- More complex setup (need to install plugins)
- Plugin discovery/loading mechanism needed
- Harder to ensure visual consistency across plugins

---

### Scenario C: Viewer-as-Library (Composable Components)
**Location**: `@alf/viewer-core` + domain packages import and compose

```
@alf/viewer-core/           # npm package
├── components/             # Primitives: Card, Badge, Timeline, Sparkline
├── layouts/                # Episode, Summary, Waterfall
└── utils/                  # escapeHtml, formatDuration, etc.

@warmhub/alf-viewer/        # npm package
├── components/             # BeliefCard, HypothesisRow, LinkageMatrix
└── render.ts               # compose AEF components + domain components
```

**How it works**:
1. AEF provides **building blocks** (Card, Badge, Timeline primitives)
2. Domain packages **compose** these with domain-specific components
3. ReActPOC imports `@warmhub/alf-viewer` and calls its render function

**Domain extension approach**:
```typescript
// @warmhub/alf-viewer/src/render.ts
import { Card, Badge, Timeline, formatHtml } from '@alf/viewer-core';
import { BeliefCard, LinkageMatrix } from './components';

export function renderAEFTrace(entries: AnyAEFEntry[]): string {
  const coreHtml = formatHtml(entries, { components: AEF_CORE_COMPONENTS });
  const beliefHtml = renderBeliefOverlays(entries.filter(isBeliefEntry));
  return wrapDocument(coreHtml + beliefHtml);
}
```

**Pros**:
- Maximum flexibility for domain customization
- Shared primitives ensure visual consistency
- Tree-shakeable - only import what you use
- Natural fit for React/component-based architectures

**Cons**:
- Requires more integration work in each domain
- No standalone `alf view` command (need domain-specific wrapper)
- Shared CSS/theming challenges

---

### Scenario D: Federated Viewers (Multi-Repo Architecture)
**Location**: Multiple independent repos, unified via manifest

```
alf/                        # Core spec + CLI + adapters only (no viewer)

alf-viewer-web/             # Web-based viewer (separate repo)
├── core/                   # Handles session.*, message, tool.*
└── extensions/             # Extension stubs

warmhub-alf-viewer/         # WarmHub-specific viewer (separate repo)
├── extends: alf-viewer-web
└── overrides/              # warmhub.* renderers
```

**How it works**:
1. AEF repo stays pure: spec + CLI + adapters (v0.1 scope)
2. `alf-viewer-web` is a separate project for generic AEF viewing
3. Domain viewers extend `alf-viewer-web` with overrides
4. Extension registry lives in a manifest file

**Domain extension approach**:
```yaml
# warmhub-alf-viewer/alf-viewer.yaml
extends: "@alf/viewer-web"
extensions:
  warmhub.belief.query:
    component: ./src/components/BeliefQuery.tsx
  warmhub.react.episode:
    component: ./src/components/Episode.tsx
aggregations:
  - name: beliefTrajectory
    types: [warmhub.belief.query, warmhub.belief.update]
    handler: ./src/aggregators/trajectory.ts
```

**Pros**:
- AEF v0.1 scope preserved (no viewer in core)
- Complete separation of concerns
- Domain teams own their viewers entirely
- Viewer can evolve independently of spec

**Cons**:
- Fragmented ecosystem
- No unified experience across domains
- Integration requires multiple repos
- Harder to share improvements

---

## Comparative Analysis

| Dimension | A: Monolithic | B: Plugin | C: Library | D: Federated |
|-----------|---------------|-----------|------------|--------------|
| **AEF v0.1 Scope** | Violates | Optional | Separate | Separate |
| **Extension Isolation** | Coupled | Good | Good | Best |
| **Setup Complexity** | Simple | Medium | Medium | High |
| **Visual Consistency** | Best | Good | Manual | Hard |
| **Domain Flexibility** | Limited | Good | Best | Good |
| **Community Adoption** | Barrier | Extensible | Requires coding | Fragmented |
| **Streaming Support** | Batch-first | Possible | Possible | Possible |

---

## Recommended Strategy: Scenario B (Plugin Architecture)

### Rationale

1. **Respects AEF v0.1 Scope**: Viewer is optional/separate from core CLI
2. **Balances Simplicity & Flexibility**: Single install with extensibility
3. **Natural Evolution Path**:
   - Phase 1: Ship `alf view` with core types only
   - Phase 2: Add plugin registry
   - Phase 3: Community creates domain plugins
4. **Matches OTel Pattern**: Similar to how OTel has collector + extensions

### Proposed Structure

```
aef/
├── src/
│   ├── cli.ts               # validate, convert, info, view
│   ├── viewer/
│   │   ├── core.ts          # Core type renderers
│   │   ├── registry.ts      # Plugin loading
│   │   ├── components/      # Shared primitives
│   │   └── html.ts          # HTML document generation
│   └── plugins/
│       └── warmhub.ts       # Built-in warmhub plugin (dogfooding)

# Later: external package
@warmhub/alf-viewer-plugin/
└── index.ts                 # More sophisticated warmhub visualization
```

### Migration Path for ReActPOC

```bash
# Step 1: Convert traces to AEF
pnpm alf convert --adapter reactpoc logs/belief_*.jsonl -o alf_traces.jsonl

# Step 2: View with built-in warmhub plugin (simple)
pnpm alf view alf_traces.jsonl --output report.html

# Step 3: Use advanced domain plugin (later)
pnpm alf view alf_traces.jsonl --plugin @warmhub/alf-viewer-plugin --output report.html
```

### Extension Interface

```typescript
// aef/src/viewer/registry.ts
export interface ViewerPlugin {
  readonly namespace: string;  // e.g., 'warmhub.*'

  // Entry-level renderers
  renderEntry?(entry: AnyAEFEntry, ctx: RenderContext): string | null;

  // Aggregation views (span multiple entries)
  aggregations?: {
    name: string;
    types: string[];  // e.g., ['warmhub.belief.query', 'warmhub.belief.update']
    render: (entries: AnyAEFEntry[], ctx: RenderContext) => string;
  }[];

  // CSS to inject
  styles?: string;
}
```

### What Moves from ReActPOC

| Current Component | AEF Location | Notes |
|-------------------|--------------|-------|
| `formatWaterfallHtml` | `aef/src/viewer/components/waterfall.ts` | Generalized for any step/tool data |
| `generateSparklineSvg` | `aef/src/viewer/components/sparkline.ts` | Reusable primitive |
| `formatStatusBadge`, `formatMetricBadge` | `aef/src/viewer/components/badge.ts` | Theming via CSS vars |
| `formatBeliefSnapshotHtml`, `formatBeliefDeltasHtml` | `alf/plugins/warmhub.ts` | Domain-specific |
| `formatGateTimelineHtml` | `alf/plugins/warmhub.ts` | Domain-specific |
| `formatLinkageMatrixHtml` | `alf/plugins/warmhub.ts` | Domain-specific |
| `formatAnswerComparisonHtml` | `alf/plugins/warmhub.ts` | Domain-specific (HotpotQA) |
| CSS styles | Split: core theme + plugin additions | CSS custom properties |

---

## Implementation Phases

### Phase 1: Core Viewer (AEF types only)
- `session.start/end` → Episode header/footer
- `message` → Chat-style bubbles
- `tool.call/result` → Collapsible tool cards
- `error` → Error callouts
- Basic waterfall timeline from `tool.*` entries

### Phase 2: Plugin Infrastructure
- `ViewerPlugin` interface
- Plugin discovery (local files + npm packages)
- CSS injection mechanism
- Aggregation pipeline

### Phase 3: WarmHub Plugin (dogfooding)
- Migrate belief visualization from ReActPOC
- Belief trajectory sparklines
- Finish gate timeline
- Evidence linkage matrix

### Phase 4: Advanced Features
- Real-time streaming viewer
- Interactive filtering
- Export to PDF/PNG
- Diff between two traces

---

This approach lets AEF stay focused on the interchange format while building a sustainable extension ecosystem for domain-specific visualization.
