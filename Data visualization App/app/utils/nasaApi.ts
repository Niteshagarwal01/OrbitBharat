/**
 * NASA DONKI API Service
 * Provides real-time CME events, solar flares, and space weather data
 * API Documentation: https://api.nasa.gov
 */

// NASA API Configuration - loaded from environment variables
import { fetchWithTimeout } from './fetchWithTimeout';

const NASA_API_KEY = process.env.EXPO_PUBLIC_NASA_API_KEY || 'lTZME2fgspsB5gXZIW5HZ7urQeh9eb1Ba4BDwRlj';
const DONKI_BASE_URL = 'https://api.nasa.gov/DONKI';

export interface CMEEvent {
    activityID: string;
    startTime: string;
    sourceLocation: string;
    activeRegionNum: number | null;
    link: string;
    note: string;
    instruments: { displayName: string }[];
    cmeAnalyses?: CMEAnalysis[];
}

export interface CMEAnalysis {
    time21_5: string;
    latitude: number;
    longitude: number;
    halfAngle: number;
    speed: number;
    type: string;
    isMostAccurate: boolean;
    levelOfData: number;
    note: string;
}

export interface SolarFlare {
    flrID: string;
    beginTime: string;
    peakTime: string;
    endTime: string | null;
    classType: string;
    sourceLocation: string;
    activeRegionNum: number | null;
    linkedEvents: { activityID: string }[] | null;
}

export interface GeomagneticStorm {
    gstID: string;
    startTime: string;
    linkedEvents: { activityID: string }[] | null;
    allKpIndex: { observedTime: string; kpIndex: number; source: string }[];
}

export interface HighSpeedStream {
    hssID: string;
    eventTime: string;
    instruments: { displayName: string }[];
    linkedEvents: { activityID: string }[] | null;
}

/**
 * Format date to NASA API format (YYYY-MM-DD)
 */
const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

/**
 * Get date range for API queries (default: last 30 days)
 */
const getDefaultDateRange = (daysBack: number = 30) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    return {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
    };
};

// Simple in-memory cache
const cache: { [key: string]: { data: any; timestamp: number } } = {};
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

const getCachedData = <T>(key: string): T | null => {
    const cached = cache[key];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    return null;
};

const setCachedData = (key: string, data: any) => {
    cache[key] = { data, timestamp: Date.now() };
};

/**
 * Fetch CME events from NASA DONKI API
 */
export const fetchCMEEvents = async (
    startDate?: string,
    endDate?: string
): Promise<CMEEvent[]> => {
    try {
        const range = getDefaultDateRange(30);
        const start = startDate || range.startDate;
        const end = endDate || range.endDate;
        const cacheKey = `CME_${start}_${end}`;

        const cached = getCachedData<CMEEvent[]>(cacheKey);
        if (cached) return cached;

        const url = `${DONKI_BASE_URL}/CME?startDate=${start}&endDate=${end}&api_key=${NASA_API_KEY}`;
        const response = await fetchWithTimeout(url);

        if (!response.ok) {
            // Return cached data if available even if expired on error
            if (cache[cacheKey]) return cache[cacheKey].data;
            throw new Error(`NASA API error: ${response.status}`);
        }

        const data: CMEEvent[] = await response.json();
        setCachedData(cacheKey, data || []);
        return data || [];
    } catch (error) {
        console.error('Error fetching CME events:', error);
        return [];
    }
};

/**
 * Fetch CME Analysis data with speed and trajectory
 */
export const fetchCMEAnalysis = async (
    startDate?: string,
    endDate?: string
): Promise<CMEAnalysis[]> => {
    try {
        const range = getDefaultDateRange(30);
        const start = startDate || range.startDate;
        const end = endDate || range.endDate;
        const cacheKey = `CMEAnalysis_${start}_${end}`;

        const cached = getCachedData<CMEAnalysis[]>(cacheKey);
        if (cached) return cached;

        const url = `${DONKI_BASE_URL}/CMEAnalysis?startDate=${start}&endDate=${end}&mostAccurateOnly=true&api_key=${NASA_API_KEY}`;
        const response = await fetchWithTimeout(url);

        if (!response.ok) {
            if (cache[cacheKey]) return cache[cacheKey].data;
            throw new Error(`NASA API error: ${response.status}`);
        }

        const data: CMEAnalysis[] = await response.json();
        setCachedData(cacheKey, data || []);
        return data || [];
    } catch (error) {
        console.error('Error fetching CME analysis:', error);
        return [];
    }
};

/**
 * Fetch Solar Flare events
 */
