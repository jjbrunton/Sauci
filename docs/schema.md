# Database Schema

## Entity Relationship Diagram

```mermaid
erDiagram
    %% Core Authentication
    auth_users {
        uuid id PK
        string email
        jsonb raw_user_meta_data
    }

    %% User Management
    profiles {
        uuid id PK,FK "references auth.users"
        text name
        text avatar_url
        text push_token
        boolean is_premium
        uuid couple_id FK
        timestamptz created_at
        timestamptz updated_at
    }

    couples {
        uuid id PK
        text invite_code UK
        timestamptz created_at
    }

    %% Content
    question_packs {
        uuid id PK
        text name
        text description
        text icon
        boolean is_premium
        boolean is_public
        int sort_order
        timestamptz created_at
    }

    questions {
        uuid id PK
        uuid pack_id FK
        text text
        text partner_text "for two-part questions"
        int intensity "1-5"
        timestamptz created_at
    }

    %% Couple Pack Selection
    couple_packs {
        uuid couple_id PK,FK
        uuid pack_id PK,FK
        boolean enabled
        timestamptz created_at
    }

    %% User Interaction
    responses {
        uuid id PK
        uuid user_id FK
        uuid question_id FK
        uuid couple_id FK
        answer_type answer "yes/no/maybe"
        timestamptz created_at
    }

    matches {
        uuid id PK
        uuid couple_id FK
        uuid question_id FK
        match_type match_type "yes_yes/yes_maybe/maybe_maybe"
        boolean is_new
        timestamptz created_at
    }

    messages {
        uuid id PK
        uuid match_id FK
        uuid user_id FK
        text content
        text media_path
        timestamptz read_at
        timestamptz created_at
    }

    %% Subscriptions
    subscriptions {
        uuid id PK
        uuid user_id FK
        text revenuecat_app_user_id
        text product_id
        subscription_status status
        text[] entitlement_ids
        timestamptz purchased_at
        timestamptz expires_at
        text original_transaction_id
        text store
        boolean is_sandbox
        text cancel_reason
        timestamptz grace_period_expires_at
        timestamptz created_at
        timestamptz updated_at
    }

    revenuecat_webhook_events {
        uuid id PK
        text event_id UK
        text event_type
        text app_user_id
        timestamptz processed_at
        jsonb payload
    }

    %% Feedback
    feedback {
        uuid id PK
        uuid user_id FK
        feedback_type type "bug/feature_request/general"
        text title
        text description
        text screenshot_url
        jsonb device_info
        feedback_status status
        text admin_notes
        timestamptz created_at
        timestamptz updated_at
    }

    %% Relationships
    auth_users ||--|| profiles : "extends"
    couples ||--o{ profiles : "has members"
    couples ||--o{ couple_packs : "selects packs"
    couples ||--o{ responses : "has responses"
    couples ||--o{ matches : "has matches"

    question_packs ||--o{ questions : "contains"
    question_packs ||--o{ couple_packs : "selected by"

    questions ||--o{ responses : "answered by"
    questions ||--o{ matches : "generates"

    profiles ||--o{ responses : "submits"
    profiles ||--o{ feedback : "submits"
    profiles ||--o{ subscriptions : "has"

    matches ||--o{ messages : "has chat"
    auth_users ||--o{ messages : "sends"
```

## Enums

| Enum | Values |
|------|--------|
| `answer_type` | `yes`, `no`, `maybe` |
| `match_type` | `yes_yes`, `yes_maybe`, `maybe_maybe` |
| `feedback_type` | `bug`, `feature_request`, `general` |
| `feedback_status` | `new`, `reviewed`, `in_progress`, `resolved`, `closed` |
| `subscription_status` | `active`, `cancelled`, `expired`, `billing_issue`, `paused` |

## Key Flows

### Response & Match Flow
1. User submits response via `submit-response` edge function
2. Response saved to `responses` table (UPSERT on `user_id, question_id`)
3. Function checks for partner's response on same question
4. If both answered positively (not "no"), a `match` is created
5. Match triggers push notification to both partners
6. Match unlocks chat thread in `messages` table

### Couple Pairing Flow
1. First user creates couple, gets `invite_code`
2. Second user joins via `manage-couple` edge function with invite code
3. Both profiles' `couple_id` set to same couple

### Pack Selection Flow
1. Couples can enable/disable packs via `couple_packs` junction table
2. `get_recommended_questions()` function filters questions by enabled packs
3. Two-part questions show `partner_text` to second responder
