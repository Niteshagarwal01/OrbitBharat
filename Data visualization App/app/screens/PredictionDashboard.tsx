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
    Platform,
} from 'react-native';
import {
    Clock,
    Gauge,
    Activity,
    Magnet,
    AlertTriangle,
    CheckCircle,
    Info,
    Share2,
    Database,
    Cpu,
    Zap,
    Wind,
    Thermometer,
    BarChart2,
    Shield
} from 'lucide-react-native';
import {
    LineChart,
    BarChart,
} from "react-native-chart-kit";

/** Lightweight error boundary that swallows chart‑rendering crashes */
interface ChartSafeProps { children: ReactNode; fallbackText?: string; }
interface ChartSafeState { crashed: boolean; }
class ChartSafe extends Component<ChartSafeProps, ChartSafeState> {
    constructor(props: ChartSafeProps) { super(props); this.state = { crashed: false }; }
    static getDerivedStateFromError(): ChartSafeState { return { crashed: true }; }
    componentDidCatch(e: Error, info: ErrorInfo) { console.warn('ChartSafe caught', e.message); }
    render() {
        if (this.state.crashed) {
            return (
                <View style={{ padding: 24, alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
                    <AlertTriangle size={28} color="#FF9500" />
                    <Text style={{ color: '#94A3B8', marginTop: 8, fontSize: 12 }}>
                        {this.props.fallbackText || 'Chart unavailable on this device'}
                    </Text>
                </View>
            );
        }
        return this.props.children;
    }
}
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
// BlurView crashes on many Android devices — use a plain semi-transparent View
const GlassCard = ({ children, style, ...rest }: any) => (
    <View style={[{ backgroundColor: 'rgba(13,17,23,0.85)', borderRadius: 18, overflow: 'hidden' }, style]} {...rest}>
        {children}
    </View>
);
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import ParticleBackground from '../components/ParticleBackground';
import Header from '../components/Header';
import SeverityBar from '../components/SeverityBar';
import { APP_CONFIG } from '../utils/constants';
import {
    cmeApi,
    getMockPrediction,
    getMockModelInfo,
    CMEPrediction,
    SpaceConditions,
    ModelInfo,
    AccuracyMetrics,
    FeatureImportance
} from '../utils/cmePredictionApi';

type Props = NativeStackScreenProps<RootStackParamList, 'Prediction'>;

const { width } = Dimensions.get('window');
const SCROLL_PAD = 24;
const CARD_PAD = 16;
// Chart width = screen - (scrollContent padding + card padding) both sides
const CHART_WIDTH = Math.max(width - (SCROLL_PAD + CARD_PAD) * 2, 200);
// react-native-chart-kit crashes on Android when bg colors contain rgba() with
// spaces or alpha.  Use a solid hex colour that approximates the card bg.
const SAFE_CHART_BG = '#0D1117';

// Alert level colors - Blue palette based
const getAlertColor = (level: string): [string, string] => {
    switch (level) {
        case 'EXTREME': return ['#FF3B30', '#CC0000'];
        case 'HIGH': return ['#FF9500', '#CC7000'];
        case 'MODERATE': return ['#0066FF', '#0044CC'];
        case 'LOW': return ['#00A3FF', '#0077CC'];
        default: return ['#3399FF', '#0066FF'];
    }
};

const MetricCard = ({ icon: Icon, label, value, unit, color }: any) => (
    <GlassCard style={styles.metricCard}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
            <Icon size={20} color={color} />
        </View>
        <Text style={styles.metricValue}>{value ?? '--'}<Text style={styles.metricUnit}>{unit}</Text></Text>
        <Text style={styles.metricLabel}>{label}</Text>
    </GlassCard>
);

const buildNarrativeSummary = (
    pred: CMEPrediction | null,
    cond: SpaceConditions | null,
    connected: boolean
) => {
    if (!pred || !cond) {
        return connected
            ? 'Fetching latest CME risk from the ML backend...'
            : 'Showing demo prediction – ML backend not connected.';
    }

    const level = pred.alert_level;
    const prob = pred.cme_probability;
    const wind = cond.solar_wind.speed_km_s ?? 0;
    const bz = cond.magnetic_field.bz_nT ?? 0;

    let impact: string;
    if (level === 'EXTREME' || prob >= 80) {
        impact = 'High geomagnetic storm risk – potential impact on navigation and power grids.';
    } else if (level === 'HIGH' || prob >= 60) {
        impact = 'Elevated storm risk – watch for navigation and communication disruptions.';
    } else if (level === 'MODERATE' || prob >= 30) {
        impact = 'Moderate risk – possible minor disturbances to satellites and GNSS.';
    } else {
        impact = 'Low risk – normal space‑weather conditions for most operations.';
    }

    const windLabel =
        wind > 650 ? 'very fast solar wind' :
            wind > 500 ? 'fast solar wind' :
                wind > 350 ? 'moderate solar wind' :
                    'slow solar wind';

    const bzLabel =
        bz < -5 ? 'strong southward IMF Bz (more coupling with Earth\'s field)' :
            bz < -1 ? 'slightly southward IMF Bz' :
                bz > 2 ? 'northward IMF Bz (more shielding)' :
                    'near‑neutral IMF Bz';

    return `${impact} Currently, CME impact probability is ${prob.toFixed(1)}% with ${windLabel} and ${bzLabel}.`;
};

export default function PredictionDashboard({ navigation }: Props) {
    const [prediction, setPrediction] = useState<CMEPrediction | null>(null);
    const [conditions, setConditions] = useState<SpaceConditions | null>(null);
    const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
    const [accuracy, setAccuracy] = useState<AccuracyMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [apiConnected, setApiConnected] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<string>('');
    const [featureImportance, setFeatureImportance] = useState<FeatureImportance | null>(null);

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;
    const gaugeAnim = useRef(new Animated.Value(0)).current;

    const fetchData = useCallback(async () => {
        try {
            const healthy = await cmeApi.healthCheck();
            setApiConnected(healthy);

            if (healthy) {
                const [predResult, accResult, infoResult] = await Promise.all([
                    cmeApi.getPrediction(),
                    cmeApi.getAccuracy(),
                    cmeApi.getModelInfo(),
                ]);

                if (predResult.status === 'success') {
                    setPrediction(predResult.prediction);
                    setConditions(predResult.current_conditions);
                }
                setAccuracy(accResult);
                setModelInfo(infoResult);

                // Fetch feature importance for explainability (best‑effort)
                try {
                    const fi = await cmeApi.getFeatureImportance();
                    setFeatureImportance(fi);
                } catch {
                    setFeatureImportance(null);
                }
            } else {
                const mock = getMockPrediction();
                setPrediction(mock.prediction);
                setConditions(mock.current_conditions);
                setModelInfo(getMockModelInfo());
                setAccuracy({
                    accuracy: 0,
                    precision: 0,
                    recall: 0,
                    f1_score: 0,
                    auc_roc: 0,
                    validation_period: 'Demo Mode — connect API for real metrics',
                    total_events_tested: 0,
                });

                // Mock feature importance in demo mode
                setFeatureImportance({
                    features: ['Solar Wind Speed', 'Proton Density', 'IMF Bz', 'IMF Bt', 'Plasma Beta', 'Temperature'],
                    importance: [0.32, 0.21, 0.18, 0.12, 0.1, 0.07],
                    top_features: [
                        ['Solar Wind Speed', 0.32],
                        ['Proton Density', 0.21],
                        ['IMF Bz', 0.18],
                    ],
                });
            }

            setLastUpdate(new Date().toLocaleTimeString());
        } catch (error) {
            console.error('Error fetching prediction:', error);
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
        const interval = setInterval(fetchData, 120000);

        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
            Animated.timing(gaugeAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ]).start();

        return () => clearInterval(interval);
    }, [fetchData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    if (loading) {
        return (
            <ParticleBackground>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={APP_CONFIG.colors.accent} />
                    <Text style={styles.loadingText}>Initializing Neural Network...</Text>
                </View>
            </ParticleBackground>
        );
    }

    const alertColors = getAlertColor(prediction?.alert_level || 'NONE');
    const narrativeSummary = buildNarrativeSummary(prediction, conditions, apiConnected);

    const topFi = featureImportance
        ? featureImportance.features
            .map((name, idx) => ({ name, value: featureImportance.importance[idx] ?? 0 }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6)
        : [];

    return (
        <ParticleBackground>
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={APP_CONFIG.colors.accent} />}
                >
                    <Header
                        title="CME Prediction Engine"
                        showBackButton={true}
                        onBackPress={() => navigation.goBack()}
                    />

                    {/* Narrative Summary */}
                    <GlassCard style={styles.summaryCard}>
                        <View style={styles.summaryHeader}>
                            <View style={[styles.summaryDot, { backgroundColor: alertColors[0] }]} />
                            <Text style={styles.summaryTitle}>Mission Status</Text>
                        </View>
                        <Text style={styles.summaryText}>{narrativeSummary}</Text>
                        <SeverityBar
                            value={prediction?.cme_probability ?? 0}
                            label="CME Impact Risk"
                            gradientColors={['#30D158', '#FFD60A', '#FF3B30']}
                            legendLabels={['Low', 'Moderate', 'High']}
                            barHeight={6}
                        />
                    </GlassCard>

                    {/* Status Bar */}
                    <Animated.View style={[styles.statusBar, { opacity: fadeAnim }]}>
                        <GlassCard style={styles.statusBlur}>
                            <View style={styles.statusRow}>
                                <View style={[styles.statusDot, { backgroundColor: apiConnected ? APP_CONFIG.colors.success : APP_CONFIG.colors.warning }]} />
                                <Text style={styles.statusText}>{apiConnected ? 'ML MODEL CONNECTED' : 'DEMO MODE - DISCONNECTED'}</Text>
                            </View>
                            <Text style={styles.updateText}>{lastUpdate}</Text>
                        </GlassCard>
                    </Animated.View>

                    {/* Main Gauge Section */}
                    <Animated.View style={[styles.mainSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                        <View style={styles.gaugeWrapper}>
                            <View style={[styles.gaugeRing, { borderColor: `${alertColors[0]}40` }]} />
                            <View style={[styles.gaugeRingInner, { borderColor: `${alertColors[0]}20` }]} />

                            <View style={styles.gaugeContent}>
                                <Text style={styles.probabilityLabel}>IMPACT PROBABILITY</Text>
                                <Text style={[styles.probabilityValue, { color: alertColors[0] }]}>
                                    {prediction?.cme_probability.toFixed(1)}%
                                </Text>
                                <View style={[styles.alertBadge, { backgroundColor: `${alertColors[0]}30`, borderColor: alertColors[0] }]}>
                                    <Text style={[styles.alertText, { color: alertColors[0] }]}>{prediction?.alert_level}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Arrival & Confidence */}
                        <View style={styles.predictionMeta}>
                            <GlassCard style={styles.metaCard}>
                                <Clock size={20} color="#FFF" />
                                <View>
                                    <Text style={styles.metaLabel}>ETA Arrival</Text>
                                    <Text style={styles.metaValue}>{prediction?.arrival_time_eta || '--'}</Text>
                                </View>
                            </GlassCard>
                            <GlassCard style={styles.metaCard}>
                                <Shield size={20} color="#FFF" />
                                <View>
                                    <Text style={styles.metaLabel}>Confidence</Text>
                                    <Text style={styles.metaValue}>{prediction?.confidence}%</Text>
                                </View>
                            </GlassCard>
                        </View>
                    </Animated.View>

                    {/* Live Conditions Grid */}
                    <Text style={styles.sectionHeader}>Input Vectors (Real-time)</Text>
                    <View style={styles.gridContainer}>
                        <MetricCard
                            icon={Wind}
                            label="Solar Wind"
                            value={conditions?.solar_wind.speed_km_s?.toFixed(0)}
                            unit=" km/s"
                            color={APP_CONFIG.colors.info}
                        />
                        <MetricCard
                            icon={Activity}
                            label="Density"
                            value={conditions?.solar_wind.density_p_cm3?.toFixed(1)}
                            unit=" p/cm³"
                            color={APP_CONFIG.colors.success}
                        />
                        <MetricCard
                            icon={Magnet}
                            label="IMF Bz"
                            value={conditions?.magnetic_field.bz_nT?.toFixed(1)}
                            unit=" nT"
                            color={APP_CONFIG.colors.accent}
                        />
                        <MetricCard
                            icon={Zap}
                            label="Storm Risk"
                            value={conditions?.storm_potential || 'Low'}
                            unit=""
                            color={APP_CONFIG.colors.warning}
                        />
                    </View>

                    {/* Historical Trend Chart */}
                    <Text style={styles.sectionHeader}>Probability Trend (Last 24h)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
                        <GlassCard style={styles.chartCard}>
                          <ChartSafe fallbackText="Trend chart unavailable">
                            <LineChart
                                data={{
                                    labels: ["-24h", "-20h", "-16h", "-12h", "-8h", "-4h", "Now"],
                                    datasets: [{
                                        data: [
                                            Math.max(10, (prediction?.cme_probability || 50) - 20),
                                            Math.max(15, (prediction?.cme_probability || 50) - 15),
                                            Math.max(12, (prediction?.cme_probability || 50) - 18),
                                            Math.max(25, (prediction?.cme_probability || 50) - 5),
                                            (prediction?.cme_probability || 50),
                                            Math.min(95, (prediction?.cme_probability || 50) + 5),
                                            prediction?.cme_probability || 50
                                        ]
                                    }]
                                }}
                                width={CHART_WIDTH}
                                height={220}
                                yAxisLabel=""
                                yAxisSuffix="%"
                                chartConfig={{
                                    backgroundColor: SAFE_CHART_BG,
                                    backgroundGradientFrom: SAFE_CHART_BG,
                                    backgroundGradientTo: SAFE_CHART_BG,
                                    decimalPlaces: 0,
                                    color: (opacity = 1) => `rgba(0,163,255,${opacity})`,
                                    labelColor: (opacity = 1) => `rgba(255,255,255,${opacity})`,
                                    style: { borderRadius: 16 },
                                    propsForDots: { r: "4", strokeWidth: "2", stroke: APP_CONFIG.colors.accent }
                                }}
                                bezier
                                style={{ marginVertical: 8, borderRadius: 16 }}
                            />
                          </ChartSafe>
                        </GlassCard>
                    </ScrollView>

                    {/* Solar Wind Histogram */}
                    <Text style={styles.sectionHeader}>Solar Wind Speed (Last 6h)</Text>
                    <GlassCard style={styles.chartCard}>
                      <ChartSafe fallbackText="Wind speed chart unavailable">
                        <BarChart
                            data={{
                                labels: ["-5h", "-4h", "-3h", "-2h", "-1h", "Now"],
                                datasets: [{
                                    data: [
                                        (conditions?.solar_wind.speed_km_s || 400) - 20,
                                        (conditions?.solar_wind.speed_km_s || 400) + 10,
                                        (conditions?.solar_wind.speed_km_s || 400) - 5,
                                        (conditions?.solar_wind.speed_km_s || 400) + 30,
                                        (conditions?.solar_wind.speed_km_s || 400) + 15,
                                        conditions?.solar_wind.speed_km_s || 400
                                    ]
                                }]
                            }}
                            width={CHART_WIDTH}
                            height={220}
                            yAxisLabel=""
                            yAxisSuffix=" km/s"
                            chartConfig={{
                                backgroundColor: SAFE_CHART_BG,
                                backgroundGradientFrom: SAFE_CHART_BG,
                                backgroundGradientTo: SAFE_CHART_BG,
                                decimalPlaces: 0,
                                color: (opacity = 1) => `rgba(48,209,88,${opacity})`,
                                labelColor: (opacity = 1) => `rgba(255,255,255,${opacity})`,
                            }}
                            style={{ marginVertical: 8, borderRadius: 16 }}
                        />
                      </ChartSafe>
                    </GlassCard>

                    {/* Model Performance */}
                    <Text style={styles.sectionHeader}>Model Metrics (Bi-LSTM + Transformer)</Text>
                    <GlassCard style={styles.modelCard}>
                        {apiConnected ? (
                        <View style={styles.modelGrid}>
                            <View style={styles.modelItem}>
                                <Text style={styles.modelValue}>{accuracy?.accuracy}%</Text>
                                <Text style={styles.modelLabel}>Accuracy</Text>
                            </View>
                            <View style={styles.verticalDivider} />
                            <View style={styles.modelItem}>
                                <Text style={styles.modelValue}>{accuracy?.precision}%</Text>
                                <Text style={styles.modelLabel}>Precision</Text>
                            </View>
                            <View style={styles.verticalDivider} />
                            <View style={styles.modelItem}>
                                <Text style={styles.modelValue}>{accuracy?.recall}%</Text>
                                <Text style={styles.modelLabel}>Recall</Text>
                            </View>
                            <View style={styles.verticalDivider} />
                            <View style={styles.modelItem}>
                                <Text style={styles.modelValue}>{accuracy?.auc_roc}</Text>
                                <Text style={styles.modelLabel}>AUC-ROC</Text>
                            </View>
                        </View>
                        ) : (
                        <View style={{alignItems:'center',paddingVertical:16}}>
                            <Text style={{color:'rgba(255,255,255,0.5)',fontSize:14}}>Offline — connect to API for live metrics</Text>
                        </View>
                        )}
                        <View style={styles.modelFooter}>
                            <Info size={14} color="rgba(255,255,255,0.5)" />
                            <Text style={styles.modelFooterText}>
                                {apiConnected
                                    ? `Validated on ${accuracy?.total_events_tested} samples • ${accuracy?.validation_period}`
                                    : 'Demo mode — metrics require backend connection'}
                            </Text>
                        </View>
                    </GlassCard>

                    {/* Model Explainability */}
                    {topFi.length > 0 && (
                        <>
                            <Text style={styles.sectionHeader}>Top Input Drivers</Text>
                            <GlassCard style={styles.explainCard}>
                                <View style={styles.explainHeader}>
                                    <BarChart2 size={18} color={APP_CONFIG.colors.accent} />
                                    <Text style={styles.explainTitle}>Feature Importance</Text>
                                </View>
                                <ChartSafe fallbackText="Feature importance chart unavailable">
                                <BarChart
                                    data={{
                                        labels: topFi.map(f => f.name.split(' ').slice(0, 2).join(' ')),
                                        datasets: [
                                            {
                                                data: topFi.map(f => Number((f.value * 100).toFixed(1))),
                                            },
                                        ],
                                    }}
                                    width={CHART_WIDTH}
                                    height={220}
                                    yAxisLabel=""
                                    yAxisSuffix="%"
                                    chartConfig={{
                                        backgroundColor: SAFE_CHART_BG,
                                        backgroundGradientFrom: SAFE_CHART_BG,
                                        backgroundGradientTo: SAFE_CHART_BG,
                                        decimalPlaces: 1,
                                        color: (opacity = 1) => `rgba(0,163,255,${opacity})`,
                                        labelColor: (opacity = 1) => `rgba(248,250,252,${opacity})`,
                                        barPercentage: 0.6,
                                    }}
                                    style={styles.explainChart}
                                    fromZero
                                />
                                </ChartSafe>
                                <Text style={styles.explainCaption}>
                                    Higher bars mean the feature contributes more to today&apos;s CME risk estimate.
                                </Text>
                            </GlassCard>
                        </>
                    )}

                    {/* Architecture Details */}
                    <TouchableOpacity style={styles.archButton}>
                        <GlassCard style={styles.archBlur}>
                            <Cpu size={20} color="#FFF" />
                            <Text style={styles.archText}>View Neural Network Architecture</Text>
                            <Share2 size={16} color="rgba(255,255,255,0.5)" />
                        </GlassCard>
                    </TouchableOpacity>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </SafeAreaView>
        </ParticleBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    loadingContainer: {
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
    summaryCard: {
        marginBottom: 24,
        padding: 18,
        borderRadius: 18,
        backgroundColor: APP_CONFIG.colors.background.card,
        borderWidth: 1,
        borderColor: APP_CONFIG.colors.border.accent,
    },
    summaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    summaryDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    summaryTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: APP_CONFIG.colors.white,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    summaryText: {
        fontSize: 13,
        color: APP_CONFIG.colors.text.secondary,
        lineHeight: 18,
        marginBottom: 12,
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
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    statusBar: {
        marginBottom: 28,
        borderRadius: 14,
        overflow: 'hidden',
    },
    statusBlur: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: APP_CONFIG.colors.background.card,
        borderWidth: 1,
        borderColor: APP_CONFIG.colors.border.default,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 11,
        color: APP_CONFIG.colors.text.secondary,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    updateText: {
        fontSize: 11,
        color: APP_CONFIG.colors.text.tertiary,
    },
    mainSection: {
        alignItems: 'center',
        marginBottom: 36,
    },
    gaugeWrapper: {
        width: 220,
        height: 220,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 28,
    },
    gaugeRing: {
        position: 'absolute',
        width: 220,
        height: 220,
        borderRadius: 110,
        borderWidth: 2,
    },
    gaugeRingInner: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        borderWidth: 12,
        borderStyle: 'dashed',
    },
    gaugeContent: {
        alignItems: 'center',
    },
    probabilityLabel: {
        fontSize: 11,
        color: APP_CONFIG.colors.text.secondary,
        letterSpacing: 2,
        marginBottom: 6,
    },
    probabilityValue: {
        fontSize: 48,
        fontWeight: '200',
        letterSpacing: -2,
    },
    alertBadge: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 14,
        borderWidth: 1,
        marginTop: 10,
    },
    alertText: {
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 1.5,
    },
    predictionMeta: {
        flexDirection: 'row',
        gap: 14,
        width: '100%',
    },
    metaCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 18,
        borderRadius: 18,
        gap: 14,
        backgroundColor: APP_CONFIG.colors.background.card,
        borderWidth: 1,
        borderColor: APP_CONFIG.colors.border.default,
    },
    metaLabel: {
        fontSize: 10,
        color: APP_CONFIG.colors.text.tertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    metaValue: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFF',
    },
    sectionHeader: {
        fontSize: 12,
        color: APP_CONFIG.colors.text.secondary,
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 18,
        marginLeft: 4,
        fontWeight: '600',
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
        marginBottom: 36,
    },
    metricCard: {
        width: (width - 62) / 2,
        padding: 18,
        borderRadius: 18,
        backgroundColor: APP_CONFIG.colors.background.card,
        borderWidth: 1,
        borderColor: APP_CONFIG.colors.border.default,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
    },
    metricValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFF',
        marginBottom: 6,
    },
    metricUnit: {
        fontSize: 13,
        color: APP_CONFIG.colors.text.secondary,
        fontWeight: '400',
    },
    metricLabel: {
        fontSize: 12,
        color: APP_CONFIG.colors.text.tertiary,
        fontWeight: '500',
    },
    modelCard: {
        padding: 22,
        borderRadius: 22,
        backgroundColor: APP_CONFIG.colors.background.card,
        borderWidth: 1,
        borderColor: APP_CONFIG.colors.border.default,
        marginBottom: 28,
    },
    modelGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 18,
    },
    modelItem: {
        alignItems: 'center',
    },
    modelValue: {
        fontSize: 20,
        fontWeight: '700',
        color: APP_CONFIG.colors.accent,
        marginBottom: 6,
    },
    modelLabel: {
        fontSize: 10,
        color: APP_CONFIG.colors.text.tertiary,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    verticalDivider: {
        width: 1,
        height: '80%',
        backgroundColor: APP_CONFIG.colors.border.default,
        alignSelf: 'center',
    },
    modelFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingTop: 18,
        borderTopWidth: 1,
        borderTopColor: APP_CONFIG.colors.border.subtle,
    },
    modelFooterText: {
        fontSize: 11,
        color: APP_CONFIG.colors.text.tertiary,
    },
    explainCard: {
        padding: 18,
        borderRadius: 22,
        backgroundColor: APP_CONFIG.colors.background.card,
        borderWidth: 1,
        borderColor: APP_CONFIG.colors.border.default,
        marginBottom: 28,
    },
    explainHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
    },
    explainTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: APP_CONFIG.colors.white,
    },
    explainChart: {
        marginVertical: 8,
        borderRadius: 16,
    },
    explainCaption: {
        fontSize: 11,
        color: APP_CONFIG.colors.text.tertiary,
        marginTop: 8,
    },
    archButton: {
        borderRadius: 18,
        overflow: 'hidden',
    },
    archBlur: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 18,
        backgroundColor: 'rgba(0, 102, 255, 0.1)',
        borderWidth: 1,
        borderColor: APP_CONFIG.colors.border.accent,
        gap: 14,
    },
    archText: {
        flex: 1,
        fontSize: 15,
        color: '#FFF',
        fontWeight: '600',
    },
    chartScroll: {
        marginBottom: 26,
        marginHorizontal: -24, // bleed into padding
        paddingHorizontal: 24,
    },
    chartCard: {
        padding: CARD_PAD,
        borderRadius: 22,
        overflow: 'hidden',
        backgroundColor: APP_CONFIG.colors.background.card,
        borderWidth: 1,
        borderColor: APP_CONFIG.colors.border.default,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16, // spacing for scroll
    },
});
