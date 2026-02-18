// User Preferences and Data Storage for OrbitBharat
// Developer: Nitesh Agarwal (2026)
// Makes sign-in meaningful with personalized features

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserPreferences {
    userId: string;
    email?: string;
    name?: string;
    avatarUrl?: string;
    favoriteCategories: string[];
    notificationsEnabled: boolean;
    alertThreshold: 'low' | 'medium' | 'high';
    lastVisit: string;
    visitCount: number;
    savedArticles: string[];
    searchHistory: string[];
    preferredUnits: 'metric' | 'imperial';
    darkMode: boolean;
    createdAt: string;
}

const PREFS_KEY = '@orbitbharat_user_prefs';
const GUEST_KEY = '@orbitbharat_guest_prefs';

// Default preferences for new users
const defaultPreferences: UserPreferences = {
    userId: 'guest',
    favoriteCategories: ['cme', 'flare', 'storm'],
    notificationsEnabled: true,
    alertThreshold: 'medium',
    lastVisit: new Date().toISOString(),
    visitCount: 1,
    savedArticles: [],
    searchHistory: [],
    preferredUnits: 'metric',
    darkMode: true,
    createdAt: new Date().toISOString(),
};

// Get user preferences (from Clerk user or guest)
export const getUserPreferences = async (userId?: string): Promise<UserPreferences> => {
    try {
        const key = userId ? `${PREFS_KEY}_${userId}` : GUEST_KEY;
        const stored = await AsyncStorage.getItem(key);

        if (stored) {
            const prefs = JSON.parse(stored) as UserPreferences;
            // Update visit info
            prefs.lastVisit = new Date().toISOString();
            prefs.visitCount += 1;
            await AsyncStorage.setItem(key, JSON.stringify(prefs));
            return prefs;
        }

        // Create new preferences
        const newPrefs = { ...defaultPreferences, userId: userId || 'guest' };
        await AsyncStorage.setItem(key, JSON.stringify(newPrefs));
        return newPrefs;
    } catch (error) {
        console.error('Error getting preferences:', error);
        return { ...defaultPreferences, userId: userId || 'guest' };
    }
};

// Update user preferences
export const updateUserPreferences = async (
    userId: string | undefined,
    updates: Partial<UserPreferences>
): Promise<void> => {
    try {
        const key = userId ? `${PREFS_KEY}_${userId}` : GUEST_KEY;
        const current = await getUserPreferences(userId);
        const updated = { ...current, ...updates };
        await AsyncStorage.setItem(key, JSON.stringify(updated));
    } catch (error) {
        console.error('Error updating preferences:', error);
    }
};

// Save an article
export const saveArticle = async (userId: string | undefined, articleId: string): Promise<void> => {
    const prefs = await getUserPreferences(userId);
    if (!prefs.savedArticles.includes(articleId)) {
        prefs.savedArticles.push(articleId);
        await updateUserPreferences(userId, { savedArticles: prefs.savedArticles });
    }
};

// Remove saved article
export const unsaveArticle = async (userId: string | undefined, articleId: string): Promise<void> => {
    const prefs = await getUserPreferences(userId);
    prefs.savedArticles = prefs.savedArticles.filter(id => id !== articleId);
    await updateUserPreferences(userId, { savedArticles: prefs.savedArticles });
};

// Add to search history
export const addSearchHistory = async (userId: string | undefined, query: string): Promise<void> => {
    const prefs = await getUserPreferences(userId);
    const history = prefs.searchHistory.filter(q => q !== query);
    history.unshift(query);
    await updateUserPreferences(userId, { searchHistory: history.slice(0, 20) });
};

// Get personalized greeting based on time and user data
export const getPersonalizedGreeting = (name?: string): string => {
    const hour = new Date().getHours();
    let greeting = '';

    if (hour < 12) greeting = 'Good morning';
    else if (hour < 17) greeting = 'Good afternoon';
    else if (hour < 21) greeting = 'Good evening';
    else greeting = 'Good night';

    if (name) {
        const firstName = name.split(' ')[0];
        return `${greeting}, ${firstName}! 👋`;
    }
    return `${greeting}, Space Explorer! 🚀`;
};

// Get personalized dashboard stats
export const getPersonalizedStats = async (userId?: string) => {
    const prefs = await getUserPreferences(userId);

    return {
        totalVisits: prefs.visitCount,
        savedArticles: prefs.savedArticles.length,
        favoriteTopics: prefs.favoriteCategories.length,
        memberSince: new Date(prefs.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric'
        }),
        isReturningUser: prefs.visitCount > 1,
    };
};

// Migrate guest data to authenticated user
export const migrateGuestDataToUser = async (userId: string): Promise<void> => {
    try {
        const guestData = await AsyncStorage.getItem(GUEST_KEY);
        if (guestData) {
            const guestPrefs = JSON.parse(guestData) as UserPreferences;
            const userKey = `${PREFS_KEY}_${userId}`;

            // Merge guest data with user account
            const existing = await AsyncStorage.getItem(userKey);
            if (existing) {
                const userPrefs = JSON.parse(existing) as UserPreferences;
                userPrefs.savedArticles = [...new Set([...userPrefs.savedArticles, ...guestPrefs.savedArticles])];
                userPrefs.searchHistory = [...new Set([...userPrefs.searchHistory, ...guestPrefs.searchHistory])];
                userPrefs.visitCount += guestPrefs.visitCount;
                await AsyncStorage.setItem(userKey, JSON.stringify(userPrefs));
            } else {
                guestPrefs.userId = userId;
                await AsyncStorage.setItem(userKey, JSON.stringify(guestPrefs));
            }

            // Clear guest data after migration
            await AsyncStorage.removeItem(GUEST_KEY);
        }
    } catch (error) {
        console.error('Error migrating guest data:', error);
    }
};
