import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StatusBar,
  Image,
  Animated,
  Dimensions,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LayoutDashboard,
  Activity,
  Zap,
  Radio,
  ChevronRight,
  Wind,
  Gauge,
  Thermometer,
  Orbit,
  Brain,
  Rocket,
  TrendingUp,
  TrendingDown,
  Sun,
  Search,
  Bell,
  Cpu,
  AlertTriangle,
  Timer,
  ArrowRightCircle,
  MapPin,
  ArrowRight,
  ShieldCheck,
  Globe,
  Satellite,
  CloudSun,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { BlurView } from 'expo-blur';
import { APP_CONFIG } from '../utils/constants';
import { logger } from '../utils/logger';
import { getTrendColor } from '../utils/helpers';
import FloatingNavbar from '../components/FloatingNavbar';
import ParticleBackground from '../components/ParticleBackground';
import { getSpaceWeatherSummary } from '../utils/nasaApi';
import { getRealTimeSolarWindSummary } from '../utils/noaaApi';
import { cmeApi, getMockPrediction } from '../utils/cmePredictionApi';
import { LinearGradient } from 'expo-linear-gradient';
import SeverityBar from '../components/SeverityBar';

type Props = NativeStackScreenProps<RootStackParamList, 'Landing'>;

const { width } = Dimensions.get('window');

// Responsive Grid Config
const numColumns = width > 768 ? 2 : 1;
const GRID_GAP = 16;
const GRID_PAD = 24;
const cardWidth = numColumns > 1 ? (width - GRID_PAD * 2 - GRID_GAP) / 2 : width - GRID_PAD * 2;

const buildLandingSummary = (
  cmeProbability: number,
  alertLevel: string,
  kpIndex: number,
  solarWindSpeed: string,
  mlConnected: boolean,
): string => {
  if (!mlConnected) {
    return 'Using demo prediction — start the OrbitBharat ML backend to enable live CME risk estimates.';
  }

  let impact: string;
  if (alertLevel === 'EXTREME' || cmeProbability >= 80 || kpIndex >= 7) {
    impact = 'High geomagnetic storm risk with potential impact on navigation and power grids.';
  } else if (alertLevel === 'HIGH' || cmeProbability >= 60 || kpIndex >= 5) {
    impact = 'Elevated storm risk; navigation and HF communications may be intermittently affected.';
  } else if (alertLevel === 'MODERATE' || cmeProbability >= 30 || kpIndex >= 3) {
    impact = 'Moderate space‑weather activity with minor satellite and GNSS disturbances possible.';
  } else {
    impact = 'Low space‑weather activity; nominal conditions for most missions.';
  }

  const prob = `${Math.round(cmeProbability)}%`;
  const kp = `Kp=${kpIndex}`;

  return `${impact} Current CME impact probability is ${prob} with ${kp} and solar wind near ${solarWindSpeed || 'N/A'}.`;
};

