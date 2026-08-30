import type { Category, QuestionPack, UsageReason } from '../../types';

/**
 * Category-name keywords to prioritize for each onboarding usage reason,
 * matched case-insensitively against the couple's actual catalog. Ordered
 * from most to least relevant so the first matching category's packs lead
 * the recommended row.
 *
 * Keep this in sync with the categories seeded in the content catalog
 * (see apps/supabase/content-seed.sql) - it degrades gracefully to no
 * recommendation if none of the keywords match anything in the catalog.
 */
export const USAGE_REASON_CATEGORY_KEYWORDS: Record<UsageReason, string[]> = {
    improve_communication: ['getting started', 'quality time', 'social life'],
    reconnect: ['quality time', 'long distance', 'romance'],
    deeper_connection: ['romance', 'sensual discovery', 'getting started'],
    have_fun: ['adventure', 'spicy challenges', 'roleplay', 'public thrills'],
    strengthen_relationship: ['quality time', 'romance', 'getting started'],
    spice_up_intimacy: ['bedroom adventures', 'fantasy exploration', 'the kink lab', 'toy time'],
};

export const RECOMMENDED_PACKS_LABEL = 'Picked for how you want to use Sauci';

/** Caps the recommended row so it stays a highlight, not a full re-listing of the catalog. */
export const RECOMMENDED_PACKS_LIMIT = 8;

/**
 * Picks a personalized set of packs based on the usage reason collected during
 * onboarding. Pure and side-effect free so it can be unit tested directly.
 * Returns an empty array whenever there is nothing to recommend (no reason on
 * file, or no catalog category matches its keywords) so callers can simply
 * skip rendering the row.
 */
export function pickRecommendedPacks(
    packs: QuestionPack[],
    categories: Category[],
    usageReason: UsageReason | null | undefined,
): QuestionPack[] {
    if (!usageReason) return [];

    const keywords = USAGE_REASON_CATEGORY_KEYWORDS[usageReason];
    if (!keywords || keywords.length === 0) return [];

    const orderedCategoryIds: string[] = [];
    for (const keyword of keywords) {
        for (const category of categories) {
            if (
                category.name.toLowerCase().includes(keyword) &&
                !orderedCategoryIds.includes(category.id)
            ) {
                orderedCategoryIds.push(category.id);
            }
        }
    }
    if (orderedCategoryIds.length === 0) return [];

    const packsByCategoryId = new Map<string, QuestionPack[]>();
    for (const pack of packs) {
        if (!pack.category_id) continue;
        const list = packsByCategoryId.get(pack.category_id) ?? [];
        list.push(pack);
        packsByCategoryId.set(pack.category_id, list);
    }

    const recommended: QuestionPack[] = [];
    for (const categoryId of orderedCategoryIds) {
        if (recommended.length >= RECOMMENDED_PACKS_LIMIT) break;
        const categoryPacks = packsByCategoryId.get(categoryId) ?? [];
        for (const pack of categoryPacks) {
            if (recommended.length >= RECOMMENDED_PACKS_LIMIT) break;
            if (!recommended.some((existing) => existing.id === pack.id)) {
                recommended.push(pack);
            }
        }
    }

    return recommended;
}
