import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '@clerk/clerk-expo';
import { useState, useEffect, useCallback } from 'react';

// Keys for storage
const BOOKMARKS_KEY = 'user_bookmarks';
const SETTINGS_KEY = 'user_alert_settings';

export interface AlertSettings {
    cmeAlerts: boolean;
    flareAlerts: boolean;
    stormAlerts: boolean;
    minSeverity: 'low' | 'moderate' | 'high' | 'extreme';
}

export const DEFAULT_SETTINGS: AlertSettings = {
    cmeAlerts: true,
    flareAlerts: true,
    stormAlerts: true,
    minSeverity: 'moderate',
};

// Hook for managing Bookmarks
export const useBookmarks = () => {
    const { user, isLoaded } = useUser();
    const [bookmarks, setBookmarks] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    // Load bookmarks on mount or user change
    useEffect(() => {
        loadBookmarks();
    }, [user]);

    const loadBookmarks = async () => {
        try {
            setLoading(true);
            // specific key for user if logged in, otherwise 'guest'
            const key = user ? `${BOOKMARKS_KEY}_${user.id}` : `${BOOKMARKS_KEY}_guest`;
            const stored = await AsyncStorage.getItem(key);
            if (stored) {
                setBookmarks(JSON.parse(stored));
            } else {
                setBookmarks([]);
            }
        } catch (error) {
            console.error('Failed to load bookmarks', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleBookmark = async (articleId: string) => {
        try {
            const key = user ? `${BOOKMARKS_KEY}_${user.id}` : `${BOOKMARKS_KEY}_guest`;
            let newBookmarks: string[];

            if (bookmarks.includes(articleId)) {
                newBookmarks = bookmarks.filter(id => id !== articleId);
            } else {
                newBookmarks = [...bookmarks, articleId];
            }

            setBookmarks(newBookmarks);
            await AsyncStorage.setItem(key, JSON.stringify(newBookmarks));
            return newBookmarks.includes(articleId); // return active state
        } catch (error) {
            console.error('Failed to toggle bookmark', error);
            return false;
        }
    };

    const isBookmarked = useCallback((articleId: string) => {
        return bookmarks.includes(articleId);
    }, [bookmarks]);

    return { bookmarks, toggleBookmark, isBookmarked, loading };
};

// Hook for managing Alert Preferences
export const useAlertSettings = () => {
    const { user } = useUser();
    const [settings, setSettings] = useState<AlertSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSettings();
    }, [user]);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const key = user ? `${SETTINGS_KEY}_${user.id}` : `${SETTINGS_KEY}_guest`;
            const stored = await AsyncStorage.getItem(key);
            if (stored) {
                setSettings(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Failed to load settings', error);
        } finally {
            setLoading(false);
        }
    };

    const updateSettings = async (newSettings: Partial<AlertSettings>) => {
        try {
            const key = user ? `${SETTINGS_KEY}_${user.id}` : `${SETTINGS_KEY}_guest`;
            const updated = { ...settings, ...newSettings };
            setSettings(updated);
            await AsyncStorage.setItem(key, JSON.stringify(updated));
        } catch (error) {
            console.error('Failed to save settings', error);
        }
    };

    return { settings, updateSettings, loading };
};
