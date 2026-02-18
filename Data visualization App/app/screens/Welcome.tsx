import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  ImageBackground,
  Animated,
  Easing
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { ArrowRight, Zap, Shield, Activity as ActivityIcon } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { APP_CONFIG } from '../utils/constants';
import { logger } from '../utils/logger';
import ParticleBackground from '../components/ParticleBackground';
import { useSafeAuth as useAuth, useSafeOAuth as useOAuth, useSafeUser as useUser } from '../utils/useClerkSafe';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

// Warm up browser for OAuth
WebBrowser.maybeCompleteAuthSession();

const { width } = Dimensions.get('window');

const Welcome = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isSignedIn, signOut } = useAuth();
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);

  // Animations
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const contentTranslateY = useRef(new Animated.Value(50)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  // OAuth providers
  const { startOAuthFlow: startGoogleAuth } = useOAuth({ strategy: 'oauth_google' });
  const { startOAuthFlow: startAppleAuth } = useOAuth({ strategy: 'oauth_apple' });

  useEffect(() => {
    // Entrance Animations
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(400),
        Animated.parallel([
          Animated.timing(contentTranslateY, {
            toValue: 0,
            duration: 800,
            easing: Easing.out(Easing.exp),
            useNativeDriver: true,
          }),
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          })
        ])
      ])
    ]).start();
  }, []);

  const handleStartExploring = () => {
    logger.info('Start exploring button pressed', {}, 'Welcome');
    navigation.navigate('Landing');
  };

  const handleGoogleSignIn = useCallback(async () => {
    setIsLoading(true);
    try {
      logger.info('Google sign in initiated', {}, 'Welcome');
      const { createdSessionId, setActive } = await startGoogleAuth();

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        logger.info('Google sign in successful', {}, 'Welcome');
        navigation.navigate('Landing');
      }
    } catch (err: any) {
      logger.error('Google sign in error', { error: err.message }, 'Welcome');
      Alert.alert('Sign In Failed', 'Could not sign in with Google. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [startGoogleAuth, navigation]);

  const handleAppleSignIn = useCallback(async () => {
    setIsLoading(true);
    try {
      logger.info('Apple sign in initiated', {}, 'Welcome');
      const { createdSessionId, setActive } = await startAppleAuth();

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        logger.info('Apple sign in successful', {}, 'Welcome');
        navigation.navigate('Landing');
      }
    } catch (err: any) {
      logger.error('Apple sign in error', { error: err.message }, 'Welcome');
      Alert.alert('Sign In Failed', 'Could not sign in with Apple. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [startAppleAuth, navigation]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      logger.info('User signed out', {}, 'Welcome');
    } catch (err: any) {
      logger.error('Sign out error', { error: err.message }, 'Welcome');
    }
  }, [signOut]);

  return (
    <ParticleBackground>
      <View style={styles.container}>

        {/* Ambient Glows */}
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />

        <View style={styles.contentContainer}>
          {/* Hero Section */}
          <Animated.View style={[
            styles.heroSection,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }]
            }
          ]}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={['rgba(0,102,255,0.25)', 'rgba(0,163,255,0.1)', 'rgba(0,102,255,0)']}
                style={styles.logoGlow}
              />
              <ActivityIcon size={52} color={APP_CONFIG.colors.accent} style={styles.logoIcon} />
            </View>

            <Text style={styles.appName}>
              ORBIT<Text style={{ color: APP_CONFIG.colors.accent }}>BHARAT</Text>
            </Text>
            <Text style={styles.appTagline}>Advanced Space Weather Monitoring</Text>

            <View style={styles.featurePills}>
              <View style={styles.pill}>
                <Zap size={12} color={APP_CONFIG.colors.success} />
                <Text style={styles.pillText}>Real-time CME</Text>
              </View>
              <View style={styles.pill}>
                <Shield size={12} color={APP_CONFIG.colors.warning} />
                <Text style={styles.pillText}>Storm Alert</Text>
              </View>
            </View>
          </Animated.View>

          {/* Action Panel */}
          <Animated.View style={[
            styles.cardContainer,
            {
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslateY }]
            }
          ]}>
            <BlurView intensity={30} tint="dark" style={styles.glassCard}>

              {isSignedIn && user ? (
                <View style={styles.userSection}>
                  <Text style={styles.welcomeText}>Welcome back,</Text>
                  <Text style={styles.userName}>{user.firstName || 'Commander'}</Text>

                  <TouchableOpacity style={styles.primaryButton} onPress={handleStartExploring}>
                    <LinearGradient
                      colors={['#0066FF', '#00A3FF']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={styles.gradientButton}
                    >
                      <Text style={styles.primaryButtonText}>Access Dashboard</Text>
                      <ArrowRight size={20} color="#FFF" />
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.secondaryButton} onPress={handleSignOut}>
                    <Text style={styles.secondaryButtonText}>Sign Out</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.authSection}>
                  {isLoading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color={APP_CONFIG.colors.accent} />
                      <Text style={styles.loadingText}>Authenticating...</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.loginTitle}>Mission Control Access</Text>
                      <Text style={styles.loginSubtitle}>Sign in to sync your planetary preferences</Text>

                      <View style={styles.socialRow}>
                        <TouchableOpacity style={styles.socialButton} onPress={handleGoogleSignIn}>
                          <FontAwesome name="google" size={24} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.socialButton} onPress={handleAppleSignIn}>
                          <FontAwesome name="apple" size={24} color="#FFF" />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.divider}>
                        <View style={styles.line} />
                        <Text style={styles.orText}>OR</Text>
                        <View style={styles.line} />
                      </View>

                      <TouchableOpacity style={styles.guestButton} onPress={handleStartExploring}>
                        <Text style={styles.guestButtonText}>Enter as Guest</Text>
                        <ArrowRight size={18} color={APP_CONFIG.colors.text.secondary} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </BlurView>
          </Animated.View>

          <Text style={styles.version}>{`v${APP_CONFIG.version} • ISRO Hackathon Edition`}</Text>
        </View>
      </View>
    </ParticleBackground>
  );
};

