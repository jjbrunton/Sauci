import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authClient } from '../config';
import { adminRequest } from '@/lib/adminApi';
import type { User, Session } from '@supabase/supabase-js';
import { preloadAiConfig, clearAiConfigCache } from '@/hooks/useAiConfig';

// Define admin roles
export type AdminRole = 'pack_creator' | 'super_admin';

// Available permission keys
export const PERMISSION_KEYS = {
    // Content permissions
    MANAGE_PACKS: 'manage_packs',
    MANAGE_QUESTIONS: 'manage_questions',
    MANAGE_CATEGORIES: 'manage_categories',
    // User permissions
    VIEW_USERS: 'view_users',
    VIEW_CHATS: 'view_chats',
    VIEW_MEDIA: 'view_media',
    VIEW_MATCHES: 'view_matches',
    VIEW_RESPONSES: 'view_responses',
    VIEW_ACTIVITY: 'view_activity',
    MANAGE_FEEDBACK: 'manage_feedback',
    GIFT_PREMIUM: 'gift_premium',
    // System permissions
    MANAGE_CODES: 'manage_codes',
    MANAGE_ADMINS: 'manage_admins',
    MANAGE_AI_CONFIG: 'manage_ai_config',
    MANAGE_APP_CONFIG: 'manage_app_config',
    VIEW_AUDIT_LOGS: 'view_audit_logs',
} as const;

export type PermissionKey = typeof PERMISSION_KEYS[keyof typeof PERMISSION_KEYS];

// Permission metadata for UI
export const PERMISSION_METADATA: Record<PermissionKey, { label: string; description: string; group: 'content' | 'users' | 'system' }> = {
    [PERMISSION_KEYS.MANAGE_CATEGORIES]: { label: 'Can manage categories', description: 'Create, edit, delete categories', group: 'content' },
    [PERMISSION_KEYS.MANAGE_PACKS]: { label: 'Can manage packs', description: 'Create, edit, delete question packs', group: 'content' },
    [PERMISSION_KEYS.MANAGE_QUESTIONS]: { label: 'Can manage questions', description: 'Create, edit, delete questions', group: 'content' },
    [PERMISSION_KEYS.VIEW_USERS]: { label: 'Can view users', description: 'View user profiles and list', group: 'users' },
    [PERMISSION_KEYS.VIEW_CHATS]: { label: 'Can view chats', description: 'View chat messages between users', group: 'users' },
    [PERMISSION_KEYS.VIEW_MEDIA]: { label: 'Can view media', description: 'View user photos and media', group: 'users' },
    [PERMISSION_KEYS.VIEW_MATCHES]: { label: 'Can view matches', description: 'View user matches and match details', group: 'users' },
    [PERMISSION_KEYS.VIEW_RESPONSES]: { label: 'Can view responses', description: 'View user question responses', group: 'users' },
    [PERMISSION_KEYS.VIEW_ACTIVITY]: { label: 'Can view activity', description: 'View user activity feed (responses, matches, messages, signups)', group: 'users' },
    [PERMISSION_KEYS.MANAGE_FEEDBACK]: { label: 'Can manage feedback', description: 'View and respond to user feedback', group: 'users' },
    [PERMISSION_KEYS.GIFT_PREMIUM]: { label: 'Can gift premium', description: 'Manually upgrade users to premium status', group: 'users' },
    [PERMISSION_KEYS.MANAGE_CODES]: { label: 'Can manage redemption codes', description: 'Create and view redemption codes', group: 'system' },
    [PERMISSION_KEYS.MANAGE_ADMINS]: { label: 'Can manage admins', description: 'Add/remove admin users and change permissions', group: 'system' },
    [PERMISSION_KEYS.MANAGE_AI_CONFIG]: { label: 'Can manage AI settings', description: 'Configure AI models, API keys, and council mode', group: 'system' },
    [PERMISSION_KEYS.MANAGE_APP_CONFIG]: { label: 'Can manage app settings', description: 'Configure mobile app behavior settings', group: 'system' },
    [PERMISSION_KEYS.VIEW_AUDIT_LOGS]: { label: 'Can view audit logs', description: 'Access audit log history', group: 'system' },
};

// Permission structure
export interface AdminPermissions {
    role: AdminRole;
    permissions: string[];
}

interface AuthContextType {
    user: User | null;
    session: Session | null;
    permissions: AdminPermissions | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    hasPermission: (permission: PermissionKey) => boolean;
    isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PERMISSIONS_KEY = 'admin_permissions';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [permissions, setPermissions] = useState<AdminPermissions | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        authClient.auth.getSession().then(async ({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);

            if (session) {
                try {
                    const currentPermissions = await adminRequest<AdminPermissions>('/v1/admin/me');
                    setPermissions(currentPermissions);
                    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(currentPermissions));
                    preloadAiConfig().catch(console.error);
                } catch {
                    setPermissions(null);
                    localStorage.removeItem(PERMISSIONS_KEY);
                }
            }
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = authClient.auth.onAuthStateChange(
            (_event, session) => {
                setSession(session);
                setUser(session?.user ?? null);

                if (!session) {
                    setPermissions(null);
                    localStorage.removeItem(PERMISSIONS_KEY);
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const login = async (email: string, password: string) => {
        const { error } = await authClient.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            throw new Error(error.message);
        }

        // Fetch admin role and permissions
        let adminData: AdminPermissions;
        try {
            adminData = await adminRequest<AdminPermissions>('/v1/admin/me');
        } catch {
            await authClient.auth.signOut();
            throw new Error('Access denied. You are not an administrator.');
        }

        // Store permissions from database
        const perms: AdminPermissions = {
            role: adminData.role,
            permissions: (adminData.permissions as string[]) || [],
        };

        localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(perms));
        setPermissions(perms);

        // Preload AI config after successful login (non-blocking)
        preloadAiConfig().catch(console.error);
    };

    const logout = async () => {
        localStorage.removeItem(PERMISSIONS_KEY);
        setPermissions(null);
        clearAiConfigCache();
        await authClient.auth.signOut();
    };

    const isSuperAdmin = permissions?.role === 'super_admin';

    const hasPermission = (permission: PermissionKey): boolean => {
        if (!permissions) return false;

        // Super admins have all permissions
        if (isSuperAdmin) return true;

        // Check if user has the specific permission
        return permissions.permissions.includes(permission);
    };

    return (
        <AuthContext.Provider value={{
            user,
            session,
            permissions,
            loading,
            login,
            logout,
            hasPermission,
            isSuperAdmin,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
