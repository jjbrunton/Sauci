import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../config';
import type { User, Session } from '@supabase/supabase-js';

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
        { action: 'list', resource: 'categories' },
        { action: 'create', resource: 'categories' },
        { action: 'edit', resource: 'categories' },
        { action: 'list', resource: 'question_packs' },
        { action: 'create', resource: 'question_packs' },
        { action: 'edit', resource: 'question_packs' },
        { action: 'delete', resource: 'question_packs' },
        { action: 'list', resource: 'questions' },
        { action: 'create', resource: 'questions' },
        { action: 'edit', resource: 'questions' },
        { action: 'delete', resource: 'questions' },
    ],
    super_admin: [
        // Full access to all resources
        { action: '*', resource: '*' },
    ],
};

interface AuthContextType {
    user: User | null;
    session: Session | null;
    permissions: AdminPermissions | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    canAccess: (resource: string, action: string) => boolean;
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
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);

            // Restore permissions from localStorage
            const storedPermissions = localStorage.getItem(PERMISSIONS_KEY);
            if (storedPermissions) {
                setPermissions(JSON.parse(storedPermissions));
            }

            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
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
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
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
        const perms: AdminPermissions = {
            role: adminData.role as AdminRole,
            permissions: ROLE_PERMISSIONS[adminData.role as AdminRole],
        };

        localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(perms));
        setPermissions(perms);
    };

    const logout = async () => {
        localStorage.removeItem(PERMISSIONS_KEY);
        setPermissions(null);
        await supabase.auth.signOut();
    };

    const canAccess = (resource: string, action: string): boolean => {
        if (!permissions) return false;

        // Check for wildcard (super_admin)
        if (permissions.permissions.some(p => p.action === '*' && p.resource === '*')) {
            return true;
        }

        // Check specific permission
        return permissions.permissions.some(
            p => p.resource === resource && (p.action === action || p.action === '*')
        );
    };

    const isSuperAdmin = permissions?.role === 'super_admin';

    return (
        <AuthContext.Provider value={{
            user,
            session,
            permissions,
            loading,
            login,
            logout,
            canAccess,
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
