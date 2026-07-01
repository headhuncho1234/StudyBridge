import { useColorScheme } from 'react-native';

export const darkTheme = {
  gradient: ['#0d47a1', '#006b8f', '#00897b', '#1b5e20'] as const,
  gradientStart: { x: 0, y: 0 },
  gradientEnd: { x: 1, y: 1 },
  card: 'rgba(255, 255, 255, 0.12)',
  border: 'rgba(255, 255, 255, 0.15)',
  cardBorder: 'rgba(255, 255, 255, 0.2)',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255, 255, 255, 0.75)',
  accent: '#e8c84a',
  accentText: '#0A2463',
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  isDark: true,
};

export const lightTheme = {
  gradient: ['#e3f0ff', '#e0f4f8', '#e0f5f0', '#eaf5ea'] as const,
  gradientStart: { x: 0, y: 0 },
  gradientEnd: { x: 1, y: 1 },
  card: 'rgba(255, 255, 255, 0.85)',
  border: 'rgba(0, 0, 0, 0.08)',
  cardBorder: 'rgba(0, 0, 0, 0.12)',
  textPrimary: '#0A2463',
  textSecondary: 'rgba(10, 36, 99, 0.6)',
  accent: '#c8a000',
  accentText: '#0A2463',
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  isDark: false,
};

// Default export stays as dark for backward compat with existing imports
export const theme = darkTheme;
