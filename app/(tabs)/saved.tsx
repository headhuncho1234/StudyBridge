import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getSavedIds } from '../../lib/savedScholarships';
import { getSavedSchoolIds, toggleSchoolSaved } from '../../lib/savedSchools';
import { theme } from '../../lib/theme';
import GradientBackground from '../../components/GradientBackground';
import { School } from '../../lib/schoolMatching';

type Scholarship = {
  id: string;
  title: string;
  provider: string;
  amount: string;
  deadline: string;
};

type Tab = 'scholarships' | 'schools';

function formatDeadline(deadline: string) {
  const date = new Date(`${deadline}T00:00:00`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SavedScreen() {
  const [tab, setTab] = useState<Tab>('scholarships');

  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [scholarshipsLoading, setScholarshipsLoading] = useState(true);
  const [scholarshipsError, setScholarshipsError] = useState<string | null>(null);

  const [schools, setSchools] = useState<School[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [schoolsError, setSchoolsError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setScholarshipsLoading(true);
      setScholarshipsError(null);

      getSavedIds().then((ids) => {
        if (cancelled) return;

        if (ids.length === 0) {
          setScholarships([]);
          setScholarshipsLoading(false);
          return;
        }

        supabase
          .from('scholarships')
          .select('id, title, provider, amount, deadline')
          .in('id', ids)
          .order('deadline', { ascending: true })
          .then(({ data, error }) => {
            if (cancelled) return;
            if (error) {
              setScholarshipsError(error.message);
            } else {
              setScholarships((data ?? []) as Scholarship[]);
            }
            setScholarshipsLoading(false);
          });
      });

      return () => {
        cancelled = true;
      };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setSchoolsLoading(true);
      setSchoolsError(null);

      getSavedSchoolIds().then((ids) => {
        if (cancelled) return;

        if (ids.size === 0) {
          setSchools([]);
          setSchoolsLoading(false);
          return;
        }

        supabase
          .from('schools')
          .select('*')
          .in('id', Array.from(ids))
          .then(({ data, error }) => {
            if (cancelled) return;
            if (error) {
              setSchoolsError(error.message);
            } else {
              setSchools((data ?? []) as School[]);
            }
            setSchoolsLoading(false);
          });
      });

      return () => {
        cancelled = true;
      };
    }, [])
  );

  const handleUnsaveSchool = async (schoolId: string) => {
    await toggleSchoolSaved(schoolId);
    setSchools((prev) => prev.filter((school) => school.id !== schoolId));
  };

  return (
    <GradientBackground>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.greeting}>Your List</Text>
        <Text style={styles.heading}>Saved</Text>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'scholarships' && styles.tabButtonActive]}
            onPress={() => setTab('scholarships')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabButtonText, tab === 'scholarships' && styles.tabButtonTextActive]}>
              Scholarships
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'schools' && styles.tabButtonActive]}
            onPress={() => setTab('schools')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabButtonText, tab === 'schools' && styles.tabButtonTextActive]}>Schools</Text>
          </TouchableOpacity>
        </View>

        {tab === 'scholarships' && (
          <>
            {scholarshipsLoading && <ActivityIndicator color={theme.textSecondary} style={styles.stateIndicator} />}

            {!scholarshipsLoading && scholarshipsError && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>⚠️ Couldn't load saved scholarships</Text>
                <Text style={styles.cardBody}>{scholarshipsError}</Text>
              </View>
            )}

            {!scholarshipsLoading && !scholarshipsError && scholarships.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🔖</Text>
                <Text style={styles.emptyTitle}>No saved scholarships yet</Text>
                <Text style={styles.emptyBody}>
                  Bookmark scholarships from your search results to keep track of opportunities and
                  deadlines here.
                </Text>
              </View>
            )}

            {!scholarshipsLoading &&
              !scholarshipsError &&
              scholarships.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.resultCard}
                  onPress={() => router.push({ pathname: '/scholarship/[id]', params: { id: item.id } })}
                >
                  <Text style={styles.resultTitle}>{item.title}</Text>
                  <Text style={styles.resultOrg}>{item.provider}</Text>
                  <View style={styles.resultMeta}>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillText}>{item.amount}</Text>
                    </View>
                    <Text style={styles.resultDeadline}>Due {formatDeadline(item.deadline)}</Text>
                  </View>
                </Pressable>
              ))}
          </>
        )}

        {tab === 'schools' && (
          <>
            {schoolsLoading && <ActivityIndicator color={theme.textSecondary} style={styles.stateIndicator} />}

            {!schoolsLoading && schoolsError && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>⚠️ Couldn't load saved schools</Text>
                <Text style={styles.cardBody}>{schoolsError}</Text>
              </View>
            )}

            {!schoolsLoading && !schoolsError && schools.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🏫</Text>
                <Text style={styles.emptyTitle}>No saved schools yet</Text>
                <Text style={styles.emptyBody}>
                  Bookmark schools from your Smart Matching results to keep track of them here.
                </Text>
              </View>
            )}

            {!schoolsLoading &&
              !schoolsError &&
              schools.map((school) => (
                <View key={school.id} style={styles.resultCard}>
                  <View style={styles.schoolTopRow}>
                    <Text style={styles.resultTitle}>{school.name}</Text>
                    <TouchableOpacity
                      onPress={() => handleUnsaveSchool(school.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.bookmarkIcon}>★</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.resultOrg}>{school.location}</Text>
                  <View style={styles.resultMeta}>
                    {school.tuition != null && (
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText}>${Math.round(school.tuition).toLocaleString()}/yr</Text>
                      </View>
                    )}
                    {school.ranking && <Text style={styles.resultDeadline}>{school.ranking}</Text>}
                  </View>
                </View>
              ))}
          </>
        )}
      </ScrollView>
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
    marginBottom: 20,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 4,
    marginBottom: 24,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: theme.textPrimary,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  tabButtonTextActive: {
    color: theme.accentText,
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
  emptyState: {
    backgroundColor: theme.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 32,
    alignItems: 'center',
    marginTop: 16,
    ...theme.shadow,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
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
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 4,
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
  schoolTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  bookmarkIcon: {
    fontSize: 22,
    color: theme.accent,
    marginLeft: 12,
  },
});
