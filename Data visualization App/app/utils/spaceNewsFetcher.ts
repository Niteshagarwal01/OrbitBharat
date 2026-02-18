// Enhanced Space News Fetcher for OrbitBharat
// Developer: Nitesh Agarwal (2026)
// Multi-source real-time space weather news

import { fetchWithTimeout } from './fetchWithTimeout';

const NASA_API_KEY = process.env.EXPO_PUBLIC_NASA_API_KEY || 'DEMO_KEY';

export interface SpaceBlog {
    id: string;
    title: string;
    summary: string;
    date: string;
    source: string;
    sourceIcon: string;
    url: string;
    category: 'cme' | 'flare' | 'storm' | 'aurora' | 'mission' | 'research' | 'prediction';
    severity?: 'low' | 'moderate' | 'high' | 'extreme';
    imageUrl?: string;
}

// Format date for display
const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

// Fetch recent CME events
export const fetchCMENews = async (): Promise<SpaceBlog[]> => {
    try {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const response = await fetchWithTimeout(
            `https://api.nasa.gov/DONKI/CME?startDate=${startDate}&endDate=${endDate}&api_key=${NASA_API_KEY}`
        );

        if (!response.ok) throw new Error('CME fetch failed');

        const data = await response.json();

        return (data || []).slice(0, 6).map((cme: any, index: number) => {
            const speed = cme.cmeAnalyses?.[0]?.speed || 0;
            let severity: 'low' | 'moderate' | 'high' | 'extreme' = 'low';
            if (speed > 1500) severity = 'extreme';
            else if (speed > 1000) severity = 'high';
            else if (speed > 500) severity = 'moderate';

            return {
                id: `cme-${index}-${Date.now()}`,
                title: `CME Detected: ${cme.sourceLocation || 'Full Halo'}`,
                summary: cme.note || `A Coronal Mass Ejection was detected at ${cme.startTime}. ${speed ? `Speed: ${speed} km/s. ` : ''
                    }${cme.cmeAnalyses?.[0]?.type || 'Analyzing trajectory...'}`,
                date: formatDate(cme.startTime),
                source: 'NASA DONKI',
                sourceIcon: 'planet-outline',
                url: cme.link || 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/',
                category: 'cme' as const,
                severity,
            };
        });
    } catch (error) {
        console.error('CME news fetch error:', error);
        return [];
    }
};

// Fetch solar flare events
export const fetchFlareNews = async (): Promise<SpaceBlog[]> => {
    try {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const response = await fetchWithTimeout(
            `https://api.nasa.gov/DONKI/FLR?startDate=${startDate}&endDate=${endDate}&api_key=${NASA_API_KEY}`
        );

        if (!response.ok) throw new Error('Flare fetch failed');

        const data = await response.json();

        return (data || []).slice(0, 6).map((flare: any, index: number) => {
            const classType = flare.classType || 'Unknown';
            let severity: 'low' | 'moderate' | 'high' | 'extreme' = 'low';
            if (classType.startsWith('X')) severity = 'extreme';
            else if (classType.startsWith('M')) severity = 'high';
            else if (classType.startsWith('C')) severity = 'moderate';

            return {
                id: `flare-${index}-${Date.now()}`,
                title: `${classType} Solar Flare`,
                summary: `A ${classType} class solar flare erupted from ${flare.sourceLocation || 'the Sun'} on ${new Date(flare.beginTime).toLocaleDateString()}. Peak time: ${flare.peakTime?.split('T')[1]?.substring(0, 5) || 'Unknown'} UTC. ${flare.linkedEvents?.length ? `Associated with ${flare.linkedEvents.length} other event(s).` : ''
                    }`,
                date: formatDate(flare.beginTime),
                source: 'NASA DONKI',
                sourceIcon: 'sunny-outline',
                url: flare.link || 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/',
                category: 'flare' as const,
                severity,
            };
        });
    } catch (error) {
        console.error('Flare news fetch error:', error);
        return [];
    }
};

