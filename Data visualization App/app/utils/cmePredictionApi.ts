// CME Prediction API Client
// Connects React Native app to OrbitBharat ML backend
// Developer: Nitesh Agarwal (2026)

import { fetchWithTimeout } from './fetchWithTimeout';

// ─── Backend URL Configuration ───────────────────────────────
// Always prefer the deployed Render URL so APK builds work.
// The .env / EAS env var can override for dev or staging.
const DEPLOYED_URL = 'https://orbitbharat-api.onrender.com';

// __DEV__ is true inside Metro (expo start) and false in APK builds.
// In dev, honour the env var so you can point at a local server;
// in production APK, always use the deployed URL.
const API_BASE_URL: string = (() => {
    // @ts-ignore – __DEV__ is a React-Native global
    const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
    const envUrl = process.env.EXPO_PUBLIC_CME_API_URL;
    if (isDev && envUrl) return envUrl;   // local dev override
    return DEPLOYED_URL;
})();

export interface CMEPrediction {
    cme_probability: number;
    arrival_time_hours: number;
    arrival_time_eta: string;
    confidence: number;
    alert_level: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
}

export interface SpaceConditions {
    timestamp: string;
    solar_wind: {
        speed_km_s: number | null;
        density_p_cm3: number | null;
        speed_category: 'Low' | 'Moderate' | 'High';
    };
    magnetic_field: {
        bz_nT: number | null;
        bz_direction: string;
    };
    storm_potential: 'Low' | 'Moderate' | 'High';
}

export interface ModelInfo {
    name: string;
    architecture: {
        branch_1: string;
        branch_2: string;
        fusion: string;
        output_heads: string[];
    };
    input: {
        features: string[];
        window: string;
        resolution: string;
    };
    data_source: string;
    developer: string;
    version: string;
}

export interface AccuracyMetrics {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
    auc_roc: number;
    validation_period: string;
    total_events_tested: number;
    donki_cme_events?: number;
    true_positives?: number;
    false_positives?: number;
    true_negatives?: number;
    false_negatives?: number;
    computed_at?: string;
    note?: string;
}

export interface FeatureImportance {
    features: string[];
    importance: number[];
    top_features: [string, number][];
}

class CMEPredictionAPI {
    private baseUrl: string;

    constructor(baseUrl: string = API_BASE_URL) {
        this.baseUrl = baseUrl;
    }

    private async fetch<T>(endpoint: string): Promise<T> {
        try {
            const response = await fetchWithTimeout(`${this.baseUrl}${endpoint}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            return response.json();
        } catch (error) {
            // Silently fail when ML backend is offline - app uses mock data fallback
            throw error;
        }
    }

    /**
     * Get real-time CME prediction from ML model
     */
    async getPrediction(): Promise<{
        status: string;
        timestamp: string;
        prediction: CMEPrediction;
        current_conditions: SpaceConditions;
    }> {
        return this.fetch('/api/predict');
    }

    /**
     * Get current space weather conditions
     */
    async getConditions(): Promise<SpaceConditions> {
        return this.fetch('/api/conditions');
    }

    /**
     * Get forecast for next N hours
     */
    async getForecast(hours: number = 24): Promise<{
        forecast_period_hours: number;
        cme_probability: number;
        arrival_time_hours: number;
        alert_level: string;
        confidence: number;
    }> {
        return this.fetch(`/api/forecast/${hours}`);
    }

    /**
     * Get model accuracy metrics
     */
    async getAccuracy(): Promise<AccuracyMetrics> {
        return this.fetch('/api/accuracy');
    }

    /**
     * Get feature importance for explainability
     */
    async getFeatureImportance(): Promise<FeatureImportance> {
        return this.fetch('/api/feature-importance');
    }

    /**
     * Get model architecture information
     */
    async getModelInfo(): Promise<ModelInfo> {
        return this.fetch('/api/model-info');
    }

    /**
     * Get real-time solar wind data
     */
    async getRealtimeData(): Promise<{
        data_source: string;
        total_points: number;
        timestamps: string[];
        values: {
            speed: number[];
            density: number[];
            bz: number[];
            bt: number[];
        };
    }> {
        return this.fetch('/api/data/realtime');
    }

    /**
     * Check if API server is healthy
     */
    async healthCheck(): Promise<boolean> {
        // Render free-tier cold-starts can take 30+ seconds.
        // Try twice: first with a generous 30 s timeout, then a quick retry.
        const attempt = async (timeoutMs: number): Promise<boolean> => {
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), timeoutMs);
                const response = await fetch(`${this.baseUrl}/`, {
                    method: 'GET',
                    signal: controller.signal,
                });
                clearTimeout(timer);
                if (response.ok) {
                    const data = await response.json();
                    console.log('[CME API] Health check OK:', data);
                    return data.status === 'healthy';
                }
                return false;
            } catch {
                return false;
            }
        };

        console.log('[CME API] Health check to:', this.baseUrl);
        // 1st attempt – long timeout covers Render cold-start
        if (await attempt(30_000)) return true;
        // 2nd attempt – server may have just woken up
        return attempt(10_000);
    }
}

// Singleton instance
export const cmeApi = new CMEPredictionAPI();

// For testing when API is not available, return mock data
export const getMockPrediction = () => ({
    status: 'success',
    timestamp: new Date().toISOString(),
    prediction: {
        cme_probability: 35.7,
        arrival_time_hours: 48.2,
        arrival_time_eta: '2.0 days',
        confidence: 82.3,
        alert_level: 'MODERATE' as const,
    },
    current_conditions: {
        timestamp: new Date().toISOString(),
        solar_wind: {
            speed_km_s: 425,
            density_p_cm3: 4.2,
            speed_category: 'Moderate' as const,
        },
        magnetic_field: {
            bz_nT: -2.3,
            bz_direction: 'Neutral',
        },
        storm_potential: 'Low' as const,
    },
});

export const getMockModelInfo = (): ModelInfo => ({
    name: 'CME Ensemble Model',
    architecture: {
        branch_1: 'Bidirectional LSTM with Multi-Head Attention (3 layers)',
        branch_2: 'Transformer Encoder (4 layers, 8 heads)',
        fusion: 'Concatenation + Dense layers',
        output_heads: ['CME Probability', 'Arrival Time', 'Confidence'],
    },
    input: {
        features: ['Solar Wind Speed', 'Proton Density', 'Temperature', 'IMF Bz', 'IMF Bt', 'Plasma Beta'],
        window: '60 minutes',
        resolution: '1 minute',
    },
    data_source: 'DSCOVR Satellite at L1 (NOAA SWPC)',
    developer: 'Nitesh Agarwal',
    version: '2.0.0',
});
