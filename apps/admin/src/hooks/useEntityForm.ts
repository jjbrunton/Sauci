import { useState, useCallback } from 'react';

/**
 * Generic form state management hook for entity CRUD dialogs
 * Reduces boilerplate across pages like PacksPage, CategoriesPage, QuestionsPage, etc.
 *
 * @template TFormData - The shape of the form data
 * @template TEntity - The shape of the entity being edited (extends the form data)
 *
 * @example
 * ```tsx
 * interface CategoryForm {
 *   name: string;
 *   description: string;
 *   icon: string;
 * }
 *
 * interface Category extends CategoryForm {
 *   id: string;
 *   created_at: string;
 * }
 *
 * const {
 *   formData,
 *   setField,
 *   dialogOpen,
 *   setDialogOpen,
 *   editingItem,
 *   saving,
 *   setSaving,
 *   openCreate,
 *   openEdit,
 *   reset,
 *   isEditing,
 * } = useEntityForm<CategoryForm, Category>(
 *   { name: '', description: '', icon: '📚' },
 *   (category) => ({
 *     name: category.name,
 *     description: category.description || '',
 *     icon: category.icon || '📚',
 *   })
 * );
 * ```
 */
export function useEntityForm<
    TFormData extends Record<string, unknown>,
    TEntity extends Record<string, unknown> = TFormData
>(
    initialFormData: TFormData,
    /**
     * Transform an entity into form data for editing.
     * Handles nullable fields and default values.
     */
    entityToFormData?: (entity: TEntity) => TFormData
) {
    const [formData, setFormData] = useState<TFormData>(initialFormData);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<TEntity | null>(null);
    const [saving, setSaving] = useState(false);

    /**
     * Update a single field in the form data
     */
    const setField = useCallback(<K extends keyof TFormData>(
        field: K,
        value: TFormData[K]
    ) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    }, []);

    /**
     * Update multiple fields at once
     */
    const setFields = useCallback((updates: Partial<TFormData>) => {
        setFormData(prev => ({ ...prev, ...updates }));
    }, []);

    /**
     * Reset form to initial state
     */
    const reset = useCallback(() => {
        setFormData(initialFormData);
        setEditingItem(null);
    }, [initialFormData]);

    /**
     * Open dialog for creating a new entity
     */
    const openCreate = useCallback(() => {
        setEditingItem(null);
        setFormData(initialFormData);
        setDialogOpen(true);
    }, [initialFormData]);

    /**
     * Open dialog for editing an existing entity
     */
    const openEdit = useCallback((entity: TEntity) => {
        setEditingItem(entity);
        if (entityToFormData) {
            setFormData(entityToFormData(entity));
        } else {
            // Best effort: assume entity shape matches form data
            setFormData(entity as unknown as TFormData);
        }
        setDialogOpen(true);
    }, [entityToFormData]);

    /**
     * Prefill form with data (e.g., from AI suggestion) and open create dialog
     */
    const openCreateWith = useCallback((data: Partial<TFormData>) => {
        setEditingItem(null);
        setFormData({ ...initialFormData, ...data });
        setDialogOpen(true);
    }, [initialFormData]);

    /**
     * Close the dialog
     */
    const close = useCallback(() => {
        setDialogOpen(false);
    }, []);

    /**
     * Close dialog and reset form
     */
    const closeAndReset = useCallback(() => {
        setDialogOpen(false);
        // Small delay to allow dialog close animation
        setTimeout(() => {
            setFormData(initialFormData);
            setEditingItem(null);
        }, 150);
    }, [initialFormData]);

    return {
        // Form state
        formData,
        setFormData,
        setField,
        setFields,

        // Dialog state
        dialogOpen,
        setDialogOpen,

        // Entity state
        editingItem,
        setEditingItem,

        // Loading state
        saving,
        setSaving,

        // Actions
        openCreate,
        openEdit,
        openCreateWith,
        reset,
        close,
        closeAndReset,

        // Computed
        isEditing: editingItem !== null,
    };
}