// Fetch geomagnetic storm events
export const fetchStormNews = async (): Promise<SpaceBlog[]> => {
    try {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const response = await fetchWithTimeout(
            `https://api.nasa.gov/DONKI/GST?startDate=${startDate}&endDate=${endDate}&api_key=${NASA_API_KEY}`
        );

        if (!response.ok) throw new Error('Storm fetch failed');

        const data = await response.json();

        return (data || []).slice(0, 5).map((storm: any, index: number) => {
            const maxKp = Math.max(...(storm.allKpIndex?.map((k: any) => k.kpIndex || 0) || [0]));
            let severity: 'low' | 'moderate' | 'high' | 'extreme' = 'low';
            if (maxKp >= 8) severity = 'extreme';
            else if (maxKp >= 6) severity = 'high';
            else if (maxKp >= 4) severity = 'moderate';

            return {
                id: `storm-${index}-${Date.now()}`,
                title: `Geomagnetic Storm: Kp ${maxKp}`,
                summary: `A geomagnetic storm occurred starting ${new Date(storm.startTime).toLocaleDateString()}. Maximum Kp index: ${maxKp}. ${maxKp >= 5 ? 'Aurora may be visible at mid-latitudes!' : 'Aurora visible at high latitudes.'
                    }`,
                date: formatDate(storm.startTime),
                source: 'NASA DONKI',
                sourceIcon: 'globe-outline',
                url: storm.link || 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/',
                category: 'storm' as const,
                severity,
            };
        });
    } catch (error) {
        console.error('Storm news fetch error:', error);
        return [];
    }
};

// Fetch NOAA alerts
export const fetchNOAAAlerts = async (): Promise<SpaceBlog[]> => {
    try {
        const response = await fetchWithTimeout('https://services.swpc.noaa.gov/products/alerts.json');

        if (!response.ok) throw new Error('NOAA alerts fetch failed');

        const data = await response.json();

        return (data || []).slice(0, 4).map((alert: any, index: number) => {
            const message = alert.message || '';
            let category: SpaceBlog['category'] = 'research';
            let severity: 'low' | 'moderate' | 'high' | 'extreme' = 'low';

            if (message.includes('WATCH') || message.includes('WARNING')) {
                severity = 'high';
                category = 'storm';
            }
            if (message.includes('ALERT')) severity = 'extreme';

            return {
                id: `noaa-${index}-${Date.now()}`,
                title: `${message.split('\n')[0]?.substring(0, 60) || 'NOAA Alert'}`,
                summary: message.substring(0, 250) || 'NOAA Space Weather Prediction Center alert.',
                date: formatDate(alert.issue_datetime || new Date().toISOString()),
                source: 'NOAA SWPC',
                sourceIcon: 'warning-outline',
                url: 'https://www.swpc.noaa.gov/products/alerts-watches-and-warnings',
                category,
                severity,
            };
        });
    } catch (error) {
        console.error('NOAA alerts fetch error:', error);
        return [];
    }
};

// Fetch solar imagery updates (SDO)
export const fetchSDOUpdates = async (): Promise<SpaceBlog[]> => {
    // SDO provides continuous solar imagery - we create featured content
    const sdoChannels = [
        { id: 'aia_193', name: 'AIA 193Å', desc: 'Corona and hot flare plasma' },
        { id: 'aia_304', name: 'AIA 304Å', desc: 'Chromosphere and transition region' },
        { id: 'aia_171', name: 'AIA 171Å', desc: 'Quiet corona and coronal loops' },
        { id: 'hmi_mag', name: 'HMI Magnetogram', desc: 'Photospheric magnetic field' },
    ];

    return sdoChannels.map((channel, index) => ({
        id: `sdo-${index}-${Date.now()}`,
        title: `SDO ${channel.name} Update`,
        summary: `Latest ${channel.name} imagery from Solar Dynamics Observatory. ${channel.desc}. SDO captures high-resolution images of the Sun every 12 seconds.`,
        date: formatDate(new Date().toISOString()),
        source: 'NASA SDO',
        sourceIcon: 'aperture-outline',
        url: 'https://sdo.gsfc.nasa.gov/data/',
        category: 'research' as const,
        imageUrl: `https://sdo.gsfc.nasa.gov/assets/img/latest/latest_256_${channel.id === 'hmi_mag' ? 'HMIB' : channel.id.toUpperCase()}.jpg`,
    }));
};

