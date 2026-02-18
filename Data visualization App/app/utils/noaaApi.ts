/**
 * NOAA Space Weather Prediction Center API Service
 * Provides real-time solar wind data from DSCOVR satellite
 * API Documentation: https://services.swpc.noaa.gov
 */

import { fetchWithTimeout } from './fetchWithTimeout';

const NOAA_BASE_URL = 'https://services.swpc.noaa.gov';

export interface SolarWindData {
    time_tag: string;
    speed: number;         // km/s
    density: number;       // particles/cm³
    temperature: number;   // Kelvin
}

export interface MagnetometerData {
    time_tag: string;
    bx_gsm: number;        // nT
    by_gsm: number;        // nT
    bz_gsm: number;        // nT
    bt: number;            // Total B nT
    theta_gsm: number;     // degrees
    phi_gsm: number;       // degrees
}

export interface SpaceWeatherAlert {
    product_id: string;
    issue_datetime: string;
    message: string;
}

export interface KpIndex {
    time_tag: string;
    kp: string;
    kp_index: number;
    a_running: number;
    station_count: number;
}

export interface XRayFlux {
    time_tag: string;
    satellite: number;
    current_class: string;
    current_ratio: number;
    current_int_xrlong: number;
    begin_class: string | null;
    max_class: string | null;
}

/**
 * Fetch real-time solar wind plasma data from DSCOVR
 */
export const fetchSolarWindData = async (): Promise<SolarWindData[]> => {
    try {
        const url = `${NOAA_BASE_URL}/products/solar-wind/plasma-7-day.json`;

        const response = await fetchWithTimeout(url);

        if (!response.ok) {
            throw new Error(`NOAA API error: ${response.status}`);
        }

        const rawData = await response.json();

        // Skip header row and parse data
        const data: SolarWindData[] = rawData.slice(1).map((row: any[]) => ({
            time_tag: row[0],
            density: parseFloat(row[1]) || 0,
            speed: parseFloat(row[2]) || 0,
            temperature: parseFloat(row[3]) || 0,
        })).filter((d: SolarWindData) => d.speed > 0);

        return data;
    } catch (error) {
        console.error('Error fetching solar wind data:', error);
        return [];
    }
};

/**
 * Fetch real-time magnetometer data from DSCOVR
 */
export const fetchMagnetometerData = async (): Promise<MagnetometerData[]> => {
    try {
        const url = `${NOAA_BASE_URL}/products/solar-wind/mag-7-day.json`;

        const response = await fetchWithTimeout(url);

        if (!response.ok) {
            throw new Error(`NOAA API error: ${response.status}`);
        }

        const rawData = await response.json();

        // Skip header row and parse data
        const data: MagnetometerData[] = rawData.slice(1).map((row: any[]) => ({
            time_tag: row[0],
            bx_gsm: parseFloat(row[1]) || 0,
            by_gsm: parseFloat(row[2]) || 0,
            bz_gsm: parseFloat(row[3]) || 0,
            bt: parseFloat(row[6]) || 0,
            theta_gsm: parseFloat(row[4]) || 0,
            phi_gsm: parseFloat(row[5]) || 0,
        })).filter((d: MagnetometerData) => d.bt > 0);

        return data;
    } catch (error) {
        console.error('Error fetching magnetometer data:', error);
        return [];
    }
};

/**
 * Fetch current Kp index (geomagnetic activity indicator)
 */
export const fetchKpIndex = async (): Promise<KpIndex[]> => {
    try {
        const url = `${NOAA_BASE_URL}/products/noaa-planetary-k-index.json`;

        const response = await fetchWithTimeout(url);

        if (!response.ok) {
            throw new Error(`NOAA API error: ${response.status}`);
        }

        const rawData = await response.json();

        // Skip header row
        const data: KpIndex[] = rawData.slice(1).map((row: any[]) => ({
            time_tag: row[0],
            kp: row[1],
            kp_index: parseInt(row[1]) || 0,
            a_running: parseFloat(row[2]) || 0,
            station_count: parseInt(row[3]) || 0,
        }));

        return data;
    } catch (error) {
        console.error('Error fetching Kp index:', error);
        return [];
    }
};

/**
 * Fetch X-ray flux data (for solar flare detection)
 */
export const fetchXRayFlux = async (): Promise<XRayFlux[]> => {
    try {
        const url = `${NOAA_BASE_URL}/products/xray-flares.json`;

        const response = await fetchWithTimeout(url);

        if (!response.ok) {
            throw new Error(`NOAA API error: ${response.status}`);
        }

        const rawData = await response.json();

        // Skip header row
        const data: XRayFlux[] = rawData.slice(1).map((row: any[]) => ({
            time_tag: row[0],
            satellite: parseInt(row[1]) || 0,
            current_class: row[2] || 'A',
            current_ratio: parseFloat(row[3]) || 0,
            current_int_xrlong: parseFloat(row[4]) || 0,
            begin_class: row[5] || null,
            max_class: row[6] || null,
        }));

        return data;
    } catch (error) {
        console.error('Error fetching X-ray flux:', error);
        return [];
    }
};

