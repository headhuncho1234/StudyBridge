export const theme = {
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
};
