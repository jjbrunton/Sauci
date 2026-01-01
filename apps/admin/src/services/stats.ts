import { supabase } from '@/config';

// =============================================================================
// Types
// =============================================================================

export interface DashboardStats {
    categories: number;
    packs: number;
    questions: number;
    users: number;
}

// =============================================================================
// Stats Operations
// =============================================================================

/**
 * Fetch dashboard statistics (counts for main entities)
 */
export async function fetchDashboardStats(): Promise<DashboardStats> {
    const [
        { count: categories },
        { count: packs },
        { count: questions },
        { count: users },
    ] = await Promise.all([
        supabase.from('categories').select('*', { count: 'exact', head: true }),
        supabase.from('question_packs').select('*', { count: 'exact', head: true }),
        supabase.from('questions').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
    ]);

    return {
        categories: categories || 0,
        packs: packs || 0,
        questions: questions || 0,
        users: users || 0,
    };
}

/**
 * Fetch count for a specific table
 */
export async function fetchTableCount(tableName: string): Promise<number> {
    const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

    if (error) throw error;
    return count || 0;
}