/**
 * Get geomagnetic activity description from Kp index
 */
export const getGeomagneticActivityLevel = (kp: number): string => {
    if (kp <= 1) return 'Quiet';
    if (kp <= 3) return 'Unsettled';
    if (kp <= 4) return 'Active';
    if (kp <= 5) return 'Minor Storm (G1)';
    if (kp <= 6) return 'Moderate Storm (G2)';
    if (kp <= 7) return 'Strong Storm (G3)';
    if (kp <= 8) return 'Severe Storm (G4)';
    return 'Extreme Storm (G5)';
};

/**
 * Get comprehensive real-time solar wind summary
 */
export const getRealTimeSolarWindSummary = async () => {
    try {
        const [solarWind, mag, kpData] = await Promise.all([
            fetchSolarWindData(),
            fetchMagnetometerData(),
            fetchKpIndex(),
        ]);

        // Get most recent readings
        const latestWind = solarWind.length > 0 ? solarWind[solarWind.length - 1] : null;
        const latestMag = mag.length > 0 ? mag[mag.length - 1] : null;
        const latestKp = kpData.length > 0 ? kpData[kpData.length - 1] : null;

        // Calculate averages for last hour (assuming ~1 minute resolution)
        const lastHourWind = solarWind.slice(-60);
        const avgSpeed = lastHourWind.reduce((sum, d) => sum + d.speed, 0) / lastHourWind.length || 0;
        const avgDensity = lastHourWind.reduce((sum, d) => sum + d.density, 0) / lastHourWind.length || 0;

        return {
            current: {
                speed: latestWind?.speed || 0,
                density: latestWind?.density || 0,
                temperature: latestWind?.temperature || 0,
                magneticField: latestMag?.bt || 0,
                bz: latestMag?.bz_gsm || 0,
            },
            averages: {
                speed: Math.round(avgSpeed),
                density: Math.round(avgDensity * 10) / 10,
            },
            geomagnetic: {
                kpIndex: latestKp?.kp_index || 0,
                activity: latestKp ? getGeomagneticActivityLevel(latestKp.kp_index) : 'Unknown',
            },
            lastUpdated: latestWind?.time_tag || new Date().toISOString(),
        };
    } catch (error) {
        console.error('Error getting solar wind summary:', error);
        return null;
    }
};

/**
 * Calculate aurora visibility probability based on Kp
 */
export const getAuroraForecast = (kpIndex: number): { visibility: string; latitudeReach: string } => {
    if (kpIndex <= 2) return { visibility: 'Low', latitudeReach: 'High Arctic only' };
    if (kpIndex <= 4) return { visibility: 'Moderate', latitudeReach: 'Northern Canada, Scandinavia' };
    if (kpIndex <= 6) return { visibility: 'High', latitudeReach: 'Northern US, UK' };
    if (kpIndex <= 8) return { visibility: 'Very High', latitudeReach: 'Central US, Central Europe' };
    return { visibility: 'Extreme', latitudeReach: 'Visible worldwide' };
};

/**
 * Fetch real-time aurora forecast data from NOAA Ovation model.
 * Returns array of [lat, lng, probability_0_to_1] for heatmap rendering.
 * Data source: NOAA Space Weather Prediction Center
 */
export const fetchAuroraOvationData = async (): Promise<number[][]> => {
    try {
        const response = await fetchWithTimeout(
            `${NOAA_BASE_URL}/json/ovation_aurora_latest.json`,
            {},
            15000
        );
        if (!response.ok) throw new Error(`NOAA Aurora error: ${response.status}`);

        const rawData = await response.json();

        // NOAA Ovation endpoint returns an object with a "coordinates" array
        // Each entry is [lng (0-359), lat (-90..90), probability (0-100)]
        const coordArray = Array.isArray(rawData)
            ? rawData.slice(1)            // fallback: flat array with header row
            : rawData.coordinates || [];   // expected: object with "coordinates" key

        const points: number[][] = [];
        for (let i = 0; i < coordArray.length; i++) {
            const d = coordArray[i];
            if (!Array.isArray(d) || d.length < 3) continue;
            const probability = d[2];
            if (probability < 3) continue; // Skip negligible aurora
            // Convert longitude from 0-359 to -180...180
            const lng = d[0] > 180 ? d[0] - 360 : d[0];
            const lat = d[1];
            points.push([lat, lng, probability / 100]); // Normalize to 0-1
        }

        return points;
    } catch (error) {
        console.error('Error fetching aurora Ovation data:', error);
        return [];
    }
};
