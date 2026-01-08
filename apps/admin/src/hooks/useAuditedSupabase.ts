import { supabase } from '@/config';

// Tables to audit
const AUDITED_TABLES = [
    'question_packs',
    'questions',
    'categories',
    'profiles',
    'couples',
    'responses',
    'matches',
    'messages',
    'subscriptions',
    'feedback',
    'admin_users',
    'redemption_codes',
    'code_redemptions',
];

type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

async function logAction(
    tableName: string,
    action: AuditAction,
    recordId: string | null,
    oldValues?: Record<string, unknown> | null,
    newValues?: Record<string, unknown> | null
): Promise<void> {
    if (!AUDITED_TABLES.includes(tableName)) return;

    try {
        const { error } = await supabase.rpc('log_admin_action', {
            p_table_name: tableName,
            p_action: action,
            p_record_id: recordId,
            p_old_values: oldValues || null,
            p_new_values: newValues || null,
        });
        if (error) {
            console.error('Failed to log audit action:', error);
        }
    } catch (error) {
        console.error('Failed to log audit action:', error);
        // Don't throw - logging failure shouldn't block the operation
    }
}

interface InsertResult<T> {
    data: T[] | null;
    error: Error | null;
}

interface SingleResult<T> {
    data: T | null;
    error: Error | null;
}

/**
 * Audited Supabase operations - automatically logs INSERT/UPDATE/DELETE to audit_logs
 */
export const auditedSupabase = {
    /**
     * Insert records with audit logging
     */
    async insert<T extends { id: string }>(
        table: string,
        records: Omit<T, 'id' | 'created_at'>[] | Omit<T, 'id' | 'created_at'>
    ): Promise<InsertResult<T>> {
        const recordArray = Array.isArray(records) ? records : [records];

        const { data, error } = await supabase
            .from(table)
            .insert(recordArray)
            .select();

        if (!error && data) {
            // Log each inserted record
            for (const record of data as T[]) {
                await logAction(table, 'INSERT', record.id, null, record as Record<string, unknown>);
            }
        }

        return { data: data as T[] | null, error };
    },

    /**
     * Update a single record with audit logging
     */
    async update<T extends object = Record<string, unknown>>(
        table: string,
        id: string,
        updates: Partial<T> | Record<string, unknown>
    ): Promise<SingleResult<T>> {
        // Fetch old values before update
        let oldValues: Record<string, unknown> | null = null;
        if (AUDITED_TABLES.includes(table)) {
            const { data: oldData } = await supabase
                .from(table)
                .select('*')
                .eq('id', id)
                .single();
            oldValues = oldData;
        }

        const { data, error } = await supabase
            .from(table)
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (!error && data) {
            await logAction(table, 'UPDATE', id, oldValues, data as Record<string, unknown>);
        }

        return { data: data as T | null, error };
    },

    /**
     * Update multiple records matching a filter with audit logging
     */
    async updateMany<T extends { id: string }>(
        table: string,
        filter: { column: string; value: unknown },
        updates: Partial<T>
    ): Promise<InsertResult<T>> {
        // Fetch old values before update
        let oldRecords: Record<string, unknown>[] = [];
        if (AUDITED_TABLES.includes(table)) {
            const { data: oldData } = await supabase
                .from(table)
                .select('*')
                .eq(filter.column, filter.value);
            oldRecords = oldData || [];
        }

        const { data, error } = await supabase
            .from(table)
            .update(updates)
            .eq(filter.column, filter.value)
            .select();

        if (!error && data) {
            // Log each updated record
            for (const record of data as T[]) {
                const oldRecord = oldRecords.find(r => r.id === record.id);
                await logAction(table, 'UPDATE', record.id, oldRecord || null, record as Record<string, unknown>);
            }
        }

        return { data: data as T[] | null, error };
    },

    /**
     * Delete a single record with audit logging
     */
    async delete(
        table: string,
        id: string
    ): Promise<{ error: Error | null }> {
        // Fetch old values before delete
        let oldValues: Record<string, unknown> | null = null;
        if (AUDITED_TABLES.includes(table)) {
            const { data: oldData } = await supabase
                .from(table)
                .select('*')
                .eq('id', id)
                .single();
            oldValues = oldData;
        }

        const { error } = await supabase
            .from(table)
            .delete()
            .eq('id', id);

        if (!error) {
            await logAction(table, 'DELETE', id, oldValues, null);
        }

        return { error };
    },

    /**
     * Delete multiple records with audit logging
     */
    async deleteMany(
        table: string,
        ids: string[]
    ): Promise<{ error: Error | null }> {
        // Fetch old values before delete
        let oldRecords: Record<string, unknown>[] = [];
        if (AUDITED_TABLES.includes(table)) {
            const { data: oldData } = await supabase
                .from(table)
                .select('*')
                .in('id', ids);
            oldRecords = oldData || [];
        }

        const { error } = await supabase
            .from(table)
            .delete()
            .in('id', ids);

        if (!error) {
            // Log each deletion
            for (const record of oldRecords) {
                await logAction(table, 'DELETE', record.id as string, record, null);
            }
        }

        return { error };
    },

    /**
     * Delete a record by a custom field (not id) with audit logging
     */
    async deleteBy(
        table: string,
        field: string,
        value: string
    ): Promise<{ error: Error | null }> {
        // Fetch old values before delete
        let oldValues: Record<string, unknown> | null = null;
        if (AUDITED_TABLES.includes(table)) {
            const { data: oldData } = await supabase
                .from(table)
                .select('*')
                .eq(field, value)
                .single();
            oldValues = oldData;
        }

        const { error } = await supabase
            .from(table)
            .delete()
            .eq(field, value);

        if (!error && oldValues) {
            await logAction(table, 'DELETE', (oldValues.id as string) || null, oldValues, null);
        }

        return { error };
    },
};
