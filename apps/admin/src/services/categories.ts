import { supabase } from '@/config';
import { auditedSupabase } from '@/hooks/useAuditedSupabase';

// =============================================================================
// Types
// =============================================================================

export interface Category {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    sort_order: number | null;
    created_at: string | null;
    is_public: boolean;
    pack_count?: number;
}

export interface CategoryFormData {
    name: string;
    description: string;
    icon: string;
    is_public: boolean;
}

// =============================================================================
// Read Operations
// =============================================================================

/**
 * Fetch all categories with pack counts
 */
export async function fetchCategories(): Promise<Category[]> {
    // Fetch categories
    const { data: categories, error: catError } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });

    if (catError) throw catError;

    // Fetch pack counts per category
    const { data: packs } = await supabase
        .from('question_packs')
        .select('category_id');

    const packCounts: Record<string, number> = {};
    packs?.forEach(p => {
        if (p.category_id) {
            packCounts[p.category_id] = (packCounts[p.category_id] || 0) + 1;
        }
    });

    return (categories || []).map(c => ({
        ...c,
        pack_count: packCounts[c.id] || 0,
    }));
}

/**
 * Fetch a single category by ID
 */
export async function fetchCategoryById(id: string): Promise<Category | null> {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error) throw error;
    return data;
}

// =============================================================================
// Write Operations
// =============================================================================

/**
 * Create a new category
 */
export async function createCategory(
    data: CategoryFormData,
    sortOrder: number
): Promise<Category> {
    const { data: created, error } = await auditedSupabase.insert('categories', {
        name: data.name,
        description: data.description || null,
        icon: data.icon || null,
        sort_order: sortOrder,
        is_public: data.is_public ?? true,
    });

    if (error) throw error;
    if (!created || created.length === 0) throw new Error('Failed to create category');
    return created[0] as Category;
}

/**
 * Update an existing category
 */
export async function updateCategory(
    id: string,
    data: Partial<CategoryFormData>
): Promise<void> {
    const { error } = await auditedSupabase.update('categories', id, {
        name: data.name,
        description: data.description || null,
        icon: data.icon || null,
        is_public: data.is_public,
    });

    if (error) throw error;
}

/**
 * Delete a category
 */
export async function deleteCategory(id: string): Promise<void> {
    const { error } = await auditedSupabase.delete('categories', id);
    if (error) throw error;
}

/**
 * Swap sort order between two categories (for reordering)
 */
export async function swapCategorySortOrder(
    category1Id: string,
    category1Order: number,
    category2Id: string,
    category2Order: number
): Promise<void> {
    await Promise.all([
        auditedSupabase.update('categories', category1Id, { sort_order: category2Order }),
        auditedSupabase.update('categories', category2Id, { sort_order: category1Order }),
    ]);
}
