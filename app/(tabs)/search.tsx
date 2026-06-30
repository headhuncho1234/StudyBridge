import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { getSavedIds, toggleSaved } from '../../lib/savedScholarships';
import { theme } from '../../lib/theme';
import GradientBackground from '../../components/GradientBackground';

type Scholarship = {
  id: string;
  title: string;
  provider: string;
  amount: string;
  deadline: string;
};

function formatDeadline(deadline: string) {
  const date = new Date(`${deadline}T00:00:00`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    getSavedIds().then((ids) => {
      if (!cancelled) setSavedIds(new Set(ids));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleSaved = async (id: string, event: GestureResponderEvent) => {
    event.stopPropagation();
    const saved = await toggleSaved(id);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (saved) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;

    const timeout = setTimeout(() => {
      setLoading(true);
      setError(null);

      const today = new Date().toISOString().slice(0, 10);

      let request = supabase
        .from('scholarships')
        .select('id, title, provider, amount, deadline')
        .gte('deadline', today)
        .order('deadline', { ascending: true });

      if (query.trim()) {
        request = request.ilike('title', `%${query.trim()}%`);
      }

      request.then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error.message);
        } else {
          setScholarships((data ?? []) as Scholarship[]);
        }
        setLoading(false);
      });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  return (
    <GradientBackground>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.greeting}>Discover</Text>
          <Text style={styles.heading}>Find Scholarships</Text>

          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, field, or country"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
          </View>

          {!loading && !error && (
            <Text style={styles.countLine}>{scholarships.length} scholarships available</Text>
          )}

          <Text style={styles.sectionTitle}>
            {query.trim() ? 'Search Results' : 'All Scholarships'}
          </Text>

          {loading && <ActivityIndicator color={theme.textSecondary} style={styles.stateIndicator} />}

          {!loading && error && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>⚠️ Couldn't load scholarships</Text>
              <Text style={styles.cardBody}>{error}</Text>
            </View>
          )}

          {!loading && !error && scholarships.length === 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>No results</Text>
              <Text style={styles.cardBody}>Try a different search term.</Text>
            </View>
          )}

          {!loading &&
            !error &&
            scholarships.map((item) => (
              <Pressable
                key={item.id}
                style={styles.resultCard}
                onPress={() => router.push({ pathname: '/scholarship/[id]', params: { id: item.id } })}
              >
                <View style={styles.resultHeader}>
                  <Text style={[styles.resultTitle, styles.resultTitleText]}>{item.title}</Text>
                  <Pressable
                    onPress={(event) => handleToggleSaved(item.id, event)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={savedIds.has(item.id) ? 'bookmark' : 'bookmark-outline'}
                      size={20}
                      color={theme.accent}
                    />
                  </Pressable>
                </View>
                <Text style={styles.resultOrg}>{item.provider}</Text>
                <View style={styles.resultMeta}>
                  <View style={styles.metaPill}>
                    <Text style={styles.metaPillText}>{item.amount}</Text>
                  </View>
                  <Text style={styles.resultDeadline}>Due {formatDeadline(item.deadline)}</Text>
                </View>
              </Pressable>
            ))}
        </ScrollView>
      </TouchableWithoutFeedback>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 80,
    paddingBottom: 120,
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
    marginBottom: 24,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...theme.shadow,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.textPrimary,
  },
  countLine: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 12,
  },
  stateIndicator: {
    marginTop: 24,
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 20,
    ...theme.shadow,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  resultCard: {
    backgroundColor: theme.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 20,
    marginBottom: 12,
    ...theme.shadow,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  resultTitleText: {
    flex: 1,
    marginRight: 12,
  },
  resultOrg: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 12,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 10,
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  resultDeadline: {
    fontSize: 12,
    color: theme.textSecondary,
  },
});
