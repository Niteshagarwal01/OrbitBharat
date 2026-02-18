import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions,
  Animated,
  ActivityIndicator,
  Platform
} from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import {
  Radio,
  CheckCircle,
  RefreshCw,
  Clock,
  Activity,
  AlertTriangle,
  Gauge,
  Compass,
  Wind,
  Thermometer,
  Magnet,
  Sun,
  Zap,
  Eye,
  List,
  Grid,
  Share2,
  Cpu,
  Info,
  FileText,
  BookOpen,
  Settings,
  ChevronRight,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import GlassCard from '../components/GlassCard';
import { APP_CONFIG } from '../utils/constants';
import { logger } from '../utils/logger';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import ParticleBackground from '../components/ParticleBackground';
import { getSpaceWeatherSummary } from '../utils/nasaApi';
import {
  getRealTimeSolarWindSummary,
  getAuroraForecast,
  fetchSolarWindData,
  fetchMagnetometerData,
  fetchKpIndex,
  SolarWindData,
  MagnetometerData,
  KpIndex,
} from '../utils/noaaApi';

type Props = NativeStackScreenProps<RootStackParamList, 'GraphSimulation'>;

const { width } = Dimensions.get('window');
const SCROLL_PAD = 20;
const CARD_PAD = 20;
const CHART_WIDTH = Math.max(width - SCROLL_PAD * 2 - CARD_PAD * 2, 200);
const SAFE_CHART_BG = '#0D1117';

// Available time windows
const TIME_OPTIONS = ['6H', '1D', '3D', '7D'] as const;
type TimeWindow = typeof TIME_OPTIONS[number];

// How many points we downsample to for the chart
const MAX_CHART_POINTS = 7;

// Helpers
const hoursForWindow = (w: TimeWindow): number => {
  switch (w) {
    case '6H':  return 6;
    case '1D':  return 24;
    case '3D':  return 72;
    case '7D':  return 168;
    default:    return 24;
  }
};

/** Downsample an array to at most `n` evenly-spaced items. */
function downsample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const step = (arr.length - 1) / (n - 1);
  const result: T[] = [];
  for (let i = 0; i < n; i++) result.push(arr[Math.round(i * step)]);
  return result;
}

/** Create human-readable labels for chart x-axis. */
function timeLabels(count: number, windowHours: number): string[] {
  const labels: string[] = [];
  const step = windowHours / (count - 1);
  for (let i = 0; i < count; i++) {
    const hoursAgo = windowHours - i * step;
    if (hoursAgo <= 0) { labels.push('Now'); continue; }
    if (hoursAgo < 1)  { labels.push(`${Math.round(hoursAgo * 60)}m`); continue; }
    if (hoursAgo < 48)  { labels.push(`-${Math.round(hoursAgo)}h`); continue; }
    labels.push(`-${(hoursAgo / 24).toFixed(0)}d`);
  }
  return labels;
}

// Types for processed data
interface SolarData {
  currentCME: {
    speed: string;
    direction: string;
    intensity: string;
    arrivalTime: string;
    confidence: string;
  };
  solarWind: {
    speed: string;
    density: string;
    temperature: string;
    magneticField: string;
  };
  spaceWeather: {
    geomagneticActivity: string;
    solarFlareProbability: string;
    auroraVisibility: string;
    satelliteRisk: string;
    kpIndex: number;
  };
}

