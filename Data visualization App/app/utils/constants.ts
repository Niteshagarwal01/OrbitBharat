// Premium Design System - Blue, White & Black Palette
// Typography: Inter (body), Playfair Display (elegant), Space Grotesk (titles)

export const APP_CONFIG = {
  name: 'OrbitBharat',
  version: '2.0.0',
  developer: 'Nitesh Agarwal',
  description: 'Advanced Space Weather Monitoring & ISRO Satellite Tracking System',

  // Premium Color Palette
  colors: {
    // Primary Blues
    primary: '#0066FF',
    primaryLight: '#3399FF',
    primaryDark: '#0044CC',
    accent: '#00A3FF',
    accentGlow: 'rgba(0, 163, 255, 0.3)',

    // Whites & Grays
    white: '#FFFFFF',
    offWhite: '#F8F9FA',
    silver: '#E8ECF0',
    muted: '#94A3B8',

    // Blacks & Dark
    black: '#000000',
    richBlack: '#0A0A0F',
    darkNavy: '#0D1117',
    charcoal: '#1A1A2E',

    // Semantic
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',

    // Legacy support
    secondary: '#1a1a2e',
    background: {
      main: '#0A0A0F',
      secondary: '#0D1117',
      tertiary: '#1A1A2E',
      card: 'rgba(13, 17, 23, 0.8)',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#94A3B8',
      tertiary: '#64748B',
      accent: '#00A3FF',
    },
    overlay: {
      light: 'rgba(255,255,255,0.03)',
      medium: 'rgba(255,255,255,0.06)',
      dark: 'rgba(255,255,255,0.1)',
    },
    gradient: {
      primary: ['#0066FF', '#00A3FF'],
      dark: ['#0A0A0F', '#1A1A2E'],
      card: ['rgba(13, 17, 23, 0.9)', 'rgba(26, 26, 46, 0.6)'],
      accent: ['#0066FF', '#00A3FF', '#00D4FF'],
    },
    border: {
      subtle: 'rgba(255,255,255,0.06)',
      default: 'rgba(255,255,255,0.1)',
      accent: 'rgba(0, 163, 255, 0.3)',
    },
  },

  // Premium Typography
  typography: {
    // Title Font - Bold, impactful headers
    title: {
      fontWeight: '800' as const,
      letterSpacing: 1,
    },
    // Elegant Font - Refined, sophisticated text
    elegant: {
      fontWeight: '300' as const,
      letterSpacing: 0.5,
    },
    // Body Font - Clean, readable content
    body: {
      fontWeight: '400' as const,
      letterSpacing: 0,
    },
    // Italic variant
    italic: {
      fontStyle: 'italic' as const,
      fontWeight: '400' as const,
    },
    sizes: {
      xs: 10,
      sm: 12,
      md: 14,
      lg: 16,
      xl: 20,
      xxl: 24,
      xxxl: 32,
      display: 48,
      hero: 56,
    },
  },

  // Refined Spacing System
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
    section: 40,
  },

  // Modern Border Radius
  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    full: 999,
  },

  // Premium Shadows
  shadows: {
    subtle: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    light: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 6,
    },
    heavy: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 12,
    },
    glow: {
      shadowColor: '#0066FF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 15,
    },
  },

  // Animation Timings
  animation: {
    duration: {
      instant: 100,
      fast: 200,
      normal: 300,
      slow: 500,
      xslow: 800,
    },
    easing: {
      ease: 'ease',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out',
    },
  },
};

export const SENSOR_DATA = [
  {
    id: '1',
    name: 'SWIS',
    desc: 'Solar Wind Ion Spectrometer',
    reading: 'Proton Flux: 3.2×10⁸',
    trendUp: true,
    graph: require('../../assets/graph_01.png'),
  },
  {
    id: '2',
    name: 'ASPEX',
    desc: 'Aditya Solar Wind Particle Experiment',
    reading: 'Ion Count: 4.1×10⁷',
    trendUp: false,
    graph: require('../../assets/graph_02.png'),
  },
  {
    id: '3',
    name: 'VELC',
    desc: 'Visible Emission Line Coronagraph',
    reading: 'Intensity: 1.2×10⁶',
    trendUp: true,
    graph: require('../../assets/graph_03.png'),
  },
];

export const TRENDING_DATA = [
  { id: '1', name: 'Magnetic Field', change: '↑ Stable', trendUp: true },
  { id: '2', name: 'Solar Flare Activity', change: '↓ Low', trendUp: false },
  { id: '3', name: 'Particle Flux', change: '↑ Rising', trendUp: true },
];

export const TIME_FILTERS = ['1D', '1W', '1M', '1Y', '5Y', 'ALL'];

export const STATISTICS_DATA = [
  ['Open', '204.00'],
  ['High', '209.15'],
  ['Low', '202.12'],
  ['Volume', '1.3M'],
  ['Avg Volume', '1.1M'],
  ['Activity', 'Rising'],
];

export const CHART_DATA = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  datasets: [
    {
      data: [204.0, 207.5, 206.0, 208.0, 207.2, 206.8, 202.12],
    },
  ],
}; 