export default function Landing({ navigation }: Props) {
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Refresh state
  const [refreshing, setRefreshing] = useState(false);

  // Real data states
  const [cmeCount, setCmeCount] = useState<number>(0);
  const [todayEvents, setTodayEvents] = useState<number>(0);
  const [solarWindSpeed, setSolarWindSpeed] = useState<string>('--');
  const [kpIndex, setKpIndex] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // ML Prediction states
  const [cmeProbability, setCmeProbability] = useState<number>(0);
  const [alertLevel, setAlertLevel] = useState<string>('NONE');
  const [arrivalEta, setArrivalEta] = useState<string>('--');
  const [mlConnected, setMlConnected] = useState<boolean>(false);

  // Fetch real space weather data + ML predictions
  const fetchSpaceWeatherData = useCallback(async () => {
    try {
      const [nasaData, noaaData] = await Promise.all([
        getSpaceWeatherSummary(),
        getRealTimeSolarWindSummary(),
      ]);

      if (nasaData) {
        setCmeCount(nasaData.totalCMEs);
        setTodayEvents(nasaData.totalFlares);
        setLastUpdated(new Date().toLocaleTimeString());
      }

      if (noaaData) {
        setSolarWindSpeed(`${Math.round(noaaData.current.speed)} km/s`);
        setKpIndex(noaaData.geomagnetic.kpIndex);
      }

      // Fetch ML prediction
      try {
        const isHealthy = await cmeApi.healthCheck();
        setMlConnected(isHealthy);

        if (isHealthy) {
          const prediction = await cmeApi.getPrediction();
          if (prediction.status === 'success') {
            setCmeProbability(prediction.prediction.cme_probability);
            setAlertLevel(prediction.prediction.alert_level);
            setArrivalEta(prediction.prediction.arrival_time_eta);
          }
        } else {
          // Use mock data for demo
          const mock = getMockPrediction();
          setCmeProbability(mock.prediction.cme_probability);
          setAlertLevel(mock.prediction.alert_level);
          setArrivalEta(mock.prediction.arrival_time_eta);
        }
      } catch (mlError) {
        logger.warn('ML prediction unavailable', { mlError }, 'Landing');
        const mock = getMockPrediction();
        setCmeProbability(mock.prediction.cme_probability);
        setAlertLevel(mock.prediction.alert_level);
        setArrivalEta(mock.prediction.arrival_time_eta);
      }

      logger.info('Landing page data fetched', {}, 'Landing');
    } catch (error) {
      logger.error('Error fetching space weather for landing', { error }, 'Landing');
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSpaceWeatherData();
    setRefreshing(false);
  }, [fetchSpaceWeatherData]);

  useEffect(() => {
    fetchSpaceWeatherData();

    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchSpaceWeatherData, 5 * 60 * 1000);

    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for counters
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    return () => clearInterval(interval);
  }, [fetchSpaceWeatherData]);


  const handleNavigation = (screen: keyof RootStackParamList) => {
    navigation.navigate(screen);
  };

  const handleTabPress = (tab: string) => {
    switch (tab) {
      case 'home': break;
      case 'blog': handleNavigation('Blog'); break;
      case 'chatbot': handleNavigation('Chatbot'); break;
    }
  };

  const getAlertColor = (level: string) => {
    switch (level) {
      case 'EXTREME': return '#FF3B30';
      case 'HIGH': return '#FF9F0A';
      case 'MODERATE': return '#FFD60A';
      default: return '#30D158'; // Low
    }
  };

  const currentAlertColor = getAlertColor(alertLevel);
  const summaryText = buildLandingSummary(cmeProbability, alertLevel, kpIndex, solarWindSpeed, mlConnected);

  return (
    <ParticleBackground>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={APP_CONFIG.colors.accent} />}
        >
          {/* Top Navbar */}
          <BlurView intensity={20} tint="dark" style={styles.topNav}>
            <View style={styles.headerRow}>
              <View style={styles.brandContainer}>
                <Sun size={24} color={APP_CONFIG.colors.accent} style={styles.logoIcon} />
                <Text style={styles.brandText}>
                  ORBIT
                  <Text style={{ color: APP_CONFIG.colors.accent }}>BHARAT</Text>
                </Text>
              </View>
              <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Settings')}>
                <LinearGradient colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']} style={styles.profileGradient}>
                  <View style={styles.statusOnline} />
                  <Globe size={20} color="#FFF" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </BlurView>


          {/* Main Hero - System Status */}
          <Animated.View style={[styles.heroContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <LinearGradient
              colors={['rgba(0, 102, 255, 0.15)', 'rgba(0, 163, 255, 0.05)', 'rgba(0, 0, 0, 0)']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={styles.heroGradient}
            >
              <View style={[styles.statusIndicator, { borderColor: currentAlertColor }]}>
                <View style={[styles.statusDot, { backgroundColor: currentAlertColor }]} />
                <Text style={[styles.statusText, { color: currentAlertColor }]}>SYSTEM STATUS: {alertLevel}</Text>
              </View>

              <View style={styles.heroMain}>
                <View style={styles.probabilityContainer}>
                  <Text style={styles.probabilityLabel}>CME IMPACT PROBABILITY</Text>
                  <View style={styles.probabilityRow}>
                    <Text style={styles.probabilityValue}>{cmeProbability.toFixed(0)}</Text>
                    <Text style={styles.probabilityUnit}>%</Text>
                  </View>
                </View>

                <View style={styles.etaContainer}>
                  <Text style={styles.etaLabel}>EST. ARRIVAL</Text>
                  <View style={styles.etaBox}>
                    <Timer size={14} color="#AAA" style={{ marginRight: 6 }} />
                    <Text style={styles.etaValue}>{arrivalEta}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.gridStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>SOLAR WIND</Text>
                  <Text style={styles.statValue}>{solarWindSpeed}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>KP INDEX</Text>
                  <Text style={styles.statValue}>{kpIndex}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>ACTIVE REGIONS</Text>
                  <Text style={styles.statValue}>{todayEvents}</Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Mission Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={[styles.summaryDot, { backgroundColor: currentAlertColor }]} />
              <Text style={styles.summaryTitle}>OrbitBharat Mission Summary</Text>
              <View style={[styles.connectionBadge, { backgroundColor: mlConnected ? 'rgba(48,209,88,0.15)' : 'rgba(255,159,10,0.15)' }]}>
                <View style={[styles.connectionDot, { backgroundColor: mlConnected ? '#30D158' : '#FF9F0A' }]} />
                <Text style={[styles.connectionText, { color: mlConnected ? '#30D158' : '#FF9F0A' }]}>
                  {mlConnected ? 'LIVE' : 'DEMO'}
                </Text>
              </View>
            </View>
            <Text style={styles.summaryText}>{summaryText}</Text>
            <SeverityBar
              value={cmeProbability}
              label="CME Risk Level"
              gradientColors={['#30D158', '#FFD60A', '#FF3B30']}
              legendLabels={['Low', 'Moderate', 'High']}
              barHeight={6}
            />
          </View>

          {/* Action Grid */}
          <View style={styles.gridContainer}>
            {/* Simulation Card */}
            <TouchableOpacity onPress={() => handleNavigation('GraphSimulation')} style={[styles.gridCard, { width: cardWidth }]}>
              <BlurView intensity={20} tint="light" style={styles.glassInner}>
                <View style={styles.cardIconConfig}>
                  <LinearGradient colors={['#0066FF', '#00A3FF']} style={styles.iconGradient}>
                    <LayoutDashboard size={24} color="#FFF" />
                  </LinearGradient>
                </View>
                <Text style={styles.cardTitle}>Data Simulation</Text>
                <Text style={styles.cardDesc}>Analyze historical events & patterns.</Text>
                <View style={styles.cardArrow}>
                  <ArrowRight size={16} color="#FFF" />
                </View>
              </BlurView>
            </TouchableOpacity>

            {/* Prediction Card */}
            <TouchableOpacity onPress={() => handleNavigation('Prediction')} style={[styles.gridCard, { width: cardWidth }]}>
              <BlurView intensity={20} tint="light" style={styles.glassInner}>
                <View style={styles.cardIconConfig}>
                  <LinearGradient colors={['#0044CC', '#0066FF']} style={styles.iconGradient}>
                    <Cpu size={24} color="#FFF" />
                  </LinearGradient>
                </View>
                <Text style={styles.cardTitle}>ML Forecast</Text>
                <Text style={styles.cardDesc}>AI-driven prediction models.</Text>
                <View style={styles.cardArrow}>
                  <ArrowRight size={16} color="#FFF" />
                </View>
              </BlurView>
            </TouchableOpacity>

            {/* Aditya L1 Data Card */}
            <TouchableOpacity onPress={() => handleNavigation('AdityaL1')} style={[styles.gridCard, { width: cardWidth }]}>
              <BlurView intensity={20} tint="light" style={styles.glassInner}>
                <View style={styles.cardIconConfig}>
                  <LinearGradient colors={['#FF6B00', '#FF9500']} style={styles.iconGradient}>
                    <Sun size={24} color="#FFF" />
                  </LinearGradient>
                </View>
                <Text style={styles.cardTitle}>Aditya-L1 Data</Text>
                <Text style={styles.cardDesc}>Live SWIS & VELC readings.</Text>
                <View style={styles.cardArrow}>
                  <ArrowRight size={16} color="#FFF" />
                </View>
              </BlurView>
            </TouchableOpacity>

            {/* Satellite Tracker Card */}
            <TouchableOpacity onPress={() => handleNavigation('SatelliteTracker')} style={[styles.gridCard, { width: cardWidth }]}>
              <BlurView intensity={20} tint="light" style={styles.glassInner}>
                <View style={styles.cardIconConfig}>
                  <LinearGradient colors={['#3399FF', '#00A3FF']} style={styles.iconGradient}>
                    <Satellite size={24} color="#FFF" />
                  </LinearGradient>
                </View>
                <Text style={styles.cardTitle}>ISRO Satellites</Text>
                <Text style={styles.cardDesc}>Track Indian satellites.</Text>
                <View style={styles.cardArrow}>
                  <ArrowRight size={16} color="#FFF" />
                </View>
              </BlurView>
            </TouchableOpacity>

            {/* Weather Forecast Card */}
            <TouchableOpacity onPress={() => handleNavigation('WeatherForecast')} style={[styles.gridCard, { width: cardWidth }]}>
              <BlurView intensity={20} tint="light" style={styles.glassInner}>
                <View style={styles.cardIconConfig}>
                  <LinearGradient colors={['#9333EA', '#A855F7']} style={styles.iconGradient}>
                    <CloudSun size={24} color="#FFF" />
                  </LinearGradient>
                </View>
                <Text style={styles.cardTitle}>Space Weather</Text>
                <Text style={styles.cardDesc}>72-hour Kp forecast.</Text>
                <View style={styles.cardArrow}>
                  <ArrowRight size={16} color="#FFF" />
                </View>
              </BlurView>
            </TouchableOpacity>

            {/* Global Space Weather Map */}
            <TouchableOpacity onPress={() => handleNavigation('SpaceWeatherMap')} style={[styles.gridCard, { width: cardWidth }]}>
              <BlurView intensity={20} tint="light" style={styles.glassInner}>
                <View style={styles.cardIconConfig}>
                  <LinearGradient colors={['#0ea5e9', '#22c55e']} style={styles.iconGradient}>
                    <Globe size={24} color="#FFF" />
                  </LinearGradient>
                </View>
                <Text style={styles.cardTitle}>Aurora Map</Text>
                <Text style={styles.cardDesc}>Global Kp auroral ovals.</Text>
                <View style={styles.cardArrow}>
                  <ArrowRight size={16} color="#FFF" />
                </View>
              </BlurView>
            </TouchableOpacity>

            {/* Community Blog Card */}
            <TouchableOpacity onPress={() => handleNavigation('Blog')} style={[styles.gridCard, { width: cardWidth }]}>
              <BlurView intensity={20} tint="light" style={styles.glassInner}>
                <View style={styles.cardIconConfig}>
                  <LinearGradient colors={['#0066FF', '#3399FF']} style={styles.iconGradient}>
                    <Globe size={24} color="#FFF" />
                  </LinearGradient>
                </View>
                <Text style={styles.cardTitle}>Research Hub</Text>
                <Text style={styles.cardDesc}>Community insights & papers.</Text>
                <View style={styles.cardArrow}>
                  <ArrowRight size={16} color="#FFF" />
                </View>
              </BlurView>
            </TouchableOpacity>
          </View>

          {/* Live Alert Ticker */}
          <Animated.View style={[styles.alertTicker, { opacity: fadeAnim }]}>
            <View style={styles.alertIcon}>
              <Activity size={18} color={APP_CONFIG.colors.text.secondary} />
            </View>
            <Text style={styles.tickerText} numberOfLines={1}>
              LATEST: Solar flare M1.2 detected from Region 3576 • Updated {lastUpdated}
            </Text>
          </Animated.View>

          {/* Quick Stats Row */}
          <Text style={styles.sectionHeader}>Mission Telemetry</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.telemetryScroll}>
            {[
              { label: 'CME COUNT', value: cmeCount, unit: '', icon: Radio, color: APP_CONFIG.colors.accent },
              { label: 'WIND TEMP', value: '1.2M', unit: 'K', icon: Thermometer, color: APP_CONFIG.colors.primaryLight },
              { label: 'DENSITY', value: '4.5', unit: 'p/cm³', icon: Wind, color: APP_CONFIG.colors.primary },
              { label: 'MAG FIELD', value: '6.2', unit: 'nT', icon: Zap, color: APP_CONFIG.colors.accent }
            ].map((item, index) => (
              <View key={index} style={styles.telemetryCardWrap}>
                <BlurView intensity={10} tint="light" style={styles.telemetryCard}>
                  <item.icon size={18} color={item.color} style={{ marginBottom: 8 }} />
                  <Text style={styles.telemetryValue}>{item.value}<Text style={styles.telemetryUnit}>{item.unit}</Text></Text>
                  <Text style={styles.telemetryLabel}>{item.label}</Text>
                </BlurView>
              </View>
            ))}
          </ScrollView>

          <View style={{ height: 100 }} />
        </ScrollView>

        <FloatingNavbar activeTab="home" onTabPress={handleTabPress} />
      </SafeAreaView>
    </ParticleBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  // Premium Top Navigation
  topNav: {
    paddingTop: 8,
    paddingBottom: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: APP_CONFIG.colors.border.subtle,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoIcon: {},
  brandText: {
    color: APP_CONFIG.colors.white,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 3,
  },
  profileBtn: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  profileGradient: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: APP_CONFIG.colors.border.accent,
    backgroundColor: 'rgba(0, 102, 255, 0.1)',
  },
  statusOnline: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: APP_CONFIG.colors.success,
    borderWidth: 2,
    borderColor: APP_CONFIG.colors.richBlack,
  },
  scrollContent: {
    paddingTop: 8,
  },
  summaryCard: {
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 22,
    padding: 18,
    backgroundColor: APP_CONFIG.colors.background.card,
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.border.accent,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
    flexWrap: 'nowrap',
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: APP_CONFIG.colors.white,
    letterSpacing: 1,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  summaryText: {
    fontSize: 13,
    color: APP_CONFIG.colors.text.secondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  summaryBarBackground: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(15,23,42,0.9)',
    overflow: 'hidden',
  },
  summaryBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  summaryScaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  summaryScaleLabel: {
    fontSize: 10,
    color: APP_CONFIG.colors.text.tertiary,
  },

  // Premium Hero Section
  heroContainer: {
    marginHorizontal: 24,
    borderRadius: 28,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.border.accent,
    overflow: 'hidden',
    backgroundColor: APP_CONFIG.colors.background.card,
  },
  heroGradient: {
    padding: 28,
  },
  statusIndicator: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  heroMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 32,
  },
  probabilityContainer: {},
  probabilityLabel: {
    color: APP_CONFIG.colors.text.secondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  probabilityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  probabilityValue: {
    color: APP_CONFIG.colors.white,
    fontSize: 64,
    fontWeight: '200',
    lineHeight: 68,
    letterSpacing: -2,
  },
  probabilityUnit: {
    color: APP_CONFIG.colors.accent,
    fontSize: 28,
    fontWeight: '300',
    marginTop: 10,
    marginLeft: 4,
  },
  etaContainer: {
    alignItems: 'flex-end',
  },
  etaLabel: {
    color: APP_CONFIG.colors.text.secondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  etaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 102, 255, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.border.accent,
  },
  etaValue: {
    color: APP_CONFIG.colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  gridStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 102, 255, 0.05)',
    borderRadius: 16,
    padding: 18,
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: APP_CONFIG.colors.border.default,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    backgroundColor: APP_CONFIG.colors.border.default,
    height: '80%',
    alignSelf: 'center',
  },
  statLabel: {
    color: APP_CONFIG.colors.text.tertiary,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  statValue: {
    color: APP_CONFIG.colors.white,
    fontSize: 16,
    fontWeight: '600',
  },

  // Premium Grid Cards
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    gap: 16,
  },
  gridCard: {
    marginBottom: 0,
    borderRadius: 24,
    overflow: 'hidden',
    height: 170,
    backgroundColor: APP_CONFIG.colors.background.card,
    borderColor: APP_CONFIG.colors.border.default,
    borderWidth: 1,
  },
  glassInner: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  cardIconConfig: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  iconGradient: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    color: APP_CONFIG.colors.white,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  cardDesc: {
    color: APP_CONFIG.colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  cardArrow: {
    position: 'absolute',
    top: 20,
    right: 20,
    opacity: 0.6,
  },

  // Premium Ticker
  alertTicker: {
    marginHorizontal: 24,
    marginVertical: 28,
    backgroundColor: 'rgba(0, 102, 255, 0.08)',
    borderRadius: 100,
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.border.accent,
  },
  alertIcon: {
    marginRight: 12,
  },
  tickerText: {
    color: APP_CONFIG.colors.text.secondary,
    fontSize: 12,
    flex: 1,
    fontWeight: '500',
  },

  // Premium Telemetry Section
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: APP_CONFIG.colors.white,
    marginLeft: 24,
    marginBottom: 18,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  telemetryScroll: {
    paddingHorizontal: 24,
    gap: 14,
  },
  telemetryCardWrap: {
    width: 115,
    height: 115,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.border.default,
  },
  telemetryCard: {
    flex: 1,
    backgroundColor: APP_CONFIG.colors.background.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  telemetryValue: {
    color: APP_CONFIG.colors.white,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  telemetryUnit: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
    fontWeight: '400',
  },
  telemetryLabel: {
    color: APP_CONFIG.colors.text.tertiary,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Connection Status Badge
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 'auto',
    flexShrink: 0,
  },
  connectionDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginRight: 4,
  },
  connectionText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
});