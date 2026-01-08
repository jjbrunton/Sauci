# Dares Feature - Architecture & Implementation Plan

> **Status**: Planning Complete - Ready for Implementation  
> **Created**: 2026-01-08  
> **Target**: Schema + Admin Portal (Phase 1), Mobile App (Phase 2 - Later)

## Overview

The Dares feature allows users to send challenges/dares to their partner from curated packs. Partners can accept or decline dares, and the sender marks them as complete. A scoreboard tracks total completed dares per user/couple.

### Key Decisions

| Aspect | Decision |
|--------|----------|
| Dare Selection | User browses list, picks dare to send |
| Decline | Recipient can decline (no negative impact) |
| Cancel | Sender can cancel before completion |
| Timeframes | Pick from preset list + "no time limit" option |
| Scoreboard | Simple count of completed dares |
| Custom Dares | Premium users can create their own |
| Gender Filtering | Not needed (user chooses which dare to send) |
| Premium Model | Same as question packs (free/premium packs) |
| Chat | Auto-create chat thread when dare is sent |
| Completion | Sender marks dare as complete |

---

## Database Schema

### New Enum Types

```sql
CREATE TYPE dare_status AS ENUM (
  'pending',    -- Sent, waiting for recipient to accept/decline
  'active',     -- Recipient accepted, timer started (if applicable)
  'completed',  -- Sender marked as complete
  'expired',    -- Time ran out (only if had deadline)
  'declined',   -- Recipient declined
  'cancelled'   -- Sender cancelled before completion
);
```

### Table: `dare_packs`

Mirrors `question_packs` structure for consistency.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | NO | `gen_random_uuid()` | Primary key |
| `name` | TEXT | NO | | Pack name |
| `description` | TEXT | YES | | Pack description |
| `icon` | TEXT | YES | | Emoji icon |
| `is_premium` | BOOLEAN | NO | `false` | Requires premium access |
| `is_public` | BOOLEAN | NO | `true` | Visible to users |
| `is_explicit` | BOOLEAN | NO | `false` | Contains explicit content |
| `sort_order` | INTEGER | NO | `0` | Display ordering |
| `category_id` | UUID | YES | | FK to `categories` (optional) |
| `min_intensity` | INTEGER | YES | | Auto-calculated from dares |
| `max_intensity` | INTEGER | YES | | Auto-calculated from dares |
| `avg_intensity` | NUMERIC(3,2) | YES | | Auto-calculated from dares |
| `created_at` | TIMESTAMPTZ | NO | `now()` | Creation timestamp |

**Indexes:**
- Primary key on `id`
- Index on `sort_order` for ordering
- Index on `is_public, is_premium` for filtering

### Table: `dares`

Individual dare content within packs.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | NO | `gen_random_uuid()` | Primary key |
| `pack_id` | UUID | NO | | FK to `dare_packs` (CASCADE delete) |
| `text` | TEXT | NO | | Dare description/instruction |
| `intensity` | INTEGER | NO | `1` | 1-5 scale (CHECK constraint) |
| `suggested_duration_hours` | INTEGER | YES | | Suggested timeframe in hours |
| `created_at` | TIMESTAMPTZ | NO | `now()` | Creation timestamp |

**Constraints:**
- `CHECK (intensity >= 1 AND intensity <= 5)`
- Foreign key to `dare_packs` with `ON DELETE CASCADE`

**Indexes:**
- Primary key on `id`
- Index on `pack_id` for lookups

### Table: `sent_dares`

