/**
 * N2YO Satellite Tracking API
 * Real-time satellite position tracking using TLE data
 * API Documentation: https://www.n2yo.com/api/
 */

import { fetchWithTimeout } from './fetchWithTimeout';

// N2YO API Configuration - loaded from environment variables
const N2YO_API_KEY = process.env.EXPO_PUBLIC_N2YO_API_KEY || '';
if (!N2YO_API_KEY) console.warn('EXPO_PUBLIC_N2YO_API_KEY is not set');
const N2YO_BASE_URL = 'https://api.n2yo.com/rest/v1/satellite';

// ISRO Satellite NORAD IDs
export const ISRO_NORAD_IDS = {
    'ADITYA-L1': 57320,         // Aditya-L1 Solar Observatory
    'CHANDRAYAAN-3': 57321,     // Chandrayaan-3 Propulsion Module
    'NAVIC-1G': 41384,          // IRNSS-1G Navigation
    'NAVIC-1A': 40269,          // IRNSS-1A Navigation
    'GSAT-30': 44998,           // Communication Satellite
    'GSAT-31': 44034,           // Communication Satellite
    'CARTOSAT-3': 44804,        // Earth Observation
    'INSAT-3DR': 41752,         // Meteorological
    'OCEANSAT-3': 54361,        // Ocean Studies (EOS-06)
    'RISAT-2BR1': 44857,        // Radar Imaging
    'ASTROSAT': 40930,          // Space Observatory
    'RESOURCESAT-2A': 41877,    // Earth Observation
};

export interface SatellitePosition {
    satid: number;
    satname: string;
    satlatitude: number;
    satlongitude: number;
    sataltitude: number;
    azimuth: number;
    elevation: number;
    ra: number;
    dec: number;
    timestamp: number;
    eclipsed: boolean;
}

export interface SatelliteTLE {
    satid: number;
    satname: string;
    transactionscount: number;
    tle: string;
}

export interface SatelliteInfo {
    satid: number;
    satname: string;
    intDesignator: string;
    launchDate: string;
    satlat: number;
    satlng: number;
    satalt: number;
}

export interface VisualPass {
    startAz: number;
    startAzCompass: string;
    startEl: number;
    startUTC: number;
    maxAz: number;
    maxAzCompass: string;
    maxEl: number;
    maxUTC: number;
    endAz: number;
    endAzCompass: string;
    endEl: number;
    endUTC: number;
    mag: number;
    duration: number;
}

// Cache for API responses
const cache: { [key: string]: { data: any; timestamp: number } } = {};
const CACHE_DURATION = 30000; // 30 seconds for position data

const getCached = <T>(key: string): T | null => {
    const cached = cache[key];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    return null;
};

const setCache = (key: string, data: any) => {
    cache[key] = { data, timestamp: Date.now() };
};

/**
 * Get real-time position of a satellite
 */
