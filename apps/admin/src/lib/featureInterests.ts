export interface FeatureInterestRow {
    id: string;
    user_id: string;
    feature: string;
    created_at: string;
}

export interface RecentFeatureInterest extends FeatureInterestRow {
    profile?: {
        id: string;
        name: string | null;
        email: string | null;
        avatar_url: string | null;
    };
}

export function toRecentFeatureInterest(row: FeatureInterestRow): RecentFeatureInterest {
    return {
        id: row.id,
        user_id: row.user_id,
        feature: row.feature,
        created_at: row.created_at,
    };
}

export function formatFeatureName(feature: string): string {
    return feature
        .split('_')
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}
