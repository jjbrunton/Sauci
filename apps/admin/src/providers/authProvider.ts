import { AuthProvider } from 'react-admin';
import { supabase } from '../config';

export const authProvider: AuthProvider = {
    login: async ({ username, password }) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: username,
            password,
        });
        if (error) {
            throw new Error(error.message);
        }
        return Promise.resolve();
    },
    logout: async () => {
        await supabase.auth.signOut();
        return Promise.resolve();
    },
    checkError: async (error) => {
        if (error.status === 401 || error.status === 403) {
            return Promise.reject();
        }
        return Promise.resolve();
    },
    checkAuth: async () => {
        const session = await supabase.auth.getSession();
        return session.data.session ? Promise.resolve() : Promise.reject();
    },
    getPermissions: () => Promise.resolve(),
};
