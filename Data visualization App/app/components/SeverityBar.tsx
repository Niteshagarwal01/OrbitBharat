/**
 * SeverityBar — Reusable 0–100 severity indicator
 * OrbitBharat Design System
 *
 * A slim animated bar with a pointer and labeled legend.
 * Used for: CME risk, Kp index, AQI, storm potential.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { APP_CONFIG } from '../utils/constants';

interface SeverityBarProps {
    /** 0–100 numeric value */
    value: number;
    /** Label shown above the bar */
    label?: string;
    /** Custom legend labels (default: Safe / Watch / Alert) */
    legendLabels?: [string, string, string];
    /** Custom gradient colors (low → high) */
    gradientColors?: string[];
    /** Container style overrides */
    style?: ViewStyle;
    /** Show the numeric value next to the pointer */
    showValue?: boolean;
    /** Height of the bar in px */
    barHeight?: number;
}

const DEFAULT_GRADIENT = ['#10B981', '#F59E0B', '#EF4444'];
const DEFAULT_LEGEND: [string, string, string] = ['Safe', 'Watch', 'Alert'];

export default function SeverityBar({
    value,
    label,
    legendLabels = DEFAULT_LEGEND,
    gradientColors = DEFAULT_GRADIENT,
    style,
    showValue = true,
    barHeight = 8,
}: SeverityBarProps) {
    const clampedValue = Math.min(Math.max(value, 0), 100);
    const pointerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.spring(pointerAnim, {
            toValue: clampedValue,
            useNativeDriver: false,
            tension: 50,
            friction: 8,
        }).start();
    }, [clampedValue]);

    const pointerLeft = pointerAnim.interpolate({
        inputRange: [0, 100],
        outputRange: ['0%', '100%'],
    });

    // Determine severity color for pointer
    const getSeverityColor = (v: number) => {
        if (v < 33) return gradientColors[0];
        if (v < 66) return gradientColors[1];
        return gradientColors[2];
    };

    return (
        <View style={[styles.container, style]}>
            {label && <Text style={styles.label}>{label}</Text>}

            {/* Bar Track */}
            <View style={[styles.track, { height: barHeight, borderRadius: barHeight / 2 }]}>
                <LinearGradient
                    colors={gradientColors as [string, string, ...string[]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.gradient, { borderRadius: barHeight / 2 }]}
                />

                {/* Animated Pointer */}
                <Animated.View
                    style={[
                        styles.pointer,
                        {
                            left: pointerLeft,
                            backgroundColor: getSeverityColor(clampedValue),
                            width: barHeight + 8,
                            height: barHeight + 8,
                            borderRadius: (barHeight + 8) / 2,
                            top: -(4),
                        },
                    ]}
                >
                    {showValue && (
                        <View style={styles.valueBubble}>
                            <Text style={styles.valueText}>{Math.round(clampedValue)}</Text>
                        </View>
                    )}
                </Animated.View>
            </View>

            {/* Legend */}
            <View style={styles.legendRow}>
                <Text style={[styles.legendText, { color: gradientColors[0] }]}>{legendLabels[0]}</Text>
                <Text style={[styles.legendText, { color: gradientColors[1] }]}>{legendLabels[1]}</Text>
                <Text style={[styles.legendText, { color: gradientColors[2] }]}>{legendLabels[2]}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 8,
    },
    label: {
        fontSize: 10,
        fontWeight: '700',
        color: APP_CONFIG.colors.text.secondary,
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    track: {
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.05)',
        overflow: 'visible',
        position: 'relative',
    },
    gradient: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.6,
    },
    pointer: {
        position: 'absolute',
        borderWidth: 2,
        borderColor: APP_CONFIG.colors.richBlack,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: -8,
        ...APP_CONFIG.shadows.glow,
    },
    valueBubble: {
        position: 'absolute',
        top: -22,
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderRadius: 6,
        paddingHorizontal: 5,
        paddingVertical: 2,
    },
    valueText: {
        color: '#FFF',
        fontSize: 9,
        fontWeight: '700',
    },
    legendRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 6,
    },
    legendText: {
        fontSize: 9,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
});
