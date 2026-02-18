// Clerk Authentication Configuration for OrbitBharat
// Developer: Nitesh Agarwal

import * as SecureStore from 'expo-secure-store';

// Clerk API Keys - loaded from environment variables
// Publishable keys are safe for client-side use (designed to be public)
export const CLERK_PUBLISHABLE_KEY =
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    'pk_test_dG9sZXJhbnQtYm9iY2F0LTcyLmNsZXJrLmFjY291bnRzLmRldiQ';

// Token cache for Clerk (persists auth state)
export const tokenCache = {
    async getToken(key: string) {
        try {
            return SecureStore.getItemAsync(key);
        } catch (err) {
            return null;
        }
    },
    async saveToken(key: string, value: string) {
        try {
            return SecureStore.setItemAsync(key, value);
        } catch (err) {
            return;
        }
    },
};

// Check if Clerk is properly configured
export const isClerkConfigured = (): boolean => {
    return CLERK_PUBLISHABLE_KEY.startsWith('pk_');
};
