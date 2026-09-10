import { CardBorder, Colors } from '@/constants/Colors';

// The onboarding uses Lotti's default light appearance before personalization.
export const onboardingColors = {
  text: Colors.light.textPrimary,
  secondary: Colors.light.textSecondary,
  muted: Colors.light.textTertiary,
  background: Colors.light.background,
  border: CardBorder,
  accent: '#8E4EC6', // Existing profile and sleep-tracker accent.
  accentText: '#5E3DB3',
  selected: '#EDE2F7',
  selectedGlass: 'rgba(142,78,198,0.22)',
  softAccent: 'rgba(142,78,198,0.10)',
  soft: Colors.light.cardLight,
  white: '#FFFFFF',
  rose: '#FFCDCE',
};
