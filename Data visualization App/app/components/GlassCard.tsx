/**
 * GlassCard – drop-in replacement for expo-blur's BlurView.
 *
 * BlurView crashes on many Android devices.  This component renders a
 * semi-transparent View that approximates the "glassmorphism" look
 * without relying on native blur.  It accepts the same `style` prop so
 * existing styles (borderRadius, padding, etc.) keep working.
 */

import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';

interface GlassCardProps {
    children: React.ReactNode;
    /** Forwarded to inner View.  Existing borderRadius / padding etc. are preserved. */
    style?: StyleProp<ViewStyle>;
    /** Ignored – kept for API compatibility with BlurView */
    intensity?: number;
    /** Ignored – kept for API compatibility with BlurView */
    tint?: 'dark' | 'light' | 'default';
}

const GlassCard: React.FC<GlassCardProps> = ({ children, style, ...rest }) => (
    <View
        style={[
            {
                backgroundColor: 'rgba(13,17,23,0.85)',
                borderRadius: 18,
                overflow: 'hidden',
            },
            style,
        ]}
        {...rest}
    >
        {children}
    </View>
);

export default GlassCard;
