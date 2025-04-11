import React from 'react';
import { View, StyleSheet } from 'react-native';
import GenieLampSvg from '../../assets/icons/genie-lamp-svgrepo-com.svg';

interface GenieLampIconProps {
  size?: number;
  color?: string;
}

/**
 * Genie Lamp icon component for tabs
 * Properly imports the SVG file from assets/icons directory
 */
export function GenieLampIcon({ size = 24, color = '#000000' }: GenieLampIconProps) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <GenieLampSvg width={size} height={size} fill={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  }
});
