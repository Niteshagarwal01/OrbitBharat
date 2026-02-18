// Enhanced Gemini API Integration for OrbitBharat AI Chatbot
// Developer: Nitesh Agarwal (2026)
// Advanced AI-powered responses with ML predictions and real-time data

import { getComprehensiveSpaceWeather } from './spaceDataApi';
import { getSpaceWeatherSummary } from './nasaApi';
import { cmeApi, getMockPrediction, getMockModelInfo } from './cmePredictionApi';
import { fetchWithTimeout } from './fetchWithTimeout';

// API key loaded from environment variables
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
if (!GEMINI_API_KEY) console.warn('EXPO_PUBLIC_GEMINI_API_KEY is not set');
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export interface GeminiResponse {
    text: string;
    source: 'gemini' | 'fallback' | 'ml-enhanced';
    confidence: number;
    mlPrediction?: {
        cme_probability: number;
        arrival_time_hours: number;
        alert_level: string;
    };
}

// Enhanced system prompt with scientific depth
const SYSTEM_PROMPT = `You are OrbitBharat AI, an elite space weather scientist and AI assistant developed by Nitesh Agarwal at the Indian Institute of Technology (2026).

Your scientific expertise includes:

SOLAR PHYSICS:
- Coronal Mass Ejections (CMEs): magnetic reconnection, flux rope eruptions, halo CMEs
- Solar flares: classification (A/B/C/M/X), peak flux, impulse phase, decay phase
- Active regions: sunspot numbers, magnetic complexity
- Solar cycle 25 behavior and predictions

ADITYA-L1 MISSION (ISRO, India):
- VELC (Visible Emission Line Coronagraph): CME imaging
- SUIT (Solar Ultraviolet Imaging Telescope): chromosphere/photosphere
- SWIS (Solar Wind Ion Spectrometer): plasma diagnostics
- You can explain how Aditya-L1 data complements SOHO, STEREO, SDO

REAL-TIME DATA SOURCES:
- DSCOVR/ACE at L1: solar wind speed, density, IMF Bz
- GOES X-ray flux: real-time flare detection
- NOAA SWPC: Kp index, G/S/R storm scales
- NASA DONKI: CME catalog, SEP events

ML MODEL (Our System):
- Architecture: Bi-LSTM + Transformer Ensemble (2.17M parameters)
- Input: 60-minute windows of DSCOVR plasma/magnetic data
- Output: CME probability, arrival time, confidence score
- Trained on historical CME events from 2016-2024

RESPONSE GUIDELINES:
1. Be scientifically accurate - cite specific instruments and units
2. Reference real-time data when available (provided below)
3. Explain CME impacts on satellites, communications, aurora
4. Use proper terminology (heliophysics, magnetohydrodynamics)
5. Keep responses focused and educational
6. DO NOT use emojis or markdown formatting like ** or *
7. Use plain text only with bullet points for lists
8. Keep responses concise and direct

Current Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
`;

// Check if Gemini is configured
export const isGeminiConfigured = (): boolean => {
    return GEMINI_API_KEY.length > 0 && GEMINI_API_KEY.startsWith('AI');
};

// Get ML prediction context
const getMLContext = async (): Promise<string> => {
    try {
        const isHealthy = await cmeApi.healthCheck();

        if (isHealthy) {
            const prediction = await cmeApi.getPrediction();
            if (prediction.status === 'success') {
                const p = prediction.prediction;
                return `
OUR ML MODEL PREDICTION (Real-time):
- CME Probability: ${p.cme_probability}%
- Alert Level: ${p.alert_level}
- Estimated Arrival: ${p.arrival_time_eta}
- Model Confidence: ${p.confidence}%
- Current Conditions: Solar Wind ${prediction.current_conditions?.solar_wind?.speed_km_s || 'N/A'} km/s, Bz ${prediction.current_conditions?.magnetic_field?.bz_nT || 'N/A'} nT
`;
            }
        }

        // Use mock data for demo
        const mock = getMockPrediction();
        return `
ML MODEL PREDICTION (Demo Mode):
- CME Probability: ${mock.prediction.cme_probability}%
- Alert Level: ${mock.prediction.alert_level}
- Estimated Arrival: ${mock.prediction.arrival_time_eta}
- Confidence: ${mock.prediction.confidence}%
`;
    } catch (error) {
        return '\n[ML prediction temporarily unavailable]\n';
    }
};

