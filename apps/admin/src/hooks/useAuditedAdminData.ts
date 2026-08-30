import { adminData } from '@/lib/adminApi';

// Tables to audit
const AUDITED_TABLES = [
    'question_packs',
    'questions',
    'categories',
    'dare_packs',
    'dares',
    'quiz_questions',
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
    // The standalone admin API writes the mutation and audit record in one
    // transaction. Keeping this no-op preserves the existing call sites while
    // avoiding duplicate or client-forgeable audit entries.
    void tableName; void action; void recordId; void oldValues; void newValues;
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
 * Admin API mutations. The server writes each mutation and audit record atomically.
 */
export const auditedAdminData = {
    /**
     * Insert records with audit logging
     */
    async insert<T extends { id: string }>(
        table: string,
        records: Omit<T, 'id' | 'created_at'>[] | Omit<T, 'id' | 'created_at'>
    ): Promise<InsertResult<T>> {
        const recordArray = Array.isArray(records) ? records : [records];

        const { data, error } = await adminData
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
            const { data: oldData } = await adminData
                .from(table)
                .select('*')
                .eq('id', id)
                .single();
            oldValues = oldData;
        }

        const { data, error } = await adminData
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
            const { data: oldData } = await adminData
                .from(table)
                .select('*')
                .eq(filter.column, filter.value);
            oldRecords = oldData || [];
        }

        const { data, error } = await adminData
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
            const { data: oldData } = await adminData
                .from(table)
                .select('*')
                .eq('id', id)
                .single();
            oldValues = oldData;
        }

        const { error } = await adminData
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
            const { data: oldData } = await adminData
                .from(table)
                .select('*')
                .in('id', ids);
            oldRecords = oldData || [];
        }

        const { error } = await adminData
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
            const { data: oldData } = await adminData
                .from(table)
                .select('*')
                .eq(field, value)
                .single();
            oldValues = oldData;
        }

        const { error } = await adminData
            .from(table)
            .delete()
            .eq(field, value);

        if (!error && oldValues) {
            await logAction(table, 'DELETE', (oldValues.id as string) || null, oldValues, null);
        }

        return { error };
    },
};
