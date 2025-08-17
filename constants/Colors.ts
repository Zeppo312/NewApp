/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * This color scheme is designed with a warm beige palette for expecting mothers.
 */

// Soft beige palette - lighter and softer colors
const primaryColor = '#E6CCB2'; // Soft beige/tan - primary accent color
const secondaryColor = '#F2E2CE'; // Very light beige - secondary accent
const accentColor = '#C89F81'; // Soft terracotta - for buttons and highlights
const successColor = '#9DBEBB'; // Soft sage green - for success states
const warningColor = '#E9C9B6'; // Soft coral - for warnings
const errorColor = '#FF6B6B'; // Soft red - for errors and delete actions

// Text colors - Light mode
const primaryTextLight = '#5C4033'; // Dark brown - for headings and important text (contrast ratio > 7:1)
const secondaryTextLight = '#8A6B61'; // Softer brown - for normal text (contrast ratio > 4.5:1)
const tertiaryTextLight = '#9C8178'; // Lighter brown - for less important text (contrast ratio > 3:1)
const disabledTextLight = '#B0A59E'; // Very light brown - for disabled text
const brandTextLight = '#6B4C3B'; // Brand brown - for greetings and brand elements

// Text colors - Dark mode
const primaryTextDark = '#FFFFFF'; // Pure white - for headings and important text (contrast ratio > 10:1)
const secondaryTextDark = '#F8F0E5'; // Very light beige - for normal text (contrast ratio > 7:1)
const tertiaryTextDark = '#E9D8C2'; // Lighter beige - for less important text (contrast ratio > 5:1)
const disabledTextDark = '#B8A99A'; // Lighter muted beige - for disabled text (contrast ratio > 3:1)
const accentTextDark = '#A5D6D9'; // Light turquoise - for highlights and accents (contrast ratio > 4.5:1)
const brandTextDark = '#E9D8C2'; // Brand beige - for greetings and brand elements in dark mode

// Legacy variables for backward compatibility
const darkTextColor = secondaryTextLight;
const lightTextColor = primaryTextDark;

// Card design tokens
export const CardBorder = '#E6E1DE';
export const CardBg = '#F9F5F1';
export const Shadow = { width: 0, height: 2, opacity: 0.1, radius: 3 };

// Brand colors for easy access
export const BrandColors = {
  light: brandTextLight,
  dark: brandTextDark,
};

// Qualitätsfarben für Wehen-/Schlaftracker
export const QualityColors = {
  good: '#A8D8A8',    // Pastellgrün für gute Qualität / schwache Intensität
  medium: '#FFD8A8',  // Apricot für mittlere Qualität / mittlere Intensität
  bad: '#FF9A8A',     // Korallrot für schlechte Qualität / starke Intensität
  unknown: '#D0D0D0'  // Hellgrau für unbekannte Qualität / keine Intensität
};

export const Colors = {
  light: {
    // Text colors
    text: secondaryTextLight, // Standard text color
    textPrimary: primaryTextLight, // For headings and important text
    textSecondary: secondaryTextLight, // For normal text
    textTertiary: tertiaryTextLight, // For less important text
    textDisabled: disabledTextLight, // For disabled text
    textBrand: brandTextLight, // For brand elements like greetings

    // Background colors
    background: '#FFF8F0', // Creamy white background
    cardLight: '#F7EFE5', // Very light beige for cards
    cardDark: '#F2E2CE', // Slightly darker card for contrast

    // UI element colors
    tint: accentColor,
    icon: secondaryTextLight, // Icon color matching text
    tabIconDefault: tertiaryTextLight,
    tabIconSelected: accentColor,
    primary: primaryColor,
    secondary: secondaryColor,
    accent: accentColor,
    success: successColor,
    warning: warningColor,
    error: errorColor,
    border: '#EFE1CF', // Soft border color

    // Timer specific colors
    timerText: primaryTextLight,
    timerBackground: '#FFFFFF', // Pure white for timer background
    timerBorder: '#B67352', // Darker border for better contrast

    // Card colors
    card: '#F7EFE5', // Very light beige for cards
  },
  dark: {
    // Text colors
    text: secondaryTextDark, // Standard text color
    textPrimary: primaryTextDark, // For headings and important text
    textSecondary: secondaryTextDark, // For normal text
    textTertiary: tertiaryTextDark, // For less important text
    textDisabled: disabledTextDark, // For disabled text
    textAccent: accentTextDark, // For accent text and highlights
    textBrand: brandTextDark, // For brand elements like greetings

    // Background colors
    background: '#2D2522', // Dark brown background
    cardLight: '#3D3330', // Dark brown for cards
    cardDark: '#2A2321', // Very dark brown for contrast

    // UI element colors
    tint: accentTextDark,
    icon: primaryTextDark, // Brighter icon color for better visibility
    tabIconDefault: secondaryTextDark,
    tabIconSelected: accentTextDark,
    primary: primaryColor,
    secondary: secondaryColor,
    accent: accentTextDark, // Light turquoise for better visibility
    success: '#B5D8D2', // Lighter sage in dark mode
    warning: '#F2D0B9', // Brighter warning color
    error: '#FF7A7A', // Slightly brighter error color
    border: '#5C4033', // Medium brown border with 30% opacity

    // Timer specific colors
    timerText: primaryTextDark,
    timerBackground: '#211C1A', // Almost black brown for timer background
    timerBorder: accentTextDark, // Light turquoise for timer border - high contrast

    // Card colors
    card: '#2A2321', // Very dark brown for cards
  },
};