export default Welcome;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  glowTop: {
    position: 'absolute',
    top: -120,
    left: -120,
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: 'rgba(0, 102, 255, 0.1)',
    zIndex: 0,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -100,
    right: -100,
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: width * 0.35,
    backgroundColor: 'rgba(0, 163, 255, 0.06)',
    zIndex: 0,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 40,
    paddingHorizontal: 24,
    zIndex: 1,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  logoContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  logoGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  logoIcon: {},
  appName: {
    fontSize: 38,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 4,
    marginBottom: 8,
  },
  appTagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    marginBottom: 20,
    fontWeight: '400',
    textAlign: 'center',
  },
  featurePills: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 102, 255, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 255, 0.2)',
    gap: 6,
  },
  pillText: {
    color: '#E8ECF0',
    fontSize: 12,
    fontWeight: '600',
  },
  cardContainer: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 255, 0.15)',
    backgroundColor: 'rgba(10, 10, 15, 0.7)',
  },
  glassCard: {
    padding: 28,
    alignItems: 'center',
  },
  // Auth Styles
  loginTitle: {
    fontSize: 22,
    color: '#FFF',
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  loginSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 28,
    textAlign: 'center',
    fontWeight: '400',
    paddingHorizontal: 10,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 24,
  },
  socialButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 102, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 255, 0.25)',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
    gap: 12,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  orText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  guestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 255, 0.25)',
    borderRadius: 16,
    gap: 8,
    backgroundColor: 'rgba(0, 102, 255, 0.05)',
  },
  guestButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  // User Logged In Styles
  userSection: {
    width: '100%',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
    fontWeight: '400',
  },
  userName: {
    fontSize: 28,
    color: '#FFF',
    fontWeight: '700',
    marginBottom: 28,
    letterSpacing: 0.5,
  },
  primaryButton: {
    width: '100%',
    borderRadius: 16,
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 14,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 12,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '500',
  },
  authSection: {
    width: '100%',
    alignItems: 'center',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFF',
    marginTop: 14,
    fontWeight: '500',
  },
  version: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    color: 'rgba(255,255,255,0.2)',
    fontSize: 11,
    letterSpacing: 0.5,
  },
});
