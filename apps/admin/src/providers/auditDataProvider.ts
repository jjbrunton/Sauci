import { DataProvider, CreateParams, UpdateParams, DeleteParams, DeleteManyParams } from 'react-admin';
import { dataProvider as baseDataProvider, supabase } from './supabaseProvider';

// Tables to audit
const AUDITED_TABLES = [
    'question_packs',
    'questions',
    'profiles',
    'couples',
    'responses',
    'matches',
    'messages',
    'subscriptions',
    'feedback',
];

const logAction = async (
    tableName: string,
    recordId: string,
    action: 'INSERT' | 'UPDATE' | 'DELETE',
    oldValues?: Record<string, unknown> | null,
    newValues?: Record<string, unknown> | null
) => {
    try {
        await supabase.rpc('log_admin_action', {
            p_table_name: tableName,
            p_record_id: recordId,
            p_action: action,
            p_old_values: oldValues || null,
            p_new_values: newValues || null,
        });
    } catch (error) {
        console.error('Failed to log audit action:', error);
        // Don't throw - logging failure shouldn't block the operation
    }
};

export const auditDataProvider: DataProvider = {
    ...baseDataProvider,

    create: async <RecordType extends { id: string } = { id: string }>(
        resource: string,
        params: CreateParams
    ) => {
        const result = await baseDataProvider.create<RecordType>(resource, params);

        if (AUDITED_TABLES.includes(resource)) {
            await logAction(resource, result.data.id, 'INSERT', null, result.data as Record<string, unknown>);
        }

        return result;
    },

    update: async <RecordType extends { id: string } = { id: string }>(
        resource: string,
        params: UpdateParams
    ) => {
        // Fetch old values before update
        let oldValues: Record<string, unknown> | null = null;
        if (AUDITED_TABLES.includes(resource)) {
            const { data } = await supabase
                .from(resource)
                .select('*')
                .eq('id', params.id)
                .single();
            oldValues = data;
        }

        const result = await baseDataProvider.update<RecordType>(resource, params);

        if (AUDITED_TABLES.includes(resource)) {
            await logAction(resource, params.id as string, 'UPDATE', oldValues, result.data as Record<string, unknown>);
        }

        return result;
    },

    delete: async <RecordType extends { id: string } = { id: string }>(
        resource: string,
        params: DeleteParams
    ) => {
        // Fetch old values before delete
        let oldValues: Record<string, unknown> | null = null;
        if (AUDITED_TABLES.includes(resource)) {
            const { data } = await supabase
                .from(resource)
                .select('*')
                .eq('id', params.id)
                .single();
            oldValues = data;
        }

        const result = await baseDataProvider.delete<RecordType>(resource, params);

        if (AUDITED_TABLES.includes(resource)) {
            await logAction(resource, params.id as string, 'DELETE', oldValues, null);
        }

        return result;
    },

    deleteMany: async (resource: string, params: DeleteManyParams) => {
        // Fetch old values before delete
        if (AUDITED_TABLES.includes(resource)) {
            const { data: oldRecords } = await supabase
                .from(resource)
                .select('*')
                .in('id', params.ids);

            const result = await baseDataProvider.deleteMany(resource, params);

            // Log each deletion
            for (const record of oldRecords || []) {
                await logAction(resource, record.id, 'DELETE', record, null);
            }

            return result;
        }

        return baseDataProvider.deleteMany(resource, params);
    },
};
