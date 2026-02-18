// OrbitBharat App - Advanced Space Weather Monitoring & CME Detection
// Developer: Nitesh Agarwal
// Version: 2.0.0

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ClerkProvider, ClerkLoaded, ClerkLoading } from '@clerk/clerk-expo';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import Welcome from './app/screens/Welcome';
import Landing from './app/screens/Landing';
import SearchScreen from './app/screens/SearchScreen';
import GraphSimulationScreen from './app/screens/GraphSimulationScreen';
import BlogScreen from './app/screens/BlogScreen';
import ChatbotScreen from './app/screens/ChatbotScreen';
import PredictionDashboard from './app/screens/PredictionDashboard';
import SettingsScreen from './app/screens/SettingsScreen';
import AdityaL1Screen from './app/screens/AdityaL1Screen';
import SatelliteTrackerScreen from './app/screens/SatelliteTrackerScreen';
import WeatherForecastScreen from './app/screens/WeatherForecastScreen';
import SpaceWeatherMapScreen from './app/screens/SpaceWeatherMapScreen';
import ErrorBoundary from './app/components/ErrorBoundary';
import { logger } from './app/utils/logger';
import { CLERK_PUBLISHABLE_KEY, tokenCache, isClerkConfigured } from './app/utils/clerkConfig';
import type { RootStackParamList } from './app/types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Wrap each screen so a crash in one doesn't kill the entire app */
function withEB<P extends object>(Screen: React.ComponentType<P>) {
  const Wrapped = (props: P) => (
    <ErrorBoundary>
      <Screen {...props} />
    </ErrorBoundary>
  );
  Wrapped.displayName = `EB(${Screen.displayName || Screen.name})`;
  return Wrapped;
}

function AppNavigator() {
  return (
    <NavigationContainer
      onStateChange={(state) => {
        logger.debug('Navigation state changed', { state }, 'Navigation');
      }}
    >
      <StatusBar style="light" />
      <Stack.Navigator
        id="RootStack"
        initialRouteName="Welcome"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="Welcome" component={withEB(Welcome)} />
        <Stack.Screen name="Landing" component={withEB(Landing)} />
        <Stack.Screen name="Search" component={withEB(SearchScreen)} />
        <Stack.Screen name="GraphSimulation" component={withEB(GraphSimulationScreen)} />
        <Stack.Screen name="Blog" component={withEB(BlogScreen)} />
        <Stack.Screen name="Chatbot" component={withEB(ChatbotScreen)} />
        <Stack.Screen name="Prediction" component={withEB(PredictionDashboard)} />
        <Stack.Screen name="Settings" component={withEB(SettingsScreen)} />
        <Stack.Screen name="AdityaL1" component={withEB(AdityaL1Screen)} />
        <Stack.Screen name="SatelliteTracker" component={withEB(SatelliteTrackerScreen)} />
        <Stack.Screen name="WeatherForecast" component={withEB(WeatherForecastScreen)} />
        <Stack.Screen name="SpaceWeatherMap" component={withEB(SpaceWeatherMapScreen)} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  React.useEffect(() => {
    logger.info('OrbitBharat started successfully', { version: '2.0.0', developer: 'Nitesh Agarwal' }, 'App');
  }, []);

  return (
    <ErrorBoundary>
      {isClerkConfigured() ? (
        <ClerkProvider
          publishableKey={CLERK_PUBLISHABLE_KEY}
          tokenCache={tokenCache}
        >
          <ClerkLoading>
            <View style={loadingStyles.container}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={loadingStyles.text}>Loading OrbitBharat...</Text>
            </View>
          </ClerkLoading>
          <ClerkLoaded>
            <AppNavigator />
          </ClerkLoaded>
        </ClerkProvider>
      ) : (
        /* No Clerk key — skip auth and go straight to the app */
        <AppNavigator />
      )}
    </ErrorBoundary>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: 16,
    color: '#ffffff',
    fontSize: 18,
  },
});
