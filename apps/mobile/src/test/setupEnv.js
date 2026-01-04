// Set test environment variables BEFORE modules are loaded
// This must run in setupFiles (not setupFilesAfterEnv) to ensure
// env vars are available when supabase.ts is imported

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID = 'pro';
