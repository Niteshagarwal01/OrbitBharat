// Clerk Authentication Configuration for OrbitBharat
// Developer: Nitesh Agarwal

import * as SecureStore from 'expo-secure-store';

// Clerk API Keys - loaded from environment variables
export const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
if (!CLERK_PUBLISHABLE_KEY) console.warn('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set');

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
