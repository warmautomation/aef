---
description: Start a multi-agent harness workflow for complex tasks (requires beads tracking)
---

# Harness Workflow

You are the harness orchestrator. First, read the harness-orchestration skill at `.claude/skills/harness-orchestration/SKILL.md` for full context on the workflow, then proceed.

The user has requested: $ARGUMENTS

## CRITICAL: Beads is Required

**All harness work MUST be tracked in beads.** This is non-negotiable.

## Step 1: Establish Tracking Bead

First, ensure this work has a tracking bead:

1. Check if `$ARGUMENTS` is a bead ID (matches pattern like `aef-xxx`):
   - If yes, run `bd show <bead-id>` to load context
   - If blocked, warn but allow proceeding

2. If `$ARGUMENTS` is a description (not a bead ID):
   - Create a new bead: `bd create --title="$ARGUMENTS" --type=feature --priority=2`
   - Capture the returned bead ID

3. Update the bead status: `bd update <bead-id> --status=in_progress`

Store the parent bead ID - all child tasks will depend on it.

## Step 2: Determine Execution Mode

Analyze the work to select the appropriate mode:

### Complexity Signals → Formal Mode
- Multi-file changes across different modules
- Requires spawning external agents (codex, gemini)
- Needs checkpoints for long-running work
- Cross-cutting concerns (types, tests, docs)
- User explicitly requests formal tracking

### Simplicity Signals → Lightweight Mode
- Single file or closely related files
- Documentation-only changes
- Clear, bounded scope
- Single-session completion expected
- User requests quick iteration

### Mode Selection

**If Formal Mode:**
```bash
# Initialize harness state (creates plan.json, state.json, log.jsonl)
.claude/scripts/harness-state.sh init "plan-$(date +%s)" "<parent-bead>"
```

**If Lightweight Mode:**
```bash
# Minimal logging for traceability
mkdir -p .harness
echo "{\"event\":\"workflow_start\",\"bead\":\"<bead-id>\",\"mode\":\"lightweight\",\"ts\":\"$(date -Iseconds)\"}" >> .harness/log.jsonl
```

Tell the user which mode was selected and why.

## Step 3: Analyze and Plan

With the bead context established, analyze the objective:
1. What files are likely affected?
2. What's the scope (single feature, refactor, migration)?
3. Are there existing tests that must pass?
4. What verification is appropriate?

Read relevant files to understand the codebase context.

## Step 4: Create Plan with Bead Mappings

**Formal Mode:** Create `.harness/plan.json` following the schema in `.claude/skills/harness-orchestration/plan-schema.json`.

**Lightweight Mode:** Skip plan.json creation. Use TodoWrite for task tracking instead.

**For each task, create a child bead:**
```bash
bd create --title="Task: <task-description>" --type=task --priority=2
bd dep add <child-bead> <parent-bead>  # Child depends on parent
```

Assign tasks to agents (formal mode only):
- **claude-code**: Use for tasks requiring complex reasoning or multi-file coordination
- **codex**: Use for focused implementation tasks
- **gemini**: Use for documentation and analysis

Ensure task prompts are self-contained and include:
- The bead ID being worked on
- Necessary context
- Success criteria

## Step 5: Present Plan

Display the plan to the user in a readable format:
- Parent bead ID and objective summary
- Number of phases and tasks
- Child bead IDs with their assignments
- Agent assignments
- Verification commands

Ask: "Does this plan look correct? Reply 'proceed' to start execution, or provide feedback to revise."

## Step 6: On Approval

When user approves:

**Formal Mode:**
1. Update `.harness/state.json` with `status: "executing"` and `parent_bead: "<bead-id>"`
2. Begin Phase 1 execution
3. For each task:
   - Run: `.claude/scripts/harness-state.sh task-status "<task-id>" "running" "<bead-id>"`
   - Use the Task tool to spawn the appropriate subagent
   - On completion: `.claude/scripts/harness-state.sh task-status "<task-id>" "completed" "<bead-id>"`
   - On failure: Keep bead open, create failure bead if needed

**Lightweight Mode:**
1. Update TodoWrite to mark current task in_progress
2. Execute task directly (no agent spawning)
3. On completion: `bd close <task-bead>`, update TodoWrite
4. On failure: Keep bead open, create failure bead if needed

## Step 7: Handle Discovered Issues

When any agent discovers an issue during execution:
1. Create a bead immediately:
   ```bash
   bd create --title="[DISCOVERED] <issue>" --type=bug --priority=<1-3>
   bd dep add <new-bead> <parent-bead>
   ```
2. P0-P1: Must address before continuing
3. P2+: Document rationale for deferral, continue

## Step 8: Verification Failures

When verification fails:
1. Create a failure bead:
   ```bash
   bd create --title="[VERIFY] <failure-type>" --type=bug --priority=1
   ```
2. Link to causing task's bead
3. Retry with failure context
4. Only close failure bead when verification passes

## Checkpoint Behavior

If checkpoints are enabled in config, pause and await user input at:
- After planning (before execution)
- After verification failures
- Before final commit

## Session Close Protocol

Before marking complete:
```bash
# Verify all child beads closed
bd show <parent-bead>

# Close parent bead
bd close <parent-bead>

# Sync beads
bd sync

# Commit and push code
git add . && git commit -m "..." && git push
```
