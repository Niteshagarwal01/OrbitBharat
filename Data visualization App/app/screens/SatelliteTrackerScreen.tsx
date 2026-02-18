/**
 * Indian Satellite Tracker Screen - Premium Design System
 * Real-time tracking of ISRO satellites using N2YO API
 * Matches Landing page glassmorphism / blue-only palette
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    RefreshControl,
    FlatList,
    Linking,
    ActivityIndicator,
    StatusBar,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../components/GlassCard';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Satellite,
    MapPin,
    Navigation,
    ChevronLeft,
    ChevronRight,
    Radio,
    Globe,
    ArrowUpRight,
    Signal,
    RefreshCw,
    Wifi,
    WifiOff,
    Zap,
    Clock,
    Rocket,
    Target,
    Activity,
    ExternalLink,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { APP_CONFIG } from '../utils/constants';
import ParticleBackground from '../components/ParticleBackground';
import {
    getSatellitePosition,
    ISRO_NORAD_IDS,
    SatellitePosition as APISatellitePosition,
    calculateVelocity,
} from '../utils/satelliteApi';
import SatelliteMap from '../components/SatelliteMap';

const { width } = Dimensions.get('window');

// types
interface SatellitePosition {
    latitude: number;
    longitude: number;
    altitude: number;
    velocity: number;
    timestamp: string;
}

interface ISROSatellite {
    id: string;
    name: string;
    noradId: string;
    type: 'NAVIGATION' | 'COMMUNICATION' | 'EARTH_OBSERVATION' | 'RESEARCH' | 'METEOROLOGICAL';
    launchDate: string;
    status: 'ACTIVE' | 'DECOMMISSIONED';
    altitude: number;
    inclination: number;
    period: number;
    description: string;
}

// satellite data
const ISRO_SATELLITES: ISROSatellite[] = [
    {
        id: 'aditya-l1',
        name: 'Aditya-L1',
        noradId: '57753',
        type: 'RESEARCH',
        launchDate: '2023-09-02',
        status: 'ACTIVE',
        altitude: 1500000,
        inclination: 19.2,
        period: 177.86 * 1440,
        description: 'Solar observation from L1 Lagrange point',
    },
    {
        id: 'navic-1',
        name: 'NavIC IRNSS-1A',
        noradId: '39199',
        type: 'NAVIGATION',
        launchDate: '2013-07-01',
        status: 'ACTIVE',
        altitude: 35786,
        inclination: 28.7,
        period: 1436,
        description: 'Navigation satellite for Indian positioning system',
    },
    {
        id: 'navic-7',
        name: 'NavIC IRNSS-1G',
        noradId: '41384',
        type: 'NAVIGATION',
        launchDate: '2016-04-28',
        status: 'ACTIVE',
        altitude: 35786,
        inclination: 5.2,
        period: 1436,
        description: 'Geostationary navigation satellite',
    },
    {
        id: 'gsat-30',
        name: 'GSAT-30',
        noradId: '45026',
        type: 'COMMUNICATION',
        launchDate: '2020-01-17',
        status: 'ACTIVE',
        altitude: 35786,
        inclination: 0.1,
        period: 1436,
        description: 'C & Ku-band communication satellite',
    },
    {
        id: 'gsat-31',
        name: 'GSAT-31',
        noradId: '44034',
        type: 'COMMUNICATION',
        launchDate: '2019-02-06',
        status: 'ACTIVE',
        altitude: 35786,
        inclination: 0.1,
        period: 1436,
        description: 'Ku-band transponder communication',
    },
    {
        id: 'cartosat-3',
        name: 'Cartosat-3',
        noradId: '44804',
        type: 'EARTH_OBSERVATION',
        launchDate: '2019-11-27',
        status: 'ACTIVE',
        altitude: 509,
        inclination: 97.5,
        period: 95,
        description: 'Sub-meter resolution Earth imaging',
    },
    {
        id: 'insat-3dr',
        name: 'INSAT-3DR',
        noradId: '41752',
        type: 'METEOROLOGICAL',
        launchDate: '2016-09-08',
        status: 'ACTIVE',
        altitude: 35786,
        inclination: 0.1,
        period: 1436,
        description: 'Weather & disaster-management satellite',
    },
    {
        id: 'oceansat-3',
        name: 'Oceansat-3',
        noradId: '54361',
        type: 'EARTH_OBSERVATION',
        launchDate: '2022-11-26',
        status: 'ACTIVE',
        altitude: 742,
        inclination: 98.3,
        period: 99.6,
        description: 'Ocean / atmospheric studies',
    },
    {
        id: 'risat-2br1',
        name: 'RISAT-2BR1',
        noradId: '44857',
        type: 'EARTH_OBSERVATION',
        launchDate: '2019-12-11',
        status: 'ACTIVE',
        altitude: 576,
        inclination: 37,
        period: 96,
        description: 'X-band SAR radar imaging satellite',
    },
    {
        id: 'astrosat',
        name: 'AstroSat',
        noradId: '40930',
        type: 'RESEARCH',
        launchDate: '2015-09-28',
        status: 'ACTIVE',
        altitude: 650,
        inclination: 6,
        period: 97.5,
        description: 'Multi-wavelength space observatory',
    },
    {
        id: 'resourcesat-2a',
        name: 'Resourcesat-2A',
        noradId: '42949',
        type: 'EARTH_OBSERVATION',
        launchDate: '2016-12-07',
        status: 'ACTIVE',
        altitude: 817,
        inclination: 98.7,
        period: 101,
        description: 'Earth resources monitoring',
    },
];

// type icons & accent - uses APP_CONFIG blues only
const TYPE_CONFIG = {
    NAVIGATION: { icon: Navigation, color: APP_CONFIG.colors.primary, gradient: [APP_CONFIG.colors.primary, APP_CONFIG.colors.primaryDark] as [string, string] },
    COMMUNICATION: { icon: Radio, color: APP_CONFIG.colors.accent, gradient: [APP_CONFIG.colors.accent, APP_CONFIG.colors.primary] as [string, string] },
    EARTH_OBSERVATION: { icon: Globe, color: APP_CONFIG.colors.info, gradient: [APP_CONFIG.colors.info, APP_CONFIG.colors.primaryDark] as [string, string] },
    RESEARCH: { icon: Satellite, color: APP_CONFIG.colors.primaryLight, gradient: [APP_CONFIG.colors.primaryLight, APP_CONFIG.colors.primary] as [string, string] },
    METEOROLOGICAL: { icon: Signal, color: APP_CONFIG.colors.accent, gradient: [APP_CONFIG.colors.accent, APP_CONFIG.colors.info] as [string, string] },
};

const SatelliteTrackerScreen: React.FC = () => {
    const navigation = useNavigation();
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isOnline, setIsOnline] = useState(true);
    const [selectedType, setSelectedType] = useState<ISROSatellite['type'] | 'ALL'>('ALL');
    const [positions, setPositions] = useState<Map<string, SatellitePosition>>(new Map());
    const [lastUpdate, setLastUpdate] = useState(new Date());
    const [activeCount, setActiveCount] = useState(0);
    const [viewMode, setViewMode] = useState<'LIST' | 'MAP'>('LIST');

    const fetchSatellitePositions = useCallback(async () => {
        try {
            // ── Quick network-reachability check (doesn't depend on N2YO) ──
            // Try Android's own captive-portal URL first, then Google fallback.
            const checkUrls = [
                'https://connectivitycheck.gstatic.com/generate_204',
                'https://www.google.com/generate_204',
                'https://clients3.google.com/generate_204',
            ];
            let reachable = false;
            for (const url of checkUrls) {
                try {
                    const ctrl = new AbortController();
                    const t = setTimeout(() => ctrl.abort(), 6000);
                    await fetch(url, { method: 'HEAD', signal: ctrl.signal });
                    clearTimeout(t);
                    reachable = true;
                    break; // one success is enough
                } catch { /* try next */ }
            }
            setIsOnline(reachable);

            const newPositions = new Map<string, SatellitePosition>();
            let successCount = 0;

            const fetchPromises = ISRO_SATELLITES.map(async (sat) => {
                try {
                    const noradId = parseInt(sat.noradId);
                    const position = await getSatellitePosition(noradId);
                    if (position) {
                        newPositions.set(sat.id, {
                            latitude: position.satlatitude,
                            longitude: position.satlongitude,
                            altitude: position.sataltitude,
                            velocity: calculateVelocity(position.sataltitude),
                            timestamp: new Date(position.timestamp * 1000).toISOString(),
                        });
                        successCount++;
                    }
                } catch (_) { }
            });

            await Promise.allSettled(fetchPromises);

            if (newPositions.size > 0) {
                setPositions(newPositions);
            }

            setActiveCount(successCount);
            setLastUpdate(new Date());
        } catch {
            // keep previous isOnline value; only the reachability check above toggles it
        } finally {
            setLoading(false);
        }
    }, []);

    const isFocused = useIsFocused();

    useEffect(() => {
        fetchSatellitePositions();
    }, [fetchSatellitePositions]);

    // Only poll when screen is focused to save battery & bandwidth
    useEffect(() => {
        if (!isFocused) return;
        const interval = setInterval(fetchSatellitePositions, 30000);
        return () => clearInterval(interval);
    }, [isFocused, fetchSatellitePositions]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchSatellitePositions();
        setRefreshing(false);
    }, [fetchSatellitePositions]);

    const filteredSatellites =
        selectedType === 'ALL'
            ? ISRO_SATELLITES
            : ISRO_SATELLITES.filter((s) => s.type === selectedType);

    const formatCoord = (num: number, isLat: boolean) => {
        const dir = isLat ? (num >= 0 ? 'N' : 'S') : (num >= 0 ? 'E' : 'W');
        return `${Math.abs(num).toFixed(2)}` + '\u00B0' + dir;
    };

    const formatAltitude = (alt: number) => {
        if (alt >= 1000000) return `${(alt / 1000000).toFixed(1)}M km`;
        if (alt >= 1000) return `${(alt / 1000).toFixed(0)}K km`;
        return `${alt.toFixed(0)} km`;
    };

    const renderSatelliteCard = ({ item }: { item: ISROSatellite }) => {
        const config = TYPE_CONFIG[item.type];
        const TypeIcon = config.icon;
        const position = positions.get(item.id);
        const isSpecial = item.id === 'aditya-l1';

        return (
            <TouchableOpacity
                style={styles.card}
                activeOpacity={isSpecial ? 0.7 : 1}
                onPress={() => {
                    if (isSpecial) (navigation as any).navigate('AdityaL1');
                }}
            >
                <GlassCard style={styles.cardBlur}>
                    {/* header row */}
                    <View style={styles.cardHeader}>
                        <LinearGradient colors={config.gradient} style={styles.iconCircle}>
                            <TypeIcon size={20} color="#fff" />
                        </LinearGradient>

                        <View style={styles.headerInfo}>
                            <Text style={styles.satName} numberOfLines={1}>
                                {item.name}
                            </Text>
                            <View style={styles.typeRow}>
                                <View style={[styles.typeBadge, { backgroundColor: config.color + '20' }]}>
                                    <Text style={[styles.typeText, { color: config.color }]}>
                                        {item.type.replace('_', ' ')}
                                    </Text>
                                </View>
                                <View
                                    style={[
                                        styles.statusDot,
                                        {
                                            backgroundColor:
                                                item.status === 'ACTIVE'
                                                    ? APP_CONFIG.colors.success
                                                    : APP_CONFIG.colors.warning,
                                        },
                                    ]}
                                />
                            </View>
                        </View>

                        {position && (
                            <View style={styles.liveIndicator}>
                                <Activity size={10} color={APP_CONFIG.colors.success} />
                                <Text style={styles.liveText}>LIVE</Text>
                            </View>
                        )}
                    </View>

                    {/* description */}
                    <Text style={styles.description} numberOfLines={2}>
                        {item.description}
                    </Text>

                    {/* live position */}
                    {position && (
                        <View style={styles.positionCard}>
                            <View style={styles.posRow}>
                                <View style={styles.posItem}>
                                    <MapPin size={13} color={APP_CONFIG.colors.accent} />
                                    <Text style={styles.posLabel}>Position</Text>
                                </View>
                                <Text style={styles.posValue}>
                                    {formatCoord(position.latitude, true)}, {formatCoord(position.longitude, false)}
                                </Text>
                            </View>
                            <View style={styles.posDivider} />
                            <View style={styles.posRow}>
                                <View style={styles.posItem}>
                                    <ArrowUpRight size={13} color={APP_CONFIG.colors.primaryLight} />
                                    <Text style={styles.posLabel}>Altitude</Text>
                                </View>
                                <Text style={styles.posValue}>{formatAltitude(position.altitude)}</Text>
                            </View>
                            <View style={styles.posDivider} />
                            <View style={styles.posRow}>
                                <View style={styles.posItem}>
                                    <Zap size={13} color={APP_CONFIG.colors.primary} />
                                    <Text style={styles.posLabel}>Velocity</Text>
                                </View>
                                <Text style={styles.posValue}>{position.velocity.toFixed(1)} km/s</Text>
                            </View>
                        </View>
                    )}

                    {/* stats strip */}
                    <View style={styles.statsStrip}>
                        <View style={styles.stripItem}>
                            <Text style={styles.stripValue}>{item.inclination}{'\u00B0'}</Text>
                            <Text style={styles.stripLabel}>INCL</Text>
                        </View>
                        <View style={styles.stripDivider} />
                        <View style={styles.stripItem}>
                            <Text style={styles.stripValue}>
                                {item.period > 1440
                                    ? `${(item.period / 1440).toFixed(1)}d`
                                    : `${item.period}m`}
                            </Text>
                            <Text style={styles.stripLabel}>PERIOD</Text>
                        </View>
                        <View style={styles.stripDivider} />
                        <View style={styles.stripItem}>
                            <Text style={styles.stripValue}>{item.noradId}</Text>
                            <Text style={styles.stripLabel}>NORAD</Text>
                        </View>
                        <View style={styles.stripDivider} />
                        <View style={styles.stripItem}>
                            <Text style={styles.stripValue}>{item.launchDate.split('-')[0]}</Text>
                            <Text style={styles.stripLabel}>LAUNCH</Text>
                        </View>
                    </View>

                    {/* Aditya-L1 CTA */}
                    {isSpecial && (
                        <LinearGradient
                            colors={APP_CONFIG.colors.gradient.primary as [string, string]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.ctaBar}
                        >
                            <Rocket size={14} color="#fff" />
                            <Text style={styles.ctaText}>View Live Solar Data</Text>
                            <ChevronRight size={14} color="#fff" />
                        </LinearGradient>
                    )}
                </GlassCard>
            </TouchableOpacity>
        );
    };

    const filterTypes: string[] = [
        'ALL',
        'RESEARCH',
        'NAVIGATION',
        'COMMUNICATION',
        'EARTH_OBSERVATION',
        'METEOROLOGICAL',
    ];

    if (loading) {
        return (
            <ParticleBackground>
                <SafeAreaView style={styles.container}>
                    <StatusBar barStyle="light-content" />
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator size="large" color={APP_CONFIG.colors.accent} />
                        <Text style={styles.loadingText}>Connecting to satellites...</Text>
                    </View>
                </SafeAreaView>
            </ParticleBackground>
        );
    }

    return (
        <ParticleBackground>
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" />

                {/* Satellite List */}
                <FlatList
                    data={filteredSatellites}
                    keyExtractor={(item) => item.id}
                    renderItem={renderSatelliteCard}
                    style={styles.list}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={APP_CONFIG.colors.accent}
                        />
                    }
                    ListHeaderComponent={
                        <>
                            {/* Header */}
                            <GlassCard style={styles.header}>
                                <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
                                    <ChevronLeft size={22} color="#fff" />
                                </TouchableOpacity>

                                <View style={styles.headerCenter}>
                                    <Text style={styles.headerTitle}>ISRO SATELLITES</Text>
                                    <Text style={styles.headerSub}>Real-time Tracking</Text>
                                </View>

                                <View style={styles.headerRightRow}>
                                    <TouchableOpacity style={styles.headerBtnSmall} onPress={onRefresh}>
                                        <RefreshCw size={17} color={APP_CONFIG.colors.accent} />
                                    </TouchableOpacity>
                                </View>
                            </GlassCard>

                            {/* Stats Hero / Map Switcher */}
                            <View style={styles.viewToggle}>
                                <TouchableOpacity
                                    style={[styles.toggleBtn, viewMode === 'LIST' && styles.toggleBtnActive]}
                                    onPress={() => setViewMode('LIST')}
                                >
                                    <Text style={[styles.toggleText, viewMode === 'LIST' && styles.toggleTextActive]}>LIST VIEW</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.toggleBtn, viewMode === 'MAP' && styles.toggleBtnActive]}
                                    onPress={() => setViewMode('MAP')}
                                >
                                    <Text style={[styles.toggleText, viewMode === 'MAP' && styles.toggleTextActive]}>MAP VIEW</Text>
                                </TouchableOpacity>
                            </View>

                            {viewMode === 'MAP' ? (
                                <View style={styles.mapContainer}>
                                    <SatelliteMap
                                        satellites={filteredSatellites.map(s => ({
                                            id: s.id,
                                            name: s.name,
                                            latitude: positions.get(s.id)?.latitude || 0,
                                            longitude: positions.get(s.id)?.longitude || 0,
                                            type: s.type,
                                            altitude: positions.get(s.id)?.altitude
                                        })).filter(s => s.latitude !== 0)}
                                    />
                                    <View style={styles.mapLegend}>
                                        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: APP_CONFIG.colors.primary }]} /><Text style={styles.legendText}>Navigation</Text></View>
                                        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: APP_CONFIG.colors.accent }]} /><Text style={styles.legendText}>Comm/Weather</Text></View>
                                        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: APP_CONFIG.colors.success }]} /><Text style={styles.legendText}>Active</Text></View>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.heroWrap}>
                                    <GlassCard style={styles.heroBlur}>
                                        <View style={styles.heroContent}>
                                            <View style={styles.heroItem}>
                                                <LinearGradient
                                                    colors={APP_CONFIG.colors.gradient.primary as [string, string]}
                                                    style={styles.heroIcon}
                                                >
                                                    <Satellite size={16} color="#fff" />
                                                </LinearGradient>
                                                <Text style={styles.heroValue}>{ISRO_SATELLITES.length}</Text>
                                                <Text style={styles.heroLabel}>TRACKING</Text>
                                            </View>

                                            <View style={styles.heroDivider} />

                                            <View style={styles.heroItem}>
                                                <View style={[styles.heroIcon, { backgroundColor: APP_CONFIG.colors.success + '25' }]}>
                                                    <Activity size={16} color={APP_CONFIG.colors.success} />
                                                </View>
                                                <Text style={[styles.heroValue, { color: APP_CONFIG.colors.success }]}>
                                                    {activeCount}
                                                </Text>
                                                <Text style={styles.heroLabel}>LIVE DATA</Text>
                                            </View>

                                            <View style={styles.heroDivider} />

                                            <View style={styles.heroItem}>
                                                <View
                                                    style={[
                                                        styles.heroIcon,
                                                        {
                                                            backgroundColor: isOnline
                                                                ? APP_CONFIG.colors.success + '25'
                                                                : APP_CONFIG.colors.warning + '25',
                                                        },
                                                    ]}
                                                >
                                                    {isOnline ? (
                                                        <Wifi size={16} color={APP_CONFIG.colors.success} />
                                                    ) : (
                                                        <WifiOff size={16} color={APP_CONFIG.colors.warning} />
                                                    )}
                                                </View>
                                                <Text
                                                    style={[
                                                        styles.heroValue,
                                                        { color: isOnline ? APP_CONFIG.colors.success : APP_CONFIG.colors.warning },
                                                    ]}
                                                >
                                                    {isOnline ? 'ON' : 'OFF'}
                                                </Text>
                                                <Text style={styles.heroLabel}>STATUS</Text>
                                            </View>
                                        </View>
                                    </GlassCard>
                                </View>
                            )}

                            {/* Filter Chips */}
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.filterScroll}
                                contentContainerStyle={styles.filterContainer}
                            >
                                {filterTypes.map((type) => {
                                    const isActive = selectedType === type;
                                    return (
                                        <TouchableOpacity key={type} onPress={() => setSelectedType(type as any)}>
                                            {isActive ? (
                                                <LinearGradient
                                                    colors={APP_CONFIG.colors.gradient.primary as [string, string]}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 0 }}
                                                    style={styles.chipActive}
                                                >
                                                    <Text style={styles.chipTextActive}>
                                                        {type === 'ALL' ? 'ALL' : type.replace('_', ' ')}
                                                    </Text>
                                                </LinearGradient>
                                            ) : (
                                                <View style={styles.chip}>
                                                    <Text style={styles.chipText}>
                                                        {type === 'ALL' ? 'ALL' : type.replace('_', ' ')}
                                                    </Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </>
                    }
                    ListFooterComponent={
                        <TouchableOpacity
                            style={styles.externalLink}
                            onPress={() => Linking.openURL('https://www.n2yo.com/?s=ISRO')}
                        >
                            <GlassCard style={styles.externalBlur}>
                                <Globe size={16} color={APP_CONFIG.colors.accent} />
                                <Text style={styles.externalText}>View Full Tracker on N2YO</Text>
                                <ExternalLink size={13} color={APP_CONFIG.colors.accent} />
                            </GlassCard>
                        </TouchableOpacity>
                    }
                />
            </SafeAreaView>
        </ParticleBackground>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },

    loadingWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 18,
    },
    loadingText: {
        color: APP_CONFIG.colors.text.secondary,
        fontSize: 14,
        letterSpacing: 1,
    },

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
    headerCenter: { alignItems: 'center' },
    headerRightRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 2,
    },
    headerSub: {
        fontSize: 11,
        color: APP_CONFIG.colors.text.tertiary,
        marginTop: 2,
        letterSpacing: 0.5,
    },
    headerBtnSmall: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: APP_CONFIG.colors.overlay.dark,
        borderWidth: 1,
        borderColor: APP_CONFIG.colors.border.default,
    },

    viewToggle: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 8,
        backgroundColor: APP_CONFIG.colors.overlay.dark,
        borderRadius: 12,
        padding: 4,
        borderWidth: 1,
        borderColor: APP_CONFIG.colors.border.default,
    },
    toggleBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
    },
    toggleBtnActive: {
        backgroundColor: 'rgba(0, 102, 255, 0.2)',
    },
    toggleText: {
        fontSize: 11,
        fontWeight: '700',
        color: APP_CONFIG.colors.text.tertiary,
        letterSpacing: 0.5,
    },
    toggleTextActive: {
        color: '#fff',
    },
    mapContainer: {
        marginHorizontal: 16,
        marginTop: 8,
    },
    mapLegend: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 12,
        marginBottom: 12,
        gap: 16,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 6, height: 6, borderRadius: 3 },
    legendText: { fontSize: 10, color: APP_CONFIG.colors.text.secondary },

    heroWrap: {
        marginHorizontal: 16,
        marginTop: 14,
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: APP_CONFIG.colors.border.default,
    },
    heroBlur: {
        backgroundColor: APP_CONFIG.colors.background.card,
    },
    heroContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingVertical: 18,
    },
    heroItem: { alignItems: 'center', flex: 1 },
    heroIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    heroValue: {
        fontSize: 22,
        fontWeight: '800',
        color: '#fff',
    },
    heroLabel: {
        fontSize: 9,
        color: APP_CONFIG.colors.text.tertiary,
        letterSpacing: 1,
        marginTop: 3,
    },
    heroDivider: {
        width: 1,
        height: 50,
        backgroundColor: APP_CONFIG.colors.border.subtle,
    },

    filterScroll: {
        marginTop: 16,
        marginBottom: 10,
        flexGrow: 0,
        flexShrink: 0,
    },
    filterContainer: {
        paddingHorizontal: 16,
        gap: 10,
    },
    chip: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 25,
        backgroundColor: APP_CONFIG.colors.overlay.dark,
        borderWidth: 1,
        borderColor: APP_CONFIG.colors.border.default,
    },
    chipActive: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 25,
    },
    chipText: {
        fontSize: 11,
        fontWeight: '600',
        color: APP_CONFIG.colors.text.secondary,
        letterSpacing: 0.5,
    },
    chipTextActive: {
        fontSize: 11,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 0.5,
    },

    list: { flex: 1 },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 20,
        flexGrow: 1,
    },

    card: {
        marginBottom: 16,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: APP_CONFIG.colors.border.default,
    },
    cardBlur: {
        padding: 18,
        backgroundColor: APP_CONFIG.colors.background.card,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerInfo: {
        flex: 1,
        marginLeft: 12,
    },
    satName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 0.3,
    },
    typeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 5,
        gap: 8,
    },
    typeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 10,
    },
    typeText: {
        fontSize: 9,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: APP_CONFIG.colors.success + '18',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        gap: 3,
    },
    liveText: {
        fontSize: 8,
        fontWeight: '700',
        color: APP_CONFIG.colors.success,
        letterSpacing: 0.5,
    },

    description: {
        fontSize: 13,
        color: APP_CONFIG.colors.text.tertiary,
        marginTop: 12,
        lineHeight: 18,
    },

    positionCard: {
        marginTop: 14,
        backgroundColor: 'rgba(0,0,0,0.25)',
        borderRadius: 14,
        padding: 12,
    },
    posRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    posItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    posLabel: {
        fontSize: 11,
        color: APP_CONFIG.colors.text.tertiary,
    },
    posValue: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    posDivider: {
        height: 1,
        backgroundColor: APP_CONFIG.colors.border.subtle,
        marginVertical: 8,
    },

    statsStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: APP_CONFIG.colors.border.subtle,
    },
    stripItem: { alignItems: 'center', flex: 1 },
    stripValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
    stripLabel: {
        fontSize: 8,
        color: APP_CONFIG.colors.text.tertiary,
        letterSpacing: 1,
        marginTop: 3,
    },
    stripDivider: {
        width: 1,
        height: 26,
        backgroundColor: APP_CONFIG.colors.border.subtle,
    },

    ctaBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 14,
        paddingVertical: 10,
        borderRadius: 12,
        gap: 8,
    },
    ctaText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 0.5,
    },

    externalLink: {
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 10,
    },
    externalBlur: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: APP_CONFIG.colors.background.card,
        borderWidth: 1,
        borderColor: APP_CONFIG.colors.border.accent,
        gap: 10,
    },
    externalText: {
        fontSize: 13,
        fontWeight: '600',
        color: APP_CONFIG.colors.accent,
    },
});

export default SatelliteTrackerScreen;