// Get ISRO/Aditya-L1 news (featured content)
export const getAdityaL1News = (): SpaceBlog[] => {
    return [
        {
            id: 'aditya-1',
            title: 'Aditya-L1: India at L1 Lagrange Point',
            summary: 'ISRO\'s Aditya-L1 solar observatory continues observations from the L1 point, 1.5 million km from Earth. VELC coronagraph capturing CME dynamics, SUIT imaging chromosphere.',
            date: 'Active Mission',
            source: 'ISRO',
            sourceIcon: 'rocket-outline',
            url: 'https://www.isro.gov.in/Aditya_L1.html',
            category: 'mission' as const,
        },
        {
            id: 'aditya-2',
            title: 'SWIS: Solar Wind Ion Spectrometer',
            summary: 'Latest SWIS data shows solar wind composition and energy distribution. Critical for understanding CME propagation and plasma diagnostics.',
            date: 'Continuous',
            source: 'Aditya-L1',
            sourceIcon: 'pulse-outline',
            url: 'https://www.isro.gov.in/Aditya_L1.html',
            category: 'research' as const,
        },
    ];
};

// Get ML prediction as news item
export const getMLPredictionNews = (probability: number, alertLevel: string): SpaceBlog => {
    const severity = alertLevel === 'EXTREME' ? 'extreme' : alertLevel === 'HIGH' ? 'high' : alertLevel === 'MODERATE' ? 'moderate' : 'low';

    return {
        id: `ml-pred-${Date.now()}`,
        title: `ML Model: ${probability.toFixed(1)}% CME Probability`,
        summary: `Our Bi-LSTM + Transformer ensemble model (2.17M parameters) is currently predicting ${alertLevel} CME probability based on real-time DSCOVR solar wind data.`,
        date: formatDate(new Date().toISOString()),
        source: 'OrbitBharat ML',
        sourceIcon: 'hardware-chip-outline',
        url: '#prediction',
        category: 'prediction' as const,
        severity,
    };
};

// Get all real-time space news combined
export const getAllSpaceNews = async (): Promise<SpaceBlog[]> => {
    const results = await Promise.allSettled([
        fetchCMENews(),
        fetchFlareNews(),
        fetchStormNews(),
        fetchNOAAAlerts(),
        fetchSDOUpdates(),
    ]);

    const [cmes, flares, storms, alerts, sdo] = results.map(r =>
        r.status === 'fulfilled' ? r.value : []
    );

    // Add static content
    const aditya = getAdityaL1News();
    const mlPrediction = getMLPredictionNews(35.7, 'MODERATE'); // Demo prediction

    // Combine all sources
    const allNews = [
        mlPrediction,  // ML prediction first
        ...alerts.filter(a => a.severity === 'extreme' || a.severity === 'high'),  // High priority alerts
        ...cmes.slice(0, 3),
        ...flares.slice(0, 3),
        ...storms.slice(0, 2),
        ...aditya,
        ...sdo.slice(0, 2),
        ...alerts.filter(a => a.severity !== 'extreme' && a.severity !== 'high'),
    ];

    return allNews;
};

// Get current date/time for display
export const getCurrentDateTime = (): string => {
    return new Date().toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    });
};

// Get news by category
export const getNewsByCategory = async (category: SpaceBlog['category']): Promise<SpaceBlog[]> => {
    const allNews = await getAllSpaceNews();
    return allNews.filter(n => n.category === category);
};
