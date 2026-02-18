import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity, Alert, StatusBar, Image, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, User, Bell, Shield, Info, LogOut, ChevronRight, Mail, Github, Globe, Sun } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { APP_CONFIG } from '../utils/constants';
import { useSafeAuth as useAuth, useSafeUser as useUser } from '../utils/useClerkSafe';
import { useAlertSettings } from '../utils/LoginFeatures';
import ParticleBackground from '../components/ParticleBackground';

export default function SettingsScreen({ navigation }: any) {
    const { signOut, isSignedIn } = useAuth();
    const { user } = useUser();
    const { settings, updateSettings } = useAlertSettings();

    const handleSignOut = async () => {
        try {
            await signOut();
            navigation.replace('Welcome');
        } catch (error) {
            console.error('Sign out error', error);
        }
    };

    const handleLogin = () => {
        navigation.navigate('Welcome');
    };

    const SettingRow = ({ icon: Icon, title, subtitle, value, onToggle, isSwitch = false, onPress, color }: any) => (
        <TouchableOpacity
            style={styles.rowContainer}
            activeOpacity={isSwitch ? 1 : 0.7}
            onPress={isSwitch ? () => onToggle(!value) : onPress}
        >
            <View style={[styles.iconBox, { backgroundColor: `${color}20` }]}>
                <Icon size={20} color={color} />
            </View>
            <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{title}</Text>
                {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
            </View>
            {isSwitch && (
                <Switch
                    value={value}
                    onValueChange={onToggle}
                    trackColor={{ false: 'rgba(255,255,255,0.1)', true: color }}
                    thumbColor={'#FFF'}
                />
            )}
            {!isSwitch && (
                <ChevronRight size={20} color="rgba(255,255,255,0.3)" />
            )}
        </TouchableOpacity>
    );

    return (
        <ParticleBackground>
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

                <ScrollView contentContainerStyle={styles.content}>
                    {/* Header */}
                    <BlurView intensity={20} tint="dark" style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                            <ArrowLeft size={24} color="#FFF" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>System Settings</Text>
                        <View style={{ width: 40 }} />
                    </BlurView>


                    {/* Profile Card */}
                    <View style={styles.section}>
                        <Text style={styles.sectionHeader}>COMMANDER PROFILE</Text>
                        <View style={styles.cardWrapper}>
                            <BlurView intensity={20} tint="dark" style={styles.profileCard}>
                                <View style={styles.profileHeader}>
                                    <View style={styles.avatarContainer}>
                                        {user?.imageUrl ? (
                                            <Image source={{ uri: user.imageUrl }} style={styles.avatarImage} />
                                        ) : (
                                            <LinearGradient colors={[APP_CONFIG.colors.primary, APP_CONFIG.colors.accent]} style={styles.avatarPlaceholder}>
                                                <User size={32} color="#FFF" />
                                            </LinearGradient>
                                        )}
                                        {isSignedIn && <View style={styles.onlineBadge} />}
                                    </View>
                                    <View style={styles.profileInfo}>
                                        <Text style={styles.profileName}>{user?.fullName || 'Guest Commander'}</Text>
                                        <Text style={styles.profileEmail}>{user?.primaryEmailAddress?.emailAddress || 'Access Restricted'}</Text>
                                        <View style={styles.rankBadge}>
                                            <Text style={styles.rankText}>{isSignedIn ? 'LEVEL 5 CLEARANCE' : 'GUEST ACCESS'}</Text>
                                        </View>
                                    </View>
                                </View>

                                {!isSignedIn ? (
                                    <TouchableOpacity style={styles.signInBtn} onPress={handleLogin}>
                                        <Text style={styles.signInText}>Initialize Login Sequence</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <Text style={styles.syncedText}>✓ Neural Link Active • Settings Synced</Text>
                                )}
                            </BlurView>
                        </View>
                    </View>

                    {/* Notifications */}
                    <View style={styles.section}>
                        <Text style={styles.sectionHeader}>ALERT PROTOCOLS</Text>
                        <View style={styles.cardWrapper}>
                            <BlurView intensity={20} tint="dark" style={styles.settingsCard}>
                                <SettingRow
                                    icon={Shield}
                                    title="CME Impact Alerts"
                                    subtitle="High priority notifications for earth-directed CMEs"
                                    value={settings.cmeAlerts}
                                    onToggle={(v: boolean) => updateSettings({ cmeAlerts: v })}
                                    isSwitch
                                    color={APP_CONFIG.colors.error}
                                />
                                <View style={styles.divider} />
                                <SettingRow
                                    icon={Sun}
                                    title="Solar Flare Warnings"
                                    subtitle="X-Class and M-Class flare detection"
                                    value={settings.flareAlerts}
                                    onToggle={(v: boolean) => updateSettings({ flareAlerts: v })}
                                    isSwitch
                                    color={APP_CONFIG.colors.warning}
                                />
                                <View style={styles.divider} />
                                <SettingRow
                                    icon={Globe}
                                    title="Geomagnetic Storms"
                                    subtitle="Kp Index > 5 threshold alerts"
                                    value={settings.stormAlerts}
                                    onToggle={(v: boolean) => updateSettings({ stormAlerts: v })}
                                    isSwitch
                                    color={APP_CONFIG.colors.success}
                                />
                            </BlurView>
                        </View>
                    </View>

                    {/* About & Support */}
                    <View style={styles.section}>
                        <Text style={styles.sectionHeader}>SYSTEM INFORMATION</Text>
                        <View style={styles.cardWrapper}>
                            <BlurView intensity={20} tint="dark" style={styles.settingsCard}>
                                <SettingRow
                                    icon={Info}
                                    title="Mission Version"
                                    subtitle={`v${APP_CONFIG.version} (Stable)`}
                                    onPress={() => { }}
                                    color={APP_CONFIG.colors.text.tertiary}
                                />
                                <View style={styles.divider} />
                                <SettingRow
                                    icon={Github}
                                    title="Source Code"
                                    subtitle="View repository"
                                    onPress={() => Linking.openURL('https://github.com/nitesh-agarwal/Ekip_Bhaskar_CME_Event')}
                                    color="#FFF"
                                />
                                <View style={styles.divider} />
                                <SettingRow
                                    icon={Mail}
                                    title="Contact Mission Control"
                                    subtitle="Report anomalies or bugs"
                                    onPress={() => Linking.openURL('mailto:musicniteshagarwal@gmail.com')}
                                    color={APP_CONFIG.colors.info}
                                />
                            </BlurView>
                        </View>
                    </View>

                    {isSignedIn && (
                        <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut}>
                            <LinearGradient colors={[`${APP_CONFIG.colors.error}33`, `${APP_CONFIG.colors.error}1A`]} style={styles.logoutGradient}>
                                <LogOut size={20} color={APP_CONFIG.colors.error} />
                                <Text style={styles.logoutText}>Terminate Session</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}

                    <Text style={styles.footerText}>
                        OrbitBharat AI • Developed for ISRO Hackathon
                    </Text>
                    <View style={{ height: 40 }} />
                </ScrollView>
            </SafeAreaView>
        </ParticleBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: APP_CONFIG.colors.border.subtle,
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
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFF',
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
    content: {
        padding: 24,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 12,
        marginLeft: 4,
        letterSpacing: 1.5,
        fontWeight: '700',
    },
    cardWrapper: {
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    profileCard: {
        padding: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 16,
    },
    avatarImage: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 2,
        borderColor: APP_CONFIG.colors.accent,
    },
    avatarPlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    onlineBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 14,
        height: 14,
        backgroundColor: APP_CONFIG.colors.success,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: '#000',
    },
    profileInfo: {
        flex: 1,
    },
    profileName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 4,
    },
    profileEmail: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        marginBottom: 8,
    },
    rankBadge: {
        backgroundColor: 'rgba(78, 205, 196, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: 'rgba(78, 205, 196, 0.3)',
    },
    rankText: {
        fontSize: 10,
        color: APP_CONFIG.colors.primary,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    signInBtn: {
        backgroundColor: APP_CONFIG.colors.primary,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    signInText: {
        color: '#000',
        fontWeight: 'bold',
    },
    syncedText: {
        fontSize: 11,
        color: APP_CONFIG.colors.success,
        textAlign: 'center',
        fontWeight: '600',
    },
    settingsCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    rowContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    rowText: {
        flex: 1,
    },
    rowTitle: {
        fontSize: 16,
        color: '#FFF',
        fontWeight: '500',
    },
    rowSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 2,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginLeft: 68,
    },
    logoutBtn: {
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 20,
    },
    logoutGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        gap: 8,
    },
    logoutText: {
        color: APP_CONFIG.colors.error,
        fontWeight: 'bold',
        fontSize: 16,
    },
    footerText: {
        textAlign: 'center',
        color: 'rgba(255,255,255,0.3)',
        fontSize: 11,
    },
});