Tracks dare instances sent between partners.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | NO | `gen_random_uuid()` | Primary key |
| `couple_id` | UUID | NO | | FK to `couples` (CASCADE delete) |
| `dare_id` | UUID | YES | | FK to `dares` (null for custom dares) |
| `custom_dare_text` | TEXT | YES | | Text for custom dares |
| `custom_dare_intensity` | INTEGER | YES | | Intensity for custom dares (1-5) |
| `sender_id` | UUID | NO | | FK to `profiles` |
| `recipient_id` | UUID | NO | | FK to `profiles` |
| `status` | `dare_status` | NO | `'pending'` | Current status |
| `sent_at` | TIMESTAMPTZ | NO | `now()` | When dare was sent |
| `accepted_at` | TIMESTAMPTZ | YES | | When recipient accepted |
| `expires_at` | TIMESTAMPTZ | YES | | Deadline (null = no limit) |
| `completed_at` | TIMESTAMPTZ | YES | | When marked complete |
| `sender_notes` | TEXT | YES | | Optional message from sender |
| `created_at` | TIMESTAMPTZ | NO | `now()` | Creation timestamp |

**Constraints:**
- `CHECK (custom_dare_intensity IS NULL OR (custom_dare_intensity >= 1 AND custom_dare_intensity <= 5))`
- `CHECK ((dare_id IS NOT NULL) OR (custom_dare_text IS NOT NULL))` -- Must have either a dare_id or custom text
- Foreign keys with appropriate cascade behavior

**Indexes:**
- Primary key on `id`
- Index on `couple_id` for couple lookups
- Index on `sender_id` for sender stats
- Index on `recipient_id` for recipient stats
- Index on `status` for filtering active dares
- Index on `expires_at` for expiry job

### Table: `dare_messages`

Chat messages for each dare instance.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | NO | `gen_random_uuid()` | Primary key |
| `sent_dare_id` | UUID | NO | | FK to `sent_dares` (CASCADE delete) |
| `sender_id` | UUID | NO | | FK to `profiles` |
| `content` | TEXT | NO | | Message content |
| `read_at` | TIMESTAMPTZ | YES | | When recipient read message |
| `created_at` | TIMESTAMPTZ | NO | `now()` | Creation timestamp |

**Indexes:**
- Primary key on `id`
- Index on `sent_dare_id` for message lookups
- Index on `created_at` for ordering

---

## Database Functions & Triggers

### 1. Intensity Stats Trigger

Auto-calculate `min_intensity`, `max_intensity`, `avg_intensity` on `dare_packs` when dares are inserted/updated/deleted.

```sql
CREATE OR REPLACE FUNCTION update_dare_pack_intensity_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE dare_packs
  SET 
    min_intensity = (SELECT MIN(intensity) FROM dares WHERE pack_id = COALESCE(NEW.pack_id, OLD.pack_id)),
    max_intensity = (SELECT MAX(intensity) FROM dares WHERE pack_id = COALESCE(NEW.pack_id, OLD.pack_id)),
    avg_intensity = (SELECT ROUND(AVG(intensity)::numeric, 2) FROM dares WHERE pack_id = COALESCE(NEW.pack_id, OLD.pack_id))
  WHERE id = COALESCE(NEW.pack_id, OLD.pack_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dare_intensity_stats_trigger
AFTER INSERT OR UPDATE OR DELETE ON dares
FOR EACH ROW EXECUTE FUNCTION update_dare_pack_intensity_stats();
```

### 2. User Dare Stats Function

```sql
CREATE OR REPLACE FUNCTION get_user_dare_stats(p_user_id UUID)
RETURNS TABLE (
  dares_sent_count BIGINT,
  dares_received_count BIGINT,
  dares_completed_as_sender BIGINT,
  dares_completed_as_recipient BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM sent_dares WHERE sender_id = p_user_id),
    (SELECT COUNT(*) FROM sent_dares WHERE recipient_id = p_user_id),
    (SELECT COUNT(*) FROM sent_dares WHERE sender_id = p_user_id AND status = 'completed'),
    (SELECT COUNT(*) FROM sent_dares WHERE recipient_id = p_user_id AND status = 'completed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3. Couple Dare Stats Function

```sql
CREATE OR REPLACE FUNCTION get_couple_dare_stats(p_couple_id UUID)
RETURNS TABLE (
  total_dares_sent BIGINT,
  total_dares_completed BIGINT,
  total_dares_active BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM sent_dares WHERE couple_id = p_couple_id),
    (SELECT COUNT(*) FROM sent_dares WHERE couple_id = p_couple_id AND status = 'completed'),
    (SELECT COUNT(*) FROM sent_dares WHERE couple_id = p_couple_id AND status = 'active');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## RLS Policies

