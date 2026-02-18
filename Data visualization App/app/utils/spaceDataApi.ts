// Enhanced Space Data API Service for OrbitBharat
// Developer: Nitesh Agarwal
// Fetches real-time satellite data from multiple space weather sources

import { fetchWithTimeout } from './fetchWithTimeout';

// ============================================
// REAL-TIME SPACE DATA SOURCES (2026)
// ============================================

// 1. NASA DONKI API - CME, Flares, Storms (already integrated)
// 2. NOAA SWPC API - Solar wind, Kp index (already integrated)
// 3. SDO/AIA - Solar images (new)
// 4. ACE Satellite - Real-time solar wind at L1 (new)
// 5. GOES Satellite - X-ray flux (new)

const SPACE_DATA_SOURCES = {
    // NASA DONKI (CME Events)
    NASA_DONKI: {
        base: 'https://api.nasa.gov/DONKI',
        endpoints: {
            cme: '/CME',
            flr: '/FLR',
            gst: '/GST',
            hss: '/HSS',
            sep: '/SEP',
        },
        apiKey: 'lTZME2fgspsB5gXZIW5HZ7urQeh9eb1Ba4BDwRlj',
    },

    // NOAA SWPC (Real-time solar wind)
    NOAA_SWPC: {
        base: 'https://services.swpc.noaa.gov',
        endpoints: {
            solarWind: '/products/solar-wind/plasma-7-day.json',
            magnetometer: '/products/solar-wind/mag-7-day.json',
            kpIndex: '/products/noaa-planetary-k-index.json',
            xrayFlux: '/json/goes/primary/xrays-7-day.json',
            protonFlux: '/json/goes/primary/integral-protons-7-day.json',
            auroraForecast: '/json/ovation_aurora_latest.json',
        },
    },

    // SDO (Solar Dynamics Observatory) - Real-time solar images
    SDO_AIA: {
        base: 'https://sdo.gsfc.nasa.gov/assets/img/latest',
        wavelengths: {
            '171': 'latest_1024_0171.jpg', // Coronal loops
            '193': 'latest_1024_0193.jpg', // Corona and flares
            '211': 'latest_1024_0211.jpg', // Active regions
            '304': 'latest_1024_0304.jpg', // Chromosphere
            '335': 'latest_1024_0335.jpg', // Active regions
            '94': 'latest_1024_0094.jpg',  // Hot flaring regions
        },
    },

    // ACE Satellite (Advanced Composition Explorer) at L1
    ACE_RTSW: {
        base: 'https://services.swpc.noaa.gov/products/ace',
        endpoints: {
            epam: '/epam-7-day.json',      // Energetic particles
            mag: '/mag-7-day.json',         // Magnetic field
            swepam: '/swepam-7-day.json',   // Solar wind
        },
    },

    // ISRO Aditya-L1 (when available - placeholder)
    ADITYA_L1: {
        base: 'https://pradan.issdc.gov.in/aditya', // Official ISRO portal
        note: 'Data access may require registration',
    },
};

export interface SatelliteData {
    source: string;
    timestamp: string;
    solarWindSpeed: number;
    solarWindDensity: number;
    magneticFieldBt: number;
    magneticFieldBz: number;
    protonFlux: number;
    electronFlux: number;
    kpIndex: number;
    xrayFlux: string;
}

export interface SpaceWeatherAlert {
    type: 'CME' | 'FLARE' | 'STORM' | 'RADIATION';
    severity: 'MINOR' | 'MODERATE' | 'STRONG' | 'SEVERE' | 'EXTREME';
    message: string;
    timestamp: string;
    source: string;
}

// Fetch current date from server (always accurate)
export const getServerDate = (): string => {
    return new Date().toISOString().split('T')[0];
};

// Fetch real-time ACE satellite data
export const fetchACEData = async (): Promise<any[]> => {
    try {
        const response = await fetchWithTimeout(`${SPACE_DATA_SOURCES.ACE_RTSW.base}/swepam-7-day.json`);
        if (!response.ok) throw new Error('ACE data fetch failed');
        const data = await response.json();
        return data.slice(1).map((row: any[]) => ({
            time: row[0],
            protonDensity: parseFloat(row[1]) || 0,
            bulkSpeed: parseFloat(row[2]) || 0,
            ionTemperature: parseFloat(row[3]) || 0,
        }));
    } catch (error) {
        console.error('ACE data error:', error);
        return [];
    }
};

