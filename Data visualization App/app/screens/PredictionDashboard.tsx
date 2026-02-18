import React, { useState, useEffect, useCallback, useRef, Component, ErrorInfo, ReactNode } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    ActivityIndicator,
    RefreshControl,
    Animated,
    Dimensions,
} from 'react-native';
import {
    Clock,
    Activity,
    Magnet,
    AlertTriangle,
    Info,
    Share2,
    Cpu,
    Zap,
    Wind,
    BarChart2,
    Shield,
} from 'lucide-react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import ParticleBackground from '../components/ParticleBackground';
import Header from '../components/Header';
import SeverityBar from '../components/SeverityBar';
import GlassCard from '../components/GlassCard';
import { APP_CONFIG } from '../utils/constants';
import {
    cmeApi,
    getMockPrediction,
    getMockModelInfo,
    CMEPrediction,
    SpaceConditions,
    ModelInfo,
    AccuracyMetrics,
    FeatureImportance,
} from '../utils/cmePredictionApi';

/* ─── Chart error boundary ─────────────────────────────────────────── */
interface ChartSafeProps { children: ReactNode; fallbackText?: string }
interface ChartSafeState { crashed: boolean }
class ChartSafe extends Component<ChartSafeProps, ChartSafeState> {
    constructor(p: ChartSafeProps) { super(p); this.state = { crashed: false }; }
    static getDerivedStateFromError(): ChartSafeState { return { crashed: true }; }
    componentDidCatch(e: Error) { console.warn('ChartSafe caught', e.message); }
    render() {
        if (this.state.crashed) {
            return (
                <View style={{ padding: 20, alignItems: 'center', justifyContent: 'center', minHeight: 100 }}>
                    <AlertTriangle size={24} color="#FF9500" />
                    <Text style={{ color: '#94A3B8', marginTop: 6, fontSize: 12 }}>
                        {this.props.fallbackText || 'Chart unavailable'}
                    </Text>
                </View>
            );
        }
        return this.props.children;
    }
}

/* ─── Constants ─────────────────────────────────────────────────────── */
type Props = NativeStackScreenProps<RootStackParamList, 'Prediction'>;

const SCREEN_W = Dimensions.get('window').width;
const H_PAD = 20;
const CHART_W = SCREEN_W - H_PAD * 2 - 24;
const CHART_BG = '#0D1117';

const ALERT_COLORS: Record<string, [string, string]> = {
    EXTREME: ['#FF3B30', '#CC0000'],
    HIGH: ['#FF9500', '#CC7000'],
    MODERATE: ['#0066FF', '#0044CC'],
    LOW: ['#00A3FF', '#0077CC'],
    NONE: ['#3399FF', '#0066FF'],
};

/* ─── Small metric card ────────────────────────────────────────────── */
const MetricCard = ({ icon: Icon, label, value, unit, color }: any) => (
    <GlassCard style={s.metricCard}>
        <View style={[s.metricIcon, { backgroundColor: color + '20' }]}>
            <Icon size={18} color={color} />
        </View>
        <Text style={s.metricValue}>
            {value ?? '--'}
            <Text style={s.metricUnit}>{unit}</Text>
        </Text>
        <Text style={s.metricLabel}>{label}</Text>
    </GlassCard>
);

/* ─── Narrative summary builder ────────────────────────────────────── */
const buildSummary = (
    pred: CMEPrediction | null,
    cond: SpaceConditions | null,
    connected: boolean,
) => {
    if (!pred || !cond)
        return connected
            ? 'Fetching latest CME risk from the ML backend...'
            : 'Demo prediction - ML backend not connected.';

    const prob = pred.cme_probability;
    const wind = cond.solar_wind.speed_km_s ?? 0;
    const bz = cond.magnetic_field.bz_nT ?? 0;
    const level = pred.alert_level;

    const impact =
        level === 'EXTREME' || prob >= 80
            ? 'High geomagnetic storm risk - potential impact on navigation and power grids.'
            : level === 'HIGH' || prob >= 60
                ? 'Elevated storm risk - watch for navigation and communication disruptions.'
                : level === 'MODERATE' || prob >= 30
                    ? 'Moderate risk - possible minor disturbances to satellites and GNSS.'
                    : 'Low risk - normal space-weather conditions.';

    const windTag =
        wind > 650 ? 'very fast solar wind' :
            wind > 500 ? 'fast solar wind' :
                wind > 350 ? 'moderate solar wind' : 'slow solar wind';

    const bzTag =
        bz < -5 ? 'strong southward IMF Bz' :
            bz < -1 ? 'slightly southward IMF Bz' :
                bz > 2 ? 'northward IMF Bz' : 'near-neutral IMF Bz';

    return impact + ' CME impact probability ' + prob.toFixed(1) + '% with ' + windTag + ' and ' + bzTag + '.';
};

