import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/theme';
import GradientBackground from '../components/GradientBackground';

export default function SplashScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(async () => {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          router.replace('/home');
        } else {
          router.replace('/onboarding');
        }
      }, 1500);
    });
  }, []);

  return (
    <GradientBackground style={styles.container}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
        <Text style={styles.logo}>StudyBridge</Text>
        <Text style={styles.tagline}>Your path to higher education</Text>
      </Animated.View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 42,
    fontWeight: '800',
    color: theme.textPrimary,
    textAlign: 'center',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 0.5,
  },
});