// Fetch real-time GOES X-ray flux
export const fetchGOESXrayFlux = async (): Promise<any[]> => {
    try {
        const response = await fetchWithTimeout(`${SPACE_DATA_SOURCES.NOAA_SWPC.base}/json/goes/primary/xrays-7-day.json`);
        if (!response.ok) throw new Error('GOES data fetch failed');
        const data = await response.json();
        return data.slice(1).map((row: any) => ({
            time: row.time_tag,
            flux: parseFloat(row.flux) || 0,
            energy: row.energy,
        }));
    } catch (error) {
        console.error('GOES data error:', error);
        return [];
    }
};

// Fetch real-time proton flux for radiation storms
export const fetchProtonFlux = async (): Promise<any[]> => {
    try {
        const response = await fetchWithTimeout(`${SPACE_DATA_SOURCES.NOAA_SWPC.base}/json/goes/primary/integral-protons-7-day.json`);
        if (!response.ok) throw new Error('Proton flux fetch failed');
        const data = await response.json();
        return data.slice(1).map((row: any) => ({
            time: row.time_tag,
            flux10MeV: parseFloat(row['>=10 MeV']) || 0,
            flux50MeV: parseFloat(row['>=50 MeV']) || 0,
            flux100MeV: parseFloat(row['>=100 MeV']) || 0,
        }));
    } catch (error) {
        console.error('Proton flux error:', error);
        return [];
    }
};

// Get latest SDO solar images URLs
export const getSDOImageURLs = () => {
    return Object.entries(SPACE_DATA_SOURCES.SDO_AIA.wavelengths).map(([wavelength, filename]) => ({
        wavelength: `${wavelength}Å`,
        url: `${SPACE_DATA_SOURCES.SDO_AIA.base}/${filename}`,
        description: getWavelengthDescription(wavelength),
    }));
};

const getWavelengthDescription = (wavelength: string): string => {
    const descriptions: { [key: string]: string } = {
        '171': 'Coronal loops (1M K)',
        '193': 'Corona & flares (1.5M K)',
        '211': 'Active regions (2M K)',
        '304': 'Chromosphere (50K K)',
        '335': 'Active regions (2.5M K)',
        '94': 'Hot flaring regions (6M K)',
    };
    return descriptions[wavelength] || 'Solar observation';
};

// Comprehensive real-time space weather summary
export const getComprehensiveSpaceWeather = async (): Promise<{
    lastUpdate: string;
    solarWind: any;
    xrayFlux: any;
    protons: any;
    alerts: SpaceWeatherAlert[];
    sdoImages: any[];
}> => {
    const [aceData, goesData, protonData] = await Promise.all([
        fetchACEData(),
        fetchGOESXrayFlux(),
        fetchProtonFlux(),
    ]);

    const latest = {
        solarWind: aceData[aceData.length - 1] || null,
        xrayFlux: goesData[goesData.length - 1] || null,
        protons: protonData[protonData.length - 1] || null,
    };

    const alerts: SpaceWeatherAlert[] = [];

    // Check for high solar wind speed
    if (latest.solarWind?.bulkSpeed > 600) {
        alerts.push({
            type: 'STORM',
            severity: latest.solarWind.bulkSpeed > 800 ? 'STRONG' : 'MODERATE',
            message: `Elevated solar wind speed: ${Math.round(latest.solarWind.bulkSpeed)} km/s`,
            timestamp: latest.solarWind.time,
            source: 'ACE/SWEPAM',
        });
    }

    // Check for high proton flux (radiation storm)
    if (latest.protons?.flux10MeV > 10) {
        alerts.push({
            type: 'RADIATION',
            severity: latest.protons.flux10MeV > 100 ? 'STRONG' : 'MODERATE',
            message: `Elevated proton flux: ${latest.protons.flux10MeV.toExponential(2)} pfu`,
            timestamp: latest.protons.time,
            source: 'GOES',
        });
    }

    return {
        lastUpdate: new Date().toISOString(),
        solarWind: latest.solarWind,
        xrayFlux: latest.xrayFlux,
        protons: latest.protons,
        alerts,
        sdoImages: getSDOImageURLs(),
    };
};

// Export data sources for reference
export { SPACE_DATA_SOURCES };
