/**
 * SpaceWeatherMapScreen — Full-featured global space weather dashboard
 * Shows Leaflet map with aurora ovals + a live data panel with Kp, solar wind,
 * IMF Bz, storm potential, and a color-coded legend.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import GlassCard from '../components/GlassCard';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft,
  Globe,
  Wind,
  Zap,
  Activity,
  Shield,
  AlertTriangle,
  RefreshCw,
  Compass,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import ParticleBackground from '../components/ParticleBackground';
import SeverityBar from '../components/SeverityBar';
import { APP_CONFIG } from '../utils/constants';
import { getRealTimeSolarWindSummary, getAuroraForecast, fetchAuroraOvationData } from '../utils/noaaApi';

const { width } = Dimensions.get('window');

// --------------- Leaflet HTML with real NOAA Ovation aurora heatmap ---------------
const mapHtml = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      crossorigin="" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      crossorigin=""></script>
    <script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
    <style>
      html, body { margin: 0; padding: 0; height: 100%; width: 100%; background: #020617; overflow: hidden; touch-action: none; }
      #map { width: 100%; height: 100%; touch-action: none; }
      .leaflet-control-attribution { display: none !important; }
      .leaflet-control-zoom a {
        background: rgba(2,6,23,0.85) !important;
        color: #e2e8f0 !important;
        border-color: rgba(255,255,255,0.15) !important;
        width: 36px !important;
        height: 36px !important;
        line-height: 36px !important;
        font-size: 20px !important;
        border-radius: 10px !important;
      }
      .leaflet-control-zoom { border: none !important; border-radius: 10px !important; overflow: hidden; }
      .leaflet-control-zoom a:hover { background: rgba(2,6,23,0.95) !important; }

      .legend {
        background: rgba(2, 6, 23, 0.85);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px;
        padding: 10px 14px;
        color: #e2e8f0;
        font-family: system-ui, sans-serif;
        font-size: 11px;
        line-height: 1.7;
        backdrop-filter: blur(10px);
      }
      .legend-title { font-weight: 700; font-size: 12px; margin-bottom: 6px; letter-spacing: 1px; }
      .legend-item { display: flex; align-items: center; gap: 6px; }
      .legend-swatch { width: 14px; height: 6px; border-radius: 3px; display: inline-block; }

      .status-badge {
        background: rgba(2,6,23,0.85);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        padding: 6px 12px;
        color: #94a3b8;
        font-family: system-ui, sans-serif;
        font-size: 10px;
        font-weight: 600;
        backdrop-filter: blur(10px);
        white-space: nowrap;
        letter-spacing: 0.5px;
      }
      .status-badge.live { color: #22c55e; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      var map = L.map('map', {
        zoomControl: true,
        attributionControl: false,
        worldCopyJump: true,
        minZoom: 1,
        maxZoom: 10,
        zoomSnap: 0.5,
        zoomDelta: 0.5,
        tap: true,
        dragging: true,
        touchZoom: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        bounceAtZoomLimits: true,
      }).setView([50, 10], 2);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 10, subdomains: 'abcd'
      }).addTo(map);

      var heatLayer = null;

      // Legend
      var legend = L.control({ position: 'bottomleft' });
      legend.onAdd = function () {
        var d = L.DomUtil.create('div', 'legend');
        d.innerHTML = '<div class="legend-title">AURORA PROBABILITY</div>'
          + '<div class="legend-item"><span class="legend-swatch" style="background:#22c55e"></span> Low (5-20%)</div>'
          + '<div class="legend-item"><span class="legend-swatch" style="background:#eab308"></span> Moderate (20-50%)</div>'
          + '<div class="legend-item"><span class="legend-swatch" style="background:#f97316"></span> High (50-75%)</div>'
          + '<div class="legend-item"><span class="legend-swatch" style="background:#ef4444"></span> Extreme (75%+)</div>';
        return d;
      };
      legend.addTo(map);

      // Status badge
      var statusCtrl = L.control({ position: 'topright' });
      statusCtrl.onAdd = function () {
        var d = L.DomUtil.create('div', 'status-badge');
        d.id = 'status';
        d.innerHTML = 'Loading NOAA Ovation data...';
        return d;
      };
      statusCtrl.addTo(map);

      /**
       * Receives real NOAA Ovation aurora probability data as [[lat, lng, prob], ...]
       * and renders it as a heatmap using leaflet-heat.
       */
      window.updateAurora = function (json) {
        try {
          var points = JSON.parse(json);
          if (heatLayer) { map.removeLayer(heatLayer); }

          if (!points || points.length === 0) {
            document.getElementById('status').innerHTML = 'No aurora data available';
            document.getElementById('status').className = 'status-badge';
            return;
          }

          heatLayer = L.heatLayer(points, {
            radius: 14,
            blur: 20,
            maxZoom: 10,
            max: 1.0,
            minOpacity: 0.15,
            gradient: {
              0.0:  'transparent',
              0.08: 'rgba(34,197,94,0.25)',
              0.2:  '#22c55e',
              0.4:  '#eab308',
              0.6:  '#f97316',
              0.8:  '#ef4444',
              1.0:  '#dc2626'
            }
          }).addTo(map);

          document.getElementById('status').innerHTML = 'NOAA Ovation Aurora Model — Live (' + points.length + ' pts)';
          document.getElementById('status').className = 'status-badge live';
        } catch (e) {
          console.error('updateAurora error', e);
        }
      };

      window.ReactNativeWebView.postMessage('MAP_READY');
    </script>
  </body>
