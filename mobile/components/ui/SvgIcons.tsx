import React from 'react';
import { ViewStyle } from 'react-native';
import { SvgProps } from 'react-native-svg';

// Import SVG icons directly
// This will work once the metro.config.js is set up correctly
import GenieLampIcon from '../../../assets/icons/genie-lamp-svgrepo-com.svg';

// Map icon names to their components
export const SVG_ICONS: Record<string, React.FC<SvgProps>> = {
  'genie-lamp': GenieLampIcon,
  // Add more SVG icons here as needed
};

// Type for the icon names - makes it type-safe
export type SvgIconName = keyof typeof SVG_ICONS;

// Props for the SvgIcon component
interface SvgIconProps {
  name: SvgIconName;
  size?: number;
  color?: string;
  style?: ViewStyle;
}

// Component for using SVG icons
export function SvgIcon({ name, size = 24, color = '#000', style }: SvgIconProps) {
  const IconComponent = SVG_ICONS[name];
  
  if (!IconComponent) {
    console.warn(`Icon not found: "${name}"`);
    return null;
  }
  
  return (
    <IconComponent 
      width={size} 
      height={size} 
      fill={color} 
      style={style} 
    />
  );
}
