import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { theme } from '../../lib/theme';
import GradientBackground from '../../components/GradientBackground';
import { isEligible, getMatchPercent, getMatchTier } from '../../lib/matching';
import { listSavedSearches, deleteSavedSearch, SavedSearch } from '../../lib/savedSearches';

type Scholarship = {
  id: string;
  title: string;
  provider: string;
  amount: string;
  deadline: string;
  eligible_degree_levels: string[] | null;
  eligible_countries: string[] | null;
  eligible_majors: string[] | null;
  min_gpa: number | null;
  application_difficulty: string | null;
  eligibility: string | null;
};

type ScholarshipMatch = Scholarship & { matchPercent: number; matchTier: string | null };

type Profile = {
  degree_level: string | null;
  field_of_study: string | null;
  country: string | null;
  gpa: number | null;
  target_state: string | null;
};

type School = {
  id: number;
  name: string;
  city: string;
  state: string;
  admissionRate: number | null;
  tuition: number | null;
};

type ScorecardSchool = {
  id: number;
  'school.name': string;
  'school.city': string;
  'school.state': string;
  'latest.admissions.admission_rate.overall': number | null;
  'latest.cost.tuition.out_of_state': number | null;
  'latest.student.size': number | null;
};

const SCORECARD_BASE = 'https://api.data.gov/ed/collegescorecard/v1/schools';
const SCORECARD_FIELDS =
  'id,school.name,school.city,school.state,latest.admissions.admission_rate.overall,latest.cost.tuition.out_of_state,latest.student.size';

const US_STATE_ABBREVIATIONS: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO',
  montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH',
  oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
  'district of columbia': 'DC',
};

function toStateAbbreviation(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  return US_STATE_ABBREVIATIONS[trimmed.toLowerCase()] ?? trimmed.toUpperCase();
}

function toDegreesAwardedHighest(degreeLevel: string | null): string | null {
  if (degreeLevel === 'doctoral' || degreeLevel === 'graduate') return '4';
  if (degreeLevel === 'undergraduate') return '3,4';
  return null;
}

