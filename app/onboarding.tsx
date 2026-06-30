import { useRef, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../lib/theme';
import GradientBackground from '../components/GradientBackground';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    title: 'Find Your Scholarship',
    description: 'Access thousands of scholarships matched to your academic profile, background, and goals.',
    emoji: '🎓',
  },
  {
    id: '2',
    title: 'AI-Powered Matching',
    description: 'Our intelligent system surfaces the opportunities most relevant to you — no more endless searching.',
    emoji: '🤖',
  },
  {
    id: '3',
    title: 'Track & Apply',
    description: 'Manage deadlines, save favorites, and stay organized through every step of the process.',
    emoji: '📋',
  },
  {
    id: '4',
    title: 'Built for Students Worldwide; Find your tribe!',
    description: 'Designed specifically for students navigating U.S. higher education from abroad.',
    emoji: '🌍',
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      router.replace('/terms');
    }
  };

  const handleSkip = () => {
    router.replace('/terms');
  };

  return (
    <GradientBackground>
      <View style={styles.container}>
        <TouchableOpacity style={styles.signInButton} onPress={() => router.push('/auth')}>
          <Text style={styles.signInText}>Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        <FlatList
          ref={flatListRef}
          data={slides}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <Text style={styles.emoji}>{item.emoji}</Text>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.description}>{item.description}</Text>
            </View>
          )}
        />

        <View style={styles.footer}>
          <View style={styles.dots}>
            {slides.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === currentIndex && styles.activeDot]}
              />
            ))}
          </View>

          <TouchableOpacity style={styles.button} onPress={handleNext}>
            <Text style={styles.buttonText}>
              {currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
  },
  skipText: {
    color: theme.textSecondary,
    fontSize: 16,
  },
  signInButton: {
    position: 'absolute',
    top: 60,
    left: 24,
    zIndex: 10,
  },
  signInText: {
    color: theme.textSecondary,
    fontSize: 16,
  },
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingBottom: 60,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    marginBottom: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.textSecondary,
    marginHorizontal: 4,
    opacity: 0.4,
  },
  activeDot: {
    opacity: 1,
    width: 24,
    backgroundColor: theme.accent,
  },
  button: {
    backgroundColor: theme.accent,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: theme.accentText,
    fontSize: 16,
    fontWeight: '700',
  },
});
