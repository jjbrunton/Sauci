import { AuthProvider } from 'react-admin';
import { supabase } from '../config';

// Define admin roles
export type AdminRole = 'pack_creator' | 'super_admin';

// Permission structure
export interface AdminPermissions {
    role: AdminRole;
    permissions: Array<{ action: string; resource: string }>;
}

// Define permissions by role
const ROLE_PERMISSIONS: Record<AdminRole, Array<{ action: string; resource: string }>> = {
    pack_creator: [
        { action: 'list', resource: 'question_packs' },
        { action: 'create', resource: 'question_packs' },
        { action: 'edit', resource: 'question_packs' },
        { action: 'delete', resource: 'question_packs' },
        { action: 'show', resource: 'question_packs' },
        { action: 'list', resource: 'questions' },
        { action: 'create', resource: 'questions' },
        { action: 'edit', resource: 'questions' },
        { action: 'delete', resource: 'questions' },
        { action: 'show', resource: 'questions' },
    ],
    super_admin: [
        // Full access to all resources
        { action: '*', resource: '*' },
    ],
};

const PERMISSIONS_KEY = 'admin_permissions';

export const authProvider: AuthProvider = {
    login: async ({ username, password }) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: username,
            password,
        });
        if (error) {
            throw new Error(error.message);
        }

        // Fetch admin role
        const { data: adminData, error: adminError } = await supabase
            .from('admin_users')
            .select('role')
            .eq('user_id', data.user.id)
            .single();

        if (adminError || !adminData) {
            await supabase.auth.signOut();
            throw new Error('Access denied. You are not an administrator.');
        }

        // Store permissions
        const permissions: AdminPermissions = {
            role: adminData.role as AdminRole,
            permissions: ROLE_PERMISSIONS[adminData.role as AdminRole],
        };
        localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions));

        return Promise.resolve();
    },

    logout: async () => {
        localStorage.removeItem(PERMISSIONS_KEY);
        await supabase.auth.signOut();
        return Promise.resolve();
    },

    checkError: async (error) => {
        if (error.status === 401 || error.status === 403) {
            localStorage.removeItem(PERMISSIONS_KEY);
            return Promise.reject();
        }
        return Promise.resolve();
    },

    checkAuth: async () => {
        const session = await supabase.auth.getSession();
        const permissions = localStorage.getItem(PERMISSIONS_KEY);

        if (!session.data.session || !permissions) {
            return Promise.reject();
        }
        return Promise.resolve();
    },

    getPermissions: async () => {
        const permissions = localStorage.getItem(PERMISSIONS_KEY);
        if (!permissions) {
            return Promise.reject();
        }
        return JSON.parse(permissions) as AdminPermissions;
    },

    canAccess: async ({ resource, action }) => {
        const permissionsStr = localStorage.getItem(PERMISSIONS_KEY);
        if (!permissionsStr) {
            return false;
        }

        const { permissions } = JSON.parse(permissionsStr) as AdminPermissions;

        // Check for wildcard (super_admin)
        if (permissions.some(p => p.action === '*' && p.resource === '*')) {
            return true;
        }

        // Check specific permission
        return permissions.some(
            p => p.resource === resource && (p.action === action || p.action === '*')
        );
    },

    getIdentity: async () => {
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
            throw new Error('No user');
        }

        const permissionsStr = localStorage.getItem(PERMISSIONS_KEY);
        const role = permissionsStr
            ? (JSON.parse(permissionsStr) as AdminPermissions).role
            : 'unknown';

        return {
            id: data.user.id,
            fullName: data.user.email,
            avatar: undefined,
            role,
        };
    },
};
