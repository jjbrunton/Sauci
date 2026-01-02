# Sauci

![Node 20+](https://img.shields.io/badge/node-20%2B-339933)
![npm 10+](https://img.shields.io/badge/npm-10%2B-CB3837)
![Turborepo](https://img.shields.io/badge/monorepo-turborepo-0F1115)

Sauci is a couples intimacy app where partners swipe question packs, match on shared interests, and chat about what they unlock together.

## What lives here

```
sauci/
├── apps/
│   ├── mobile/     # Expo React Native app
│   ├── admin/      # Admin dashboard (Vite + React)
│   ├── web/        # Marketing website (Next.js)
│   └── supabase/   # Supabase project (migrations, edge functions)
├── packages/
│   └── shared/     # Shared TypeScript types
```

## Core product flows

- **Couple pairing** via invite codes and profile linking
- **Question packs** with two-part phrasing and smart selection bias
- **Matches + chat** when both partners answer positively
- **Notifications** for new matches and messages
- **Subscriptions** via RevenueCat with couple-level premium sharing

## Prerequisites

- Node.js 20+
- npm 10+
- Supabase CLI (`npm install -g supabase`)
- Expo CLI (`npm install -g expo-cli`)

## Quickstart

```bash
npm install
npm run dev
```

## App commands

From each app directory:

- **Mobile** (`apps/mobile`): `npm run dev`, `npm run ios`, `npm run android`, `npm run web`
- **Admin** (`apps/admin`): `npm run dev`, `npm run build`, `npm run typecheck`
- **Web** (`apps/web`): `npm run dev`, `npm run build`, `npm run start`

## Environment setup

Copy the example files and fill in values:

- Mobile: `apps/mobile/.env.example`
- Admin: `apps/admin/.env.example`
- Web: `apps/web/.env.local.example`

## Supabase (local)

- Config lives in `apps/supabase/config.toml`.
- Use the Supabase CLI for local services and migrations.

## Scripts (root)

- `npm run dev` - run all apps in dev mode
- `npm run build` - build all apps
- `npm run lint` - lint all apps
- `npm run typecheck` - typecheck all apps
- `npm run clean` - clean build artifacts

## Docs

- Auth: `docs/authentication.md`
- Schema: `docs/schema.md`
- Pairing: `docs/couple-pairing.md`
- Questions: `docs/question-selection.md`
- Matches/notifications: `docs/match-notifications.md`
- Subscriptions: `docs/subscription-system.md`
- Mobile release guide: `apps/mobile/RELEASING.md`

## Tech stack

- **Mobile**: Expo (React Native)
- **Backend**: Supabase (Postgres, Auth, Edge Functions, Realtime)
- **Admin**: React + Vite
- **Web**: Next.js
- **Monorepo**: Turborepo

