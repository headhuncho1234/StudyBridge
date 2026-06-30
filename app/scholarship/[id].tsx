import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../../lib/supabase';
import { isSaved, toggleSaved } from '../../lib/savedScholarships';
import { theme } from '../../lib/theme';
import GradientBackground from '../../components/GradientBackground';

type ScholarshipDetail = {
  id: string;
  title: string;
  provider: string;
  amount: string;
  deadline: string;
  description: string | null;
  eligibility: string | null;
  application_link: string | null;
  category: string | null;
  country: string | null;
  field_of_study: string | null;
  min_gpa: number | null;
  max_gpa: number | null;
  eligible_majors: string[] | null;
  eligible_degree_levels: string[] | null;
  eligible_countries: string[] | null;
  tags: string[] | null;
  financial_need_required: boolean | null;
  scholarship_type: string | null;
  required_essays: number | null;
  application_difficulty: string | null;
  estimated_time_hours: number | null;
  created_at: string | null;
  updated_at: string | null;
};

function formatDeadline(deadline: string) {
  const date = new Date(`${deadline}T00:00:00`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysRemainingLabel(deadline: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(`${deadline}T00:00:00`);
  const diffDays = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays > 1) return `${diffDays} days remaining`;
  if (diffDays === 1) return '1 day remaining';
  if (diffDays === 0) return 'Due today';
  return 'Deadline passed';
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function ChipSection({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.chipRow}>
        {items.map((item) => (
          <View key={item} style={styles.chip}>
            <Text style={styles.chipText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function ScholarshipDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [scholarship, setScholarship] = useState<ScholarshipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from('scholarships')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error.message);
        } else {
          setScholarship(data as ScholarshipDetail);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    isSaved(id).then((result) => {
      if (!cancelled) setSaved(result);
    });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleToggleSaved = async () => {
    const next = await toggleSaved(id);
    setSaved(next);
  };

  const handleApply = () => {
    if (scholarship?.application_link) {
      WebBrowser.openBrowserAsync(scholarship.application_link);
    }
  };

  return (
    <GradientBackground>
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </Pressable>

        <Pressable
          onPress={handleToggleSaved}
          style={styles.bookmarkButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={24} color={theme.accent} />
        </Pressable>
      </View>

      {loading && <ActivityIndicator color={theme.textSecondary} style={styles.stateIndicator} />}

      {!loading && error && (
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>⚠️ Couldn't load scholarship</Text>
            <Text style={styles.cardBody}>{error}</Text>
          </View>
        </View>
      )}

      {!loading && !error && scholarship && (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>{scholarship.title}</Text>
          <Text style={styles.provider}>{scholarship.provider}</Text>

          <View style={styles.metaRow}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{scholarship.amount}</Text>
            </View>
            <Text style={styles.deadlineText}>
              Due {formatDeadline(scholarship.deadline)} · {daysRemainingLabel(scholarship.deadline)}
            </Text>
          </View>

          {scholarship.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.sectionBody}>{scholarship.description}</Text>
            </View>
          )}

          {scholarship.eligibility && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Eligibility</Text>
              <Text style={styles.sectionBody}>{scholarship.eligibility}</Text>
            </View>
          )}

          {scholarship.application_difficulty && (
            <View style={[styles.section, styles.tipSection]}>
              <Text style={styles.sectionTitle}>Application Tip</Text>
              <Text style={styles.tipBody}>
                {scholarship.application_difficulty === 'high'
                  ? '🔥 Highly competitive — start at least 3 months early, line up strong references, and tailor every essay to this specific program.'
                  : scholarship.application_difficulty === 'medium'
                  ? '⚡ Moderate competition — prepare a compelling personal statement and submit well before the deadline.'
                  : '✅ Lower competition — a polished, complete application stands out; don\'t skip optional sections.'}
              </Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>
            <View style={styles.detailsCard}>
              {scholarship.category && <DetailRow label="Category" value={scholarship.category} />}
              {scholarship.field_of_study && (
                <DetailRow label="Field of Study" value={scholarship.field_of_study} />
              )}
              {scholarship.country && <DetailRow label="Country" value={scholarship.country} />}
              {scholarship.scholarship_type && (
                <DetailRow label="Type" value={scholarship.scholarship_type} />
              )}
              {(scholarship.min_gpa != null || scholarship.max_gpa != null) && (
                <DetailRow
                  label="GPA Requirement"
                  value={
                    scholarship.min_gpa != null && scholarship.max_gpa != null
                      ? `${scholarship.min_gpa} - ${scholarship.max_gpa}`
                      : `${scholarship.min_gpa ?? scholarship.max_gpa}`
                  }
                />
              )}
              {scholarship.financial_need_required != null && (
                <DetailRow
                  label="Financial Need Required"
                  value={scholarship.financial_need_required ? 'Yes' : 'No'}
                />
              )}
              {scholarship.required_essays != null && (
                <DetailRow label="Required Essays" value={String(scholarship.required_essays)} />
              )}
              {scholarship.application_difficulty && (
                <DetailRow label="Application Difficulty" value={scholarship.application_difficulty} />
              )}
              {scholarship.estimated_time_hours != null && (
                <DetailRow label="Estimated Time" value={`${scholarship.estimated_time_hours} hrs`} />
              )}
              {scholarship.created_at && <DetailRow label="Posted" value={formatDate(scholarship.created_at)} />}
              {scholarship.updated_at && (
                <DetailRow label="Last Updated" value={formatDate(scholarship.updated_at)} />
              )}
            </View>
          </View>

          {scholarship.eligible_degree_levels?.length ? (
            <ChipSection title="Degree Levels" items={scholarship.eligible_degree_levels} />
          ) : null}

          {scholarship.eligible_majors?.length ? (
            <ChipSection title="Eligible Majors" items={scholarship.eligible_majors} />
          ) : null}

          {scholarship.eligible_countries?.length ? (
            <ChipSection title="Eligible Countries" items={scholarship.eligible_countries} />
          ) : null}

          {scholarship.tags?.length ? <ChipSection title="Tags" items={scholarship.tags} /> : null}

          {scholarship.application_link && (
            <Pressable style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyButtonText}>Apply Now</Text>
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  bookmarkButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  stateIndicator: {
    marginTop: 40,
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
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  provider: {
    fontSize: 15,
    color: theme.textSecondary,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  pill: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginRight: 12,
    marginBottom: 8,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  deadlineText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sectionBody: {
    fontSize: 14,
    color: theme.textPrimary,
    lineHeight: 22,
  },
  tipSection: {
    backgroundColor: 'rgba(232, 200, 74, 0.1)',
    borderRadius: 16,
    padding: 16,
  },
  tipBody: {
    fontSize: 14,
    color: theme.accent,
    lineHeight: 22,
  },
  detailsCard: {
    backgroundColor: theme.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 16,
    ...theme.shadow,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textPrimary,
    textAlign: 'right',
    flexShrink: 1,
    marginLeft: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  applyButton: {
    backgroundColor: theme.accent,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.accentText,
  },
});