### `dare_packs`

```sql
-- Anyone can view public packs
CREATE POLICY "Public dare packs are viewable by everyone"
ON dare_packs FOR SELECT
USING (is_public = true);

-- Admins can do everything
CREATE POLICY "Admins can manage dare packs"
ON dare_packs FOR ALL
USING (is_admin());
```

### `dares`

```sql
-- View dares if pack is accessible (public, or premium pack + premium user)
CREATE POLICY "Users can view dares in accessible packs"
ON dares FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM dare_packs dp
    WHERE dp.id = dares.pack_id
    AND dp.is_public = true
    AND (
      dp.is_premium = false
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_premium = true)
    )
  )
);

-- Admins can do everything
CREATE POLICY "Admins can manage dares"
ON dares FOR ALL
USING (is_admin());
```

### `sent_dares`

```sql
-- Users can view sent dares in their couple
CREATE POLICY "Users can view their couple's sent dares"
ON sent_dares FOR SELECT
USING (couple_id = get_auth_user_couple_id());

-- Users can update sent dares in their couple (for status changes)
CREATE POLICY "Users can update their couple's sent dares"
ON sent_dares FOR UPDATE
USING (couple_id = get_auth_user_couple_id());

-- Insert via edge function only (service role)
```

### `dare_messages`

```sql
-- Users can view messages for their couple's dares
CREATE POLICY "Users can view messages for their dares"
ON dare_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM sent_dares sd
    WHERE sd.id = dare_messages.sent_dare_id
    AND sd.couple_id = get_auth_user_couple_id()
  )
);

-- Users can insert messages for their couple's dares
CREATE POLICY "Users can send messages for their dares"
ON dare_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM sent_dares sd
    WHERE sd.id = dare_messages.sent_dare_id
    AND sd.couple_id = get_auth_user_couple_id()
  )
);

-- Users can update their own messages (for read_at)
CREATE POLICY "Users can update read status"
ON dare_messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM sent_dares sd
    WHERE sd.id = dare_messages.sent_dare_id
    AND sd.couple_id = get_auth_user_couple_id()
  )
);
```

---

## Preset Duration Options

App constants (not in database, but used in app/admin):

| Label | Value (hours) | Display |
|-------|---------------|---------|
| 1 hour | `1` | "1 hour" |
| 6 hours | `6` | "6 hours" |
| 12 hours | `12` | "12 hours" |
| 24 hours | `24` | "24 hours" |
| 3 days | `72` | "3 days" |
| 1 week | `168` | "1 week" |
| No time limit | `null` | "No time limit" |

---

## Edge Functions (Future - App Phase)

### `send-dare`

Send a dare to partner.

**Input:**
```typescript
interface SendDareInput {
  dare_id?: string;           // null for custom dare
  custom_dare_text?: string;  // required if dare_id is null
  custom_dare_intensity?: number; // 1-5, required if custom
  duration_hours?: number;    // null = no limit
  sender_notes?: string;      // optional message
}
```

**Logic:**
1. Validate user is in a couple
2. Get partner ID from couple
3. If custom dare, validate user is premium
4. Create `sent_dares` record with status `'pending'`
5. Calculate `expires_at` if duration provided
6. Trigger push notification to recipient

### `respond-dare`

Accept or decline a dare.

**Input:**
```typescript
interface RespondDareInput {
  sent_dare_id: string;
  action: 'accept' | 'decline';
}
```

**Logic:**
1. Validate user is recipient of the dare
2. Validate status is `'pending'`
3. If accept: set status to `'active'`, set `accepted_at`
4. If decline: set status to `'declined'`
5. Trigger push notification to sender

### `complete-dare`

Sender marks dare as complete.

**Input:**
```typescript
interface CompleteDareInput {
  sent_dare_id: string;
}
```

**Logic:**
1. Validate user is sender of the dare
2. Validate status is `'active'`
3. Set status to `'completed'`, set `completed_at`
4. Trigger push notification to recipient

