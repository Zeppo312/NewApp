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
const secondaryTextLight = '#7D5A50'; // Softer brown - for normal text (contrast ratio > 4.5:1)
const tertiaryTextLight = '#9C8178'; // Lighter brown - for less important text (contrast ratio > 3:1)
const disabledTextLight = '#B0A59E'; // Very light brown - for disabled text

// Text colors - Dark mode
const primaryTextDark = '#FFFFFF'; // Pure white - for headings and important text (contrast ratio > 10:1)
const secondaryTextDark = '#F8F0E5'; // Very light beige - for normal text (contrast ratio > 7:1)
const tertiaryTextDark = '#E9D8C2'; // Lighter beige - for less important text (contrast ratio > 5:1)
const disabledTextDark = '#B8A99A'; // Lighter muted beige - for disabled text (contrast ratio > 3:1)
const accentTextDark = '#A5D6D9'; // Light turquoise - for highlights and accents (contrast ratio > 4.5:1)

/** Opaque action pairs; feature/status colors remain independent. */
export const ActionColors = {
  light: {
    primary: '#8E4EC6',
    primaryPressed: '#793DB0',
    onPrimary: '#FFFFFF',
    secondary: '#FFFFFF',
    secondaryPressed: '#F0EDF4',
    onSecondary: primaryTextLight,
    destructive: '#B3261E',
    destructivePressed: '#941E18',
    onDestructive: '#FFFFFF',
    disabled: '#E6E1DE',
    onDisabled: secondaryTextLight,
  },
  dark: {
    primary: '#8E4EC6',
    primaryPressed: '#793DB0',
    onPrimary: '#FFFFFF',
    secondary: '#3D3330',
    secondaryPressed: '#5C4033',
    onSecondary: secondaryTextDark,
    destructive: '#B3261E',
    destructivePressed: '#941E18',
    onDestructive: '#FFFFFF',
    disabled: '#3D3330',
    onDisabled: tertiaryTextDark,
  },
} as const;

// Legacy variables for backward compatibility
const darkTextColor = secondaryTextLight;
const lightTextColor = primaryTextDark;

// Card design tokens
export const CardBorder = '#E6E1DE';
export const CardBg = '#F9F5F1';
export const Shadow = { width: 0, height: 2, opacity: 0.1, radius: 3 };

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
/** Opaque form fields on the existing shared glass material. */
/** Readable content above the wallpaper; category tints may sit on top. */
export const ContentColors = {
  light: {
    surface: 'rgba(255,255,255,0.50)',
    photoSurface: 'rgba(255,255,255,0.28)',
    readableSurface: 'rgba(255,255,255,0.94)',
    border: 'rgba(255,255,255,0.70)',
    innerBorder: 'rgba(255,255,255,0.26)',
    sheetSurface: 'rgba(255,255,255,0.74)',
    gloss: ['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.06)', 'rgba(228,235,255,0.05)'],
    timerSurface: 'rgba(225,244,252,0.42)',
    photoTimerSurface: 'rgba(225,244,252,0.24)',
    selected: '#F0E4FA',
  },
  dark: {
    surface: 'rgba(24,25,34,0.50)',
    photoSurface: 'rgba(24,25,34,0.34)',
    readableSurface: 'rgba(24,25,34,0.94)',
    border: 'rgba(255,255,255,0.26)',
    innerBorder: 'rgba(255,255,255,0.10)',
    sheetSurface: 'rgba(24,25,34,0.76)',
    gloss: ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.03)', 'rgba(170,190,235,0.03)'],
    timerSurface: 'rgba(28,47,62,0.50)',
    photoTimerSurface: 'rgba(28,47,62,0.30)',
    selected: '#493357',
  },
} as const;

export const FormColors = {
  light: {
    text: '#5C4033', secondary: '#7D5A50', placeholder: '#80675F',
    field: '#FFFFFF', border: '#E0DCE4', handle: '#BBA79B',
    backdrop: 'rgba(35,25,20,0.40)',
  },
  dark: {
    text: '#F8F0E5', secondary: '#E9D8C2', placeholder: '#CCBBAF',
    field: '#332A28', border: '#766052', handle: '#A68F80',
    backdrop: 'rgba(0,0,0,0.62)',
  },
} as const;

export type SurfaceTone = 'default' | 'lavender';

/** Cool glass treatment, shared by the switcher's surface, actions and reveal. */
export const LavenderColors = {
  light: {
    text: '#40304F', secondary: '#665675',
    field: 'rgba(255,255,255,0.58)', border: 'rgba(114,82,150,0.22)',
    backdrop: 'rgba(29,20,44,0.40)',
    action: 'rgba(142,78,198,0.12)', actionPressed: 'rgba(142,78,198,0.22)',
    onAction: '#4F3869', disabled: '#E6E0ED', onDisabled: '#6A5A79',
    surface: 'rgba(244,239,252,0.96)', surfaceBorder: 'rgba(255,255,255,0.90)',
    gradient: ['rgba(255,255,255,0.78)', 'rgba(248,244,255,0.48)', 'rgba(217,196,244,0.28)'],
    transition: ['#F1EAF9', '#E6DCF5', '#F8F4FE'],
  },
  dark: {
    text: '#F4EDFC', secondary: '#D7C9E8',
    field: 'rgba(226,208,252,0.07)', border: 'rgba(218,191,247,0.24)',
    backdrop: 'rgba(0,0,0,0.62)',
    action: 'rgba(196,159,234,0.14)', actionPressed: 'rgba(196,159,234,0.24)',
    onAction: '#F0E5FC', disabled: '#393044', onDisabled: '#C4B5D4',
    surface: 'rgba(33,26,43,0.96)', surfaceBorder: 'rgba(225,209,255,0.22)',
    gradient: ['rgba(231,215,255,0.10)', 'rgba(36,28,49,0.16)', 'rgba(153,111,195,0.12)'],
    transition: ['#211B2B', '#312440', '#251D33'],
  },
} as const;

export function getActionColors(scheme: 'light' | 'dark', tone: SurfaceTone = 'default') {
  const colors = ActionColors[scheme];
  if (tone === 'default') return colors;
  const lavender = LavenderColors[scheme];
  return {
    ...colors,
    secondary: lavender.action,
    secondaryPressed: lavender.actionPressed,
    onSecondary: lavender.onAction,
    disabled: lavender.disabled,
    onDisabled: lavender.onDisabled,
  };
}
