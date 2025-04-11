/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * This color scheme is designed with a warm beige palette for expecting mothers.
 */

// Soft beige palette - lighter and softer colors
const primaryColor = '#E6CCB2'; // Soft beige/tan - primary accent color
const secondaryColor = '#F2E2CE'; // Very light beige - secondary accent
const accentColor = '#C89F81'; // Soft terracotta - for buttons and highlights
const timerTextColor = '#5C4033'; // Dark brown for timer text - high contrast
const successColor = '#9DBEBB'; // Soft sage green - for success states
const warningColor = '#E9C9B6'; // Soft coral - for warnings
const darkTextColor = '#7D5A50'; // Softer brown - for text
const lightTextColor = '#FFF8F0'; // Creamy white - for text on dark backgrounds

export const Colors = {
  light: {
    text: darkTextColor,
    background: '#FFF8F0', // Creamy white background
    tint: accentColor,
    icon: '#A68A7B', // Lighter brown for icons
    tabIconDefault: '#A68A7B',
    tabIconSelected: accentColor,
    primary: primaryColor,
    secondary: secondaryColor,
    accent: accentColor,
    timerText: timerTextColor,
    success: successColor,
    warning: warningColor,
    card: '#F7EFE5', // Very light beige for cards
    border: '#EFE1CF', // Soft border color
    timerBackground: '#FFFFFF', // Pure white for timer background
    timerBorder: '#B67352' // Darker border for better contrast
  },
  dark: {
    text: lightTextColor,
    background: '#4A3B30', // Softer dark brown background
    tint: secondaryColor,
    icon: '#E6CCB2',
    tabIconDefault: '#E6CCB2',
    tabIconSelected: secondaryColor,
    primary: primaryColor,
    secondary: secondaryColor,
    accent: '#F2E2CE', // Lighter in dark mode
    timerText: '#FFFFFF', // White for timer text in dark mode - high contrast
    success: '#B5D8D2', // Lighter sage in dark mode
    warning: '#E9C9B6',
    card: '#5C4D41', // Softer dark brown for cards
    border: '#7D6A5A', // Softer border color
    timerBackground: '#2A1E17', // Very dark brown for timer background
    timerBorder: '#F2E2CE' // Light beige for timer border - high contrast
  },
};