export default function GraphSimulationScreen({ navigation }: Props) {
  const [activeFilter, setActiveFilter] = useState<TimeWindow>('1D');

  // Simulation
  const [isPlaying, setIsPlaying] = useState(false);
  const [simIndex, setSimIndex] = useState(0);
  const playTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Real data stores
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Raw NOAA time-series (7-day, reused for all windows)
  const [windHistory, setWindHistory] = useState<SolarWindData[]>([]);
  const [magHistory, setMagHistory] = useState<MagnetometerData[]>([]);
  const [kpHistory, setKpHistory] = useState<KpIndex[]>([]);

  const [solarData, setSolarData] = useState<SolarData>({
    currentCME:  { speed: '--', direction: '--', intensity: '--', arrivalTime: '--', confidence: '--' },
    solarWind:   { speed: '--', density: '--', temperature: '--', magneticField: '--' },
    spaceWeather:{ geomagneticActivity: '--', solarFlareProbability: '--', auroraVisibility: '--', satelliteRisk: '--', kpIndex: 0 }
  });

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // -------------------------------------------------------------------
  // Derive chart data from raw history + selected time window
  // -------------------------------------------------------------------
  const windowHours = hoursForWindow(activeFilter);
  const cutoff = new Date(Date.now() - windowHours * 3600_000);

  const filteredWind = windHistory.filter(d => new Date(d.time_tag) >= cutoff);
  const speedSampled = downsample(filteredWind, MAX_CHART_POINTS);

  const speedValues = speedSampled.length > 0
    ? speedSampled.map(d => d.speed)
    : [0];
  const speedLabels = speedSampled.length > 0
    ? timeLabels(speedSampled.length, windowHours)
    : ['--'];

  // Kp data — already at 3-hour cadence, keep all within window
  const filteredKp = kpHistory.filter(d => new Date(d.time_tag) >= cutoff);
  const kpSampled = downsample(filteredKp, MAX_CHART_POINTS);
  const kpValues = kpSampled.length > 0 ? kpSampled.map(d => d.kp_index) : [0];
  const kpLabels = kpSampled.length > 0
    ? kpSampled.map(d => {
        const dt = new Date(d.time_tag);
        return `${dt.getUTCHours().toString().padStart(2, '0')}:${dt.getUTCMinutes().toString().padStart(2, '0')}`;
      })
    : ['--'];

  // Color each Kp bar by severity
  const kpBarColors = kpValues.map(v => {
    if (v >= 7) return () => 'rgba(220,38,38,0.9)';   // red
    if (v >= 5) return () => 'rgba(250,204,21,0.9)';   // yellow
    if (v >= 3) return () => 'rgba(129,140,248,0.9)';  // indigo
    return () => 'rgba(59,130,246,0.85)';               // blue
  });

  // -------------------------------------------------------------------
  // Fetch all NOAA + NASA data
  // -------------------------------------------------------------------
  const fetchRealData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [nasaData, noaaData, windRaw, magRaw, kpRaw] = await Promise.all([
        getSpaceWeatherSummary(),
        getRealTimeSolarWindSummary(),
        fetchSolarWindData(),
        fetchMagnetometerData(),
        fetchKpIndex(),
      ]);

      // Store raw arrays
      if (windRaw?.length) setWindHistory(windRaw);
      if (magRaw?.length)  setMagHistory(magRaw);
      if (kpRaw?.length)   setKpHistory(kpRaw);

      if (noaaData) {
        const auroraInfo = getAuroraForecast(noaaData.geomagnetic.kpIndex);
        const kpIndex = noaaData.geomagnetic.kpIndex;

        let satelliteRisk = 'Minimal';
        if (kpIndex >= 7) satelliteRisk = 'High';
        else if (kpIndex >= 5) satelliteRisk = 'Moderate';
        else if (kpIndex >= 3) satelliteRisk = 'Low';

        setSolarData({
          currentCME: {
            speed: nasaData?.latestCME?.speed ? `${nasaData.latestCME.speed} km/s` : 'No recent CME',
            direction: nasaData?.latestCME?.location || 'N/A',
            intensity: nasaData?.latestFlare?.class ? `${nasaData.latestFlare.class} Class` : 'Quiet',
            arrivalTime: nasaData?.latestCME ? '24-72h' : 'N/A',
            confidence: nasaData?.totalCMEs ? 'High' : 'N/A'
          },
          solarWind: {
            speed: `${Math.round(noaaData.current.speed)} km/s`,
            density: `${noaaData.current.density.toFixed(1)} p/cm³`,
            temperature: `${(noaaData.current.temperature / 1_000_000).toFixed(2)} MK`,
            magneticField: `${noaaData.current.magneticField.toFixed(1)} nT`
          },
          spaceWeather: {
            geomagneticActivity: noaaData.geomagnetic.activity,
            solarFlareProbability: nasaData?.totalFlares ? 'Elevated' : 'Low',
            auroraVisibility: auroraInfo.visibility,
            satelliteRisk,
            kpIndex: noaaData.geomagnetic.kpIndex
          }
        });

        setIsConnected(true);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (error) {
      logger.error('Error fetching real-time data', { error }, 'GraphSimulationScreen');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRealData();
    const refreshInterval = setInterval(fetchRealData, 5 * 60 * 1000);

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();

    return () => clearInterval(refreshInterval);
  }, [fetchRealData]);

  // -------------------------------------------------------------------
  // Simulation play / pause — auto-advances through chart points
  // -------------------------------------------------------------------
  useEffect(() => {
    if (isPlaying) {
      playTimer.current = setInterval(() => {
        setSimIndex(prev => {
          const max = speedSampled.length - 1;
          if (prev >= max) { setIsPlaying(false); return max; }
          return prev + 1;
        });
      }, 1200); // 1.2 s per step
    } else if (playTimer.current) {
      clearInterval(playTimer.current);
      playTimer.current = null;
    }
    return () => { if (playTimer.current) clearInterval(playTimer.current); };
  }, [isPlaying, speedSampled.length]);

  const resetSimulation = () => {
    setIsPlaying(false);
    setSimIndex(0);
  };

  const simProgress = speedSampled.length > 1
    ? (simIndex / (speedSampled.length - 1)) * 100
    : 0;

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <ParticleBackground>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <GlassCard style={styles.header}>
            <View style={styles.headerContent}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                <ChevronRight size={24} color="#FFF" style={{ transform: [{ rotate: '180deg' }] }} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Data Simulation</Text>
              <TouchableOpacity onPress={fetchRealData} style={styles.iconBtn}>
                <RefreshCw size={20} color={isLoading ? APP_CONFIG.colors.text.secondary : APP_CONFIG.colors.accent} />
              </TouchableOpacity>
            </View>
          </GlassCard>

          {/* ── Solar Wind Velocity (Real NOAA Time-Series) ── */}
          <Animated.View style={[styles.mainGraphCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <GlassCard style={styles.glassCard}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardTitle}>Solar Wind Velocity</Text>
                  <Text style={styles.cardSubtitle}>
                    {isConnected
                      ? `NOAA DSCOVR · last ${windowHours}h · updated ${lastUpdated}`
                      : 'Waiting for NOAA DSCOVR data…'}
                  </Text>
                </View>
                {isConnected && (
                  <View style={styles.liveBadge}>
                    <View style={styles.blinkDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                )}
              </View>

              {isLoading && windHistory.length === 0 ? (
                <View style={{ height: 220, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={APP_CONFIG.colors.accent} />
                  <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>Fetching DSCOVR data…</Text>
                </View>
              ) : (
                <LineChart
                  data={{
                    labels: speedLabels,
                    datasets: [{
                      data: speedValues,
                      color: (opacity = 1) => `rgba(0, 198, 255, ${opacity})`,
                      strokeWidth: 3,
                    }],
                  }}
                  width={CHART_WIDTH}
                  height={220}
                  yAxisSuffix=" km/s"
                  chartConfig={{
                    backgroundColor: SAFE_CHART_BG,
                    backgroundGradientFrom: SAFE_CHART_BG,
                    backgroundGradientTo: SAFE_CHART_BG,
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(0, 198, 255, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                    style: { borderRadius: 16 },
                    propsForDots: { r: '4', strokeWidth: '2', stroke: APP_CONFIG.colors.accent },
                  }}
                  bezier
                  style={styles.chart}
                />
              )}

              {/* ── Kp Index (Real NOAA History) ── */}
              <View style={styles.secondaryChartSection}>
                <View style={styles.secondaryHeader}>
                  <Text style={styles.secondaryTitle}>Geomagnetic Activity (Kp)</Text>
                  <Text style={styles.secondarySubtitle}>
                    {kpSampled.length} readings · Current Kp: {solarData.spaceWeather.kpIndex || 0}
                  </Text>
                </View>

                {kpValues.length > 0 && kpValues[0] !== 0 ? (
                  <BarChart
                    data={{
                      labels: kpLabels,
                      datasets: [{ data: kpValues, colors: kpBarColors } as any],
                    }}
                    width={CHART_WIDTH}
                    height={170}
                    yAxisLabel=""
                    yAxisSuffix=""
                    chartConfig={{
                      backgroundColor: SAFE_CHART_BG,
                      backgroundGradientFrom: SAFE_CHART_BG,
                      backgroundGradientTo: SAFE_CHART_BG,
                      decimalPlaces: 0,
                      color: (opacity = 1) => `rgba(255,255,255,${opacity})`,
                      labelColor: (opacity = 1) => `rgba(148,163,184,${opacity})`,
                      barPercentage: 0.6,
                    }}
                    style={styles.secondaryChart}
                    fromZero
                    withInnerLines={false}
                  />
                ) : (
                  <View style={{ height: 170, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)' }}>No Kp data for this window</Text>
                  </View>
                )}
              </View>

              {/* Time window selector */}
              <View style={styles.filterRow}>
                {TIME_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => { setActiveFilter(opt); resetSimulation(); }}
                    style={[styles.filterChip, activeFilter === opt && styles.activeFilter]}
                  >
                    <Text style={[styles.filterText, activeFilter === opt && styles.activeFilterText]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </GlassCard>
          </Animated.View>

          {/* ── Simulation Controls ── */}
          <Animated.View style={[styles.controlPanel, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <GlassCard style={styles.controlGlass}>
              <View style={styles.controlRow}>
                <TouchableOpacity
                  style={styles.controlBtn}
                  onPress={() => setIsPlaying(p => !p)}
                >
                  {isPlaying
                    ? <Pause size={24} color="#FFF" />
                    : <Play size={24} color="#FFF" style={{ marginLeft: 4 }} />}
                </TouchableOpacity>

                <View style={styles.progressContainer}>
                  <Text style={styles.progressLabel}>
                    Simulation Timeline
                    {simIndex > 0 && speedSampled.length > 0 && speedSampled[simIndex]
                      ? ` — ${Math.round(speedSampled[simIndex].speed)} km/s`
                      : ''}
                  </Text>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${simProgress}%` as any }]} />
                  </View>
                </View>

                <TouchableOpacity style={styles.controlBtnSmall} onPress={resetSimulation}>
                  <RotateCcw size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            </GlassCard>
          </Animated.View>

          {/* ── Live Metrics Grid ── */}
          <View style={styles.metricsGrid}>
            <GlassCard style={styles.metricCard}>
              <Wind size={20} color={APP_CONFIG.colors.info} style={styles.metricIcon} />
              <Text style={styles.metricValue}>{solarData.solarWind.speed}</Text>
              <Text style={styles.metricLabel}>Wind Speed</Text>
            </GlassCard>
            <GlassCard style={styles.metricCard}>
              <Thermometer size={20} color={APP_CONFIG.colors.warning} style={styles.metricIcon} />
              <Text style={styles.metricValue}>{solarData.solarWind.temperature}</Text>
              <Text style={styles.metricLabel}>Temperature</Text>
            </GlassCard>
            <GlassCard style={styles.metricCard}>
              <Activity size={20} color={APP_CONFIG.colors.success} style={styles.metricIcon} />
              <Text style={styles.metricValue}>{solarData.solarWind.density}</Text>
              <Text style={styles.metricLabel}>Density</Text>
            </GlassCard>
            <GlassCard style={styles.metricCard}>
              <Magnet size={20} color={APP_CONFIG.colors.accent} style={styles.metricIcon} />
              <Text style={styles.metricValue}>{solarData.solarWind.magneticField}</Text>
              <Text style={styles.metricLabel}>B-Field</Text>
            </GlassCard>
          </View>

          {/* ── Impact Analysis ── */}
          <Animated.View style={[styles.detailsCard, { opacity: fadeAnim }]}>
            <LinearGradient
              colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
              style={styles.detailsGradient}
            >
              <View style={styles.detailsHeader}>
                <FileText size={18} color={APP_CONFIG.colors.text.secondary} />
                <Text style={styles.detailsTitle}>Impact Analysis</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Geomagnetic Activity</Text>
                <Text style={styles.detailValue}>{solarData.spaceWeather.geomagneticActivity}</Text>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Aurora Visibility</Text>
                <Text style={styles.detailValue}>{solarData.spaceWeather.auroraVisibility}</Text>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Satellite Risk</Text>
                <Text style={[styles.detailValue,
                  { color: solarData.spaceWeather.satelliteRisk === 'High'
                      ? APP_CONFIG.colors.warning
                      : APP_CONFIG.colors.success }]}>
                  {solarData.spaceWeather.satelliteRisk}
                </Text>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Data Points Loaded</Text>
                <Text style={styles.detailValue}>
                  {windHistory.length} wind · {kpHistory.length} Kp
                </Text>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Source</Text>
                <Text style={styles.detailValue}>NOAA SWPC / NASA DONKI</Text>
              </View>
            </LinearGradient>
          </Animated.View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </ParticleBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: APP_CONFIG.colors.border.subtle,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: APP_CONFIG.colors.overlay.dark,
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.border.default,
  },
  scrollContent: {
    padding: SCROLL_PAD,
  },
  mainGraphCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  glassCard: {
    padding: CARD_PAD,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  cardSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.5)',
  },
  blinkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: APP_CONFIG.colors.error,
    marginRight: 6,
  },
  liveText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: APP_CONFIG.colors.error,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  secondaryChartSection: {
    marginTop: 16,
  },
  secondaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  secondarySubtitle: {
    fontSize: 11,
    color: 'rgba(148,163,184,0.9)',
  },
  secondaryChart: {
    marginTop: 4,
    borderRadius: 12,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 20,
    padding: 4,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  activeFilter: {
    backgroundColor: APP_CONFIG.colors.accent,
  },
  filterText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
  },
  activeFilterText: {
    color: '#FFF',
  },
  controlPanel: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  controlGlass: {
    padding: 16,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: APP_CONFIG.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: APP_CONFIG.colors.accent,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  controlBtnSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    flex: 1,
  },
  progressLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: APP_CONFIG.colors.info,
    borderRadius: 3,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    width: (width - SCROLL_PAD * 2 - 12) / 2,
    padding: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  metricIcon: {
    marginBottom: 12,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  detailsCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  detailsGradient: {
    padding: 20,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  detailDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  detailLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
});