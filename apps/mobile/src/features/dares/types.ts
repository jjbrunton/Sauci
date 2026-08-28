export type DareStatus =
    | "pending" | "active" | "submitted" | "completed" | "expired" | "declined" | "cancelled";

export interface DarePack {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    is_premium: boolean;
    is_explicit: boolean;
    sort_order: number;
    category_id: string | null;
    min_intensity: number | null;
    max_intensity: number | null;
    avg_intensity: number | null;
    dare_count: number;
}

export interface DareItem {
    id: string;
    pack_id: string;
    text: string;
    intensity: number;
    suggested_duration_hours: number | null;
}

export interface SentDare {
    id: string;
    couple_id: string;
    dare_id: string | null;
    text: string;
    intensity: number;
    is_custom: boolean;
    sender_id: string;
    recipient_id: string;
    direction: "incoming" | "outgoing";
    status: DareStatus;
    sender_notes: string | null;
    sent_at: string;
    accepted_at: string | null;
    submitted_at: string | null;
    completed_at: string | null;
    expires_at: string | null;
}

export interface DareEntitlement {
    is_premium: boolean;
    can_send_custom: boolean;
    weekly_send_limit: number | null;
    sends_remaining: number | null;
}

export interface DareCatalog {
    entitlement: DareEntitlement;
    packs: DarePack[];
}

export interface DareStats {
    sent: number;
    received: number;
    completed_together: number;
    active: number;
    completed_by_me: number;
    completed_by_partner: number;
}

export interface SendDarePayload {
    dare_id?: string;
    custom_dare_text?: string;
    custom_dare_intensity?: number;
    duration_hours?: number | null;
    sender_notes?: string | null;
}

export const DURATION_OPTIONS: { label: string; hours: number | null }[] = [
    { label: "1 hour", hours: 1 },
    { label: "6 hours", hours: 6 },
    { label: "12 hours", hours: 12 },
    { label: "24 hours", hours: 24 },
    { label: "3 days", hours: 72 },
    { label: "1 week", hours: 168 },
    { label: "No time limit", hours: null },
];
