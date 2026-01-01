---
name: typescript-patterns
description: TypeScript type design patterns for schema-driven projects with mixed typed/untyped data. Use when designing types for formats that combine strongly-typed entries with extensible/arbitrary fields.
---

# TypeScript Patterns for Schema-Driven Projects

## When This Skill Activates

- Designing types for log formats, event schemas, or similar
- Working with "core types + extensions" patterns
- Encountering type errors with `Record<string, unknown>` intersections
- Tests pass but typecheck fails

## Patterns

### Union Types for Variant Data

When you have strongly-typed core types AND need to support arbitrary extension data:

```typescript
// GOOD: Union preserves strong typing for core, allows flexible extensions
type CoreEntry = SessionStart | SessionEnd | Message;
type ExtensionEntry = BaseEntry & Record<string, unknown>;
type AnyEntry = CoreEntry | ExtensionEntry;

// BAD: Intersection breaks assignment from concrete types
type AnyEntry = BaseEntry & Record<string, unknown>;
// Error: 'SessionStart' not assignable - missing index signature
```

**Why it works**: Union allows either a strongly-typed core entry OR an extension with arbitrary fields. Intersection requires ALL types to satisfy the index signature.

### Index Signatures for Extension Interfaces

When creating specific extension entry interfaces:

```typescript
// GOOD: Include index signature for compatibility with Record<string, unknown>
interface MyExtensionEntry extends BaseEntry {
  type: 'vendor.category.type';
  customField: string;
  [key: string]: unknown;  // Required for union compatibility
}

// BAD: Missing index signature breaks union assignment
interface MyExtensionEntry extends BaseEntry {
  type: 'vendor.category.type';
  customField: string;
}
// Error when yielding: not assignable to ExtensionEntry
```

### Test Type Casts

When testing adapter output, cast to specific types:

```typescript
// GOOD: Specific type cast preserves type checking
const sessionEnd = entries[entries.length - 1] as SessionEnd;
expect(sessionEnd.summary?.messages).toBe(2);

// BAD: Generic cast loses type safety
const sessionEnd = entries[entries.length - 1] as AnyEntry;
expect(sessionEnd.summary.messages).toBe(2);  // 'summary' is unknown
```

### Optional Property Access

When accessing properties that might be undefined:

```typescript
// GOOD: Optional chaining for nested optional properties
expect(sessionEnd.summary?.tokens?.input).toBe(250);

// BAD: Direct access on optional properties
expect(sessionEnd.summary.tokens.input).toBe(250);  // Runtime error if undefined
```

## Anti-patterns

### Don't Extend Union Types

```typescript
// BAD: Cannot extend a union type
interface MyType extends CoreEntry | ExtensionEntry {  // Error!
  extra: string;
}

// GOOD: Extend the base type, add index signature
interface MyType extends BaseEntry {
  extra: string;
  [key: string]: unknown;
}
```

### Don't Ignore Typecheck Failures

If tests pass but `tsc --noEmit` fails:
1. The type errors are real - fix them
2. Runtime assertions (expect) don't provide compile-time safety
3. Type casts to `any` or generic types hide the problem

## Checklist

When designing a type system with core + extension pattern:

- [ ] Core types defined as a union of specific interfaces
- [ ] Extension type uses intersection with `Record<string, unknown>`
- [ ] "Any" type is union of core and extension (not intersection)
- [ ] Custom extension interfaces include index signature `[key: string]: unknown`
- [ ] Tests use specific type casts (`as SessionEnd`) not generic (`as AnyEntry`)
- [ ] Both `bun test` AND `bun run typecheck` pass

## References

- Learned from: aef-uo4 (AEF type errors)
- TypeScript handbook: Index Signatures
- Pattern validated in: AEF adapters (claude-code, reactpoc)