export const fetchSolarFlares = async (
    startDate?: string,
    endDate?: string
): Promise<SolarFlare[]> => {
    try {
        const range = getDefaultDateRange(30);
        const start = startDate || range.startDate;
        const end = endDate || range.endDate;
        const cacheKey = `FLR_${start}_${end}`;

        const cached = getCachedData<SolarFlare[]>(cacheKey);
        if (cached) return cached;

        const url = `${DONKI_BASE_URL}/FLR?startDate=${start}&endDate=${end}&api_key=${NASA_API_KEY}`;
        const response = await fetchWithTimeout(url);

        if (!response.ok) {
            if (cache[cacheKey]) return cache[cacheKey].data;
            throw new Error(`NASA API error: ${response.status}`);
        }

        const data: SolarFlare[] = await response.json();
        setCachedData(cacheKey, data || []);
        return data || [];
    } catch (error) {
        console.error('Error fetching solar flares:', error);
        return [];
    }
};

/**
 * Fetch Geomagnetic Storm events
 */
export const fetchGeomagneticStorms = async (
    startDate?: string,
    endDate?: string
): Promise<GeomagneticStorm[]> => {
    try {
        const range = getDefaultDateRange(30);
        const start = startDate || range.startDate;
        const end = endDate || range.endDate;
        const cacheKey = `GST_${start}_${end}`;

        const cached = getCachedData<GeomagneticStorm[]>(cacheKey);
        if (cached) return cached;

        const url = `${DONKI_BASE_URL}/GST?startDate=${start}&endDate=${end}&api_key=${NASA_API_KEY}`;
        const response = await fetchWithTimeout(url);

        if (!response.ok) {
            if (cache[cacheKey]) return cache[cacheKey].data;
            throw new Error(`NASA API error: ${response.status}`);
        }

        const data: GeomagneticStorm[] = await response.json();
        setCachedData(cacheKey, data || []);
        return data || [];
    } catch (error) {
        console.error('Error fetching geomagnetic storms:', error);
        return [];
    }
};

/**
 * Fetch High Speed Stream events
 */
export const fetchHighSpeedStreams = async (
    startDate?: string,
    endDate?: string
): Promise<HighSpeedStream[]> => {
    try {
        const range = getDefaultDateRange(30);
        const start = startDate || range.startDate;
        const end = endDate || range.endDate;
        const cacheKey = `HSS_${start}_${end}`;

        const cached = getCachedData<HighSpeedStream[]>(cacheKey);
        if (cached) return cached;

        const url = `${DONKI_BASE_URL}/HSS?startDate=${start}&endDate=${end}&api_key=${NASA_API_KEY}`;
        const response = await fetchWithTimeout(url);

        if (!response.ok) {
            if (cache[cacheKey]) return cache[cacheKey].data;
            throw new Error(`NASA API error: ${response.status}`);
        }

        const data: HighSpeedStream[] = await response.json();
        setCachedData(cacheKey, data || []);
        return data || [];
    } catch (error) {
        console.error('Error fetching high speed streams:', error);
        return [];
    }
};

/**
 * Get comprehensive space weather summary
 */
export const getSpaceWeatherSummary = async () => {
    try {
        const [cmeEvents, solarFlares, storms] = await Promise.all([
            fetchCMEEvents(),
            fetchSolarFlares(),
            fetchGeomagneticStorms(),
        ]);

        // Get latest CME with analysis
        const latestCME = cmeEvents.length > 0 ? cmeEvents[cmeEvents.length - 1] : null;
        const latestFlare = solarFlares.length > 0 ? solarFlares[solarFlares.length - 1] : null;
        const latestStorm = storms.length > 0 ? storms[storms.length - 1] : null;

        // Calculate CME speed from analysis
        let cmeSpeed = 0;
        if (latestCME?.cmeAnalyses && latestCME.cmeAnalyses.length > 0) {
            const mostAccurate = latestCME.cmeAnalyses.find(a => a.isMostAccurate) || latestCME.cmeAnalyses[0];
            cmeSpeed = mostAccurate.speed;
        }

        return {
            totalCMEs: cmeEvents.length,
            totalFlares: solarFlares.length,
            totalStorms: storms.length,
            latestCME: latestCME ? {
                time: latestCME.startTime,
                location: latestCME.sourceLocation,
                speed: cmeSpeed,
                note: latestCME.note,
            } : null,
            latestFlare: latestFlare ? {
                time: latestFlare.peakTime,
                class: latestFlare.classType,
                location: latestFlare.sourceLocation,
            } : null,
            latestStormKpIndex: latestStorm?.allKpIndex?.[0]?.kpIndex || 0,
            lastUpdated: new Date().toISOString(),
        };
    } catch (error) {
        console.error('Error getting space weather summary:', error);
        return null;
    }
};
