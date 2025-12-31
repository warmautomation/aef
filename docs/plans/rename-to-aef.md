# Rename Strategy: ALF → AEF

**From:** ALF (Agent Log Format)
**To:** AEF (Agent Event Format)

## Overview

This document outlines the complete strategy for renaming the project from "ALF" to "AEF". The rename changes:
- Acronym: `ALF` → `AEF`
- Full name: `Agent Log Format` → `Agent Event Format`
- Lowercase: `alf` → `aef`

## Phase 1: Critical Breaking Changes

These changes affect the public API and must be coordinated:

### 1.1 Package Identity
| Location | Current | New |
|----------|---------|-----|
| `package.json` name | `@warmautomation/alf` | `@warmautomation/aef` |
| `package.json` description | `Agent Log Format - ...` | `Agent Event Format - ...` |
| `package.json` bin | `"alf": "dist/cli.js"` | `"aef": "dist/cli.js"` |
| `package.json` scripts | `"alf": "bun src/cli.ts"` | `"aef": "bun src/cli.ts"` |

### 1.2 CLI Identity
| Location | Current | New |
|----------|---------|-----|
| `src/cli.ts:24` | `.name('alf')` | `.name('aef')` |
| `src/cli.ts:25` | `'Agent Log Format utilities'` | `'Agent Event Format utilities'` |

### 1.3 Schema Identity
| Location | Current | New |
|----------|---------|-----|
| `src/schema/core.schema.json` $id | `.../alf/v1/...` | `.../aef/v1/...` |
| `src/schema/core.schema.json` description | `Agent Log Format...` | `Agent Event Format...` |

### 1.4 Extension Namespace
| Location | Current | New |
|----------|---------|-----|
| Reserved namespace | `alf.*` | `aef.*` |
| Test references | `alf.future.feature` | `aef.future.feature` |

## Phase 2: File Renames

### 2.1 Documentation Files
```
docs/AEF-spec-v0.1.md     → docs/AEF-spec-v0.1.md
docs/aef-viz.md           → docs/aef-viz.md
```

### 2.2 Test Fixture Files (11 files)
```
src/__tests__/fixtures/valid/*.alf.jsonl    → *.aef.jsonl
src/__tests__/fixtures/invalid/*.alf.jsonl  → *.aef.jsonl
```

**Files to rename:**
- `tool-flow.alf.jsonl` → `tool-flow.aef.jsonl`
- `with-extensions.alf.jsonl` → `with-extensions.aef.jsonl`
- `multi-tool-session.alf.jsonl` → `multi-tool-session.aef.jsonl`
- `parallel-tools.alf.jsonl` → `parallel-tools.aef.jsonl`
- `minimal-session.alf.jsonl` → `minimal-session.aef.jsonl`
- `pid-future-ref.alf.jsonl` → `pid-future-ref.aef.jsonl`
- `decreasing-seq.alf.jsonl` → `decreasing-seq.aef.jsonl`
- `mismatched-call-ids.alf.jsonl` → `mismatched-call-ids.aef.jsonl`
- `session-end-not-last.alf.jsonl` → `session-end-not-last.aef.jsonl`
- `interleaved-sessions.alf.jsonl` → `interleaved-sessions.aef.jsonl`
- `session-start-not-first.alf.jsonl` → `session-start-not-first.aef.jsonl`

### 2.3 Directory Rename (Final Step)
```
/Users/jschilli/dev/warm-dev/alf → /Users/jschilli/dev/warm-dev/aef
```

## Phase 3: Code Updates

### 3.1 Variable Names
| File | Current | New |
|------|---------|-----|
| `src/adapters/claude-code.ts:156` | `let alfContent` | `let aefContent` |
| `src/adapters/claude-code.ts:158` | `alfContent = content` | `aefContent = content` |
| `src/adapters/claude-code.ts:160` | `alfContent = content.map(...)` | `aefContent = content.map(...)` |

### 3.2 CSS Variables & Classes (Bulk Replace)

All CSS uses `alf-` prefix. Requires global replace:

**CSS Variables (in `src/viewer/styles.ts`):**
```
--alf-bg-*      → --aef-bg-*
--alf-fg-*      → --aef-fg-*
--alf-border-*  → --aef-border-*
--alf-accent-*  → --aef-accent-*
etc.
```

**CSS Classes (throughout viewer/):**
```
.alf-container    → .aef-container
.alf-entry        → .aef-entry
.alf-badge        → .aef-badge
.alf-message      → .aef-message
.alf-tool-call    → .aef-tool-call
.alf-tool-result  → .aef-tool-result
.alf-code         → .aef-code
.alf-collapsible  → .aef-collapsible
.alf-waterfall    → .aef-waterfall
.alf-sparkline    → .aef-sparkline
.alf-extension    → .aef-extension
etc. (100+ classes)
```

**Affected files:**
- `src/viewer/styles.ts`
- `src/viewer/html.ts`
- `src/viewer/renderers/*.ts`
- `src/viewer/components/*.ts`
- `src/viewer/plugins/*.ts`
- `examples/warmhub-viewer/plugin.ts`
- Test files that assert on class names

## Phase 4: Documentation Updates

### 4.1 Project Documentation
| File | Updates Needed |
|------|----------------|
| `CLAUDE.md` | Title, description, command examples |
| `README.md` | Title, description, imports, commands |
| `docs/plan.md` | Title, all command examples, file references |
| `docs/extensions.md` | Extension namespace references |
| `docs/aef-viz.md` (renamed) | Directory references, commands |
| `docs/AEF-spec-v0.1.md` (renamed) | Extension examples, filename conventions |

### 4.2 Code Comments
| File | Line | Update |
|------|------|--------|
| `src/index.ts:2` | JSDoc | `AEF - Agent Event Format` |

### 4.3 Test File References
All test files referencing `.alf.jsonl` fixtures need path updates.

## Phase 5: Cleanup

### 5.1 Generated Files (Delete or Regenerate)
These contain `alf-` class names and should be regenerated after rename:
- `output.html`
- `output-rp.html`
- `trace.html`

### 5.2 Lock Files
- `bun.lock` - Will regenerate on install

## Execution Order

```
1. Create git branch: `git checkout -b rename-to-aef`

2. Phase 1 - Critical changes (package.json, cli.ts, schema)
   └─ Run tests to verify nothing broke

3. Phase 3.2 - CSS bulk replace (alf- → aef-)
   └─ Single sed/replace operation
   └─ Run tests

4. Phase 3.1 - Variable renames
   └─ Run tests

5. Phase 2.2 - Rename fixture files
   └─ Update test file references
   └─ Run tests

6. Phase 4 - Documentation updates
   └─ No tests needed

7. Phase 2.1 - Rename doc files
   └─ Update any cross-references

8. Phase 5.1 - Delete generated HTML files

9. Final verification
   └─ bun test
   └─ bun run build
   └─ Test CLI: bun aef --help

10. Phase 2.3 - Directory rename (done outside repo)
    └─ mv alf aef
    └─ Update any parent project references
```

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Broken imports | Run full test suite after each phase |
| Missed references | Use grep/search for `alf`, `ALF`, `Alf` after completion |
| External dependencies | Package name change requires npm publish |
| Bookmark/URL breaks | Old URLs to `alf/` won't redirect |

## Verification Checklist

After completion, verify:
- [ ] `bun test` passes
- [ ] `bun run build` succeeds
- [ ] `bun aef --help` works
- [ ] `bun aef validate` works with test files
- [ ] `bun aef view` generates HTML with `aef-` classes
- [ ] No remaining `alf` references: `grep -ri "alf" --include="*.ts" --include="*.json" --include="*.md"`
- [ ] Package can be published as `@warmautomation/aef`

## Estimated Scope

| Category | Count |
|----------|-------|
| Files to rename | 13 |
| CSS class/variable replacements | ~150 |
| Documentation updates | ~50 references |
| Code variable renames | 3 |
| Test path updates | ~20 |

**Total unique changes:** ~250 replacements across ~40 files
