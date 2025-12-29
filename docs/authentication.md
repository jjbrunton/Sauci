# Authentication System

This document explains how authentication works in Sauci, including supported methods, session management, and deep linking.

## Overview

Sauci uses Supabase Auth with three authentication methods:
1. **Magic Link** (passwordless email)
2. **Email/Password** with verification
3. **Apple Sign-In** (iOS native + OAuth fallback)

## Authentication Methods

### Magic Link

Passwordless authentication via email OTP.

```typescript
const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
        emailRedirectTo: Linking.createURL("/(auth)/login"),
    },
});
```

**Flow:**
1. User enters email
2. Supabase sends email with magic link
3. User taps link → Opens app via deep link
4. App extracts `token_hash` and verifies OTP
5. Session established

### Email/Password

Traditional email/password with email verification.

**Sign Up:**
```typescript
const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
});
```

**Sign In:**
```typescript
const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
});
```

**Verification Flow:**
1. User signs up → Receives verification email
2. Shows "Verify your email" screen with:
   - "I've verified my email" button (attempts sign-in)
   - "Resend verification email" button (60s cooldown)
3. User clicks email link → Email verified
4. User taps "I've verified" → Sign-in succeeds

**Resend Logic:**
```typescript
const { error } = await supabase.auth.resend({
    type: 'signup',
    email: pendingVerification.email,
});
// 60 second cooldown between resends
```

### Apple Sign-In

Native Apple authentication on iOS with OAuth fallback.

**Native (iOS with expo-apple-authentication):**
```typescript
const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
        AppleAuthenticationScope.FULL_NAME,
        AppleAuthenticationScope.EMAIL,
    ],
});

const { error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
});
```

**OAuth Fallback (web, Expo Go):**
```typescript
const { error } = await supabase.auth.signInWithOAuth({
    provider: "apple",
    options: {
        redirectTo: Linking.createURL("/(auth)/login"),
    },
});
```

## Session Management

### Storage Adapter

Sessions are stored in AsyncStorage (not SecureStore due to JWT size limits):

```typescript
const ExpoStorageAdapter = {
    getItem: async (key) => {
        if (Platform.OS === "web") {
            return window.localStorage.getItem(key);
        }
        return AsyncStorage.getItem(key);
    },
    setItem: async (key, value) => { ... },
    removeItem: async (key) => { ... },
};

export const supabase = createClient(url, key, {
    auth: {
        storage: ExpoStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === "web",
    },
});
```

### Auth State Listener

The root layout listens for auth changes:

```typescript
supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        fetchUser();
        setUserContext(session.user.id, session.user.email);  // Sentry
    } else if (event === "SIGNED_OUT") {
        await clearPushToken(userId);  // Remove push token
        setUser(null);
        clearUserContext();
        queryClient.clear();
    }
});
```

### Sign Out

Sign out clears all app state:

```typescript
signOut: async () => {
    // Clear local state FIRST (ensures UI updates)
    set({ user: null, couple: null, partner: null, ... });

    // Clear other stores
    useMatchStore.getState().clearMatches();
    usePacksStore.getState().clearPacks();
    useMessageStore.getState().clearMessages();
    useSubscriptionStore.getState().clearSubscription();

    // Sign out from Supabase (don't block on this)
    await supabase.auth.signOut();
},
```

## Deep Linking

### URL Schemes

| Platform | Scheme | Example |
|----------|--------|---------|
| iOS/Android | `sauci://` | `sauci://auth/callback` |
| Expo Dev | `exp://` | `exp://localhost:8081` |

### Deep Link Handler

The root layout processes auth deep links:

```typescript
const handleDeepLink = async (url: string) => {
    const parsedUrl = new URL(url);
    const params = new URLSearchParams(parsedUrl.search);
    const hashParams = new URLSearchParams(parsedUrl.hash.replace('#', ''));

    const accessToken = params.get('access_token') || hashParams.get('access_token');
    const refreshToken = params.get('refresh_token') || hashParams.get('refresh_token');
    const tokenHash = params.get('token_hash') || hashParams.get('token_hash');
    const type = params.get('type') || hashParams.get('type');

    if (accessToken && refreshToken) {
        // OAuth flow - set session directly
        await supabase.auth.setSession({ access_token, refresh_token });
    } else if (tokenHash && type) {
        // Magic link / email verification
        await supabase.auth.verifyOtp({ token_hash, type });
    }
};
```

### Deep Link Sources

1. **Initial URL** - App opened via link (cold start)
2. **URL Event** - Link received while app running

```typescript
// Cold start
Linking.getInitialURL().then(handleDeepLink);

// App running
Linking.addEventListener("url", (event) => handleDeepLink(event.url));
```

## Profile Auto-Creation

Database trigger creates profile on signup:

```sql
CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name',
                 NEW.raw_user_meta_data->>'full_name'),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## Push Token Registration

After authentication, push token is registered:

```typescript
// In app layout after fetchUser
const token = await registerForPushNotificationsAsync();
if (token && user.id) {
    await savePushToken(user.id, token);
}
```

Tokens are stored in `profiles.push_token` and cleared on sign out.

## Auth Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Login Screen                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Magic Link   │  │   Password   │  │    Apple     │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌────────────────┐   ┌────────────────┐   ┌────────────────┐
│ signInWithOtp  │   │ signUp/signIn  │   │ signInWithId   │
│                │   │ WithPassword   │   │ Token (native) │
└────────────────┘   └────────────────┘   └────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌────────────────┐   ┌────────────────┐   ┌────────────────┐
│  Email sent    │   │  Verify email  │   │   ID Token     │
│  (magic link)  │   │  (if signup)   │   │   validated    │
└────────────────┘   └────────────────┘   └────────────────┘
          │                    │                    │
          └──────────┬─────────┴────────────────────┘
                     ▼
          ┌────────────────────┐
          │ onAuthStateChange  │
          │  event: SIGNED_IN  │
          └──────────┬─────────┘
                     ▼
          ┌────────────────────┐
          │    fetchUser()     │
          │  Load profile from │
          │     database       │
          └──────────┬─────────┘
                     ▼
          ┌────────────────────┐
          │  Register push     │
          │  token if granted  │
          └──────────┬─────────┘
                     ▼
          ┌────────────────────┐
          │  Navigate to app   │
          │  (or pairing if    │
          │   no partner)      │
          └────────────────────┘
```

## Supabase Auth Config

From `apps/supabase/config.toml`:

```toml
[auth]
enabled = true
site_url = "exp://localhost:8081"
additional_redirect_urls = ["sauci://auth/callback"]
jwt_expiry = 3600  # 1 hour
enable_refresh_token_rotation = true
refresh_token_reuse_interval = 10
enable_signup = true

[auth.external.apple]
enabled = true
client_id = "env(APPLE_CLIENT_ID)"
secret = "env(APPLE_CLIENT_SECRET)"

[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = false  # Email verification disabled by default
```

## Error Handling

| Error | Cause | Handling |
|-------|-------|----------|
| "Email not confirmed" | Sign-in before verification | Show verification pending screen |
| "Invalid login credentials" | Wrong password | Show error message |
| Empty identities array | Email already exists (signup) | Prompt to sign in instead |
| "ERR_REQUEST_CANCELED" | User canceled Apple sign-in | Silent (no error shown) |

## Security Considerations

- JWTs stored in AsyncStorage (encrypted on iOS, less secure on Android)
- Push tokens cleared on sign out
- Session auto-refresh enabled
- OAuth state verified via deep link parameters
