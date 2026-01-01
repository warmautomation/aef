---
name: harness-orchestration
description: Multi-agent workflow orchestration knowledge base. Claude uses this skill automatically when the user invokes /harness or asks for complex multi-file changes that benefit from agent coordination, verification loops, or interruptibility.
---

# Harness Orchestration Skill

## Core Philosophy: Nothing Falls Through Cracks

**Beads is THE required tracking system for all harness work.** Every objective, task, and discovered issue MUST be tracked as a bead. This ensures:
- Work is persistent across sessions
- Dependencies are explicit and enforced
- Discovered issues are captured immediately
- No work is lost or forgotten

## Available Commands

| Command | Purpose |
|---------|---------|
| `/harness <objective>` | Start new workflow (creates bead) |
| `/harness-work <bead-id>` | Pick up existing bead |
| `/harness-prepare [bead-id]` | Analyze work and bind skills |
| `/harness-status` | Check workflow and beads status |
| `/harness-resume` | Resume from checkpoint |
| `/harness-abort` | Cancel and cleanup |
| `/harness-summary` | Generate completion report |
| `/harness-retro` | Retrospective analysis |
| `/harness-debug` | Diagnose issues |

## When This Skill Activates

This skill activates when:
- User invokes `/harness <objective>` or `/harness-work <bead-id>`
- User asks for changes requiring multiple agents
- User wants interruptible, resumable workflows
- Task requires verification (tests, lint) after changes

## Execution Modes

The harness supports two execution modes. Choose based on workflow complexity.

### Formal Mode (Scripted)

Use for **complex multi-agent workflows** requiring:
- State persistence across sessions
- Structured event logging for analysis
- Multi-phase execution with checkpoints
- Post-hoc workflow analysis

**Initialization:**
```bash
# Initialize state files (creates state.json + log.jsonl)
.claude/scripts/harness-state.sh init <plan-id> <parent-bead>
```

**State Files Created:**
- `.harness/plan.json` - Execution plan with bead mappings
- `.harness/state.json` - Current execution state
- `.harness/log.jsonl` - Append-only event log

**State Transitions:**
```bash
.claude/scripts/harness-state.sh transition "executing"
.claude/scripts/harness-state.sh task-status "task-001" "running" "aef-xxx"
.claude/scripts/harness-state.sh task-status "task-001" "completed" "aef-xxx"
```

### Lightweight Mode (Manual)

Use for **simpler workflows** where:
- Single-session completion is expected
- No multi-agent coordination needed
- State persistence isn't required
- Quick iteration is preferred

**Characteristics:**
- Uses `TodoWrite` for task tracking
- Uses `bd` commands directly for beads
- No formal state files (plan.json, state.json)
- Beads provide the persistence layer

**When to Use:**
- Documentation updates
- Single-file changes
- Bug fixes with clear scope
- Tasks not requiring verification loops

### Hybrid Mode (Recommended Default)

Always maintain a minimal log for traceability, even in lightweight mode:

```bash
# At workflow start
mkdir -p .harness
echo "{\"event\":\"workflow_start\",\"bead\":\"<bead-id>\",\"mode\":\"lightweight\",\"ts\":\"$(date -Iseconds)\"}" >> .harness/log.jsonl

# At workflow end
echo "{\"event\":\"workflow_complete\",\"bead\":\"<bead-id>\",\"ts\":\"$(date -Iseconds)\"}" >> .harness/log.jsonl
```

This provides basic audit trail without full state management overhead.

### Mode Selection Guide

| Complexity | Multi-Agent | Checkpoints Needed | Recommended Mode |
|------------|-------------|-------------------|------------------|
| Low | No | No | Lightweight |
| Medium | No | Maybe | Hybrid |
| High | Yes | Yes | Formal |
| Any | Yes | Yes | Formal |

## Full Workflow Cycle

