# Sauci

A couples intimacy app featuring swipeable question packs with partner matching.

## Project Structure

```
sauci/
├── apps/
│   ├── mobile/     # Expo React Native app
│   ├── admin/      # React Admin dashboard
│   └── supabase/   # Supabase project (migrations, edge functions)
├── packages/
│   └── shared/     # Shared TypeScript types
```

## Prerequisites

- Node.js 20+
- npm 10+
- Supabase CLI (`npm install -g supabase`)
- Expo CLI (`npm install -g expo-cli`)

## Getting Started

```bash
# Install dependencies
npm install

# Start development
npm run dev
```

## Tech Stack

- **Mobile**: Expo (React Native)
- **Backend**: Supabase Cloud (PostgreSQL, Auth, Edge Functions, Realtime)
- **Admin**: React Admin
- **Monorepo**: Turborepo
