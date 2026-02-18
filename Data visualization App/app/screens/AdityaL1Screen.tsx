/**
 * Aditya-L1 Mission Dashboard
 * Follows the OrbitBharat Premium Design System (Blue, White & Black)
 * Matches Landing page UI patterns: BlurView glass cards, ParticleBackground,
 * APP_CONFIG colors, LinearGradient with blues only
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  RefreshControl,
  Linking,
  Platform,
  StatusBar,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import {
  Sun,
  Wind,
  Activity,
  Zap,
  Radio,
  Clock,
  ChevronLeft,
  ExternalLink,
  Gauge,
  Brain,
  TrendingUp,
  AlertTriangle,
  Shield,
  Cpu,
  BarChart3,
  Target,
  RefreshCw,
  CheckCircle,
  XCircle,
  Eye,
  Waves,
  Thermometer,
  ArrowRight,
  Globe,
  Satellite,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { APP_CONFIG } from '../utils/constants';
import ParticleBackground from '../components/ParticleBackground';
import { cmeApi, getMockPrediction } from '../utils/cmePredictionApi';

const { width } = Dimensions.get('window');

// ─── Data Interfaces ────────────────────────────────────────
interface SWISData {
  solarWindSpeed: number;
  protonDensity: number;
  protonTemperature: number;
  alphaRatio: number;
}

interface VELCData {
  coronalTemperature: number;
  emissionLineIntensity: number;
  cmeDetected: boolean;
  cmeVelocity: number | null;
}

interface HEL1OSData {
  flareClass: 'QUIET' | 'A' | 'B' | 'C' | 'M' | 'X';
  hardXrayFlux: number;
  photonEnergy: number;
}

interface MAGData {
  magneticFieldStrength: number;
  bzComponent: number;
  btComponent: number;
  fieldDirection: number;
}

interface MLPrediction {
  cmeProbability: number;
  arrivalTimeHours: number;
  confidence: number;
  alertLevel: string;
  isLive: boolean;
}

interface MLModelStatus {
  name: string;
  status: 'ACTIVE' | 'TRAINING' | 'OFFLINE';
  accuracy: number;
  type: string;
}

// ─── Mock Data Generator ─────────────────────────────────────
const generateMockData = () => {
  const windSpeed = 350 + Math.random() * 350;
  const bz = -10 + Math.random() * 20;

  return {
    swis: {
      solarWindSpeed: windSpeed,
      protonDensity: 2 + Math.random() * 15,
      protonTemperature: 50000 + Math.random() * 200000,
      alphaRatio: 0.02 + Math.random() * 0.06,
    } as SWISData,
    velc: {
      coronalTemperature: 1.5 + Math.random() * 1.5,
      emissionLineIntensity: 100 + Math.random() * 500,
      cmeDetected: Math.random() > 0.85,
      cmeVelocity: Math.random() > 0.85 ? 500 + Math.random() * 1500 : null,
    } as VELCData,
    hel1os: {
      flareClass: (['QUIET', 'A', 'B', 'C', 'M', 'X'] as const)[Math.floor(Math.random() * 6)],
      hardXrayFlux: 1e-6 + Math.random() * 1e-5,
      photonEnergy: 10 + Math.random() * 50,
    } as HEL1OSData,
    mag: {
      magneticFieldStrength: 5 + Math.random() * 15,
      bzComponent: bz,
      btComponent: 3 + Math.random() * 12,
      fieldDirection: Math.random() * 360,
    } as MAGData,
  };
};

const ML_MODELS: MLModelStatus[] = [
  { name: 'CME Ensemble (BiLSTM + Transformer)', status: 'ACTIVE', accuracy: 91.2, type: 'Prediction' },
  { name: 'Solar Flare Classifier (CNN)', status: 'ACTIVE', accuracy: 88.7, type: 'Classification' },
  { name: 'Anomaly Transformer', status: 'TRAINING', accuracy: 85.3, type: 'Anomaly Detection' },
  { name: 'Graph Attention Network', status: 'ACTIVE', accuracy: 89.5, type: 'Correlation' },
  { name: 'Neural ODE (Dynamics)', status: 'ACTIVE', accuracy: 87.2, type: 'Time Series' },
  { name: 'Bayesian Uncertainty Net', status: 'ACTIVE', accuracy: 86.8, type: 'Uncertainty' },
];

type TabType = 'overview' | 'livedata' | 'models' | 'analysis';

const AdityaL1Screen: React.FC = () => {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [data, setData] = useState(generateMockData());
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [mlConnected, setMlConnected] = useState(false);
  const [prediction, setPrediction] = useState<MLPrediction>({
    cmeProbability: 35.7, arrivalTimeHours: 48, confidence: 82.3, alertLevel: 'MODERATE', isLive: false,
  });
  const [historicalData, setHistoricalData] = useState<number[]>([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const fetchData = useCallback(async () => {
    const newData = generateMockData();
    setData(newData);
    setLastUpdate(new Date());
    setHistoricalData(prev => [...prev.slice(-23), newData.swis.solarWindSpeed]);

    // Try ML backend
    try {
      const isHealthy = await cmeApi.healthCheck();
      setMlConnected(isHealthy);
      if (isHealthy) {
        const pred = await cmeApi.getPrediction();
        if (pred.status === 'success') {
          setPrediction({
            cmeProbability: pred.prediction.cme_probability,
            arrivalTimeHours: pred.prediction.arrival_time_hours,
            confidence: pred.prediction.confidence,
            alertLevel: pred.prediction.alert_level,
            isLive: true,
          });
          return;
        }
      }
    } catch { }
    const mock = getMockPrediction();
    setPrediction({
      cmeProbability: mock.prediction.cme_probability,
      arrivalTimeHours: mock.prediction.arrival_time_hours,
      confidence: mock.prediction.confidence,
      alertLevel: mock.prediction.alert_level,
      isLive: false,
    });
  }, []);

  const isFocused = useIsFocused();

  useEffect(() => {
    setHistoricalData(Array.from({ length: 24 }, () => 350 + Math.random() * 300));
    fetchData();

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, [fetchData]);

  // Only poll when screen is focused to save battery & bandwidth
  useEffect(() => {
    if (!isFocused) return;
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [isFocused, fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setTimeout(() => setRefreshing(false), 800);
  }, [fetchData]);

  const fmt = (n: number, d: number = 1) => n.toFixed(d);

  const getAlertColor = (level: string) => {
    switch (level) {
      case 'EXTREME': return '#FF3B30';
      case 'HIGH': return '#FF9F0A';
      case 'MODERATE': return '#FFD60A';
      default: return '#30D158';
    }
  };

  const getWindLabel = (speed: number) => {
    if (speed < 400) return 'SLOW';
    if (speed < 550) return 'NORMAL';
    if (speed < 700) return 'FAST';
    return 'EXTREME';
  };

  const getBzLabel = (bz: number) => bz > 0 ? 'NORTH' : bz > -5 ? 'NEUTRAL' : 'SOUTH';

  const alertColor = getAlertColor(prediction.alertLevel);

  // ─── Tab Bar ──────────────────────────────────────────────
  const renderTabs = () => (
    <View style={s.tabRow}>
      {(['overview', 'livedata', 'models', 'analysis'] as TabType[]).map((tab) => {
        const isActive = activeTab === tab;
        const labels: Record<TabType, string> = {
          overview: 'Overview', livedata: 'Live Data', models: 'ML Models', analysis: 'Analysis',
        };
        const Icons: Record<TabType, any> = {
          overview: Satellite, livedata: Activity, models: Brain, analysis: BarChart3,
        };
        const Icon = Icons[tab];

        return (
          <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={[s.tab, isActive && s.tabActive]}>
            <Icon size={14} color={isActive ? APP_CONFIG.colors.accent : APP_CONFIG.colors.text.tertiary} />
            <Text style={[s.tabText, isActive && s.tabTextActive]}>{labels[tab]}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ─── Overview Tab ─────────────────────────────────────────
  const renderOverview = () => (
    <>
      {/* Hero Card */}
      <Animated.View style={[s.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <LinearGradient
          colors={['rgba(0, 102, 255, 0.15)', 'rgba(0, 163, 255, 0.05)', 'rgba(0, 0, 0, 0)']}
          style={s.heroGradient}
        >
          <View style={s.heroTop}>
            <View style={s.heroIconWrap}>
              <LinearGradient colors={APP_CONFIG.colors.gradient.primary as [string, string]} style={s.heroIconGrad}>
                <Sun size={28} color="#FFF" />
              </LinearGradient>
            </View>
            <View style={s.heroInfo}>
              <Text style={s.heroTitle}>ADITYA-L1</Text>
              <Text style={s.heroSub}>India's First Solar Observatory</Text>
              <View style={s.heroStatusRow}>
                <View style={[s.dot, { backgroundColor: APP_CONFIG.colors.success }]} />
                <Text style={[s.heroStatusText, { color: APP_CONFIG.colors.success }]}>OPERATIONAL AT L1</Text>
              </View>
            </View>
          </View>

          <View style={s.heroStats}>
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>1.5M</Text>
              <Text style={s.heroStatLabel}>KM FROM EARTH</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>7</Text>
              <Text style={s.heroStatLabel}>PAYLOADS</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>178</Text>
              <Text style={s.heroStatLabel}>DAYS ORBIT</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Alert Card */}
      <View style={s.card}>
        <View style={s.alertInner}>
          <View style={[s.alertIndicator, { borderColor: alertColor }]}>
            <View style={[s.dot, { backgroundColor: alertColor }]} />
            <Text style={[s.alertLevelText, { color: alertColor }]}>{prediction.alertLevel} ALERT</Text>
            {prediction.isLive && <Text style={s.liveBadge}>LIVE</Text>}
            {!prediction.isLive && <Text style={s.demoBadge}>DEMO</Text>}
          </View>

          <View style={s.alertGrid}>
            <View style={s.alertItem}>
              <Text style={s.alertLabel}>CME PROBABILITY</Text>
              <Text style={s.alertVal}>{prediction.cmeProbability.toFixed(0)}<Text style={s.alertUnit}>%</Text></Text>
            </View>
            <View style={s.alertItem}>
              <Text style={s.alertLabel}>EST. ARRIVAL</Text>
              <Text style={s.alertVal}>{prediction.arrivalTimeHours.toFixed(0)}<Text style={s.alertUnit}>h</Text></Text>
            </View>
            <View style={s.alertItem}>
              <Text style={s.alertLabel}>CONFIDENCE</Text>
              <Text style={s.alertVal}>{prediction.confidence.toFixed(0)}<Text style={s.alertUnit}>%</Text></Text>
            </View>
          </View>
        </View>
      </View>

      {/* Key Solar Wind Parameters */}
      <Text style={s.sectionHeader}>Solar Wind Parameters</Text>
      <View style={s.paramGrid}>
        {[
          { label: 'WIND SPEED', value: fmt(data.swis.solarWindSpeed, 0), unit: 'km/s', badge: getWindLabel(data.swis.solarWindSpeed), icon: Wind },
          { label: 'IMF BZ', value: fmt(data.mag.bzComponent), unit: 'nT', badge: getBzLabel(data.mag.bzComponent), icon: Zap },
          { label: 'DENSITY', value: fmt(data.swis.protonDensity), unit: 'p/cm³', badge: '', icon: Gauge },
          { label: 'TEMPERATURE', value: fmt(data.swis.protonTemperature / 1000, 0) + 'K', unit: '×1000', badge: '', icon: Thermometer },
        ].map((item, i) => (
          <View key={i} style={s.paramCardWrap}>
            <BlurView intensity={10} tint="light" style={s.paramCard}>
              <item.icon size={20} color={APP_CONFIG.colors.accent} style={{ marginBottom: 8 }} />
              <Text style={s.paramValue}>{item.value}</Text>
              <Text style={s.paramUnit}>{item.unit}</Text>
              {item.badge !== '' && (
                <View style={s.paramBadge}>
                  <Text style={s.paramBadgeText}>{item.badge}</Text>
                </View>
              )}
              <Text style={s.paramLabel}>{item.label}</Text>
            </BlurView>
          </View>
        ))}
      </View>

      {/* All 7 Payloads */}
      <Text style={s.sectionHeader}>Payload Status</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.payloadScroll}>
        {[
          { name: 'VELC', desc: 'Coronagraph' },
          { name: 'SUIT', desc: 'UV Imager' },
          { name: 'SWIS', desc: 'Ion Spectrometer' },
          { name: 'ASPEX', desc: 'Particle Analyzer' },
          { name: 'PAPA', desc: 'Plasma Analyzer' },
          { name: 'HEL1OS', desc: 'Hard X-ray' },
          { name: 'MAG', desc: 'Magnetometer' },
        ].map((p, i) => (
          <View key={i} style={s.payloadChipWrap}>
            <BlurView intensity={10} tint="light" style={s.payloadChip}>
              <View style={s.payloadDot} />
              <View>
                <Text style={s.payloadName}>{p.name}</Text>
                <Text style={s.payloadDesc}>{p.desc}</Text>
              </View>
            </BlurView>
          </View>
        ))}
      </ScrollView>
    </>
  );

  // ─── Live Data Tab ────────────────────────────────────────
  const renderLiveData = () => (
    <>
      {/* SWIS */}
      <Text style={s.sectionHeader}>SWIS · Solar Wind Ion Spectrometer</Text>
      <View style={s.card}>
        <View style={s.instrumentGrid}>
          {[
            { label: 'Wind Speed', value: `${fmt(data.swis.solarWindSpeed, 0)} km/s` },
            { label: 'Proton Density', value: `${fmt(data.swis.protonDensity)} p/cm³` },
            { label: 'Temperature', value: `${fmt(data.swis.protonTemperature / 1000)}K ×1000` },
            { label: 'Alpha Ratio', value: `${(data.swis.alphaRatio * 100).toFixed(1)}%` },
          ].map((item, i) => (
            <View key={i} style={s.instrItem}>
              <Text style={s.instrValue}>{item.value}</Text>
              <Text style={s.instrLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* VELC CME Detection */}
      <Text style={s.sectionHeader}>VELC · Coronagraph</Text>
      <View style={s.card}>
        <View style={[s.cmeIndicator, { borderColor: data.velc.cmeDetected ? APP_CONFIG.colors.error : APP_CONFIG.colors.success }]}>
          <View style={[s.dot, { backgroundColor: data.velc.cmeDetected ? APP_CONFIG.colors.error : APP_CONFIG.colors.success }]} />
          <Text style={{ color: data.velc.cmeDetected ? APP_CONFIG.colors.error : APP_CONFIG.colors.success, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>
            {data.velc.cmeDetected ? 'CME DETECTED' : 'NO CME DETECTED'}
          </Text>
          {data.velc.cmeVelocity && (
            <Text style={{ color: APP_CONFIG.colors.text.secondary, fontSize: 11, marginLeft: 8 }}>
              {data.velc.cmeVelocity.toFixed(0)} km/s
            </Text>
          )}
        </View>
        <View style={s.instrumentGrid}>
          <View style={s.instrItem}>
            <Text style={s.instrValue}>{fmt(data.velc.coronalTemperature)}M K</Text>
            <Text style={s.instrLabel}>Corona Temp</Text>
          </View>
          <View style={s.instrItem}>
            <Text style={s.instrValue}>{fmt(data.velc.emissionLineIntensity, 0)}</Text>
            <Text style={s.instrLabel}>Emission Intensity</Text>
          </View>
        </View>
      </View>

      {/* HEL1OS */}
      <Text style={s.sectionHeader}>HEL1OS · X-ray Spectrometer</Text>
      <View style={s.card}>
        <View style={s.flareClassBox}>
          <Text style={s.flareLabel}>CURRENT FLARE CLASS</Text>
          <Text style={[s.flareClass, {
            color: data.hel1os.flareClass === 'X' ? APP_CONFIG.colors.error :
              data.hel1os.flareClass === 'M' ? APP_CONFIG.colors.warning : APP_CONFIG.colors.accent,
          }]}>{data.hel1os.flareClass}</Text>
        </View>
        <View style={s.instrumentGrid}>
          <View style={s.instrItem}>
            <Text style={s.instrValue}>{data.hel1os.hardXrayFlux.toExponential(1)}</Text>
            <Text style={s.instrLabel}>Hard X-ray Flux</Text>
          </View>
          <View style={s.instrItem}>
            <Text style={s.instrValue}>{data.hel1os.photonEnergy.toFixed(0)} keV</Text>
            <Text style={s.instrLabel}>Photon Energy</Text>
          </View>
        </View>
      </View>

      {/* MAG */}
      <Text style={s.sectionHeader}>MAG · Magnetometer</Text>
      <View style={s.card}>
        <View style={s.instrumentGrid}>
          {[
            { label: 'Field Strength', value: `${fmt(data.mag.magneticFieldStrength)} nT` },
            { label: 'Bz Component', value: `${fmt(data.mag.bzComponent)} nT` },
            { label: 'Bt Component', value: `${fmt(data.mag.btComponent)} nT` },
            { label: 'Direction', value: `${fmt(data.mag.fieldDirection, 0)}°` },
          ].map((item, i) => (
            <View key={i} style={s.instrItem}>
              <Text style={s.instrValue}>{item.value}</Text>
              <Text style={s.instrLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </>
  );

  // ─── ML Models Tab ────────────────────────────────────────
  const renderModels = () => (
    <>
      {/* ML Engine Status */}
      <View style={[s.card, { borderColor: mlConnected ? APP_CONFIG.colors.border.accent : APP_CONFIG.colors.border.default }]}>
        <View style={s.mlHeader}>
          <LinearGradient colors={APP_CONFIG.colors.gradient.primary as [string, string]} style={s.mlIcon}>
            <Cpu size={22} color="#FFF" />
          </LinearGradient>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={s.mlTitle}>ML Prediction Engine</Text>
            <Text style={s.mlSub}>Physics-Guided Deep Learning</Text>
          </View>
          <View style={[s.mlStatusBadge, { backgroundColor: mlConnected ? 'rgba(48,209,88,0.15)' : 'rgba(255,159,10,0.15)' }]}>
            <View style={[s.dot, { backgroundColor: mlConnected ? APP_CONFIG.colors.success : APP_CONFIG.colors.warning, width: 6, height: 6, borderRadius: 3 }]} />
            <Text style={[s.mlStatusText, { color: mlConnected ? APP_CONFIG.colors.success : APP_CONFIG.colors.warning }]}>
              {mlConnected ? 'ONLINE' : 'DEMO'}
            </Text>
          </View>
        </View>
        <Text style={s.mlNote}>
          {mlConnected
            ? 'Connected to OrbitBharat ML backend — real-time predictions active.'
            : 'Start the ML server on port 8000 (see `cmePredictionApi.ts`) or set EXPO_PUBLIC_CME_API_BASE_URL for your backend URL to enable live predictions.'}
        </Text>
      </View>

      {/* Current Prediction */}
      <Text style={s.sectionHeader}>Current Prediction</Text>
      <View style={s.card}>
        <View style={s.predRow}>
          <View style={[s.predGauge, { borderColor: alertColor }]}>
            <Text style={[s.predPercent, { color: alertColor }]}>{prediction.cmeProbability.toFixed(0)}%</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 20 }}>
            <Text style={[s.predAlert, { color: alertColor }]}>{prediction.alertLevel} RISK</Text>
            <View style={s.predDetail}>
              <Clock size={13} color={APP_CONFIG.colors.text.tertiary} />
              <Text style={s.predDetailText}>Arrival: {prediction.arrivalTimeHours.toFixed(0)} hours</Text>
            </View>
            <View style={s.predDetail}>
              <Target size={13} color={APP_CONFIG.colors.text.tertiary} />
              <Text style={s.predDetailText}>Confidence: {prediction.confidence.toFixed(0)}%</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Active Models */}
      <Text style={s.sectionHeader}>Active Models</Text>
      {ML_MODELS.map((model, i) => (
        <View key={i} style={s.card}>
          <View style={s.modelRow}>
            <View style={[s.modelDot, {
              backgroundColor: model.status === 'ACTIVE' ? 'rgba(48,209,88,0.15)' :
                model.status === 'TRAINING' ? 'rgba(255,159,10,0.15)' : 'rgba(148,163,184,0.15)'
            }]}>
              {model.status === 'ACTIVE' ? <CheckCircle size={16} color={APP_CONFIG.colors.success} /> :
                model.status === 'TRAINING' ? <RefreshCw size={16} color={APP_CONFIG.colors.warning} /> :
                  <XCircle size={16} color={APP_CONFIG.colors.text.tertiary} />}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.modelName}>{model.name}</Text>
              <Text style={s.modelType}>{model.type}</Text>
            </View>
            <Text style={s.modelAcc}>{model.accuracy}%</Text>
          </View>
        </View>
      ))}

      {/* PGML Features */}
      <Text style={s.sectionHeader}>Physics-Guided ML</Text>
      <View style={s.card}>
        {[
          { name: 'Hamiltonian Neural Nets', desc: 'Energy-conserving dynamics', icon: TrendingUp },
          { name: 'Neural ODEs', desc: 'Continuous-time modeling', icon: Activity },
          { name: 'Anomaly Transformer', desc: 'Association discrepancy', icon: AlertTriangle },
          { name: 'Graph Attention', desc: 'Multi-sensor correlation', icon: Globe },
          { name: 'Bayesian Uncertainty', desc: 'Calibrated intervals', icon: Shield },
        ].map((feat, i) => (
          <View key={i} style={[s.pgmlRow, i < 4 && { borderBottomWidth: 1, borderBottomColor: APP_CONFIG.colors.border.subtle }]}>
            <feat.icon size={16} color={APP_CONFIG.colors.accent} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={s.pgmlName}>{feat.name}</Text>
              <Text style={s.pgmlDesc}>{feat.desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </>
  );

  // ─── Analysis Tab ─────────────────────────────────────────
  const renderAnalysis = () => (
    <>
      {/* 24h Wind Trend */}
      <Text style={s.sectionHeader}>Solar Wind Trend (24h)</Text>
      <View style={s.card}>
        <View style={s.chartContainer}>
          {historicalData.map((value, i) => {
            const height = ((value - 300) / 400) * 80;
            return (
              <View key={i} style={[s.chartBar, {
                height: Math.max(height, 4),
                backgroundColor: value > 600 ? APP_CONFIG.colors.error :
                  value > 450 ? APP_CONFIG.colors.warning : APP_CONFIG.colors.accent,
              }]} />
            );
          })}
        </View>
        <View style={s.chartLabels}>
          <Text style={s.chartLabel}>-24h</Text>
          <Text style={s.chartLabel}>-12h</Text>
          <Text style={s.chartLabel}>Now</Text>
        </View>
      </View>

      {/* Statistics */}
      <Text style={s.sectionHeader}>Statistical Summary</Text>
      <View style={s.card}>
        {[
          { name: 'Solar Wind Speed', min: '320', max: '680', avg: '456' },
          { name: 'Proton Density', min: '2.1', max: '15.8', avg: '7.3' },
          { name: 'Bz Component', min: '-8.2', max: '6.5', avg: '-1.2' },
        ].map((row, i) => (
          <View key={i} style={[s.statRow, i < 2 && { borderBottomWidth: 1, borderBottomColor: APP_CONFIG.colors.border.subtle }]}>
            <Text style={s.statName}>{row.name}</Text>
            <View style={s.statVals}>
              <Text style={[s.statV, { color: APP_CONFIG.colors.success }]}>↓{row.min}</Text>
              <Text style={[s.statV, { color: APP_CONFIG.colors.error }]}>↑{row.max}</Text>
              <Text style={[s.statV, { color: APP_CONFIG.colors.accent }]}>~{row.avg}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Anomalies */}
      <Text style={s.sectionHeader}>Anomaly Detection</Text>
      <View style={s.card}>
        {[
          { time: '2h ago', type: 'Speed Spike', severity: 'LOW', color: APP_CONFIG.colors.success },
          { time: '6h ago', type: 'Density Drop', severity: 'MODERATE', color: APP_CONFIG.colors.warning },
          { time: '12h ago', type: 'Bz Reversal', severity: 'HIGH', color: APP_CONFIG.colors.error },
        ].map((a, i) => (
          <View key={i} style={[s.anomalyRow, i < 2 && { borderBottomWidth: 1, borderBottomColor: APP_CONFIG.colors.border.subtle }]}>
            <View style={[s.anomalyBadge, { backgroundColor: `${a.color}15` }]}>
              <Text style={[s.anomalyBadgeText, { color: a.color }]}>{a.severity}</Text>
            </View>
            <Text style={s.anomalyType}>{a.type}</Text>
            <Text style={s.anomalyTime}>{a.time}</Text>
          </View>
        ))}
      </View>

      {/* Data Sources */}
      <Text style={s.sectionHeader}>Data Sources</Text>
      <View style={s.card}>
        {[
          { name: 'ISRO PRADAN Portal', tag: 'PRIMARY' },
          { name: 'NOAA DSCOVR', tag: 'BACKUP' },
          { name: 'NASA ACE/SWEPAM', tag: 'VALIDATION' },
        ].map((src, i) => (
          <View key={i} style={[s.sourceRow, i < 2 && { borderBottomWidth: 1, borderBottomColor: APP_CONFIG.colors.border.subtle }]}>
            <Radio size={14} color={APP_CONFIG.colors.accent} />
            <Text style={s.sourceName}>{src.name}</Text>
            <View style={s.sourceBadge}><Text style={s.sourceBadgeText}>{src.tag}</Text></View>
          </View>
        ))}
      </View>
    </>
  );

  // ─── Main Render ──────────────────────────────────────────
  return (
    <ParticleBackground>
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        {/* Header */}
        <BlurView intensity={20} tint="dark" style={s.header}>
          <View style={s.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
              <ChevronLeft size={22} color="#FFF" />
            </TouchableOpacity>
            <View style={s.headerCenter}>
              <Text style={s.headerTitle}>Aditya-L1</Text>
              <Text style={s.headerSub}>Solar Observatory · L1 Point</Text>
            </View>
            <TouchableOpacity onPress={() => Linking.openURL('https://pradan.issdc.gov.in/aditya')} style={s.headerAction}>
              <LinearGradient colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']} style={s.headerActionGrad}>
                <ExternalLink size={16} color={APP_CONFIG.colors.accent} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </BlurView>

        {/* Tabs */}
        {renderTabs()}

        {/* Content */}
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={APP_CONFIG.colors.accent} />}
        >
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'livedata' && renderLiveData()}
          {activeTab === 'models' && renderModels()}
          {activeTab === 'analysis' && renderAnalysis()}

          {/* Footer */}
          <View style={s.footer}>
            <Clock size={12} color={APP_CONFIG.colors.text.tertiary} />
            <Text style={s.footerText}>Updated: {lastUpdate.toLocaleTimeString()}</Text>
          </View>
          <View style={{ height: 30 }} />
        </ScrollView>
      </SafeAreaView>
    </ParticleBackground>
  );
};

// ─── Styles (Matching Landing/Welcome Design System) ────────
const s = StyleSheet.create({
  safe: { flex: 1 },

  // Header
  header: {
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: APP_CONFIG.colors.border.subtle,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', backgroundColor: APP_CONFIG.colors.overlay.dark, borderWidth: 1, borderColor: APP_CONFIG.colors.border.default },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { color: APP_CONFIG.colors.white, fontSize: 16, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
  headerSub: { color: APP_CONFIG.colors.text.secondary, fontSize: 11, marginTop: 2 },
  headerAction: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  headerActionGrad: {
    width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: APP_CONFIG.colors.border.accent,
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: APP_CONFIG.colors.background.card,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.border.subtle,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 12, gap: 5,
  },
  tabActive: {
    backgroundColor: 'rgba(0, 102, 255, 0.15)',
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.border.accent,
  },
  tabText: { fontSize: 11, fontWeight: '600', color: APP_CONFIG.colors.text.tertiary },
  tabTextActive: { color: APP_CONFIG.colors.accent },

  scrollContent: { paddingHorizontal: 24, paddingTop: 16 },

  // Section Header
  sectionHeader: {
    fontSize: 13, fontWeight: '700', color: APP_CONFIG.colors.white,
    marginTop: 24, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 2,
  },

  // Generic Card
  card: {
    backgroundColor: APP_CONFIG.colors.background.card,
    borderRadius: 24, marginBottom: 16,
    borderWidth: 1, borderColor: APP_CONFIG.colors.border.default,
    overflow: 'hidden',
  },

  // Hero
  heroGradient: { padding: 24 },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  heroIconWrap: { marginRight: 16 },
  heroIconGrad: { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  heroInfo: { flex: 1 },
  heroTitle: { color: APP_CONFIG.colors.white, fontSize: 24, fontWeight: '800', letterSpacing: 2 },
  heroSub: { color: APP_CONFIG.colors.text.secondary, fontSize: 13, marginTop: 2 },
  heroStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  heroStatusText: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  heroStats: {
    flexDirection: 'row', marginTop: 24, paddingTop: 20,
    borderTopWidth: 1, borderTopColor: APP_CONFIG.colors.border.default,
    justifyContent: 'space-between',
  },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatVal: { color: APP_CONFIG.colors.white, fontSize: 28, fontWeight: '200', letterSpacing: -1 },
  heroStatLabel: { color: APP_CONFIG.colors.text.tertiary, fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 6 },
  statDivider: { width: 1, backgroundColor: APP_CONFIG.colors.border.default, height: '80%', alignSelf: 'center' as const },

  // Alert
  alertInner: { padding: 20 },
  alertIndicator: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20,
    borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.5)', marginBottom: 20,
  },
  alertLevelText: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  liveBadge: {
    fontSize: 9, fontWeight: '700', color: APP_CONFIG.colors.success,
    backgroundColor: 'rgba(48,209,88,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  demoBadge: {
    fontSize: 9, fontWeight: '700', color: APP_CONFIG.colors.warning,
    backgroundColor: 'rgba(255,159,10,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  alertGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  alertItem: { flex: 1, alignItems: 'center' },
  alertLabel: { color: APP_CONFIG.colors.text.tertiary, fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  alertVal: { color: APP_CONFIG.colors.white, fontSize: 32, fontWeight: '200', letterSpacing: -1 },
  alertUnit: { fontSize: 16, color: APP_CONFIG.colors.accent, fontWeight: '300' },

  // Param Grid
  paramGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  paramCardWrap: {
    width: (width - 62) / 2, height: 140,
    borderRadius: 22, overflow: 'hidden',
    borderWidth: 1, borderColor: APP_CONFIG.colors.border.default,
  },
  paramCard: {
    flex: 1,
    backgroundColor: APP_CONFIG.colors.background.card,
    justifyContent: 'center', alignItems: 'center',
  },
  paramValue: { color: APP_CONFIG.colors.white, fontSize: 24, fontWeight: '700', marginBottom: 2 },
  paramUnit: { color: APP_CONFIG.colors.text.secondary, fontSize: 12, fontWeight: '400' },
  paramBadge: {
    marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    backgroundColor: 'rgba(0, 163, 255, 0.15)',
  },
  paramBadgeText: { color: APP_CONFIG.colors.accent, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  paramLabel: { color: APP_CONFIG.colors.text.tertiary, fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 6 },

  // Payloads
  payloadScroll: { gap: 10 },
  payloadChipWrap: {
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: APP_CONFIG.colors.border.default,
  },
  payloadChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: APP_CONFIG.colors.background.card,
  },
  payloadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: APP_CONFIG.colors.success },
  payloadName: { color: APP_CONFIG.colors.white, fontSize: 13, fontWeight: '700' },
  payloadDesc: { color: APP_CONFIG.colors.text.tertiary, fontSize: 10, marginTop: 1 },

  // Instrument Grid
  instrumentGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12 },
  instrItem: {
    width: (width - 92) / 2, backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 16, padding: 16, alignItems: 'center',
  },
  instrValue: { color: APP_CONFIG.colors.white, fontSize: 18, fontWeight: '700' },
  instrLabel: { color: APP_CONFIG.colors.text.tertiary, fontSize: 10, marginTop: 4, textAlign: 'center' },

  // CME Indicator
  cmeIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 16,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12,
    borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.3)',
  },

  // Flare Class
  flareClassBox: {
    alignItems: 'center', padding: 20,
    backgroundColor: 'rgba(0,0,0,0.3)', margin: 16, borderRadius: 16,
  },
  flareLabel: { color: APP_CONFIG.colors.text.tertiary, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  flareClass: { fontSize: 48, fontWeight: '800', marginTop: 4 },

  // ML Header
  mlHeader: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  mlIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  mlTitle: { color: APP_CONFIG.colors.white, fontSize: 16, fontWeight: '700' },
  mlSub: { color: APP_CONFIG.colors.text.secondary, fontSize: 11, marginTop: 2 },
  mlStatusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  mlStatusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  mlNote: { color: APP_CONFIG.colors.text.tertiary, fontSize: 12, lineHeight: 18, paddingHorizontal: 20, paddingBottom: 20 },

  // Prediction
  predRow: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  predGauge: {
    width: 80, height: 80, borderRadius: 40, borderWidth: 3,
    justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)',
  },
  predPercent: { fontSize: 24, fontWeight: '800' },
  predAlert: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  predDetail: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  predDetailText: { color: APP_CONFIG.colors.text.secondary, fontSize: 13 },

  // Models
  modelRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  modelDot: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  modelName: { color: APP_CONFIG.colors.white, fontSize: 13, fontWeight: '600' },
  modelType: { color: APP_CONFIG.colors.text.tertiary, fontSize: 11, marginTop: 1 },
  modelAcc: { color: APP_CONFIG.colors.accent, fontSize: 15, fontWeight: '700' },

  // PGML
  pgmlRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20 },
  pgmlName: { color: APP_CONFIG.colors.white, fontSize: 13, fontWeight: '600' },
  pgmlDesc: { color: APP_CONFIG.colors.text.tertiary, fontSize: 11, marginTop: 1 },

  // Chart
  chartContainer: { flexDirection: 'row', alignItems: 'flex-end', height: 90, paddingHorizontal: 16, paddingTop: 20, gap: 3 },
  chartBar: { flex: 1, borderRadius: 2, minHeight: 4 },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8 },
  chartLabel: { color: APP_CONFIG.colors.text.tertiary, fontSize: 10 },

  // Stats
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 20 },
  statName: { color: APP_CONFIG.colors.white, fontSize: 13, fontWeight: '600' },
  statVals: { flexDirection: 'row', gap: 14 },
  statV: { fontSize: 12, fontWeight: '600' },

  // Anomaly
  anomalyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20 },
  anomalyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  anomalyBadgeText: { fontSize: 9, fontWeight: '700' },
  anomalyType: { flex: 1, color: APP_CONFIG.colors.white, fontSize: 13, marginLeft: 12 },
  anomalyTime: { color: APP_CONFIG.colors.text.tertiary, fontSize: 11 },

  // Source
  sourceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, gap: 10 },
  sourceName: { flex: 1, color: APP_CONFIG.colors.white, fontSize: 13 },
  sourceBadge: { backgroundColor: 'rgba(0, 163, 255, 0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  sourceBadgeText: { color: APP_CONFIG.colors.accent, fontSize: 9, fontWeight: '700' },

  // Footer
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 },
  footerText: { color: APP_CONFIG.colors.text.tertiary, fontSize: 11 },
});

export default AdityaL1Screen;