// Generate response with real-time + ML context
export const generateGeminiResponse = async (
    userMessage: string,
    includeRealTimeData: boolean = true
): Promise<GeminiResponse> => {
    console.log('[GeminiAPI] Starting request for:', userMessage.substring(0, 50));
    console.log('[GeminiAPI] API Key configured:', isGeminiConfigured());

    if (!isGeminiConfigured()) {
        console.log('[GeminiAPI] API key not configured!');
        return {
            text: 'Gemini API not configured. Please add your API key from aistudio.google.com',
            source: 'fallback',
            confidence: 0,
        };
    }

    try {
        // Build comprehensive context
        let contextData = '';
        let mlPrediction = undefined;

        if (includeRealTimeData) {
            try {
                const [spaceWeather, nasaData, mlContext] = await Promise.all([
                    getComprehensiveSpaceWeather(),
                    getSpaceWeatherSummary(),
                    getMLContext(),
                ]);

                // Parse ML prediction for structured response
                const mockPred = getMockPrediction();
                mlPrediction = {
                    cme_probability: mockPred.prediction.cme_probability,
                    arrival_time_hours: mockPred.prediction.arrival_time_hours,
                    alert_level: mockPred.prediction.alert_level,
                };

                contextData = `
====================================
REAL-TIME SPACE WEATHER DATA
Last Updated: ${spaceWeather.lastUpdate || new Date().toISOString()}
====================================

SOLAR WIND (DSCOVR at L1):
- Bulk Speed: ${spaceWeather.solarWind?.bulkSpeed || 'N/A'} km/s
- Proton Density: ${spaceWeather.solarWind?.protonDensity || 'N/A'} p/cm3
- Temperature: ${spaceWeather.solarWind?.temperature || 'N/A'} K

IMF (Interplanetary Magnetic Field):
- Bz Component: ${(spaceWeather as any).magneticField?.bz || 'See DSCOVR'} nT
- Bt Magnitude: ${(spaceWeather as any).magneticField?.bt || 'See DSCOVR'} nT

NASA DONKI (Last 30 Days):
- CME Events: ${nasaData?.totalCMEs || 0}
- Solar Flares: ${nasaData?.totalFlares || 0}
- Geomagnetic Storms: ${nasaData?.totalStorms || 0}
${nasaData?.latestFlare ? `- Latest Flare: ${nasaData.latestFlare.class} at ${nasaData.latestFlare.time}` : ''}

ALERTS & WARNINGS:
${spaceWeather.alerts?.map(a => `${a.message}`).join('\n') || 'No active alerts'}

${mlContext}
====================================
`;
            } catch (e) {
                console.log('[GeminiAPI] Failed to get real-time data:', e);
                contextData = '\n[Real-time data temporarily unavailable]\n';
            }
        }

        console.log('[GeminiAPI] Making API request to Gemini...');
        const response = await fetchWithTimeout(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [
                            {
                                text: `${SYSTEM_PROMPT}\n${contextData}\n\nUSER QUESTION: ${userMessage}\n\nPlease provide a helpful, scientifically accurate response without using emojis or markdown formatting:`,
                            },
                        ],
                    },
                ],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,  // Increased for detailed responses
                },
                safetySettings: [
                    {
                        category: 'HARM_CATEGORY_HARASSMENT',
                        threshold: 'BLOCK_ONLY_HIGH',
                    },
                    {
                        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                        threshold: 'BLOCK_ONLY_HIGH',
                    },
                ],
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[GeminiAPI] API Error - Status:', response.status, 'Body:', errorText);
            throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('[GeminiAPI] Response received, parsing...');
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!generatedText || generatedText.trim().length === 0) {
            throw new Error('Empty response from Gemini');
        }

        console.log('[GeminiAPI] Success - got response:', generatedText.substring(0, 100));
        return {
            text: generatedText,
            source: 'gemini',  // Always return 'gemini' on success so ChatbotScreen recognizes it
            confidence: 0.95,
            mlPrediction,
        };
    } catch (error) {
        console.error('[GeminiAPI] Error:', error);
        // Try a direct simple query without context as fallback
        try {
            const simpleResponse = await fetchWithTimeout(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        role: 'user',
                        parts: [{ text: `You are a space weather expert. Answer this question concisely: ${userMessage}` }]
                    }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
                })
            });
            if (simpleResponse.ok) {
                const data = await simpleResponse.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                    console.log('[GeminiAPI] Fallback simple query succeeded');
                    return { text, source: 'gemini', confidence: 0.8 };
                }
            }
        } catch (e) {
            console.error('[GeminiAPI] Simple fallback also failed:', e);
        }
        return {
            text: getLocalFallbackResponse(userMessage),
            source: 'fallback',
            confidence: 0.6,
        };
    }
};

