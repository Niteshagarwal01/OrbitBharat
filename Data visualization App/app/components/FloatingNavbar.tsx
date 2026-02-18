import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { APP_CONFIG } from '../utils/constants';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from './GlassCard';

const { width } = Dimensions.get('window');

interface FloatingNavbarProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
}

interface TabItem {
  id: string;
  activeIcon: keyof typeof Ionicons.glyphMap;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
}

export default function FloatingNavbar({ activeTab, onTabPress }: FloatingNavbarProps) {
  const tabs: TabItem[] = [
    { 
      id: 'home', 
      activeIcon: 'home',
      inactiveIcon: 'home-outline'
    },
    { 
      id: 'blog', 
      activeIcon: 'book',
      inactiveIcon: 'book-outline'
    },
    { 
      id: 'chatbot', 
      activeIcon: 'chatbubble-ellipses',
      inactiveIcon: 'chatbubble-outline'
    },
  ];

  const animatedValues = useRef(tabs.map(() => new Animated.Value(0))).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Floating animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Animate the active tab
    const activeIndex = tabs.findIndex(tab => tab.id === activeTab);
    if (activeIndex !== -1) {
      Animated.parallel([
        // Reset all tabs
        ...animatedValues.map((anim, index) => 
          Animated.timing(anim, {
            toValue: index === activeIndex ? 1 : 0,
            duration: 300,
            useNativeDriver: true,
          })
        )
      ]).start();
    }
  }, [activeTab]);

  const handleTabPress = (tabId: string) => {
    onTabPress(tabId);
  };

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  });

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          transform: [{ translateY }],
        }
      ]}
    >
      <LinearGradient
        colors={[
          'rgba(10, 10, 15, 0.98)',
          'rgba(13, 17, 23, 0.95)',
          'rgba(0, 40, 80, 0.9)'
        ]}
        style={styles.gradientContainer}
      >
        <GlassCard intensity={30} tint="dark" style={styles.blurContainer}>
          {tabs.map((tab, index) => {
            const isActive = activeTab === tab.id;
            const scale = animatedValues[index].interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.1],
            });
            
            const tabTranslateY = animatedValues[index].interpolate({
              inputRange: [0, 1],
              outputRange: [0, -4],
            });

            return (
              <Animated.View
                key={tab.id}
                style={[
                  styles.tabContainer,
                  {
                    transform: [{ scale }, { translateY: tabTranslateY }],
                  }
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.tab,
                    isActive && styles.activeTab,
                  ]}
                  onPress={() => handleTabPress(tab.id)}
                  activeOpacity={0.8}
                >
                  <Animated.View style={styles.iconContainer}>
                    <Ionicons 
                      name={isActive ? tab.activeIcon : tab.inactiveIcon} 
                      size={24} 
                      color={isActive ? APP_CONFIG.colors.white : APP_CONFIG.colors.text.secondary} 
                    />
                    {isActive && (
                      <Animated.View 
                        style={[
                          styles.activeIndicator,
                          {
                            opacity: animatedValues[index],
                            transform: [{
                              scale: animatedValues[index].interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, 1],
                              })
                            }]
                          }
                        ]} 
                      />
                    )}
                  </Animated.View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </GlassCard>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    zIndex: 1000,
  },
  gradientContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 255, 0.2)',
    ...APP_CONFIG.shadows.heavy,
  },
  blurContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 24,
  },
  tabContainer: {
    alignItems: 'center',
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 18,
    minWidth: 68,
  },
  activeTab: {
    backgroundColor: APP_CONFIG.colors.accent,
    ...APP_CONFIG.shadows.glow,
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: APP_CONFIG.colors.success,
    borderWidth: 2,
    borderColor: APP_CONFIG.colors.accent,
  },
}); 