export const getSatellitePosition = async (
    noradId: number,
    observerLat: number = 20.5937, // Default: India center
    observerLng: number = 78.9629,
    observerAlt: number = 0
): Promise<SatellitePosition | null> => {
    const cacheKey = `pos_${noradId}`;
    const cached = getCached<SatellitePosition>(cacheKey);
    if (cached) return cached;

    try {
        const url = `${N2YO_BASE_URL}/positions/${noradId}/${observerLat}/${observerLng}/${observerAlt}/1/&apiKey=${N2YO_API_KEY}`;
        const response = await fetchWithTimeout(url);
        
        if (!response.ok) {
            throw new Error(`N2YO API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.positions && data.positions.length > 0) {
            const position: SatellitePosition = {
                satid: data.info.satid,
                satname: data.info.satname,
                ...data.positions[0],
            };
            setCache(cacheKey, position);
            return position;
        }
        return null;
    } catch (error) {
        console.warn(`Satellite position fetch failed for ${noradId}:`, error);
        return null;
    }
};

/**
 * Get positions for multiple satellites
 */
export const getMultipleSatellitePositions = async (
    noradIds: number[],
    observerLat: number = 20.5937,
    observerLng: number = 78.9629
): Promise<Map<number, SatellitePosition>> => {
    const positions = new Map<number, SatellitePosition>();
    
    // Fetch in parallel with rate limiting (N2YO allows 1000 requests/hour)
    const results = await Promise.allSettled(
        noradIds.map(id => getSatellitePosition(id, observerLat, observerLng))
    );
    
    results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
            positions.set(noradIds[index], result.value);
        }
    });
    
    return positions;
};

/**
 * Get TLE data for a satellite
 */
export const getSatelliteTLE = async (noradId: number): Promise<SatelliteTLE | null> => {
    const cacheKey = `tle_${noradId}`;
    const cached = getCached<SatelliteTLE>(cacheKey);
    if (cached) return cached;

    try {
        const url = `${N2YO_BASE_URL}/tle/${noradId}&apiKey=${N2YO_API_KEY}`;
        const response = await fetchWithTimeout(url);
        
        if (!response.ok) {
            throw new Error(`N2YO TLE error: ${response.status}`);
        }
        
        const data = await response.json();
        setCache(cacheKey, data);
        return data;
    } catch (error) {
        console.warn(`TLE fetch failed for ${noradId}:`, error);
        return null;
    }
};

/**
 * Get visual passes for a satellite from observer location
 */
export const getVisualPasses = async (
    noradId: number,
    observerLat: number = 20.5937,
    observerLng: number = 78.9629,
    observerAlt: number = 0,
    days: number = 10,
    minVisibility: number = 60 // seconds
): Promise<VisualPass[]> => {
    const cacheKey = `passes_${noradId}_${observerLat}_${observerLng}`;
    const cached = getCached<VisualPass[]>(cacheKey);
    if (cached) return cached;

    try {
        const url = `${N2YO_BASE_URL}/visualpasses/${noradId}/${observerLat}/${observerLng}/${observerAlt}/${days}/${minVisibility}/&apiKey=${N2YO_API_KEY}`;
        const response = await fetchWithTimeout(url);
        
        if (!response.ok) {
            throw new Error(`N2YO passes error: ${response.status}`);
        }
        
        const data = await response.json();
        const passes = data.passes || [];
        setCache(cacheKey, passes);
        return passes;
    } catch (error) {
        console.warn(`Visual passes fetch failed for ${noradId}:`, error);
        return [];
    }
};

/**
 * Get satellites above a location
 */
export const getSatellitesAbove = async (
    observerLat: number = 20.5937,
    observerLng: number = 78.9629,
    observerAlt: number = 0,
    searchRadius: number = 70, // degrees
    categoryId: number = 0 // 0 = all
): Promise<SatelliteInfo[]> => {
    try {
        const url = `${N2YO_BASE_URL}/above/${observerLat}/${observerLng}/${observerAlt}/${searchRadius}/${categoryId}/&apiKey=${N2YO_API_KEY}`;
        const response = await fetchWithTimeout(url);
        
        if (!response.ok) {
            throw new Error(`N2YO above error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.above || [];
    } catch (error) {
        console.warn('Satellites above fetch failed:', error);
        return [];
    }
};

/**
 * Get all ISRO satellite positions
 */
export const getAllISROPositions = async (
    observerLat: number = 20.5937,
    observerLng: number = 78.9629
): Promise<Map<string, SatellitePosition>> => {
    const noradIds = Object.values(ISRO_NORAD_IDS);
    const positions = await getMultipleSatellitePositions(noradIds, observerLat, observerLng);
    
    // Map NORAD IDs back to satellite names
    const namedPositions = new Map<string, SatellitePosition>();
    for (const [name, noradId] of Object.entries(ISRO_NORAD_IDS)) {
        const position = positions.get(noradId);
        if (position) {
            namedPositions.set(name, position);
        }
    }
    
    return namedPositions;
};

/**
 * Format coordinates for display
 */
export const formatCoordinates = (lat: number, lng: number): string => {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;
};

/**
 * Calculate ground track velocity (km/s)
 */
export const calculateVelocity = (altitude: number): number => {
    // Simplified orbital velocity calculation
    const earthRadius = 6371; // km
    const mu = 398600.4418; // Earth's gravitational parameter (km³/s²)
    const r = earthRadius + altitude;
    return Math.sqrt(mu / r);
};
