import { useState, useCallback } from 'react';
import { supabase } from '@/config';
import { auditedSupabase } from '@/hooks/useAuditedSupabase';
import { toast } from 'sonner';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseFilterFn = (query: any) => any;

interface UseCrudOperationsOptions<T> {
    /**
     * The Supabase table name
     */
    table: string;

    /**
     * Default ordering for fetches
     */
    orderBy?: {
        column: keyof T | string;
        ascending?: boolean;
    };

    /**
     * Select expression for fetches
     * @default '*'
     */
    select?: string;

    /**
     * Success messages for operations
     */
    messages?: {
        createSuccess?: string;
        updateSuccess?: string;
        deleteSuccess?: string;
        fetchError?: string;
        createError?: string;
        updateError?: string;
        deleteError?: string;
    };
}

/**
 * Generic CRUD operations hook for Supabase tables
 * Reduces boilerplate for data fetching and mutations across pages.
 *
 * @example
 * ```tsx
 * const {
 *   items,
 *   loading,
 *   fetchAll,
 *   create,
 *   update,
 *   remove,
 * } = useCrudOperations<Category>({
 *   table: 'categories',
 *   orderBy: { column: 'sort_order', ascending: true },
 *   messages: {
 *     createSuccess: 'Category created',
 *     updateSuccess: 'Category updated',
 *     deleteSuccess: 'Category deleted',
 *   },
 * });
 * ```
 */
export function useCrudOperations<T extends { id: string }>({
    table,
    orderBy,
    select = '*',
    messages = {},
}: UseCrudOperationsOptions<T>) {
    const [items, setItems] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const defaultMessages = {
        createSuccess: 'Created successfully',
        updateSuccess: 'Updated successfully',
        deleteSuccess: 'Deleted successfully',
        fetchError: 'Failed to load data',
        createError: 'Failed to create',
        updateError: 'Failed to update',
        deleteError: 'Failed to delete',
        ...messages,
    };

    /**
     * Fetch all items from the table
     * @param filter Optional filter function to modify the query
     */
    const fetchAll = useCallback(async (
        filter?: SupabaseFilterFn
    ): Promise<T[]> => {
        setLoading(true);
        setError(null);
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let query: any = supabase.from(table).select(select);

            if (filter) {
                query = filter(query);
            }

            if (orderBy) {
                query = query.order(orderBy.column as string, {
                    ascending: orderBy.ascending ?? true,
                });
            }

            const { data, error: fetchError } = await query;

            if (fetchError) throw fetchError;

            const result = (data || []) as T[];
            setItems(result);
            return result;
        } catch (err) {
            const error = err as Error;
            setError(error);
            toast.error(defaultMessages.fetchError);
            console.error(error);
            return [];
        } finally {
            setLoading(false);
        }
    }, [table, select, orderBy, defaultMessages.fetchError]);

    /**
     * Fetch a single item by ID
     */
    const fetchById = useCallback(async (id: string): Promise<T | null> => {
        try {
            const { data, error: fetchError } = await supabase
                .from(table)
                .select(select)
                .eq('id', id)
                .maybeSingle();

            if (fetchError) throw fetchError;
            return data as T | null;
        } catch (err) {
            console.error(err);
            return null;
        }
    }, [table, select]);

    /**
     * Create a new item
     * @param data The data to insert
     * @param options.refetch Whether to refetch after creating (default: true)
     * @returns The created item, or null on error
     */
    const create = useCallback(async (
        data: Omit<T, 'id' | 'created_at'> | Record<string, unknown>,
        options: { refetch?: boolean; silent?: boolean } = {}
    ): Promise<T | null> => {
        const { refetch = true, silent = false } = options;
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: created, error: createError } = await auditedSupabase.insert(table, data as any);

            if (createError) throw createError;

            if (!silent) {
                toast.success(defaultMessages.createSuccess);
            }

            if (refetch) {
                await fetchAll();
            }

            // auditedSupabase.insert returns T[] | null, get first element
            return created && created.length > 0 ? (created[0] as T) : null;
        } catch (err) {
            if (!silent) {
                toast.error(defaultMessages.createError);
            }
            console.error(err);
            return null;
        }
    }, [table, fetchAll, defaultMessages.createSuccess, defaultMessages.createError]);

    /**
     * Update an existing item
     * @param id The item ID
     * @param data The data to update
     * @param options.refetch Whether to refetch after updating (default: true)
     */
    const update = useCallback(async (
        id: string,
        data: Partial<T> | Record<string, unknown>,
        options: { refetch?: boolean; silent?: boolean } = {}
    ): Promise<boolean> => {
        const { refetch = true, silent = false } = options;
        try {
            const { error: updateError } = await auditedSupabase.update(table, id, data);

            if (updateError) throw updateError;

            if (!silent) {
                toast.success(defaultMessages.updateSuccess);
            }

            if (refetch) {
                await fetchAll();
            }

            return true;
        } catch (err) {
            if (!silent) {
                toast.error(defaultMessages.updateError);
            }
            console.error(err);
            return false;
        }
    }, [table, fetchAll, defaultMessages.updateSuccess, defaultMessages.updateError]);

    /**
     * Delete an item
     * @param id The item ID
     * @param options.confirm Confirmation message (if provided, shows confirm dialog)
     * @param options.refetch Whether to refetch after deleting (default: true)
     */
    const remove = useCallback(async (
        id: string,
        options: { confirm?: string; refetch?: boolean; silent?: boolean } = {}
    ): Promise<boolean> => {
        const { confirm: confirmMessage, refetch = true, silent = false } = options;

        if (confirmMessage && !window.confirm(confirmMessage)) {
            return false;
        }

        try {
            const { error: deleteError } = await auditedSupabase.delete(table, id);

            if (deleteError) throw deleteError;

            if (!silent) {
                toast.success(defaultMessages.deleteSuccess);
            }

            if (refetch) {
                await fetchAll();
            }

            return true;
        } catch (err) {
            if (!silent) {
                toast.error(defaultMessages.deleteError);
            }
            console.error(err);
            return false;
        }
    }, [table, fetchAll, defaultMessages.deleteSuccess, defaultMessages.deleteError]);

    /**
     * Optimistically update an item in local state
     * Useful for immediate UI feedback before server confirms
     */
    const optimisticUpdate = useCallback((id: string, updates: Partial<T>) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, ...updates } : item
        ));
    }, []);

    /**
     * Optimistically add an item to local state
     */
    const optimisticAdd = useCallback((item: T) => {
        setItems(prev => [...prev, item]);
    }, []);

    /**
     * Optimistically remove an item from local state
     */
    const optimisticRemove = useCallback((id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    }, []);

    return {
        // State
        items,
        setItems,
        loading,
        error,

        // Read operations
        fetchAll,
        fetchById,

        // Write operations
        create,
        update,
        remove,

        // Optimistic updates
        optimisticUpdate,
        optimisticAdd,
        optimisticRemove,
    };
}
