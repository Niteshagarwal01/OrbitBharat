import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Linking,
  Alert,
  Image,
  Dimensions,
  ImageBackground
} from 'react-native';
import {
  Flashlight,
  Sun,
  CloudLightning,
  Sparkles,
  Rocket,
  Cpu,
  Newspaper,
  Bookmark,
  Share2,
  Clock,
  ArrowRight,
  Search,
  BookOpen
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { APP_CONFIG } from '../utils/constants';
import { logger } from '../utils/logger';
import Header from '../components/Header';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import ParticleBackground from '../components/ParticleBackground';
import { getAllSpaceNews, getCurrentDateTime, SpaceBlog } from '../utils/spaceNewsFetcher';
import { useBookmarks } from '../utils/LoginFeatures';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '@clerk/clerk-expo';

type Props = NativeStackScreenProps<RootStackParamList, 'Blog'>;

const { width } = Dimensions.get('window');

// Category icons mapping
const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'cme': return Flashlight;
    case 'flare': return Sun;
    case 'storm': return CloudLightning;
    case 'aurora': return Sparkles;
    case 'mission': return Rocket;
    case 'prediction': return Cpu;
    default: return Newspaper;
  }
};

// Category colors - Premium Blue Palette
const getCategoryColor = (category: string): string => {
  switch (category) {
    case 'cme': return '#0066FF';
    case 'flare': return '#3399FF';
    case 'storm': return '#00A3FF';
    case 'aurora': return '#0044CC';
    case 'mission': return '#00D4FF';
    case 'prediction': return '#0066FF';
    default: return '#3399FF';
  }
};