</html>
`;

// --------------- Data types ---------------
interface SpaceWeatherData {
  kpIndex: number;
  windSpeed: number;
  windDensity: number;
  bzComponent: number;
  stormPotential: string;
  auroraVisibility: string;
  auroraLatReach: string;
}

const DEFAULT_DATA: SpaceWeatherData = {
  kpIndex: 0,
  windSpeed: 0,
  windDensity: 0,
  bzComponent: 0,
  stormPotential: 'Low',
  auroraVisibility: '--',
  auroraLatReach: '--',
};

// --------------- Component ---------------
const SpaceWeatherMapScreen: React.FC = () => {
  const navigation = useNavigation();
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<SpaceWeatherData>(DEFAULT_DATA);
  const [mapReady, setMapReady] = useState(false);
  const latestAuroraRef = useRef<number[][]>([]);

  const pushAuroraToMap = useCallback((points: number[][]) => {
    if (!webViewRef.current || !mapReady) return;
    const json = JSON.stringify(points);
    webViewRef.current.injectJavaScript(
      `window.updateAurora(${JSON.stringify(json)}); true;`
    );
  }, [mapReady]);

  // Re-push aurora data when map becomes ready
  useEffect(() => {
    if (mapReady && latestAuroraRef.current.length > 0) {
      pushAuroraToMap(latestAuroraRef.current);
    }
  }, [mapReady, pushAuroraToMap]);

  const fetchData = useCallback(async () => {
    try {
      // Fetch solar wind summary AND real aurora probability data in parallel
      const [summary, auroraPoints] = await Promise.allSettled([
        getRealTimeSolarWindSummary(),
        fetchAuroraOvationData(),
      ]);

      // Process solar wind summary
      const summaryData = summary.status === 'fulfilled' ? summary.value : null;
      if (summaryData) {
        const kp = summaryData.geomagnetic.kpIndex;
        const auroraInfo = getAuroraForecast(kp);

        const newData: SpaceWeatherData = {
          kpIndex: kp,
          windSpeed: Math.round(summaryData.current.speed),
          windDensity: parseFloat(summaryData.current.density?.toFixed(1) || '0'),
          bzComponent: parseFloat(summaryData.current.bz?.toFixed(1) || '0'),
          stormPotential:
            kp >= 7 ? 'Severe' : kp >= 5 ? 'High' : kp >= 3 ? 'Moderate' : 'Low',
          auroraVisibility: auroraInfo.visibility,
          auroraLatReach: auroraInfo.latitudeReach,
        };

        setData(newData);
      }

      // Push real aurora heatmap data to the map
      const aurora = auroraPoints.status === 'fulfilled' ? auroraPoints.value : [];
      latestAuroraRef.current = aurora;
      pushAuroraToMap(aurora);
    } catch {
      // silent - keep last data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pushAuroraToMap]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const onMessage = useCallback((e: any) => {
    if (e.nativeEvent.data === 'MAP_READY') {
      setMapReady(true);
    }
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getKpColor = (kp: number) => {
    if (kp >= 7) return '#EF4444';
    if (kp >= 5) return '#F97316';
    if (kp >= 3) return '#EAB308';
    return '#22C55E';
  };

  const kpColor = getKpColor(data.kpIndex);

  return (
    <ParticleBackground>
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        {/* Header */}
        <GlassCard intensity={20} tint="dark" style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn as any}>
              <ChevronLeft size={22} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Global Space Weather</Text>
              <Text style={styles.headerSub}>Live NOAA/DSCOVR Data</Text>
            </View>
            <TouchableOpacity onPress={handleRefresh} style={styles.headerBtn as any}>
              <RefreshCw size={18} color={refreshing ? APP_CONFIG.colors.accent : '#fff'} />
            </TouchableOpacity>
          </View>
        </GlassCard>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Map */}
          <View style={styles.mapWrapper}>
            <WebView
              ref={webViewRef}
              originWhitelist={['*']}
              source={{ html: mapHtml }}
              style={styles.webview}
              javaScriptEnabled
              domStorageEnabled
              nestedScrollEnabled={true}
              scrollEnabled={false}
              overScrollMode="never"
              onMessage={onMessage}
            />
            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={APP_CONFIG.colors.accent} />
                <Text style={styles.loadingText}>Projecting auroral ovals...</Text>
              </View>
            )}
          </View>

          {/* Kp Gauge Card */}
          <GlassCard intensity={25} tint="dark" style={styles.kpCard}>
            <View style={styles.kpRow}>
              <View style={styles.kpGauge}>
                <View style={[styles.kpCircle, { borderColor: kpColor }]}>
                  <Text style={[styles.kpValue, { color: kpColor }]}>{data.kpIndex}</Text>
                </View>
                <Text style={styles.kpLabel}>Kp INDEX</Text>
              </View>
              <View style={styles.kpDetails}>
                <Text style={styles.kpDetailTitle}>Geomagnetic Activity</Text>
                <Text style={[styles.kpDetailBadge, { color: kpColor }]}>
                  {data.kpIndex >= 7 ? 'SEVERE STORM' :
                    data.kpIndex >= 5 ? 'MAJOR STORM' :
                      data.kpIndex >= 3 ? 'MODERATE ACTIVITY' : 'QUIET CONDITIONS'}
                </Text>
                <SeverityBar
                  value={(data.kpIndex / 9) * 100}
                  legendLabels={['Quiet', 'Active', 'Storm']}
                  barHeight={5}
                  showValue={false}
                  style={{ marginTop: 8 }}
                />
              </View>
            </View>
          </GlassCard>

          {/* Live Metrics Grid */}
          <View style={styles.metricsGrid}>
            <GlassCard intensity={20} tint="dark" style={styles.metricCard}>
              <Wind size={18} color="#38BDF8" />
              <Text style={styles.metricValue}>{data.windSpeed}</Text>
              <Text style={styles.metricUnit}>km/s</Text>
              <Text style={styles.metricLabel}>Solar Wind</Text>
            </GlassCard>

            <GlassCard intensity={20} tint="dark" style={styles.metricCard}>
              <Activity size={18} color="#22C55E" />
              <Text style={styles.metricValue}>{data.windDensity}</Text>
              <Text style={styles.metricUnit}>p/cm³</Text>
              <Text style={styles.metricLabel}>Proton Density</Text>
            </GlassCard>

            <GlassCard intensity={20} tint="dark" style={styles.metricCard}>
              <Zap size={18} color={data.bzComponent < -5 ? '#EF4444' : '#A78BFA'} />
              <Text style={styles.metricValue}>{data.bzComponent}</Text>
              <Text style={styles.metricUnit}>nT</Text>
              <Text style={styles.metricLabel}>IMF Bz</Text>
            </GlassCard>

            <GlassCard intensity={20} tint="dark" style={styles.metricCard}>
              <Shield size={18} color={data.stormPotential === 'Low' ? '#22C55E' : '#F97316'} />
              <Text style={[styles.metricValue, { fontSize: 16 }]}>{data.stormPotential}</Text>
              <Text style={styles.metricUnit}> </Text>
              <Text style={styles.metricLabel}>Storm Risk</Text>
            </GlassCard>
          </View>

          {/* Aurora Visibility Card */}
          <GlassCard intensity={20} tint="dark" style={styles.auroraCard}>
            <View style={styles.auroraRow}>
              <Compass size={20} color="#A78BFA" />
              <Text style={styles.auroraTitle}>Aurora Visibility</Text>
            </View>
            <View style={styles.auroraDetails}>
              <View style={styles.auroraItem}>
                <Text style={styles.auroraItemLabel}>Visibility</Text>
                <Text style={styles.auroraItemValue}>{data.auroraVisibility}</Text>
              </View>
              <View style={styles.aurDivider} />
              <View style={styles.auroraItem}>
                <Text style={styles.auroraItemLabel}>Latitude Reach</Text>
                <Text style={styles.auroraItemValue}>{data.auroraLatReach}</Text>
              </View>
            </View>
            {data.kpIndex >= 5 && (
              <View style={styles.alertBanner}>
                <AlertTriangle size={14} color="#F97316" />
                <Text style={styles.alertText}>
                  Geomagnetic storm in progress — aurora may be visible at mid-latitudes.
                </Text>
              </View>
            )}
          </GlassCard>

          {/* Interpretation Card */}
          <GlassCard intensity={15} tint="dark" style={styles.interpretCard}>
            <Text style={styles.interpretTitle}>What This Means</Text>
            <Text style={styles.interpretText}>
              {data.kpIndex >= 7
                ? 'Severe geomagnetic storm. GPS degradation, HF radio blackouts, and power grid stress possible. Aurora visible down to ~40° latitude.'
                : data.kpIndex >= 5
                  ? 'Active storm conditions. Satellite drag increased, GNSS accuracy reduced. Northern lights visible at mid-latitudes on clear nights.'
                  : data.kpIndex >= 3
                    ? 'Minor geomagnetic activity. Aurora visible at high latitudes (>60°). Minimal impact on technology.'
                    : 'Quiet geomagnetic conditions. Normal operations for satellites, navigation, and communications. Aurora confined to polar regions.'
              }
            </Text>
          </GlassCard>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </ParticleBackground>
  );
};

// --------------- Styles ---------------
const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: APP_CONFIG.colors.border.subtle,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    color: APP_CONFIG.colors.white,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 1,
  },
  headerSub: {
    color: APP_CONFIG.colors.text.secondary,
    fontSize: 10,
    marginTop: 1,
    letterSpacing: 0.5,
  },

  scroll: { flex: 1 },

  // Map
  mapWrapper: {
    height: 400,
    marginTop: 4,
    marginHorizontal: 12,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.border.default,
    backgroundColor: '#020617',
  },
  webview: { flex: 1, backgroundColor: '#020617' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.8)',
  },
  loadingText: {
    marginTop: 10,
    color: APP_CONFIG.colors.text.secondary,
    fontSize: 12,
  },

  // Kp Card
  kpCard: {
    marginHorizontal: 12,
    marginTop: 14,
    padding: 18,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.border.default,
  },
  kpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  kpGauge: {
    alignItems: 'center',
  },
  kpCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  kpValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  kpLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: APP_CONFIG.colors.text.secondary,
    letterSpacing: 1.5,
    marginTop: 4,
  },
  kpDetails: { flex: 1 },
  kpDetailTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: APP_CONFIG.colors.white,
    marginBottom: 2,
  },
  kpDetailBadge: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginHorizontal: 12,
    marginTop: 14,
  },
  metricCard: {
    width: (width - 34) / 2,
    padding: 14,
    borderRadius: 16,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.border.default,
    gap: 4,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: APP_CONFIG.colors.white,
  },
  metricUnit: {
    fontSize: 10,
    color: APP_CONFIG.colors.text.tertiary,
    fontWeight: '600',
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: APP_CONFIG.colors.text.secondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Aurora Card
  auroraCard: {
    marginHorizontal: 12,
    marginTop: 14,
    padding: 18,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.border.default,
  },
  auroraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  auroraTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: APP_CONFIG.colors.white,
    letterSpacing: 0.5,
  },
  auroraDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  auroraItem: { flex: 1, alignItems: 'center' },
  auroraItemLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: APP_CONFIG.colors.text.tertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  auroraItemValue: {
    fontSize: 14,
    fontWeight: '700',
    color: APP_CONFIG.colors.white,
  },
  aurDivider: {
    width: 1,
    height: 30,
    backgroundColor: APP_CONFIG.colors.border.default,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)',
  },
  alertText: {
    flex: 1,
    fontSize: 11,
    color: '#F97316',
    fontWeight: '600',
  },

  // Interpretation
  interpretCard: {
    marginHorizontal: 12,
    marginTop: 14,
    padding: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.border.default,
  },
  interpretTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: APP_CONFIG.colors.white,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  interpretText: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
    lineHeight: 18,
  },
});

export default SpaceWeatherMapScreen;
