# Shared Package - Agent Guidelines

**STRICT RULES - DO NOT VIOLATE**

## Architecture

This is a shared TypeScript package (`@sauci/shared`) containing:
- **Types**: Shared TypeScript type definitions
- **Package Name**: `@sauci/shared`

## Directory Structure

```
src/
  index.ts              # Main export file
  types/                # Type definitions
package.json            # Package configuration
tsconfig.json           # TypeScript config
```

## Critical Rules

### Purpose

This package exists ONLY for sharing types across apps. It should contain:
- TypeScript interfaces
- Type definitions
- Enums
- Constants (if truly shared)

**NO runtime code** - types only.

### Exports

All exports must go through `src/index.ts`:
```typescript
export * from './types';
```

### Usage in Apps

Import in consuming apps:
```typescript
import type { Profile, Couple, Match } from '@sauci/shared';
```

### Type Definitions

Types should match database schema. Core entities:
- `Profile` - User profile extending Supabase auth
- `Couple` - Two users linked via invite code
- `QuestionPack` - Collection of questions
- `Question` - Individual question with intensity
- `Response` - User's answer (yes/no/maybe)
- `Match` - Created when both partners answer positively

### Adding Types

When adding new types:
1. Add to appropriate file in `src/types/`
2. Export from `src/types/index.ts`
3. Re-export from `src/index.ts`
4. Run `npm run build` from root to verify

### Versioning

Types are internal - no npm publishing. Changes propagate automatically via Turborepo workspace linking.

## Forbidden Actions

1. **DO NOT** add runtime code (functions, classes with logic)
2. **DO NOT** add dependencies (except dev dependencies)
3. **DO NOT** create circular dependencies between types
4. **DO NOT** duplicate types that exist in Supabase generated types
5. **DO NOT** break backwards compatibility without updating all consumers
6. **DO NOT** add app-specific types (keep them generic/shared)