### `cancel-dare`

Sender cancels a dare.

**Input:**
```typescript
interface CancelDareInput {
  sent_dare_id: string;
}
```

**Logic:**
1. Validate user is sender
2. Validate status is `'pending'` or `'active'`
3. Set status to `'cancelled'`
4. Trigger push notification to recipient

### Background Job: Expire Dares

Cron job (pg_cron or external) to expire overdue dares:

```sql
UPDATE sent_dares 
SET status = 'expired' 
WHERE status = 'active' 
  AND expires_at IS NOT NULL 
  AND expires_at < NOW();
```

---

## Notifications (Future - App Phase)

| Event | Recipient | Title | Body |
|-------|-----------|-------|------|
| Dare sent | Partner | "New Dare!" | "{name} sent you a dare" |
| Dare accepted | Sender | "Dare Accepted" | "{name} accepted your dare" |
| Dare declined | Sender | "Dare Declined" | "{name} declined your dare" |
| Dare completed | Recipient | "Dare Complete!" | "Your dare was marked complete" |
| Dare cancelled | Recipient | "Dare Cancelled" | "{name} cancelled the dare" |
| Dare expiring (1hr) | Recipient | "Dare Expiring Soon" | "Your dare expires in 1 hour" |
| Dare expired | Both | "Dare Expired" | "The dare has expired" |

---

## Admin Portal Implementation

### New Files Structure

```
apps/admin/src/
├── pages/
│   ├── DarePacksPage.tsx       # List all dare packs
│   ├── DarePackDetailPage.tsx  # Create/edit dare pack
│   ├── DaresPage.tsx           # List dares in a pack
│   └── DareDetailPage.tsx      # Create/edit individual dare
├── components/
│   └── IntensityIndicator.tsx  # Shared intensity display (1-5)
└── App.tsx                     # Add new routes
```

### Routes to Add

```typescript
// In App.tsx
<Route path="/dare-packs" element={<DarePacksPage />} />
<Route path="/dare-packs/new" element={<DarePackDetailPage />} />
<Route path="/dare-packs/:packId" element={<DarePackDetailPage />} />
<Route path="/dare-packs/:packId/dares" element={<DaresPage />} />
<Route path="/dare-packs/:packId/dares/new" element={<DareDetailPage />} />
<Route path="/dare-packs/:packId/dares/:dareId" element={<DareDetailPage />} />
```

### Sidebar Navigation Update

Add under "Content" section:
```
📦 Content
  ├── Question Packs
  └── Dare Packs (new)
```

### Page Specifications

#### DarePacksPage

- **Table columns**: Icon, Name, Description (truncated), Dares Count, Intensity Range, Premium, Public, Actions
- **Actions**: Edit, Delete, View Dares
- **Create button**: Top right
- **Empty state**: "No dare packs yet. Create your first pack!"

#### DarePackDetailPage

- **Form fields**:
  - Name (text input, required)
  - Description (textarea)
  - Icon (emoji picker or text input)
  - Category (dropdown, optional)
  - Is Premium (toggle)
  - Is Public (toggle)
  - Is Explicit (toggle)
  - Sort Order (number input)
- **Read-only display**: Intensity stats (min/max/avg)
- **Actions**: Save, Cancel, Delete (if editing)

#### DaresPage

- **Table columns**: Text (truncated), Intensity (visual indicator), Suggested Duration, Actions
- **Actions**: Edit, Delete
- **Create button**: Top right
- **Back link**: To dare pack detail

#### DareDetailPage

- **Form fields**:
  - Text (textarea, required)
  - Intensity (slider 1-5 with labels)
  - Suggested Duration (dropdown with preset options + "None")
- **Actions**: Save, Cancel, Delete (if editing)

---

## Implementation Tasks

### Phase 1: Database Schema (Supabase)