/* ─── Helpers ──────────────────────────────────────────────────────── */
const safeData = (arr: number[], fallback = 0): number[] => {
    if (!arr || arr.length === 0) return [fallback];
    return arr.map(v => (Number.isFinite(v) ? v : fallback));
};

/* =================================================================== */
/* COMPONENT                                                           */
/* =================================================================== */
export default function PredictionDashboard({ navigation }: Props) {
    const [prediction, setPrediction] = useState<CMEPrediction | null>(null);
    const [conditions, setConditions] = useState<SpaceConditions | null>(null);
    const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
    const [accuracy, setAccuracy] = useState<AccuracyMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [apiConnected, setApiConnected] = useState(false);
    const [lastUpdate, setLastUpdate] = useState('');
    const [featureImportance, setFeatureImportance] = useState<FeatureImportance | null>(null);

    const [windHistory, setWindHistory] = useState({
        labels: ['-5h', '-4h', '-3h', '-2h', '-1h', 'Now'],
        data: [400, 405, 398, 420, 412, 400],
    });
    const probRef = useRef<number[]>([]);
    const [probHistory, setProbHistory] = useState({ labels: ['Now'], data: [50] });

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(40)).current;

    /* ── Fetch ───────────────────────────────────────────────────── */
    const fetchData = useCallback(async () => {
        try {
            const healthy = await cmeApi.healthCheck();
            setApiConnected(healthy);

            if (healthy) {
                const [predRes, accRes, infoRes] = await Promise.all([
                    cmeApi.getPrediction(),
                    cmeApi.getAccuracy(),
                    cmeApi.getModelInfo(),
                ]);

                if (predRes.status === 'success') {
                    setPrediction(predRes.prediction);
                    setConditions(predRes.current_conditions);

                    const p = predRes.prediction.cme_probability;
                    probRef.current = [...probRef.current, p].slice(-7);
                    const ph = probRef.current;
                    const labels = ph.map((_: number, i: number) => {
                        if (i === ph.length - 1) return 'Now';
                        const m = (ph.length - 1 - i) * 2;
                        return m >= 60 ? '-' + Math.round(m / 60) + 'h' : '-' + m + 'm';
                    });
                    setProbHistory({ labels, data: ph });
                }

                setAccuracy(accRes);
                setModelInfo(infoRes);

                try {
                    const rt = await cmeApi.getRealtimeData();
                    if (rt?.values?.speed?.length) {
                        const speeds: number[] = rt.values.speed;
                        const n = speeds.length;
                        const step = Math.max(1, Math.floor(n / 6));
                        const pts: number[] = [];
                        const lbl: string[] = [];
                        for (let i = 0; i < 6; i++) {
                            const idx = Math.min(Math.max(0, n - (6 - i) * step), n - 1);
                            pts.push(Math.round(speeds[idx] || 400));
                            if (i === 5) { lbl.push('Now'); }
                            else {
                                const ago = Math.round((n - 1 - idx) / 60);
                                lbl.push(ago > 0 ? '-' + ago + 'h' : '-' + Math.round(n - 1 - idx) + 'm');
                            }
                        }
                        setWindHistory({ labels: lbl, data: pts });
                    }
                } catch { /* keep last */ }

                try { setFeatureImportance(await cmeApi.getFeatureImportance()); } catch { setFeatureImportance(null); }
            } else {
                const mock = getMockPrediction();
                setPrediction(mock.prediction);
                setConditions(mock.current_conditions);
                setModelInfo(getMockModelInfo());
                setAccuracy({
                    accuracy: 0, precision: 0, recall: 0, f1_score: 0, auc_roc: 0,
                    validation_period: '1850-2026 connect API for live metrics',
                    total_events_tested: 0,
                });
                setFeatureImportance({
                    features: ['Solar Wind', 'Proton Density', 'IMF Bz', 'IMF Bt', 'Plasma Beta', 'Temperature'],
                    importance: [0.32, 0.21, 0.18, 0.12, 0.10, 0.07],
                    top_features: [['Solar Wind', 0.32], ['Proton Density', 0.21], ['IMF Bz', 0.18]],
                });
            }

            setLastUpdate(new Date().toLocaleTimeString());
        } catch (e) {
            console.error('Prediction fetch error', e);
            const mock = getMockPrediction();
            setPrediction(mock.prediction);
            setConditions(mock.current_conditions);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const iv = setInterval(fetchData, 120000);
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
        ]).start();
        return () => clearInterval(iv);
    }, [fetchData]);

    const onRefresh = () => { setRefreshing(true); fetchData(); };

    /* ── Loading state ───────────────────────────────────────────── */
    if (loading) {
        return (
            <ParticleBackground>
                <View style={s.loadingWrap}>
                    <ActivityIndicator size="large" color={APP_CONFIG.colors.accent} />
                    <Text style={s.loadingText}>Initializing Neural Network...</Text>
                </View>
            </ParticleBackground>
        );
    }

    const alertColors = ALERT_COLORS[prediction?.alert_level || 'NONE'] || ALERT_COLORS.NONE;
    const summary = buildSummary(prediction, conditions, apiConnected);
    const topFi = featureImportance
        ? featureImportance.features
            .map((name, i) => ({ name, value: featureImportance.importance[i] ?? 0 }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6)
        : [];

    /* ── Chart configs ───────────────────────────────────────────── */
    const lineChartCfg = {
        backgroundColor: CHART_BG,
        backgroundGradientFrom: CHART_BG,
        backgroundGradientTo: CHART_BG,
        decimalPlaces: 0,
        color: (o = 1) => 'rgba(0,163,255,' + o + ')',
        labelColor: (o = 1) => 'rgba(255,255,255,' + o + ')',
        propsForDots: { r: '3', strokeWidth: '1.5', stroke: '#00A3FF' },
        propsForBackgroundLines: { strokeDasharray: '4,6', stroke: 'rgba(255,255,255,0.08)' },
    };
    const barChartCfg = {
        backgroundColor: CHART_BG,
        backgroundGradientFrom: CHART_BG,
        backgroundGradientTo: CHART_BG,
        decimalPlaces: 0,
        color: (o = 1) => 'rgba(48,209,88,' + o + ')',
        labelColor: (o = 1) => 'rgba(255,255,255,' + o + ')',
        barPercentage: 0.45,
        propsForBackgroundLines: { strokeDasharray: '4,6', stroke: 'rgba(255,255,255,0.08)' },
    };
    const fiChartCfg = {
        backgroundColor: CHART_BG,
        backgroundGradientFrom: CHART_BG,
        backgroundGradientTo: CHART_BG,
        decimalPlaces: 1,
        color: (o = 1) => 'rgba(0,163,255,' + o + ')',
        labelColor: (o = 1) => 'rgba(248,250,252,' + o + ')',
        barPercentage: 0.55,
        propsForBackgroundLines: { strokeDasharray: '4,6', stroke: 'rgba(255,255,255,0.08)' },
    };

    /* ── Render ──────────────────────────────────────────────────── */
    return (
        <ParticleBackground>
            <SafeAreaView style={s.container}>
                <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
                <ScrollView
                    contentContainerStyle={s.scroll}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={APP_CONFIG.colors.accent} />
                    }
                >
                    <Header title="CME Prediction Engine" showBackButton onBackPress={() => navigation.goBack()} />

                    {/* Summary */}
                    <GlassCard style={s.summaryCard}>
                        <View style={s.summaryRow}>
                            <View style={[s.dot, { backgroundColor: alertColors[0] }]} />
                            <Text style={s.summaryTitle}>Mission Status</Text>
                        </View>
                        <Text style={s.summaryText}>{summary}</Text>
                        <SeverityBar
                            value={prediction?.cme_probability ?? 0}
                            label="CME Impact Risk"
                            gradientColors={['#30D158', '#FFD60A', '#FF3B30']}
                            legendLabels={['Low', 'Moderate', 'High']}
                            barHeight={5}
                        />
                    </GlassCard>

                    {/* Connection status */}
                    <Animated.View style={[s.statusBar, { opacity: fadeAnim }]}>
                        <GlassCard style={s.statusInner}>
                            <View style={s.statusRow}>
                                <View style={[s.dot, { backgroundColor: apiConnected ? '#30D158' : '#FF9500' }]} />
                                <Text style={s.statusLabel}>
                                    {apiConnected ? 'ML MODEL CONNECTED' : 'DEMO MODE'}
                                </Text>
                            </View>
                            <Text style={s.statusTime}>{lastUpdate}</Text>
                        </GlassCard>
                    </Animated.View>

                    {/* Main gauge */}
                    <Animated.View style={[s.gaugeSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                        <View style={s.gaugeOuter}>
                            <View style={[s.gaugeRing, { borderColor: alertColors[0] + '40' }]} />
                            <View style={[s.gaugeRingInner, { borderColor: alertColors[0] + '20' }]} />
                            <View style={s.gaugeCenter}>
                                <Text style={s.gaugeLabel}>IMPACT PROBABILITY</Text>
                                <Text style={[s.gaugeValue, { color: alertColors[0] }]}>
                                    {prediction?.cme_probability.toFixed(1) ?? '-'}%
                                </Text>
                                <View style={[s.alertBadge, { backgroundColor: alertColors[0] + '30', borderColor: alertColors[0] }]}>
                                    <Text style={[s.alertBadgeText, { color: alertColors[0] }]}>
                                        {prediction?.alert_level || '-'}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <View style={s.metaRow}>
                            <GlassCard style={s.metaBox}>
                                <Clock size={18} color="#FFF" />
                                <View style={{ marginLeft: 10 }}>
                                    <Text style={s.metaSmall}>ETA Arrival</Text>
                                    <Text style={s.metaBig}>{prediction?.arrival_time_eta || '--'}</Text>
                                </View>
                            </GlassCard>
                            <GlassCard style={s.metaBox}>
                                <Shield size={18} color="#FFF" />
                                <View style={{ marginLeft: 10 }}>
                                    <Text style={s.metaSmall}>Confidence</Text>
                                    <Text style={s.metaBig}>{prediction?.confidence ?? '--'}%</Text>
                                </View>
                            </GlassCard>
                        </View>
                    </Animated.View>

                    {/* Live conditions grid */}
                    <Text style={s.section}>REAL-TIME INPUT VECTORS</Text>
                    <View style={s.grid}>
                        <MetricCard icon={Wind} label="Solar Wind" value={conditions?.solar_wind.speed_km_s?.toFixed(0)} unit=" km/s" color="#38BDF8" />
                        <MetricCard icon={Activity} label="Density" value={conditions?.solar_wind.density_p_cm3?.toFixed(1)} unit=" p/cm3" color="#30D158" />
                        <MetricCard icon={Magnet} label="IMF Bz" value={conditions?.magnetic_field.bz_nT?.toFixed(1)} unit=" nT" color="#00A3FF" />
                        <MetricCard icon={Zap} label="Storm Risk" value={conditions?.storm_potential || 'Low'} unit="" color="#FF9500" />
                    </View>

                    {/* Probability trend */}
                    <Text style={s.section}>CME PROBABILITY TREND</Text>
                    <GlassCard style={s.chartCard}>
                        <ChartSafe fallbackText="Trend chart unavailable">
                            <LineChart
                                data={{
                                    labels: probHistory.labels,
                                    datasets: [{ data: safeData(probHistory.data, 50) }],
                                }}
                                width={CHART_W}
                                height={200}
                                yAxisSuffix="%"
                                yAxisLabel=""
                                chartConfig={lineChartCfg}
                                bezier
                                style={s.chart}
                            />
                        </ChartSafe>
                    </GlassCard>

                    {/* Solar wind bar chart */}
                    <Text style={s.section}>SOLAR WIND SPEED</Text>
                    <GlassCard style={s.chartCard}>
                        <ChartSafe fallbackText="Wind speed chart unavailable">
                            <BarChart
                                data={{
                                    labels: windHistory.labels,
                                    datasets: [{ data: safeData(windHistory.data, 400) }],
                                }}
                                width={CHART_W}
                                height={200}
                                yAxisSuffix=" km/s"
                                yAxisLabel=""
                                chartConfig={barChartCfg}
                                style={s.chart}
                            />
                        </ChartSafe>
                    </GlassCard>

                    {/* Model metrics */}
                    <Text style={s.section}>MODEL METRICS (BI-LSTM + TRANSFORMER)</Text>
                    <GlassCard style={s.metricsCard}>
                        {apiConnected ? (
                            <View style={s.metricsRow}>
                                {[
                                    { v: (accuracy?.accuracy ?? 0) + '%', l: 'Accuracy' },
                                    { v: (accuracy?.precision ?? 0) + '%', l: 'Precision' },
                                    { v: (accuracy?.recall ?? 0) + '%', l: 'Recall' },
                                    { v: '' + (accuracy?.auc_roc ?? 0), l: 'AUC-ROC' },
                                ].map((m, i) => (
                                    <React.Fragment key={m.l}>
                                        {i > 0 && <View style={s.vDivider} />}
                                        <View style={s.metricsItem}>
                                            <Text style={s.metricsVal}>{m.v}</Text>
                                            <Text style={s.metricsLbl}>{m.l}</Text>
                                        </View>
                                    </React.Fragment>
                                ))}
                            </View>
                        ) : (
                            <View style={{ alignItems: 'center', paddingVertical: 14 }}>
                                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
                                    Offline - connect to API for live metrics
                                </Text>
                            </View>
                        )}
                        <View style={s.metricsFooter}>
                            <Info size={12} color="rgba(255,255,255,0.4)" />
                            <Text style={s.metricsFooterText}>
                                {apiConnected
                                    ? 'Validated on ' + (accuracy?.total_events_tested?.toLocaleString() ?? '-') + ' samples | ' + (accuracy?.validation_period ?? '1850-2026')
                                    : 'Historical catalog: 1850-2026 | Connect backend for metrics'}
                            </Text>
                        </View>
                    </GlassCard>

                    {/* Feature importance */}
                    {topFi.length > 0 && (
                        <>
                            <Text style={s.section}>TOP INPUT DRIVERS</Text>
                            <GlassCard style={s.chartCard}>
                                <View style={s.fiHeader}>
                                    <BarChart2 size={16} color={APP_CONFIG.colors.accent} />
                                    <Text style={s.fiTitle}>Feature Importance</Text>
                                </View>
                                <ChartSafe fallbackText="Feature chart unavailable">
                                    <BarChart
                                        data={{
                                            labels: topFi.map(f => f.name.length > 12 ? f.name.slice(0, 10) + '...' : f.name),
                                            datasets: [{ data: safeData(topFi.map(f => +(f.value * 100).toFixed(1)), 0) }],
                                        }}
                                        width={CHART_W}
                                        height={200}
                                        yAxisSuffix="%"
                                        yAxisLabel=""
                                        chartConfig={fiChartCfg}
                                        fromZero
                                        style={s.chart}
                                    />
                                </ChartSafe>
                                <Text style={s.fiCaption}>
                                    Higher bars = stronger influence on today's CME risk estimate.
                                </Text>
                            </GlassCard>
                        </>
                    )}

                    {/* Architecture CTA */}
                    <TouchableOpacity activeOpacity={0.8}>
                        <GlassCard style={s.archCard}>
                            <Cpu size={18} color="#FFF" />
                            <Text style={s.archText}>View Neural Network Architecture</Text>
                            <Share2 size={14} color="rgba(255,255,255,0.4)" />
                        </GlassCard>
                    </TouchableOpacity>

                    <View style={{ height: 32 }} />
                </ScrollView>
            </SafeAreaView>
        </ParticleBackground>
    );
}

/* =================================================================== */
/* STYLES                                                              */
/* =================================================================== */
const s = StyleSheet.create({
    container: { flex: 1 },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
    loadingText: { color: '#94A3B8', fontSize: 13, letterSpacing: 1 },

    scroll: { paddingHorizontal: H_PAD, paddingBottom: 36 },

    summaryCard: {
        padding: 16, marginBottom: 12, borderWidth: 1,
        borderColor: 'rgba(0,163,255,0.25)', borderRadius: 16,
    },
    summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    summaryTitle: { fontSize: 12, fontWeight: '700', color: '#FFF', letterSpacing: 1, textTransform: 'uppercase' },
    summaryText: { fontSize: 12.5, color: '#94A3B8', lineHeight: 18, marginBottom: 10 },

    dot: { width: 7, height: 7, borderRadius: 4 },

    statusBar: { marginBottom: 16 },
    statusInner: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statusLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '700', letterSpacing: 0.5 },
    statusTime: { fontSize: 10, color: '#64748B' },

    gaugeSection: { alignItems: 'center', marginBottom: 20 },
    gaugeOuter: { width: 200, height: 200, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
    gaugeRing: { position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 2 },
    gaugeRingInner: { position: 'absolute', width: 180, height: 180, borderRadius: 90, borderWidth: 10, borderStyle: 'dashed' },
    gaugeCenter: { alignItems: 'center' },
    gaugeLabel: { fontSize: 10, color: '#94A3B8', letterSpacing: 2, marginBottom: 4 },
    gaugeValue: { fontSize: 44, fontWeight: '200', letterSpacing: -2 },
    alertBadge: { paddingVertical: 5, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, marginTop: 8 },
    alertBadgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },

    metaRow: { flexDirection: 'row', gap: 10, width: '100%' },
    metaBox: {
        flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14,
        borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    metaSmall: { fontSize: 9, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
    metaBig: { fontSize: 15, fontWeight: '700', color: '#FFF' },

    section: {
        fontSize: 11, color: '#94A3B8', textTransform: 'uppercase',
        letterSpacing: 1.5, marginBottom: 10, marginTop: 16, fontWeight: '600',
    },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
    metricCard: {
        width: (SCREEN_W - H_PAD * 2 - 10) / 2, padding: 14, borderRadius: 14,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    metricIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    metricValue: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 4 },
    metricUnit: { fontSize: 12, color: '#94A3B8', fontWeight: '400' },
    metricLabel: { fontSize: 11, color: '#64748B', fontWeight: '500' },

    chartCard: {
        padding: 12, borderRadius: 16, borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)', marginBottom: 4,
        alignItems: 'center', overflow: 'hidden',
    },
    chart: { borderRadius: 12 },

    metricsCard: {
        padding: 16, borderRadius: 16, borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)', marginBottom: 4,
    },
    metricsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 14 },
    metricsItem: { alignItems: 'center', flex: 1 },
    metricsVal: { fontSize: 18, fontWeight: '700', color: '#00A3FF', marginBottom: 4 },
    metricsLbl: { fontSize: 9, color: '#64748B', fontWeight: '600', letterSpacing: 0.5 },
    vDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.08)' },
    metricsFooter: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    },
    metricsFooterText: { fontSize: 10, color: '#64748B' },

    fiHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingHorizontal: 4 },
    fiTitle: { fontSize: 13, fontWeight: '700', color: '#FFF' },
    fiCaption: { fontSize: 10, color: '#64748B', marginTop: 6, paddingHorizontal: 4 },

    archCard: {
        flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14,
        backgroundColor: 'rgba(0,102,255,0.08)', borderWidth: 1,
        borderColor: 'rgba(0,163,255,0.25)', gap: 12, marginTop: 12,
    },
    archText: { flex: 1, fontSize: 14, color: '#FFF', fontWeight: '600' },
});