function formatDeadline(deadline: string) {
  const date = new Date(`${deadline}T00:00:00`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function getScholarshipTip(diff: string | null): string {
  if (diff === 'high') return 'Highly competitive — start 3 months early, line up strong references, and tailor every essay.';
  if (diff === 'medium') return 'Moderate competition — prepare a compelling personal statement and apply before the deadline.';
  if (diff === 'low') return "Lower competition — a strong application stands out; don't skip optional essay sections.";
  return 'Apply early — many awards close before the posted deadline.';
}

function ScholarshipCard({ item, matchTier }: { item: Scholarship; matchTier?: string | null }) {
  const tip = getScholarshipTip(item.application_difficulty ?? null);
  const eligibilitySnippet = item.eligibility ? item.eligibility.slice(0, 100) + (item.eligibility.length > 100 ? '…' : '') : null;

  return (
    <Pressable
      style={styles.resultCard}
      onPress={() => router.push({ pathname: '/scholarship/[id]', params: { id: item.id } })}
    >
      <Text style={styles.resultTitle}>{item.title}</Text>
      <Text style={styles.resultOrg}>{item.provider}</Text>
      <View style={styles.resultMeta}>
        <View style={styles.metaPill}>
          <Text style={styles.metaPillText}>{item.amount}</Text>
        </View>
        {matchTier && (
          <View style={[styles.metaPill, styles.matchPill]}>
            <Text style={[styles.metaPillText, styles.matchPillText]}>{matchTier}</Text>
          </View>
        )}
        <Text style={styles.resultDeadline}>Due {formatDeadline(item.deadline)}</Text>
      </View>
      {eligibilitySnippet && (
        <Text style={styles.resultEligibility}>{eligibilitySnippet}</Text>
      )}
      <Text style={styles.resultTip}>💡 {tip}</Text>
      <Text style={styles.resultApplyLink}>Tap to view & apply →</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [scholarshipsLoading, setScholarshipsLoading] = useState(true);
  const [scholarshipsError, setScholarshipsError] = useState<string | null>(null);

  const [schools, setSchools] = useState<School[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [schoolsError, setSchoolsError] = useState<string | null>(null);

  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [savedSearchesLoading, setSavedSearchesLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      supabase.auth.getUser().then(async ({ data: userData }) => {
        const user = userData.user;
        if (!user) {
          if (!cancelled) {
            setProfile(null);
            setProfileLoading(false);
          }
          return;
        }

        const { data } = await supabase
          .from('profiles')
          .select('degree_level, field_of_study, country, gpa, target_state')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!cancelled) {
          setProfile(data);
          setProfileLoading(false);
        }
      });

      return () => {
        cancelled = true;
      };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setSavedSearchesLoading(true);

      listSavedSearches().then((searches) => {
        if (!cancelled) {
          setSavedSearches(searches);
          setSavedSearchesLoading(false);
        }
      });

      return () => {
        cancelled = true;
      };
    }, [])
  );

  const handleDeleteSearch = (search: SavedSearch) => {
    Alert.alert('Delete saved search?', `"${search.search_name}" will be removed permanently.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteSavedSearch(search.id);
          setSavedSearches((prev) => prev.filter((item) => item.id !== search.id));
        },
      },
    ]);
  };

  useEffect(() => {
    let cancelled = false;
    const today = new Date().toISOString().slice(0, 10);

    supabase
      .from('scholarships')
      .select(
        'id, title, provider, amount, deadline, eligible_degree_levels, eligible_countries, eligible_majors, min_gpa, application_difficulty, eligibility'
      )
      .gte('deadline', today)
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

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (profileLoading) return;

    if (!profile?.target_state) {
      setSchools([]);
      setSchoolsLoading(false);
      setSchoolsError(null);
      return;
    }

    let cancelled = false;
    setSchoolsLoading(true);
    setSchoolsError(null);

    const params = new URLSearchParams({
      api_key: process.env.EXPO_PUBLIC_SCORECARD_KEY ?? '',
      fields: SCORECARD_FIELDS,
      per_page: '8',
      sort: 'latest.student.size:desc',
      'school.operating': '1',
      'school.state': toStateAbbreviation(profile.target_state),
    });

    const degreesAwardedHighest = toDegreesAwardedHighest(profile.degree_level);
    if (degreesAwardedHighest) {
      params.set('school.degrees_awarded.highest', degreesAwardedHighest);
    }

    fetch(`${SCORECARD_BASE}?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Couldn't load schools (${response.status})`);
        }
        return (await response.json()) as { results?: ScorecardSchool[] };
      })
      .then((json) => {
        if (cancelled) return;
        const results = json.results ?? [];
        setSchools(
          results.map((item) => ({
            id: item.id,
            name: item['school.name'],
            city: item['school.city'],
            state: item['school.state'],
            admissionRate: item['latest.admissions.admission_rate.overall'],
            tuition: item['latest.cost.tuition.out_of_state'],
          }))
        );
      })
      .catch((err) => {
        if (!cancelled) setSchoolsError(err instanceof Error ? err.message : 'Failed to load schools');
      })
      .finally(() => {
        if (!cancelled) setSchoolsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profileLoading, profile?.target_state, profile?.degree_level]);

  const today = new Date().toISOString().slice(0, 10);

  const matches: ScholarshipMatch[] = profile
    ? scholarships
        .filter((item) => isEligible(item, profile, today))
        .map((item) => {
          const matchPercent = getMatchPercent(item, profile);
          return { ...item, matchPercent, matchTier: getMatchTier(matchPercent) };
        })
        .sort((a, b) => {
          if (b.matchPercent !== a.matchPercent) return b.matchPercent - a.matchPercent;
          return a.deadline.localeCompare(b.deadline);
        })
        .slice(0, 5)
    : [];

  const upcoming = scholarships.slice(0, 3);

  return (
    <GradientBackground>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>Welcome back 👋</Text>
      <Text style={styles.heading}>Your Scholarship Dashboard</Text>

      <Pressable style={styles.assistantCard} onPress={() => router.push('/profile-setup')}>
        <Text style={styles.assistantCardEmoji}>🎯</Text>
        <View style={styles.assistantCardText}>
          <Text style={styles.assistantCardTitle}>Find Your Match</Text>
          <Text style={styles.assistantCardBody}>Discover universities and scholarships tailored to you</Text>
        </View>
        <Text style={styles.assistantCardChevron}>›</Text>
      </Pressable>

      <Pressable style={styles.assistantCard} onPress={() => router.push('/assistant')}>
        <Text style={styles.assistantCardEmoji}>🤖</Text>
        <View style={styles.assistantCardText}>
          <Text style={styles.assistantCardTitle}>AI Assistant</Text>
          <Text style={styles.assistantCardBody}>Ask about visas, scholarships, schools, and housing</Text>
        </View>
        <Text style={styles.assistantCardChevron}>›</Text>
      </Pressable>

      <Pressable style={styles.assistantCard} onPress={() => router.push('/community')}>
        <Text style={styles.assistantCardEmoji}>💬</Text>
        <View style={styles.assistantCardText}>
          <Text style={styles.assistantCardTitle}>Student Community</Text>
          <Text style={styles.assistantCardBody}>Connect with peers, ask questions, share experiences</Text>
        </View>
        <Text style={styles.assistantCardChevron}>›</Text>
      </Pressable>

      {!savedSearchesLoading && savedSearches.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Saved Searches</Text>
          {savedSearches.map((search) => (
            <Swipeable
              key={search.id}
              renderRightActions={() => (
                <TouchableOpacity
                  style={styles.deleteAction}
                  onPress={() => handleDeleteSearch(search)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.deleteActionText}>Delete</Text>
                </TouchableOpacity>
              )}
              overshootRight={false}
            >
              <Pressable
                style={[styles.card, styles.savedSearchCard]}
                onPress={() => router.push({ pathname: '/profile-setup', params: { savedSearchId: search.id } })}
              >
                <Text style={styles.cardTitle}>🔖 {search.search_name}</Text>
                <Text style={styles.cardBody}>
                  {search.results_count ?? 0} matches ·{' '}
                  {new Date(search.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </Pressable>
            </Swipeable>
          ))}
        </>
      )}

      {!profileLoading && !profile && (
        <Pressable style={styles.card} onPress={() => router.push('/profile-setup')}>
          <Text style={styles.cardTitle}>🎯 Complete your profile to unlock matches</Text>
          <Text style={styles.cardBody}>
            Add your degree level, field of study, GPA, and more so we can surface scholarships and schools picked
            for you.
          </Text>
        </Pressable>
      )}

      {!profileLoading && profile && (
        <>
          <Text style={styles.sectionTitle}>Your Matches</Text>

          {scholarshipsLoading && <ActivityIndicator color={theme.textSecondary} style={styles.stateIndicator} />}

          {!scholarshipsLoading && scholarshipsError && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>⚠️ Couldn't load matches</Text>
              <Text style={styles.cardBody}>{scholarshipsError}</Text>
            </View>
          )}

          {!scholarshipsLoading && !scholarshipsError && matches.length === 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>No matches yet</Text>
              <Text style={styles.cardBody}>Check back soon for new scholarship opportunities.</Text>
            </View>
          )}

          {!scholarshipsLoading &&
            !scholarshipsError &&
            matches.map((item) => <ScholarshipCard key={item.id} item={item} matchTier={item.matchTier} />)}
        </>
      )}

      {!profileLoading && profile && !profile.target_state && (
        <>
          <Text style={styles.sectionTitle}>Recommended Schools</Text>
          <Pressable style={styles.card} onPress={() => router.push('/profile-setup')}>
            <Text style={styles.cardTitle}>🏫 Add a target state to get school recommendations</Text>
          </Pressable>
        </>
      )}

      {!profileLoading && profile?.target_state && (
        <>
          <Text style={styles.sectionTitle}>Recommended Schools</Text>

          {schoolsLoading && <ActivityIndicator color={theme.textSecondary} style={styles.stateIndicator} />}

          {!schoolsLoading && schoolsError && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>⚠️ Couldn't load schools</Text>
              <Text style={styles.cardBody}>{schoolsError}</Text>
            </View>
          )}

          {!schoolsLoading && !schoolsError && schools.length === 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>No schools found</Text>
              <Text style={styles.cardBody}>Try a different target state in your profile.</Text>
            </View>
          )}

          {!schoolsLoading &&
            !schoolsError &&
            schools.map((school) => (
              <View key={school.id} style={styles.schoolCard}>
                <Text style={styles.schoolName}>{school.name}</Text>
                <Text style={styles.schoolLocation}>
                  {school.city}, {school.state}
                </Text>
                <View style={styles.resultMeta}>
                  {school.admissionRate != null && (
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillText}>{Math.round(school.admissionRate * 100)}% admit rate</Text>
                    </View>
                  )}
                  {school.tuition != null && (
                    <Text style={styles.resultDeadline}>{formatCurrency(school.tuition)}/yr out-of-state</Text>
                  )}
                </View>
              </View>
            ))}
        </>
      )}

      <Text style={styles.sectionTitle}>Deadlines Coming Up</Text>

      {scholarshipsLoading && <ActivityIndicator color={theme.textSecondary} style={styles.stateIndicator} />}

      {!scholarshipsLoading && scholarshipsError && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⚠️ Couldn't load deadlines</Text>
          <Text style={styles.cardBody}>{scholarshipsError}</Text>
        </View>
      )}

      {!scholarshipsLoading && !scholarshipsError && upcoming.length === 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No upcoming deadlines</Text>
          <Text style={styles.cardBody}>Check back soon for new scholarship opportunities.</Text>
        </View>
      )}

      {!scholarshipsLoading &&
        !scholarshipsError &&
        upcoming.map((item) => <ScholarshipCard key={item.id} item={item} />)}
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
    marginBottom: 24,
  },
  assistantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 18,
    marginBottom: 20,
    ...theme.shadow,
  },
  assistantCardEmoji: {
    fontSize: 28,
    marginRight: 14,
  },
  assistantCardText: {
    flex: 1,
  },
  assistantCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  assistantCardBody: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
  },
  assistantCardChevron: {
    fontSize: 22,
    color: theme.accent,
    marginLeft: 8,
  },
  savedSearchCard: {
    marginBottom: 12,
  },
  deleteAction: {
    backgroundColor: '#D64545',
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    marginBottom: 12,
    borderRadius: 20,
  },
  deleteActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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
    flexWrap: 'wrap',
  },
  metaPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 10,
    marginBottom: 6,
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  matchPill: {
    backgroundColor: theme.accent,
  },
  matchPillText: {
    color: theme.accentText,
  },
  resultDeadline: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  resultEligibility: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 8,
    lineHeight: 17,
  },
  resultTip: {
    fontSize: 12,
    color: theme.accent,
    marginTop: 6,
    lineHeight: 17,
    fontStyle: 'italic',
  },
  resultApplyLink: {
    fontSize: 12,
    color: theme.accent,
    fontWeight: '700',
    marginTop: 8,
  },
  schoolCard: {
    backgroundColor: theme.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 20,
    marginBottom: 12,
    ...theme.shadow,
  },
  schoolName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  schoolLocation: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 12,
  },
});
