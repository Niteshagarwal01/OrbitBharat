// Safe Clerk hook wrappers — return sensible defaults when Clerk is NOT configured.
// This prevents crashes on screens that reference useAuth / useUser / useOAuth
// when the app runs without a CLERK_PUBLISHABLE_KEY.

import { isClerkConfigured } from './clerkConfig';
import {
  useAuth as _useAuth,
  useUser as _useUser,
  useOAuth as _useOAuth,
} from '@clerk/clerk-expo';

// Evaluated once at module-load time — never changes during app lifetime,
// so the conditional hook call below is safe (call order is deterministic).
const CLERK_ENABLED = isClerkConfigured();

/** Drop-in replacement for `useAuth()` from @clerk/clerk-expo */
export function useSafeAuth() {
  if (!CLERK_ENABLED) {
    return {
      isSignedIn: false as boolean,
      isLoaded: true,
      signOut: async () => {},
      getToken: async () => null as string | null,
      userId: null as string | null,
    };
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return _useAuth();
}

/** Drop-in replacement for `useUser()` from @clerk/clerk-expo */
export function useSafeUser() {
  if (!CLERK_ENABLED) {
    return {
      user: null,
      isLoaded: true,
      isSignedIn: false as boolean,
    };
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return _useUser();
}

/** Drop-in replacement for `useOAuth()` from @clerk/clerk-expo */
export function useSafeOAuth(opts: { strategy: 'oauth_google' | 'oauth_apple' }) {
  if (!CLERK_ENABLED) {
    return {
      startOAuthFlow: async () => ({
        createdSessionId: null,
        setActive: null,
      }),
    };
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return _useOAuth(opts);
}
