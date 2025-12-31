# Admin Dashboard - Agent Guidelines

**STRICT RULES - DO NOT VIOLATE**

## Architecture

This is a React Admin dashboard using:
- **Build**: Vite
- **Routing**: react-router-dom with component-based routing in `App.tsx`
- **Styling**: Tailwind CSS
- **State**: React Context (`AuthContext`)
- **Backend**: Supabase client in `src/lib/supabase.ts`

## Directory Structure

```
src/
  components/           # Reusable components
    layout/             # AppLayout, Sidebar, etc.
    ProtectedRoute.tsx  # Route guard
  contexts/             # React contexts (AuthContext)
  hooks/                # Custom hooks
  lib/                  # Utilities (supabase)
  pages/                # Page components
    content/            # Categories, Packs, Questions
    users/              # User management (super_admin only)
    admins/             # Admin management (super_admin only)
```

## Critical Rules

### Authentication & Authorization

Two admin roles exist:
- `admin` - Content management only (categories, packs, questions)
- `super_admin` - Full access including user data, admins, audit logs

Use `<ProtectedRoute requireSuperAdmin>` for super_admin-only routes.

### Route Structure

```typescript
// Public
/login

// Protected (all admins)
/                       # Dashboard
/categories             # Category management
/categories/:id/packs   # Packs in category
/packs/:id/questions    # Questions in pack

// Protected (super_admin only)
/users                  # User list
/users/:id              # User detail
/users/:id/matches/:id  # Match chat view
/admins                 # Admin management
/audit-logs             # Audit log viewer
```

### Supabase Queries

- **Always use `.maybeSingle()` instead of `.single()`** when the row might not exist
- All admin operations are audited - check `audit_logs` table structure

### UI Patterns

- Use Tailwind CSS for styling
- Follow existing component patterns in `src/components/`
- Use `AppLayout` wrapper for all protected pages

### Security

- Never expose user passwords or sensitive data in admin views
- Audit log all administrative actions
- Verify admin role before performing operations

## Forbidden Actions

1. **DO NOT** expose user passwords or auth tokens
2. **DO NOT** allow content admins to access user data
3. **DO NOT** bypass role checks in protected routes
4. **DO NOT** perform destructive operations without confirmation
5. **DO NOT** use `.single()` for queries that might return 0 rows
6. **DO NOT** skip audit logging for administrative actions
