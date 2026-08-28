import { createClient } from '@supabase/supabase-js';

export const supabaseConfig = {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
};

export const authClient = createClient(
    supabaseConfig.url,
    supabaseConfig.anonKey
);

const configuredApiUrl = import.meta.env.VITE_API_URL;

if (!configuredApiUrl) {
    throw new Error('Missing required environment variable: VITE_API_URL');
}

export const apiUrl = configuredApiUrl.replace(/\/$/, '');
