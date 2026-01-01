import { supabase } from '@/config';
import { auditedSupabase } from '@/hooks/useAuditedSupabase';

// =============================================================================
// Types
// =============================================================================

export interface Pack {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    is_premium: boolean;
    is_public: boolean;
    is_explicit: boolean;
    sort_order: number | null;
    category_id: string | null;
    created_at: string | null;
    category?: { name: string };
    question_count?: number;
}

export interface PackFormData {
    name: string;
    description: string;
    icon: string;
    is_premium: boolean;
    is_public: boolean;
    is_explicit: boolean;
}

export interface Topic {
    id: string;
    name: string;
}

// =============================================================================
// Read Operations
// =============================================================================

/**
 * Fetch all packs for a category with question counts
 */
export async function fetchPacksForCategory(categoryId: string): Promise<Pack[]> {
    const { data: packs, error: packError } = await supabase
        .from('question_packs')
        .select('*, category:categories(name)')
        .eq('category_id', categoryId)
        .order('sort_order', { ascending: true });

    if (packError) throw packError;

    // Get question counts per pack
    const { data: questions } = await supabase
        .from('questions')
        .select('pack_id');

    const questionCounts: Record<string, number> = {};
    questions?.forEach(q => {
        if (q.pack_id) {
            questionCounts[q.pack_id] = (questionCounts[q.pack_id] || 0) + 1;
        }
    });

    return (packs || []).map(p => ({
        ...p,
        question_count: questionCounts[p.id] || 0,
    }));
}

/**
 * Fetch a single pack by ID
 */
export async function fetchPackById(id: string): Promise<Pack | null> {
    const { data, error } = await supabase
        .from('question_packs')
        .select('*, category:categories(name)')
        .eq('id', id)
        .maybeSingle();

    if (error) throw error;
    return data;
}

/**
 * Fetch all topics
 */
export async function fetchAllTopics(): Promise<Topic[]> {
    const { data, error } = await supabase
        .from('topics')
        .select('*')
        .order('name');

    if (error) throw error;
    return data || [];
}

/**
 * Fetch topic IDs for a specific pack
 */
export async function fetchPackTopicIds(packId: string): Promise<Set<string>> {
    const { data, error } = await supabase
        .from('pack_topics')
        .select('topic_id')
        .eq('pack_id', packId);

    if (error) throw error;
    return new Set((data || []).map(pt => pt.topic_id));
}

// =============================================================================
// Write Operations
// =============================================================================

/**
 * Create a new pack
 */
export async function createPack(
    categoryId: string,
    data: PackFormData,
    sortOrder: number
): Promise<Pack> {
    const { data: created, error } = await auditedSupabase.insert('question_packs', {
        name: data.name,
        description: data.description || null,
        icon: data.icon || null,
        is_premium: data.is_premium,
        is_public: data.is_public,
        is_explicit: data.is_explicit,
        category_id: categoryId,
        sort_order: sortOrder,
    });

    if (error) throw error;
    return created as Pack;
}

/**
 * Update an existing pack
 */
export async function updatePack(
    id: string,
    data: Partial<PackFormData>
): Promise<void> {
    const { error } = await auditedSupabase.update('question_packs', id, {
        name: data.name,
        description: data.description || null,
        icon: data.icon || null,
        is_premium: data.is_premium,
        is_public: data.is_public,
        is_explicit: data.is_explicit,
    });

    if (error) throw error;
}

/**
 * Delete a pack
 */
export async function deletePack(id: string): Promise<void> {
    const { error } = await auditedSupabase.delete('question_packs', id);
    if (error) throw error;
}

/**
 * Swap sort order between two packs (for reordering)
 */
export async function swapPackSortOrder(
    pack1Id: string,
    pack1Order: number,
    pack2Id: string,
    pack2Order: number
): Promise<void> {
    await Promise.all([
        auditedSupabase.update('question_packs', pack1Id, { sort_order: pack2Order }),
        auditedSupabase.update('question_packs', pack2Id, { sort_order: pack1Order }),
    ]);
}

// =============================================================================
// Topic Operations
// =============================================================================

/**
 * Update pack topics (replaces all existing topics)
 */
export async function updatePackTopics(
    packId: string,
    topicIds: string[]
): Promise<void> {
    // Delete existing topics
    await supabase.from('pack_topics').delete().eq('pack_id', packId);

    // Insert new topics
    if (topicIds.length > 0) {
        const { error } = await supabase.from('pack_topics').insert(
            topicIds.map(topicId => ({ pack_id: packId, topic_id: topicId }))
        );
        if (error) throw error;
    }
}

/**
 * Create a new topic
 */
export async function createTopic(name: string): Promise<Topic> {
    const { data, error } = await supabase
        .from('topics')
        .insert({ name })
        .select()
        .single();

    if (error) throw error;
    return data;
}