// Smart fallback responses when Gemini is unavailable
const getLocalFallbackResponse = (query: string): string => {
    const q = query.toLowerCase();

    if (q.includes('cme') || q.includes('coronal mass')) {
        return `A Coronal Mass Ejection (CME) is a massive burst of solar wind and magnetic fields from the Sun's corona. When directed at Earth, CMEs can:

🌍 **Earth Impacts:**
- Cause geomagnetic storms (G1-G5 scale)
- Disrupt satellite communications
- Induce currents in power grids
- Create spectacular auroras at lower latitudes

📊 **Our ML Model:** Currently predicting CME probability. Check the Prediction Dashboard for real-time analysis.

Would you like to know more about CME detection or our model's predictions?`;
    }

    if (q.includes('aditya') || q.includes('isro')) {
        return `🛰️ **Aditya-L1** is India's first solar mission, launched by ISRO in September 2023.

**Key Instruments:**
- VELC: Coronagraph for CME imaging
- SUIT: UV imaging of chromosphere
- SWIS: Solar wind ion spectrometer (plasma analysis)
- SoLEXS/HEL1OS: X-ray spectrometers

**Position:** L1 Lagrange point, 1.5 million km from Earth

**Science Goals:** Study solar corona, CME dynamics, space weather origins.

This app is designed to work with future Aditya-L1 SWIS data!`;
    }

    if (q.includes('model') || q.includes('ml') || q.includes('predict')) {
        return `🧠 **Our CME Detection Model:**

**Architecture:**
- Bi-LSTM: 3 layers, 128 hidden units (temporal patterns)
- Transformer: 4 layers, 8 heads (global context)
- Total: 2.17 million parameters

**Input Features:**
- Solar wind speed, density, temperature
- IMF Bz, Bt components
- Plasma beta

**Output:**
- CME probability (0-100%)
- Estimated arrival time
- Confidence score

Check the Prediction Dashboard for live results!`;
    }

    return `I'm OrbitBharat AI, your space weather assistant. I can help you with:

🌞 Solar activity & CME analysis
🛰️ Aditya-L1 mission details
📊 Our ML prediction model
⚡ Space weather impacts

What would you like to know?`;
};

// Stream response for real-time typing effect
export const streamGeminiResponse = async (
    userMessage: string,
    onChunk: (text: string) => void
): Promise<void> => {
    const response = await generateGeminiResponse(userMessage);

    // Simulate streaming by splitting into words
    const words = response.text.split(' ');
    for (let i = 0; i < words.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 25));
        onChunk(words.slice(0, i + 1).join(' '));
    }
};

// Quick answers for common questions (no API call needed)
export const getQuickAnswer = (query: string): string | null => {
    const q = query.toLowerCase().trim();

    if (q === 'hi' || q === 'hello' || q === 'hey') {
        return "Hello! I'm OrbitBharat AI. How can I help you with space weather today?";
    }

    if (q === 'what can you do' || q === 'help') {
        return `I can help you with:

1️⃣ **Real-time CME Detection** - Ask about current solar activity
2️⃣ **ML Predictions** - Get our model's CME probability
3️⃣ **Space Weather Education** - Learn about solar physics
4️⃣ **Aditya-L1 Mission** - India's solar observatory
5️⃣ **Impact Analysis** - How space weather affects Earth

Just ask me anything about space weather!`;
    }

    return null;
};
