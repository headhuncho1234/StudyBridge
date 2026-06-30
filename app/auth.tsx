import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/theme';
import GradientBackground from '../components/GradientBackground';

type Mode = 'signIn' | 'signUp';

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignUp = mode === 'signUp';

  const handleSwitchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    if (isSignUp && !accepted) {
      setError('You must agree to the Terms & Conditions to continue.');
      return;
    }

    setLoading(true);

    const { error: authError } = isSignUp
      ? await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              accepted_terms_at: new Date().toISOString(),
            },
          },
        })
      : await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

    if (authError) {
      setLoading(false);
      setError(authError.message);
      return;
    }

    router.replace('/home');
  };

  return (
    <GradientBackground>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.greeting}>{isSignUp ? 'Get Started' : 'Welcome Back'}</Text>
          <Text style={styles.heading}>{isSignUp ? 'Create Your Account' : 'Sign In'}</Text>

          <View style={styles.modeSwitch}>
            <TouchableOpacity
              style={[styles.modeButton, !isSignUp && styles.modeButtonActive]}
              onPress={() => handleSwitchMode('signIn')}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeButtonText, !isSignUp && styles.modeButtonTextActive]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, isSignUp && styles.modeButtonActive]}
              onPress={() => handleSwitchMode('signUp')}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeButtonText, isSignUp && styles.modeButtonTextActive]}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {isSignUp && (
            <TouchableOpacity style={styles.checkRow} onPress={() => setAccepted(!accepted)} activeOpacity={0.7}>
              <View style={[styles.checkbox, accepted && styles.checkboxActive]}>
                {accepted && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>
                I have read and agree to the{' '}
                <Text style={styles.checkLink} onPress={() => router.push('/terms')}>
                  Terms & Conditions
                </Text>
              </Text>
            </TouchableOpacity>
          )}

          {error && (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={theme.accentText} />
            ) : (
              <Text style={styles.buttonText}>{isSignUp ? 'Sign Up' : 'Sign In'}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 100,
    paddingBottom: 48,
  },
  greeting: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.textPrimary,
    marginTop: 4,
    marginBottom: 32,
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 4,
    marginBottom: 24,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: theme.textPrimary,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  modeButtonTextActive: {
    color: theme.accentText,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.textPrimary,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.textSecondary,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  checkmark: {
    color: theme.accentText,
    fontWeight: '800',
    fontSize: 14,
  },
  checkLabel: {
    flex: 1,
    color: theme.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  checkLink: {
    color: theme.textPrimary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  errorCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  errorText: {
    color: theme.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  button: {
    backgroundColor: theme.accent,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: theme.accentText,
    fontSize: 16,
    fontWeight: '700',
  },
});