- [ ] **1.1** Create migration: `dare_status` enum type
- [ ] **1.2** Create migration: `dare_packs` table
- [ ] **1.3** Create migration: `dares` table with intensity trigger
- [ ] **1.4** Create migration: `sent_dares` table
- [ ] **1.5** Create migration: `dare_messages` table
- [ ] **1.6** Create migration: RLS policies for all tables
- [ ] **1.7** Create migration: Stats functions (`get_user_dare_stats`, `get_couple_dare_stats`)
- [ ] **1.8** Create migration: Add tables to realtime publication
- [ ] **1.9** Test migrations in non-prod environment
- [ ] **1.10** Apply migrations to production

### Phase 2: Admin Portal

- [ ] **2.1** Create `IntensityIndicator` component (if not exists)
- [ ] **2.2** Create `DarePacksPage` - list view
- [ ] **2.3** Create `DarePackDetailPage` - create/edit form
- [ ] **2.4** Create `DaresPage` - list dares in pack
- [ ] **2.5** Create `DareDetailPage` - create/edit dare form
- [ ] **2.6** Add routes to `App.tsx`
- [ ] **2.7** Update sidebar navigation
- [ ] **2.8** Test full CRUD flow in admin portal

### Phase 3: Edge Functions (Future - App Phase)

- [ ] **3.1** Create `send-dare` edge function
- [ ] **3.2** Create `respond-dare` edge function
- [ ] **3.3** Create `complete-dare` edge function
- [ ] **3.4** Create `cancel-dare` edge function
- [ ] **3.5** Set up dare expiry cron job
- [ ] **3.6** Integrate with notification system

### Phase 4: Mobile App (Future)

- [ ] **4.1** Create dare packs browsing UI
- [ ] **4.2** Create dare selection/sending flow
- [ ] **4.3** Create incoming dare notification + response UI
- [ ] **4.4** Create active dare tracking UI
- [ ] **4.5** Create dare chat integration
- [ ] **4.6** Create scoreboard/stats display
- [ ] **4.7** Create custom dare creation (premium)
- [ ] **4.8** Add to Zustand stores

---

## Competitor Analysis Notes

Features observed in competitor apps (Desire, Kindu, Spicer, Lovewick):

| Feature | In Our Plan | Notes |
|---------|-------------|-------|
| Dare Packs/Categories | ✅ | Themed collections |
| Intensity Levels | ✅ | 1-5 scale, reuses user preference |
| Time Limits | ✅ | Preset options + no limit |
| Points/Scoring | ✅ Simple | Just count, not weighted points |
| Custom Dares | ✅ Premium | Users create their own |
| Decline Option | ✅ | No negative impact |
| Dare History | ✅ | Via `sent_dares` table |
| Chat per Dare | ✅ | `dare_messages` table |
| Proof/Verification | ❌ | Not in v1 (could add photo proof later) |
| Daily/Random Dares | ❌ | Not in v1 (could add "random dare" button) |
| Dare Rewards | ❌ | Not in v1 (could unlock content) |
| Streak Tracking | ❌ | Not in v1 (could add later) |

### Potential Future Enhancements

1. **Photo/Video Proof**: Allow recipient to submit proof of completion
2. **Random Dare Button**: "Surprise me" feature that picks a random dare
3. **Daily Dare Suggestions**: Push notification with suggested dare
4. **Streak Tracking**: Consecutive days/weeks with completed dares
5. **Achievements/Badges**: Unlock badges for milestones (10 dares, 50 dares, etc.)
6. **Couple Leaderboard**: Compare with other couples (opt-in)

---

## Open Questions (Resolved)

| Question | Answer |
|----------|--------|
| Should dare packs use same `categories` table? | Yes, reuse existing categories |
| Can same dare be sent multiple times? | Yes, each is a new instance |
| Bulk import for dares in admin? | Not in v1, can add later |
| Migration target | Non-prod first, then prod |

---

## References

- Existing schema patterns: `apps/supabase/migrations/20251230000000_v1_initial_schema.sql`
- Question packs structure: `question_packs`, `questions` tables
- Match/messaging pattern: `matches`, `messages` tables
- Admin portal patterns: `apps/admin/src/pages/QuestionPacksPage.tsx`
