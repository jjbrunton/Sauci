import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "./authStore";

export interface NotificationPreferences {
    user_id: string;
    matches_enabled: boolean;
    messages_enabled: boolean;
    partner_activity_enabled: boolean;
    nudges_enabled: boolean;
    pack_changes_enabled: boolean;
    new_packs_enabled: boolean;
    streak_milestones_enabled: boolean;
    created_at: string;
    updated_at: string;
}

interface NotificationPreferencesState {
    preferences: NotificationPreferences | null;
    isLoading: boolean;
    isUpdating: boolean;
    error: string | null;

    // Actions
    fetchPreferences: () => Promise<void>;
    updatePreference: (key: keyof Omit<NotificationPreferences, 'user_id' | 'created_at' | 'updated_at'>, value: boolean) => Promise<void>;
    clearPreferences: () => void;
}

export const useNotificationPreferencesStore = create<NotificationPreferencesState>((set, get) => ({
    preferences: null,
    isLoading: false,
    isUpdating: false,
    error: null,

    fetchPreferences: async () => {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) {
            set({ preferences: null, isLoading: false });
            return;
        }

        set({ isLoading: true, error: null });

        try {
            // Use the RPC function to get or create preferences
            const { data, error } = await supabase
                .rpc('get_or_create_notification_preferences', { p_user_id: userId });

            if (error) throw error;

            set({ preferences: data, isLoading: false });
        } catch (error) {
            console.error('Error fetching notification preferences:', error);
            set({ error: 'Failed to load notification preferences', isLoading: false });
        }
    },

    updatePreference: async (key, value) => {
        const userId = useAuthStore.getState().user?.id;
        const currentPreferences = get().preferences;

        if (!userId) return;

        // Optimistic update
        if (currentPreferences) {
            set({
                preferences: { ...currentPreferences, [key]: value },
                isUpdating: true,
            });
        }

        try {
            const { error } = await supabase
                .from('notification_preferences')
                .update({ [key]: value })
                .eq('user_id', userId);

            if (error) throw error;

            set({ isUpdating: false });
        } catch (error) {
            console.error('Error updating notification preference:', error);
            // Revert optimistic update
            set({
                preferences: currentPreferences,
                isUpdating: false,
                error: 'Failed to update preference',
            });
        }
    },

    clearPreferences: () => {
        set({ preferences: null, isLoading: false, isUpdating: false, error: null });
    },
}));