```
┌─────────────────────────────────────────────────────────────┐
│                    HARNESS WORKFLOW CYCLE                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. PREPARE ──► 2. PLAN ──► 3. EXECUTE ──► 4. VERIFY       │
│       │              │            │             │           │
│       ▼              ▼            ▼             ▼           │
│  Bind skills    Create beads  Update beads  Create beads   │
│  to work        for tasks     as work       for failures   │
│                               progresses                    │
│                                                             │
│  5. FINALIZE ──► 6. RETRO                                  │
│       │              │                                      │
│       ▼              ▼                                      │
│  Close beads    Update skills                               │
│  Sync & commit  from learnings                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Phase 1: PREPARE (`/harness-prepare`)

Before starting work, analyze and bind skills:

1. **Identify work characteristics** - Technology, complexity, files
2. **Discover applicable skills** - Scan `.claude/skills/`
3. **Match skills to work** - Create binding matrix
4. **Identify skill gaps** - Create new skills if needed
5. **Load skills** - Read and internalize guidance

### Phase 2: PLAN (`/harness` or `/harness-work`)

Create execution plan with bead tracking:

1. **Get or create parent bead** - This is the objective tracker
2. **Analyze the objective** - What files are affected? What's the scope?
3. **Create child beads for tasks** with dependencies
4. **Assign agents strategically**
5. **Define verification commands**
6. **Present plan for approval**

### Phase 3: EXECUTE

Run tasks with continuous bead updates:

1. **Update task bead to in_progress**
2. **Spawn agent with skill-informed prompt**
3. **On completion: close task bead**
4. **On failure: keep bead open, may create failure bead**

### Phase 4: VERIFY

Run verification with issue tracking:

1. **Execute test/lint/typecheck commands**
2. **Create P0-P1 beads for each failure type**
3. **Link failure beads to causing tasks**
4. **Retry with failure context**

### Phase 5: FINALIZE (`/harness-summary`)

Complete work with proper cleanup:

1. **Generate summary with beads report**
2. **Close all child beads**
3. **Close parent bead**
4. **Sync beads and commit code**

### Phase 6: RETRO (`/harness-retro`)

Capture learnings after completion:

1. **Analyze patterns from discovered issues**
2. **Identify anti-patterns and successes**
3. **Update existing skills with learnings**
4. **Create new skills for gaps**
5. **Document retrospective**

## Beads Integration Requirements

### Starting Work

**Option A: Prepare first (recommended)**
```bash
/harness-prepare aef-xxx    # Analyze and bind skills
/harness-work aef-xxx       # Pick up with skills loaded
```

**Option B: Direct start**
```bash
/harness "Add streaming support to CLI"
# Creates bead, then proceeds
```

### During Execution

1. **Each phase task = child bead** with dependency on parent
2. **Discovered issues = new beads** linked to parent objective
3. **Verification failures = new beads** with P0-P1 priority
4. **State changes update beads** (`bd update <id> --status=in_progress`)

### Completing Work

1. Close all child beads first
2. Close parent bead with summary
3. Run `bd sync` before pushing
4. Run `/harness-retro` to capture learnings

## Planning Guidelines

When creating a plan:

1. **Get or create parent bead** - This is the objective tracker
2. **Analyze the objective** - What files are affected? What's the scope?
3. **Create child beads for phases/tasks** with dependencies:
   ```bash
   bd create --title="Phase 1: Setup types" --type=task --priority=2
   bd create --title="Phase 2: Implement adapters" --type=task --priority=2
   bd dep add <phase2-id> <phase1-id>  # Phase 2 depends on Phase 1
   ```
4. **Assign agents strategically**:
   - `claude-code`: Complex reasoning, architecture, multi-file coordination
   - `codex`: Focused implementation, test writing, refactoring
   - `gemini`: Documentation, analysis, review
5. **Define verification** - What commands prove success?
6. **Link beads to plan.json** - Each task references its bead ID

## Task Prompt Guidelines

Task prompts sent to external CLIs should:
- Reference the bead ID for context
- Include applicable skills guidance
- Be self-contained (include necessary context)
- Specify exact files to modify
- Include success criteria
- Mention constraints (don't break existing tests, etc.)

Example task prompt for Codex:
```
Working on bead: aef-xxx (Phase 1: Setup types)

Skills: typescript-patterns, validation

Implement the `calculateTotal` function in src/utils/pricing.ts.

Requirements:
- Accept an array of LineItem objects
- Apply discounts from the discount field
- Return a PricingResult with subtotal, discount, tax, and total
- Handle empty arrays (return zero values)

Constraints:
- Do not modify other files
- Preserve existing function signatures
- Add JSDoc comments

Success: The function compiles and handles the documented cases.
When complete, this task's bead (aef-xxx) should be closed.
```

## Discovered Issues Protocol

When agents discover issues during execution:

1. **Create a bead immediately**:
   ```bash
   bd create --title="[DISCOVERED] Type error in calculateTotal" \
     --type=bug --priority=1
   bd dep add <new-bead> <parent-bead>  # Links to objective
   ```

2. **Categorize by priority**:
   - P0-P1: Must fix before proceeding (blocks verification)
   - P2-P3: Defer with explicit rationale
   - P4: Backlog, document and continue

3. **Never ignore issues** - If you see a problem, bead it.

## Skill Binding

Skills inform agent work at multiple levels:

### Pre-Work Binding (`/harness-prepare`)
- Analyze beads for applicable skills
- Load skill context before planning
- Identify skill gaps early

### Task-Level Binding
- Include skill names in task prompts
- Reference key patterns/anti-patterns
- Apply skill checklists to verification

### Post-Work Learning (`/harness-retro`)
- Update skills with new patterns
- Create skills for discovered gaps
- Strengthen anti-pattern warnings

## State Files

- `.harness/plan.json` - The execution plan (includes bead mappings)
- `.harness/state.json` - Current execution state (includes parent bead ID)
- `.harness/log.jsonl` - Append-only event log (includes bead events)
- `.harness/artifacts/{task-id}/` - Per-task outputs
- `.harness/prepare-<bead-id>.md` - Preparation summaries
- `.harness/retros/<date>-retro.md` - Retrospective records

## Verification Failures

When verification fails:

1. Create a bead for each failure type:
   ```bash
   bd create --title="[VERIFY] Test failure: calculateTotal.test.ts" \
     --type=bug --priority=1
   ```

2. Link to the task that caused it:
   ```bash
   bd dep add <failure-bead> <task-bead>
   ```

3. Retry mechanism creates fix attempts, updating the failure bead

## Session Close Checklist

Before marking work complete:

```bash
# 1. Check bead status
bd show <parent-bead>  # Verify all children closed

# 2. Close parent bead
bd close <parent-bead>

# 3. Sync beads to git
bd sync

# 4. Commit code changes
git add . && git commit -m "..."

# 5. Push everything
git push

# 6. Run retrospective (if significant work)
/harness-retro
```

## Anti-Patterns (NEVER DO)

- Starting work without a tracking bead
- Skipping skill preparation for complex work
- Completing tasks without closing their beads
- Ignoring discovered issues (always create a bead)
- Marking parent complete before children
- Skipping `bd sync` at session end
- Creating tasks without bead mappings in plan.json
- Skipping retrospective after significant work
- Not updating skills with learnings
