/**
 * Weather and Air Quality API Service
 * Real-time weather forecast and AQI monitoring
 * APIs: OpenWeatherMap + AQICN (World Air Quality Index)
 */

import { fetchWithTimeout } from './fetchWithTimeout';

const OPENWEATHER_API_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY || '';
const AQICN_API_KEY = process.env.EXPO_PUBLIC_AQICN_API_KEY || '';

if (!OPENWEATHER_API_KEY) console.warn('EXPO_PUBLIC_OPENWEATHER_API_KEY is not set');
if (!AQICN_API_KEY) console.warn('EXPO_PUBLIC_AQICN_API_KEY is not set');

const OPENWEATHER_BASE = 'https://api.openweathermap.org/data/2.5';
const AQICN_BASE = 'https://api.waqi.info';

// Indian major cities for monitoring
export const INDIAN_CITIES = [
    { name: 'Delhi', lat: 28.6139, lon: 77.2090 },
    { name: 'Mumbai', lat: 19.0760, lon: 72.8777 },
    { name: 'Bangalore', lat: 12.9716, lon: 77.5946 },
    { name: 'Chennai', lat: 13.0827, lon: 80.2707 },
    { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
    { name: 'Hyderabad', lat: 17.3850, lon: 78.4867 },
    { name: 'Pune', lat: 18.5204, lon: 73.8567 },
    { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714 },
];

// Interfaces
export interface WeatherData {
    city: string;
    country: string;
    temp: number;
    feelsLike: number;
    tempMin: number;
    tempMax: number;
    humidity: number;
    pressure: number;
    windSpeed: number;
    windDeg: number;
    clouds: number;
    visibility: number;
    description: string;
    icon: string;
    sunrise: number;
    sunset: number;
    timestamp: number;
}

export interface ForecastData {
    dt: number;
    temp: number;
    tempMin: number;
    tempMax: number;
    humidity: number;
    description: string;
    icon: string;
    windSpeed: number;
    pop: number; // Probability of precipitation
}

export interface AQIData {
    city: string;
    aqi: number;
    level: 'Good' | 'Moderate' | 'Unhealthy for Sensitive' | 'Unhealthy' | 'Very Unhealthy' | 'Hazardous';
    dominantPollutant: string;
    pm25: number;
    pm10: number;
    o3: number;
    no2: number;
    so2: number;
    co: number;
    timestamp: string;
    color: string;
}

export interface CombinedWeatherAQI {
    weather: WeatherData;
    forecast: ForecastData[];
    aqi: AQIData | null;
}

// Cache
const cache: { [key: string]: { data: any; timestamp: number } } = {};
const WEATHER_CACHE_DURATION = 600000; // 10 minutes
const AQI_CACHE_DURATION = 1800000; // 30 minutes

const getCached = <T>(key: string, duration: number): T | null => {
    const cached = cache[key];
    if (cached && Date.now() - cached.timestamp < duration) {
        return cached.data;
    }
    return null;
};

const setCache = (key: string, data: any) => {
    cache[key] = { data, timestamp: Date.now() };
};

/**
 * Get AQI level and color from index value
 */
export const getAQILevel = (aqi: number): { level: AQIData['level']; color: string } => {
    if (aqi <= 50) return { level: 'Good', color: '#10B981' };
    if (aqi <= 100) return { level: 'Moderate', color: '#F59E0B' };
    if (aqi <= 150) return { level: 'Unhealthy for Sensitive', color: '#F97316' };
    if (aqi <= 200) return { level: 'Unhealthy', color: '#EF4444' };
    if (aqi <= 300) return { level: 'Very Unhealthy', color: '#9333EA' };
    return { level: 'Hazardous', color: '#7F1D1D' };
};

/**
 * Get current weather for a location
 */
export const getCurrentWeather = async (
    lat: number,
    lon: number
): Promise<WeatherData | null> => {
    const cacheKey = `weather_${lat}_${lon}`;
    const cached = getCached<WeatherData>(cacheKey, WEATHER_CACHE_DURATION);
    if (cached) return cached;

    try {
        const url = `${OPENWEATHER_BASE}/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
        const response = await fetchWithTimeout(url);
        
        if (!response.ok) {
            throw new Error(`Weather API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        const weather: WeatherData = {
            city: data.name,
            country: data.sys.country,
            temp: Math.round(data.main.temp),
            feelsLike: Math.round(data.main.feels_like),
            tempMin: Math.round(data.main.temp_min),
            tempMax: Math.round(data.main.temp_max),
            humidity: data.main.humidity,
            pressure: data.main.pressure,
            windSpeed: data.wind.speed,
            windDeg: data.wind.deg || 0,
            clouds: data.clouds.all,
            visibility: data.visibility / 1000, // Convert to km
            description: data.weather[0].description,
            icon: data.weather[0].icon,
            sunrise: data.sys.sunrise * 1000,
            sunset: data.sys.sunset * 1000,
            timestamp: Date.now(),
        };
        
        setCache(cacheKey, weather);
        return weather;
    } catch (error) {
        console.warn('Weather fetch failed:', error);
        return null;
    }
};

/**
 * Get 5-day forecast
 */
export const getWeatherForecast = async (
    lat: number,
    lon: number
): Promise<ForecastData[]> => {
    const cacheKey = `forecast_${lat}_${lon}`;
    const cached = getCached<ForecastData[]>(cacheKey, WEATHER_CACHE_DURATION);
    if (cached) return cached;

    try {
        const url = `${OPENWEATHER_BASE}/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
        const response = await fetchWithTimeout(url);
        
        if (!response.ok) {
            throw new Error(`Forecast API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Get one entry per day (noon)
        const dailyForecasts: ForecastData[] = [];
        const processedDates = new Set<string>();
        
        for (const item of data.list) {
            const date = new Date(item.dt * 1000).toDateString();
            if (!processedDates.has(date) && dailyForecasts.length < 5) {
                processedDates.add(date);
                dailyForecasts.push({
                    dt: item.dt * 1000,
                    temp: Math.round(item.main.temp),
                    tempMin: Math.round(item.main.temp_min),
                    tempMax: Math.round(item.main.temp_max),
                    humidity: item.main.humidity,
                    description: item.weather[0].description,
                    icon: item.weather[0].icon,
                    windSpeed: item.wind.speed,
                    pop: Math.round((item.pop || 0) * 100),
                });
            }
        }
        
        setCache(cacheKey, dailyForecasts);
        return dailyForecasts;
    } catch (error) {
        console.warn('Forecast fetch failed:', error);
        return [];
    }
};

/**
 * Get AQI data from AQICN
 */
export const getAQI = async (
    lat: number,
    lon: number
): Promise<AQIData | null> => {
    const cacheKey = `aqi_${lat}_${lon}`;
    const cached = getCached<AQIData>(cacheKey, AQI_CACHE_DURATION);
    if (cached) return cached;

    try {
        const url = `${AQICN_BASE}/feed/geo:${lat};${lon}/?token=${AQICN_API_KEY}`;
        const response = await fetchWithTimeout(url);
        
        if (!response.ok) {
            throw new Error(`AQI API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status !== 'ok' || !data.data) {
            return null;
        }
        
        const aqiValue = data.data.aqi;
        const { level, color } = getAQILevel(aqiValue);
        const iaqi = data.data.iaqi || {};
        
        const aqi: AQIData = {
            city: data.data.city?.name || 'Unknown',
            aqi: aqiValue,
            level,
            dominantPollutant: data.data.dominentpol || 'pm25',
            pm25: iaqi.pm25?.v || 0,
            pm10: iaqi.pm10?.v || 0,
            o3: iaqi.o3?.v || 0,
            no2: iaqi.no2?.v || 0,
            so2: iaqi.so2?.v || 0,
            co: iaqi.co?.v || 0,
            timestamp: data.data.time?.iso || new Date().toISOString(),
            color,
        };
        
        setCache(cacheKey, aqi);
        return aqi;
    } catch (error) {
        console.warn('AQI fetch failed:', error);
        return null;
    }
};

/**
 * Get AQI by city name
 */
export const getAQIByCity = async (city: string): Promise<AQIData | null> => {
    const cacheKey = `aqi_city_${city}`;
    const cached = getCached<AQIData>(cacheKey, AQI_CACHE_DURATION);
    if (cached) return cached;

    try {
        const url = `${AQICN_BASE}/feed/${city}/?token=${AQICN_API_KEY}`;
        const response = await fetchWithTimeout(url);
        
        if (!response.ok) {
            throw new Error(`AQI city API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status !== 'ok' || !data.data) {
            return null;
        }
        
        const aqiValue = data.data.aqi;
        const { level, color } = getAQILevel(aqiValue);
        const iaqi = data.data.iaqi || {};
        
        const aqi: AQIData = {
            city: data.data.city?.name || city,
            aqi: aqiValue,
            level,
            dominantPollutant: data.data.dominentpol || 'pm25',
            pm25: iaqi.pm25?.v || 0,
            pm10: iaqi.pm10?.v || 0,
            o3: iaqi.o3?.v || 0,
            no2: iaqi.no2?.v || 0,
            so2: iaqi.so2?.v || 0,
            co: iaqi.co?.v || 0,
            timestamp: data.data.time?.iso || new Date().toISOString(),
            color,
        };
        
        setCache(cacheKey, aqi);
        return aqi;
    } catch (error) {
        console.warn('AQI city fetch failed:', error);
        return null;
    }
};

/**
 * Get combined weather and AQI data
 */
export const getWeatherAndAQI = async (
    lat: number,
    lon: number
): Promise<CombinedWeatherAQI | null> => {
    const [weather, forecast, aqi] = await Promise.all([
        getCurrentWeather(lat, lon),
        getWeatherForecast(lat, lon),
        getAQI(lat, lon),
    ]);
    
    if (!weather) return null;
    
    return {
        weather,
        forecast,
        aqi,
    };
};

/**
 * Get AQI for all major Indian cities
 */
export const getIndianCitiesAQI = async (): Promise<AQIData[]> => {
    const cityNames = ['delhi', 'mumbai', 'bangalore', 'chennai', 'kolkata', 'hyderabad', 'pune', 'ahmedabad'];
    
    const results = await Promise.allSettled(
        cityNames.map(city => getAQIByCity(city))
    );
    
    return results
        .filter((r): r is PromiseFulfilledResult<AQIData> => 
            r.status === 'fulfilled' && r.value !== null
        )
        .map(r => r.value);
};

/**
 * Get weather icon URL
 */
export const getWeatherIconUrl = (icon: string): string => {
    return `https://openweathermap.org/img/wn/${icon}@2x.png`;
};

/**
 * Get wind direction from degrees
 */
export const getWindDirection = (deg: number): string => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(deg / 22.5) % 16;
    return directions[index];
};

/**
 * Format temperature
 */
export const formatTemp = (temp: number): string => {
    return `${temp}°C`;
};

/**
 * Get UV index level
 */
export const getUVLevel = (uvi: number): { level: string; color: string } => {
    if (uvi <= 2) return { level: 'Low', color: '#10B981' };
    if (uvi <= 5) return { level: 'Moderate', color: '#F59E0B' };
    if (uvi <= 7) return { level: 'High', color: '#F97316' };
    if (uvi <= 10) return { level: 'Very High', color: '#EF4444' };
    return { level: 'Extreme', color: '#9333EA' };
};
