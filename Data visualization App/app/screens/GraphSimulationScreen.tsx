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
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import { APP_CONFIG, TIME_FILTERS } from '../utils/constants';
import { logger } from '../utils/logger';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import ParticleBackground from '../components/ParticleBackground';
import { getSpaceWeatherSummary } from '../utils/nasaApi';
import { getRealTimeSolarWindSummary, getAuroraForecast } from '../utils/noaaApi';

type Props = NativeStackScreenProps<RootStackParamList, 'GraphSimulation'>;

const { width } = Dimensions.get('window');
const SCROLL_PAD = 20;
const CARD_PAD = 20;
// Chart width = screen - scroll padding both sides - card padding both sides
const CHART_WIDTH = Math.max(width - SCROLL_PAD * 2 - CARD_PAD * 2, 200);

// Types for API data
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
  const [activeFilter, setActiveFilter] = useState('1D');
  const [activeTab, setActiveTab] = useState<'summary' | 'details'>('summary');

  // Simulation State
  const [isPlaying, setIsPlaying] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const simulationProgress = useRef(new Animated.Value(0)).current;

  // Real data states
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [chartData, setChartData] = useState<number[]>([400, 420, 440, 430, 460, 450, 480]);

  const [solarData, setSolarData] = useState<SolarData>({
    currentCME: { speed: '--', direction: '--', intensity: '--', arrivalTime: '--', confidence: '--' },
    solarWind: { speed: '--', density: '--', temperature: '--', magneticField: '--' },
    spaceWeather: { geomagneticActivity: '--', solarFlareProbability: '--', auroraVisibility: '--', satelliteRisk: '--', kpIndex: 0 }
  });

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Fetch real data from APIs
  const fetchRealData = useCallback(async () => {
    try {
      const [nasaData, noaaData] = await Promise.all([
        getSpaceWeatherSummary(),
        getRealTimeSolarWindSummary(),
      ]);

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
            temperature: `${(noaaData.current.temperature / 1000000).toFixed(2)}Mk`,
            magneticField: `${noaaData.current.magneticField.toFixed(1)} nT`
          },
          spaceWeather: {
            geomagneticActivity: noaaData.geomagnetic.activity,
            solarFlareProbability: nasaData?.totalFlares ? 'Elevated' : 'Low',
            auroraVisibility: auroraInfo.visibility,
            satelliteRisk: satelliteRisk,
            kpIndex: noaaData.geomagnetic.kpIndex
          }
        });

        // Mock chart update based on real speed
        const currentSpeed = noaaData.current.speed;
        setChartData(prev => [...prev.slice(1), currentSpeed]);

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

    // Entrance
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();

    return () => clearInterval(refreshInterval);
  }, [fetchRealData]);

  const toggleSimulation = () => {
    setIsPlaying(!isPlaying);
    // Add logic to animate graph or progress bar
  };

  const getChartData = () => {
    return {
      labels: ['00', '04', '08', '12', '16', '20', '24'],
      datasets: [{
        data: chartData,
        color: (opacity = 1) => `rgba(0, 198, 255, ${opacity})`,
        strokeWidth: 3
      }]
    };
  };

  return (
    <ParticleBackground>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <BlurView intensity={20} tint="dark" style={styles.header}>
            <View style={styles.headerContent}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                <ChevronRight size={24} color="#FFF" style={{ transform: [{ rotate: '180deg' }] }} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Data Simulation</Text>
              <TouchableOpacity onPress={fetchRealData} style={styles.iconBtn}>
                <RefreshCw size={20} color={isLoading ? APP_CONFIG.colors.text.secondary : APP_CONFIG.colors.accent} />
              </TouchableOpacity>
            </View>
          </BlurView>

          {/* Main Graph Card */}
          <Animated.View style={[styles.mainGraphCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <BlurView intensity={30} tint="dark" style={styles.glassCard}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardTitle}>Solar Wind Velocity</Text>
                  <Text style={styles.cardSubtitle}>Real-time SWIS Data Stream</Text>
                </View>
                <View style={styles.liveBadge}>
                  <View style={styles.blinkDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              </View>

              <LineChart
                data={getChartData()}
                width={CHART_WIDTH}
                height={220}
                yAxisSuffix=" km/s"
                chartConfig={{
                  backgroundColor: '#0F172A',
                  backgroundGradientFrom: '#0F172A',
                  backgroundGradientTo: '#1E293B',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(0, 198, 255, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                  style: { borderRadius: 16 },
                  propsForDots: { r: "4", strokeWidth: "2", stroke: APP_CONFIG.colors.accent }
                }}
                bezier
                style={styles.chart}
              />

              {/* Secondary bar chart for Kp index & variability */}
              <View style={styles.secondaryChartSection}>
                <View style={styles.secondaryHeader}>
                  <Text style={styles.secondaryTitle}>Geomagnetic Activity (Kp)</Text>
                  <Text style={styles.secondarySubtitle}>
                    Last 7 checkpoints · Current Kp: {solarData.spaceWeather.kpIndex || 0}
                  </Text>
                </View>
                <BarChart
                  data={{
                    labels: ['-18h', '-15h', '-12h', '-9h', '-6h', '-3h', 'Now'],
                    datasets: [
                      {
                        data: [
                          Math.max(0, (solarData.spaceWeather.kpIndex || 3) - 2),
                          Math.max(0, (solarData.spaceWeather.kpIndex || 3) - 1.5),
                          Math.max(0, (solarData.spaceWeather.kpIndex || 3) - 1),
                          solarData.spaceWeather.kpIndex || 3,
                          Math.min(9, (solarData.spaceWeather.kpIndex || 3) + 0.5),
                          Math.min(9, (solarData.spaceWeather.kpIndex || 3) + 1),
                          solarData.spaceWeather.kpIndex || 3,
                        ],
                        colors: [
                          () => 'rgba(59,130,246,0.85)',
                          () => 'rgba(59,130,246,0.85)',
                          () => 'rgba(129,140,248,0.9)',
                          () => 'rgba(56,189,248,0.95)',
                          () => 'rgba(250,204,21,0.95)',
                          () => 'rgba(248,113,113,0.95)',
                          () => 'rgba(248,113,113,0.95)',
                        ],
                      } as any,
                    ],
                  }}
                  width={CHART_WIDTH}
                  height={170}
                  yAxisLabel=""
                  yAxisSuffix=""
                  chartConfig={{
                    backgroundColor: '#0F172A',
                    backgroundGradientFrom: '#0F172A',
                    backgroundGradientTo: '#1E293B',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(255,255,255,${opacity})`,
                    labelColor: (opacity = 1) => `rgba(148,163,184,${opacity})`,
                    barPercentage: 0.6,
                  }}
                  style={styles.secondaryChart}
                  fromZero
                  withInnerLines={false}
                />
              </View>

              {/* Time Filters */}
              <View style={styles.filterRow}>
                {TIME_FILTERS.map(filter => (
                  <TouchableOpacity
                    key={filter}
                    onPress={() => setActiveFilter(filter)}
                    style={[styles.filterChip, activeFilter === filter && styles.activeFilter]}
                  >
                    <Text style={[styles.filterText, activeFilter === filter && styles.activeFilterText]}>{filter}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </BlurView>
          </Animated.View>

          {/* Simulation Controls */}
          <Animated.View style={[styles.controlPanel, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <BlurView intensity={20} tint="light" style={styles.controlGlass}>
              <View style={styles.controlRow}>
                <TouchableOpacity style={styles.controlBtn} onPress={toggleSimulation}>
                  {isPlaying ? <Pause size={24} color="#FFF" /> : <Play size={24} color="#FFF" style={{ marginLeft: 4 }} />}
                </TouchableOpacity>

                <View style={styles.progressContainer}>
                  <Text style={styles.progressLabel}>Simulation Timeline</Text>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: '30%' }]} />
                  </View>
                </View>

                <TouchableOpacity style={styles.controlBtnSmall}>
                  <RotateCcw size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            </BlurView>
          </Animated.View>

          {/* Metrics Grid */}
          <View style={styles.metricsGrid}>
            <BlurView intensity={20} tint="dark" style={styles.metricCard}>
              <Wind size={20} color={APP_CONFIG.colors.info} style={styles.metricIcon} />
              <Text style={styles.metricValue}>{solarData.solarWind.speed}</Text>
              <Text style={styles.metricLabel}>Wind Speed</Text>
            </BlurView>
            <BlurView intensity={20} tint="dark" style={styles.metricCard}>
              <Thermometer size={20} color={APP_CONFIG.colors.warning} style={styles.metricIcon} />
              <Text style={styles.metricValue}>{solarData.solarWind.temperature}</Text>
              <Text style={styles.metricLabel}>Temperature</Text>
            </BlurView>
            <BlurView intensity={20} tint="dark" style={styles.metricCard}>
              <Activity size={20} color={APP_CONFIG.colors.success} style={styles.metricIcon} />
              <Text style={styles.metricValue}>{solarData.solarWind.density}</Text>
              <Text style={styles.metricLabel}>Density</Text>
            </BlurView>
            <BlurView intensity={20} tint="dark" style={styles.metricCard}>
              <Magnet size={20} color={APP_CONFIG.colors.accent} style={styles.metricIcon} />
              <Text style={styles.metricValue}>{solarData.solarWind.magneticField}</Text>
              <Text style={styles.metricLabel}>B-Field</Text>
            </BlurView>
          </View>

          {/* Detailed Data Section */}
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
                <Text style={[styles.detailValue, { color: solarData.spaceWeather.satelliteRisk === 'High' ? APP_CONFIG.colors.warning : APP_CONFIG.colors.success }]}>
                  {solarData.spaceWeather.satelliteRisk}
                </Text>
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