export default function BlogScreen({ navigation }: Props) {
  const { isSignedIn } = useAuth();
  const { bookmarks, toggleBookmark, isBookmarked } = useBookmarks();

  const [articles, setArticles] = useState<SpaceBlog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'feed' | 'saved'>('feed');
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  // Fetch real-time news
  const fetchNews = useCallback(async () => {
    try {
      const news = await getAllSpaceNews();
      setArticles(news);
    } catch (error) {
      logger.error('Failed to fetch space news', { error }, 'BlogScreen');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNews();
  }, [fetchNews]);

  const handleArticlePress = async (article: SpaceBlog) => {
    logger.info('Article pressed', { id: article.id }, 'BlogScreen');
    if (article.url) {
      if (article.url.startsWith('http')) {
        await WebBrowser.openBrowserAsync(article.url);
      } else if (article.url === '#prediction') {
        navigation.navigate('Prediction');
      }
    }
  };

  const articleImages: Record<string, any> = {
    cme: require('../../assets/adaptive-icon.png'), // Replace with actual category images if available
    flare: require('../../assets/adaptive-icon.png'),
    storm: require('../../assets/adaptive-icon.png'),
    // Fallbacks
  };

  const renderArticle = (article: SpaceBlog) => {
    const isSaved = isBookmarked(article.id);
    const CategoryIcon = getCategoryIcon(article.category);
    const catColor = getCategoryColor(article.category);

    return (
      <Animated.View key={article.id} style={[styles.articleCard, { opacity: fadeAnim }]}>
        <TouchableOpacity onPress={() => handleArticlePress(article)} activeOpacity={0.9}>
          <View style={styles.imagePlaceholder}>
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']}
              style={styles.imageGradient}
            />
            <View style={[styles.cardBadge, { backgroundColor: catColor }]}>
              <CategoryIcon size={12} color="#000" />
              <Text style={styles.cardBadgeText}>{article.category.toUpperCase()}</Text>
            </View>
          </View>

          <BlurView intensity={20} tint="dark" style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={2}>{article.title}</Text>
            <Text style={styles.cardSummary} numberOfLines={2}>{article.summary}</Text>

            <View style={styles.cardFooter}>
              <View style={styles.sourceRow}>
                <Clock size={12} color="rgba(255,255,255,0.5)" />
                <Text style={styles.sourceText}>{article.date} • {article.source}</Text>
              </View>
              <View style={styles.actionsRow}>
                <TouchableOpacity onPress={() => toggleBookmark(article.id)} style={styles.iconBtn}>
                  <Bookmark size={18} color={isSaved ? APP_CONFIG.colors.accent : "#FFF"} fill={isSaved ? APP_CONFIG.colors.accent : "none"} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn}>
                  <Share2 size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const filteredArticles = articles.filter(a => {
    const matchCat = selectedCategory === 'all' || a.category === selectedCategory;
    const matchView = viewMode === 'feed' || (viewMode === 'saved' && isBookmarked(a.id));
    return matchCat && matchView;
  });

  return (
    <ParticleBackground>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={APP_CONFIG.colors.accent} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.feed}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={APP_CONFIG.colors.accent} />}
          >
            {/* Header */}
            <BlurView intensity={20} tint="dark" style={styles.header}>
              <View style={styles.headerTop}>
                <TouchableOpacity onPress={() => navigation.navigate('Landing')} style={styles.backBtn}>
                  <ArrowRight size={24} color="#FFF" style={{ transform: [{ rotate: '180deg' }] }} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Cosmic Brief</Text>
                <TouchableOpacity style={styles.searchBtn}>
                  <Search size={22} color="#FFF" />
                </TouchableOpacity>
              </View>

              {/* View Toggles */}
              <View style={styles.viewToggle}>
                <TouchableOpacity
                  onPress={() => setViewMode('feed')}
                  style={[styles.toggleBtn, viewMode === 'feed' && styles.activeToggle]}
                >
                  <Text style={[styles.toggleText, viewMode === 'feed' && styles.activeToggleText]}>Latest</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setViewMode('saved')}
                  style={[styles.toggleBtn, viewMode === 'saved' && styles.activeToggle]}
                >
                  <Text style={[styles.toggleText, viewMode === 'saved' && styles.activeToggleText]}>Saved</Text>
                </TouchableOpacity>
              </View>

              {/* Category Scroll */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                {['all', 'cme', 'flare', 'storm', 'mission'].map(cat => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setSelectedCategory(cat)}
                    style={[styles.catPill, selectedCategory === cat && styles.activeCatPill]}
                  >
                    <Text style={[styles.catText, selectedCategory === cat && styles.activeCatText]}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </BlurView>

            {filteredArticles.length > 0 ? (
              filteredArticles.map(renderArticle)
            ) : (
              <View style={styles.emptyState}>
                <BookOpen size={48} color="rgba(255,255,255,0.2)" />
                <Text style={styles.emptyText}>No articles found in this sector.</Text>
              </View>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

      </SafeAreaView>
    </ParticleBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: APP_CONFIG.colors.border.subtle,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 18,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: APP_CONFIG.colors.overlay.dark,
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.border.default,
  },
  searchBtn: {
    padding: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  viewToggle: {
    flexDirection: 'row',
    marginHorizontal: 24,
    backgroundColor: APP_CONFIG.colors.background.card,
    borderRadius: 14,
    marginBottom: 18,
    padding: 5,
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.border.default,
  },
  toggleBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  activeToggle: {
    backgroundColor: APP_CONFIG.colors.accent,
  },
  toggleText: {
    color: APP_CONFIG.colors.text.tertiary,
    fontWeight: '600',
    fontSize: 13,
  },
  activeToggleText: {
    color: '#FFF',
  },
  categoryScroll: {
    paddingHorizontal: 24,
    gap: 12,
  },
  catPill: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.border.default,
    backgroundColor: APP_CONFIG.colors.background.card,
  },
  activeCatPill: {
    backgroundColor: APP_CONFIG.colors.accent,
    borderColor: APP_CONFIG.colors.accent,
  },
  catText: {
    color: APP_CONFIG.colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  activeCatText: {
    color: '#FFF',
  },
  feed: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  articleCard: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: APP_CONFIG.colors.background.card,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.border.default,
    ...APP_CONFIG.shadows.medium,
  },
  imagePlaceholder: {
    height: 150,
    backgroundColor: 'rgba(0, 102, 255, 0.08)',
  },
  imageGradient: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: 80,
  },
  cardBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 5,
  },
  cardBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.5,
  },
  cardContent: {
    padding: 20,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 10,
    lineHeight: 24,
    letterSpacing: 0.3,
  },
  cardSummary: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    lineHeight: 21,
    marginBottom: 18,
    fontWeight: '400',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: APP_CONFIG.colors.border.default,
    paddingTop: 14,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sourceText: {
    fontSize: 11,
    color: APP_CONFIG.colors.text.tertiary,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  iconBtn: {
    opacity: 0.8,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    opacity: 0.8,
  },
  emptyText: {
    color: APP_CONFIG.colors.text.secondary,
    marginTop: 18,
    fontSize: 15,
    fontWeight: '500',
  },
});