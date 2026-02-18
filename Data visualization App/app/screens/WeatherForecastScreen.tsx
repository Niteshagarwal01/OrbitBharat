/**
 * Weather & AQI Forecast Screen - Premium Design System
 * Real-time weather + Air Quality | Matches Landing glassmorphism palette
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ChevronLeft,
    Cloud,
    Droplets,
    Wind,
    Sun,
    CloudRain,
    CloudSnow,
    CloudLightning,
    Eye,
    Gauge,
    MapPin,
    RefreshCw,
    AlertTriangle,
    Leaf,
    ChevronDown,
    Sunrise,
    Sunset,
    CloudFog,
    Cloudy,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { APP_CONFIG } from '../utils/constants';
import ParticleBackground from '../components/ParticleBackground';
import {
    getCurrentWeather,
    getWeatherForecast,
    getAQI,
    getIndianCitiesAQI,
    WeatherData,
    ForecastData,
    AQIData,
    getAQILevel,
    getWindDirection,
    INDIAN_CITIES,
} from '../utils/weatherAqiApi';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 72) / 2;

const WeatherForecastScreen: React.FC = () => {
    const navigation = useNavigation();
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedCity, setSelectedCity] = useState(INDIAN_CITIES[0]);
    const [showCityPicker, setShowCityPicker] = useState(false);
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [forecast, setForecast] = useState<ForecastData[]>([]);
    const [aqi, setAqi] = useState<AQIData | null>(null);
    const [citiesAQI, setCitiesAQI] = useState<AQIData[]>([]);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setError(null);
            const [weatherData, forecastData, aqiData] = await Promise.all([
                getCurrentWeather(selectedCity.lat, selectedCity.lon),
                getWeatherForecast(selectedCity.lat, selectedCity.lon),
                getAQI(selectedCity.lat, selectedCity.lon),
            ]);
            setWeather(weatherData);
            setForecast(forecastData);
            setAqi(aqiData);
            const allCitiesAQI = await getIndianCitiesAQI();
            setCitiesAQI(allCitiesAQI);
        } catch (err) {
            setError('Failed to fetch weather data. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [selectedCity]);

    useEffect(() => {
        setLoading(true);
        fetchData();
    }, [fetchData]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    }, [fetchData]);

    // --- helpers ---
    const getWeatherIcon = (condition: string | undefined, size: number = 32) => {
        if (!condition) return <Cloud size={size} color="#fff" />;
        const c = condition.toLowerCase();
        if (c.includes('rain') || c.includes('drizzle')) return <CloudRain size={size} color={APP_CONFIG.colors.accent} />;
        if (c.includes('snow')) return <CloudSnow size={size} color="#E0F2FE" />;
        if (c.includes('thunder') || c.includes('storm')) return <CloudLightning size={size} color={APP_CONFIG.colors.warning} />;
        if (c.includes('clear') || c.includes('sun')) return <Sun size={size} color="#FCD34D" />;
        if (c.includes('mist') || c.includes('fog') || c.includes('haze')) return <CloudFog size={size} color={APP_CONFIG.colors.muted} />;
        if (c.includes('cloud')) return <Cloudy size={size} color={APP_CONFIG.colors.silver} />;
        return <Cloud size={size} color={APP_CONFIG.colors.muted} />;
    };

    const getAQIColor = (aqiVal: number) => {
        if (aqiVal <= 50) return APP_CONFIG.colors.success;
        if (aqiVal <= 100) return APP_CONFIG.colors.warning;
        if (aqiVal <= 150) return '#F97316';
        if (aqiVal <= 200) return APP_CONFIG.colors.error;
        if (aqiVal <= 300) return '#A855F7';
        return '#7C2D12';
    };

    const getAQIGradient = (aqiVal: number): [string, string] => {
        if (aqiVal <= 50) return [APP_CONFIG.colors.success, '#059669'];
        if (aqiVal <= 100) return [APP_CONFIG.colors.warning, '#D97706'];
        if (aqiVal <= 150) return ['#F97316', '#EA580C'];
        if (aqiVal <= 200) return [APP_CONFIG.colors.error, '#DC2626'];
        if (aqiVal <= 300) return ['#A855F7', '#9333EA'];
        return ['#7C2D12', '#450a0a'];
    };

    const getAQILabel = (aqiVal: number) => {
        if (aqiVal <= 50) return 'Good';
        if (aqiVal <= 100) return 'Moderate';
        if (aqiVal <= 150) return 'Sensitive';
        if (aqiVal <= 200) return 'Unhealthy';
        if (aqiVal <= 300) return 'Very Bad';
        return 'Hazardous';
    };

    const formatTime = (timestamp: number) =>
        new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // --- render ---
    return (
        <ParticleBackground>
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" />

                {/* Loading */}
                {loading ? (
                    <View style={styles.centerWrap}>
                        <ActivityIndicator size="large" color={APP_CONFIG.colors.accent} />
                        <Text style={styles.loadingText}>Fetching weather data...</Text>
                    </View>
                ) : error ? (
                    <View style={styles.centerWrap}>
                        <AlertTriangle size={56} color={APP_CONFIG.colors.warning} />
                        <Text style={styles.errorTitle}>Connection Error</Text>
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity onPress={onRefresh} style={styles.retryWrap}>
                            <LinearGradient
                                colors={APP_CONFIG.colors.gradient.primary as [string, string]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.retryGradient}
                            >
                                <Text style={styles.retryText}>Try Again</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={APP_CONFIG.colors.accent} />
                        }
                    >
                        {/* ===== Header ===== */}
                        <BlurView intensity={30} tint="dark" style={styles.header}>
                            <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
                                <ChevronLeft size={22} color="#fff" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.cityButton}
                                onPress={() => setShowCityPicker(!showCityPicker)}
                            >
                                <MapPin size={14} color={APP_CONFIG.colors.accent} />
                                <Text style={styles.cityText}>{selectedCity.name}</Text>
                                <ChevronDown size={14} color={APP_CONFIG.colors.text.tertiary} />
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.headerBtn} onPress={onRefresh}>
                                <RefreshCw size={17} color={APP_CONFIG.colors.accent} />
                            </TouchableOpacity>
                        </BlurView>

                        {/* City Picker Dropdown */}
                        {showCityPicker && (
                            <View style={styles.dropdown}>
                                <BlurView intensity={40} tint="dark" style={styles.dropdownBlur}>
                                    {INDIAN_CITIES.map((city) => {
                                        const active = selectedCity.name === city.name;
                                        return (
                                            <TouchableOpacity
                                                key={city.name}
                                                style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                                                onPress={() => {
                                                    setSelectedCity(city);
                                                    setShowCityPicker(false);
                                                }}
                                            >
                                                <Text style={[styles.dropdownText, active && styles.dropdownTextActive]}>
                                                    {city.name}
                                                </Text>
                                                {active && <View style={styles.checkDot} />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </BlurView>
                            </View>
                        )}
                        {/* ===== Hero Weather ===== */}
                        {weather && (
                            <View style={styles.heroSection}>
                                <View style={styles.heroIcon}>{getWeatherIcon(weather.description, 80)}</View>
                                <Text style={styles.heroTemp}>{weather.temp}{'\u00B0'}</Text>
                                <Text style={styles.heroCondition}>{weather.description}</Text>
                                <View style={styles.heroMeta}>
                                    <Text style={styles.heroFeels}>Feels like {weather.feelsLike}{'\u00B0'}</Text>
                                    <View style={styles.heroDot} />
                                    <Text style={styles.heroHL}>H:{weather.tempMax}{'\u00B0'} L:{weather.tempMin}{'\u00B0'}</Text>
                                </View>
                            </View>
                        )}

                        {/* ===== Quick Stats ===== */}
                        {weather && (
                            <>
                                <Text style={styles.sectionHeader}>CONDITIONS</Text>
                                <View style={styles.statsGrid}>
                                    {[
                                        { icon: Droplets, label: 'Humidity', value: `${weather.humidity}%`, accent: APP_CONFIG.colors.accent },
                                        { icon: Wind, label: getWindDirection(weather.windDeg), value: `${weather.windSpeed} m/s`, accent: APP_CONFIG.colors.primary },
                                        { icon: Gauge, label: 'Pressure', value: `${weather.pressure} hPa`, accent: APP_CONFIG.colors.primaryLight },
                                        { icon: Eye, label: 'Visibility', value: `${weather.visibility.toFixed(1)} km`, accent: APP_CONFIG.colors.info },
                                    ].map((s, i) => (
                                        <View key={i} style={styles.statCardWrap}>
                                            <BlurView intensity={18} tint="dark" style={styles.statCard}>
                                                <LinearGradient
                                                    colors={[s.accent + '22', s.accent + '08'] as [string, string]}
                                                    style={styles.statIconWrap}
                                                >
                                                    <s.icon size={20} color={s.accent} />
                                                </LinearGradient>
                                                <Text style={styles.statValue}>{s.value}</Text>
                                                <Text style={styles.statLabel}>{s.label}</Text>
                                            </BlurView>
                                        </View>
                                    ))}
                                </View>
                            </>
                        )}

                        {/* ===== Sun Times ===== */}
                        {weather && (
                            <View style={styles.sunCardWrap}>
                                <BlurView intensity={18} tint="dark" style={styles.sunCard}>
                                    <View style={styles.sunItem}>
                                        <Sunrise size={26} color="#FCD34D" />
                                        <Text style={styles.sunTime}>{formatTime(weather.sunrise)}</Text>
                                        <Text style={styles.sunLabel}>Sunrise</Text>
                                    </View>
                                    <View style={styles.sunDivider} />
                                    <View style={styles.sunItem}>
                                        <Sunset size={26} color={APP_CONFIG.colors.warning} />
                                        <Text style={styles.sunTime}>{formatTime(weather.sunset)}</Text>
                                        <Text style={styles.sunLabel}>Sunset</Text>
                                    </View>
                                </BlurView>
                            </View>
                        )}

                        {/* ===== AQI ===== */}
                        {aqi && (
                            <>
                                <Text style={styles.sectionHeader}>AIR QUALITY</Text>
                                <View style={styles.aqiCardWrap}>
                                    <BlurView intensity={18} tint="dark" style={styles.aqiCard}>
                                        <View style={styles.aqiHeader}>
                                            <Leaf size={18} color={getAQIColor(aqi.aqi)} />
                                            <Text style={styles.aqiHeaderTitle}>Air Quality Index</Text>
                                        </View>

                                        <View style={styles.aqiMain}>
                                            <LinearGradient colors={getAQIGradient(aqi.aqi)} style={styles.aqiGauge}>
                                                <Text style={styles.aqiGaugeVal}>{aqi.aqi}</Text>
                                            </LinearGradient>
                                            <View style={styles.aqiDetails}>
                                                <Text style={[styles.aqiLevel, { color: getAQIColor(aqi.aqi) }]}>
                                                    {getAQILabel(aqi.aqi)}
                                                </Text>
                                                <Text style={styles.aqiCity}>{aqi.city || selectedCity.name}</Text>
                                                <Text style={styles.aqiDominant}>
                                                    Dominant: {aqi.dominantPollutant.toUpperCase()}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Pollutants */}
                                        <View style={styles.pollSection}>
                                            <Text style={styles.pollTitle}>POLLUTANTS</Text>
                                            <View style={styles.pollGrid}>
                                                {[
                                                    { val: aqi.pm25, name: 'PM2.5' },
                                                    { val: aqi.pm10, name: 'PM10' },
                                                    { val: aqi.o3, name: 'O\u2083' },
                                                    { val: aqi.no2, name: 'NO\u2082' },
                                                    { val: aqi.so2, name: 'SO\u2082' },
                                                    { val: aqi.co, name: 'CO' },
                                                ]
                                                    .filter((p) => p.val > 0)
                                                    .map((p) => (
                                                        <View key={p.name} style={styles.pollChip}>
                                                            <Text style={styles.pollVal}>{p.val}</Text>
                                                            <Text style={styles.pollName}>{p.name}</Text>
                                                        </View>
                                                    ))}
                                            </View>
                                        </View>
                                    </BlurView>
                                </View>
                            </>
                        )}

                        {/* ===== 5-Day Forecast ===== */}
                        {forecast && forecast.length > 0 && (
                            <>
                                <Text style={styles.sectionHeader}>5-DAY FORECAST</Text>
                                <View style={styles.forecastCardWrap}>
                                    <BlurView intensity={18} tint="dark" style={styles.forecastCard}>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                            <View style={styles.forecastScroll}>
                                                {forecast.slice(0, 5).map((day: ForecastData, index: number) => {
                                                    const date = new Date(day.dt);
                                                    const dayName =
                                                        index === 0
                                                            ? 'Today'
                                                            : date.toLocaleDateString('en-US', { weekday: 'short' });
                                                    return (
                                                        <View key={index} style={styles.forecastItem}>
                                                            <Text style={styles.forecastDay}>{dayName}</Text>
                                                            {getWeatherIcon(day.description, 28)}
                                                            <View style={styles.forecastTemps}>
                                                                <Text style={styles.forecastHigh}>{Math.round(day.tempMax)}{'\u00B0'}</Text>
                                                                <Text style={styles.forecastLow}>{Math.round(day.tempMin)}{'\u00B0'}</Text>
                                                            </View>
                                                            <View style={styles.forecastPop}>
                                                                <Droplets size={10} color={APP_CONFIG.colors.accent} />
                                                                <Text style={styles.forecastPopText}>{day.pop}%</Text>
                                                            </View>
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        </ScrollView>
                                    </BlurView>
                                </View>
                            </>
                        )}

                        {/* ===== India AQI Grid ===== */}
                        {citiesAQI.length > 0 && (
                            <>
                                <Text style={styles.sectionHeader}>INDIA AIR QUALITY</Text>
                                <View style={styles.citiesGrid}>
                                    {citiesAQI.slice(0, 8).map((cityData) => (
                                        <TouchableOpacity
                                            key={cityData.city}
                                            style={styles.cityAqiCard}
                                            onPress={() => {
                                                const city = INDIAN_CITIES.find(
                                                    (c) =>
                                                        cityData.city.toLowerCase().includes(c.name.toLowerCase()) ||
                                                        c.name.toLowerCase().includes(cityData.city.toLowerCase())
                                                );
                                                if (city) setSelectedCity(city);
                                            }}
                                        >
                                            <BlurView intensity={15} tint="dark" style={styles.cityAqiBlur}>
                                                <Text style={styles.cityAqiName} numberOfLines={1}>
                                                    {cityData.city.split(',')[0]}
                                                </Text>
                                                <Text style={[styles.cityAqiValue, { color: getAQIColor(cityData.aqi) }]}>
                                                    {cityData.aqi}
                                                </Text>
                                                <Text style={[styles.cityAqiLabel, { color: getAQIColor(cityData.aqi) }]}>
                                                    {getAQILabel(cityData.aqi)}
                                                </Text>
                                            </BlurView>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </>
                        )}

                        {/* ===== AQI Legend ===== */}
                        <BlurView intensity={15} tint="dark" style={styles.legendCard}>
                            <Text style={styles.legendTitle}>AQI Scale Reference</Text>
                            <View style={styles.legendBar}>
                                <LinearGradient
                                    colors={[APP_CONFIG.colors.success, APP_CONFIG.colors.warning, '#F97316', APP_CONFIG.colors.error, '#A855F7', '#7C2D12'] as [string, string, ...string[]]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.legendGradient}
                                />
                            </View>
                            <View style={styles.legendLabels}>
                                {['0', '50', '100', '150', '200', '300+'].map((l) => (
                                    <Text key={l} style={styles.legendLabel}>{l}</Text>
                                ))}
                            </View>
                        </BlurView>

                        <View style={{ height: 30 }} />
                    </ScrollView>
                )}
            </SafeAreaView>
        </ParticleBackground>
    );
};

// ====================== STYLES ======================
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },

    /* header */
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: APP_CONFIG.colors.background.card,
        borderBottomWidth: 1,
        borderBottomColor: APP_CONFIG.colors.border.subtle,
    },
    headerBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: APP_CONFIG.colors.overlay.dark,
        borderWidth: 1,
        borderColor: APP_CONFIG.colors.border.default,
    },
    cityButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 9,
        backgroundColor: APP_CONFIG.colors.overlay.dark,
        borderRadius: 25,
        gap: 8,
        borderWidth: 1,
        borderColor: APP_CONFIG.colors.border.default,
    },
    cityText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },

    /* dropdown */
    dropdown: {
        marginHorizontal: 20,
        marginBottom: 10,
        zIndex: 1000,
        borderRadius: 18,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
    },
    dropdownBlur: {
        borderRadius: 18,
        backgroundColor: APP_CONFIG.colors.background.card,
        borderWidth: 1,
        borderColor: APP_CONFIG.colors.border.default,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: APP_CONFIG.colors.border.subtle,
    },
    dropdownItemActive: {
        backgroundColor: APP_CONFIG.colors.primary + '18',
    },
    dropdownText: {
        fontSize: 14,
        color: APP_CONFIG.colors.text.secondary,
    },
    dropdownTextActive: {
        color: APP_CONFIG.colors.accent,
        fontWeight: '600',
    },
    checkDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: APP_CONFIG.colors.accent,
    },

    /* center/loading */
    centerWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        gap: 14,
    },
    loadingText: {
        color: APP_CONFIG.colors.text.secondary,
        fontSize: 14,
        letterSpacing: 1,
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    errorText: {
        fontSize: 14,
        color: APP_CONFIG.colors.text.tertiary,
        textAlign: 'center',
    },
    retryWrap: { borderRadius: 25, overflow: 'hidden', marginTop: 10 },
    retryGradient: { paddingVertical: 12, paddingHorizontal: 32 },
    retryText: { fontSize: 15, fontWeight: '600', color: '#fff' },

    /* scroll */
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },

    /* section header */
    sectionHeader: {
        fontSize: 12,
        color: APP_CONFIG.colors.text.secondary,
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 14,
        marginTop: 28,
        marginLeft: 4,
        fontWeight: '600',
    },

    /* hero */
    heroSection: { alignItems: 'center', paddingVertical: 16 },
    heroIcon: { marginBottom: 4 },
    heroTemp: {
        fontSize: 88,
        fontWeight: '200',
        color: '#fff',
        lineHeight: 100,
    },
    heroCondition: {
        fontSize: 20,
        fontWeight: '500',
        color: '#fff',
        textTransform: 'capitalize',
    },
    heroMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 12,
    },
    heroFeels: { fontSize: 13, color: APP_CONFIG.colors.text.secondary },
    heroDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: APP_CONFIG.colors.border.default,
    },
    heroHL: { fontSize: 13, color: APP_CONFIG.colors.text.secondary },

    /* stat grid */
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    statCardWrap: {
        width: CARD_WIDTH,
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: APP_CONFIG.colors.border.default,
    },
    statCard: {
        flex: 1,
        padding: 16,
        alignItems: 'center',
        backgroundColor: APP_CONFIG.colors.background.card,
    },
    statIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statValue: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
        marginTop: 10,
    },
    statLabel: {
        fontSize: 11,
        color: APP_CONFIG.colors.text.tertiary,
        marginTop: 4,
    },

    /* sun */
    sunCardWrap: {
        marginTop: 20,
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: APP_CONFIG.colors.border.default,
    },
    sunCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        backgroundColor: APP_CONFIG.colors.background.card,
    },
    sunItem: { flex: 1, alignItems: 'center' },
    sunDivider: {
        width: 1,
        height: 50,
        backgroundColor: APP_CONFIG.colors.border.subtle,
    },
    sunTime: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginTop: 10,
    },
    sunLabel: {
        fontSize: 11,
        color: APP_CONFIG.colors.text.tertiary,
        marginTop: 4,
    },

    /* aqi */
    aqiCardWrap: {
        borderRadius: 22,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: APP_CONFIG.colors.border.default,
    },
    aqiCard: {
        padding: 20,
        backgroundColor: APP_CONFIG.colors.background.card,
    },
    aqiHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 18,
    },
    aqiHeaderTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
    aqiMain: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 22,
    },
    aqiGauge: {
        width: 90,
        height: 90,
        borderRadius: 45,
        justifyContent: 'center',
        alignItems: 'center',
    },
    aqiGaugeVal: {
        fontSize: 32,
        fontWeight: '800',
        color: '#fff',
    },
    aqiDetails: { marginLeft: 22, flex: 1 },
    aqiLevel: { fontSize: 22, fontWeight: '700' },
    aqiCity: {
        fontSize: 13,
        color: APP_CONFIG.colors.text.tertiary,
        marginTop: 4,
    },
    aqiDominant: {
        fontSize: 11,
        color: APP_CONFIG.colors.text.tertiary,
        marginTop: 4,
    },
    pollSection: {
        borderTopWidth: 1,
        borderTopColor: APP_CONFIG.colors.border.subtle,
        paddingTop: 16,
    },
    pollTitle: {
        fontSize: 10,
        fontWeight: '600',
        color: APP_CONFIG.colors.text.tertiary,
        letterSpacing: 1,
        marginBottom: 12,
    },
    pollGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    pollChip: {
        backgroundColor: APP_CONFIG.colors.overlay.dark,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
        alignItems: 'center',
        minWidth: 68,
        borderWidth: 1,
        borderColor: APP_CONFIG.colors.border.subtle,
    },
    pollVal: { fontSize: 16, fontWeight: '700', color: '#fff' },
    pollName: {
        fontSize: 9,
        color: APP_CONFIG.colors.text.tertiary,
        marginTop: 2,
    },

    /* forecast */
    forecastCardWrap: {
        borderRadius: 22,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: APP_CONFIG.colors.border.default,
    },
    forecastCard: {
        padding: 18,
        backgroundColor: APP_CONFIG.colors.background.card,
    },
    forecastScroll: { flexDirection: 'row', gap: 14 },
    forecastItem: {
        alignItems: 'center',
        backgroundColor: APP_CONFIG.colors.overlay.dark,
        borderRadius: 16,
        padding: 14,
        minWidth: 78,
        borderWidth: 1,
        borderColor: APP_CONFIG.colors.border.subtle,
    },
    forecastDay: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 10,
    },
    forecastTemps: { marginTop: 10, alignItems: 'center' },
    forecastHigh: { fontSize: 16, fontWeight: '700', color: '#fff' },
    forecastLow: {
        fontSize: 13,
        color: APP_CONFIG.colors.text.tertiary,
        marginTop: 2,
    },
    forecastPop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginTop: 8,
    },
    forecastPopText: {
        fontSize: 10,
        color: APP_CONFIG.colors.accent,
    },

    /* india aqi */
    citiesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    cityAqiCard: {
        width: CARD_WIDTH,
        borderRadius: 16,
        overflow: 'hidden',
    },
    cityAqiBlur: {
        padding: 14,
        alignItems: 'center',
        borderRadius: 16,
        backgroundColor: APP_CONFIG.colors.background.card,
        borderWidth: 1,
        borderColor: APP_CONFIG.colors.border.subtle,
    },
    cityAqiName: {
        fontSize: 11,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 6,
    },
    cityAqiValue: { fontSize: 26, fontWeight: '800' },
    cityAqiLabel: {
        fontSize: 9,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 2,
    },

    /* legend */
    legendCard: {
        marginTop: 20,
        borderRadius: 18,
        padding: 18,
        backgroundColor: APP_CONFIG.colors.background.card,
        borderWidth: 1,
        borderColor: APP_CONFIG.colors.border.default,
        overflow: 'hidden',
    },
    legendTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: APP_CONFIG.colors.text.secondary,
        marginBottom: 14,
    },
    legendBar: { height: 10, borderRadius: 5, overflow: 'hidden' },
    legendGradient: { flex: 1 },
    legendLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    legendLabel: {
        fontSize: 9,
        color: APP_CONFIG.colors.text.tertiary,
    },
});

export default WeatherForecastScreen;
