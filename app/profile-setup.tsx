import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/theme';
import GradientBackground from '../components/GradientBackground';
import {
  School,
  MatchAnswers,
  isSchoolEligible,
  getSchoolMatchPercent,
  getSchoolMatchTier,
  getWhyThisMatch,
  resolveRegionFilter,
  BUDGET_CEILINGS,
  CAMPUS_SIZE_RANGES,
  MAJOR_GROUPS,
} from '../lib/schoolMatching';
import { getSavedSchoolIds, toggleSchoolSaved } from '../lib/savedSchools';
import { saveSearch } from '../lib/savedSearches';
import { isEligible, getMatchPercent, getMatchTier, matchesDemographic } from '../lib/matching';

const MAJORS = MAJOR_GROUPS.flatMap((group) => group.options);

const GPA_RANGES = ['Below 2.5', '2.5-3.0', '3.0-3.5', '3.5-3.7', '3.7-4.0'];

const GPA_RANGE_VALUES: Record<string, number> = {
  'Below 2.5': 2.4,
  '2.5-3.0': 2.75,
  '3.0-3.5': 3.25,
  '3.5-3.7': 3.6,
  '3.7-4.0': 3.85,
};

const ENROLLMENT_TYPES = ['Undergraduate', 'Graduate School', 'Community College', 'Certificate Program'];

const ENROLLMENT_TYPE_DEGREE_LEVELS: Record<string, string> = {
  Undergraduate: 'undergraduate',
  'Graduate School': 'graduate',
  'Community College': 'undergraduate',
  'Certificate Program': 'undergraduate',
};

const LOCATIONS = [
  'Northeast',
  'Southeast',
  'Midwest',
  'Southwest',
  'West Coast',
  'Mountain West',
  'Hawaii, Alaska & Territories',
  'Anywhere in U.S.',
];

const BUDGETS = ['Under $20k', '$20k-$30k', '$30k-$50k', '$50k-$75k', 'Over $75k', 'No limit'];

const CAMPUS_SIZES = ['Small <5k', 'Medium 5k-15k', 'Large 15k-30k', 'Very Large 30k+', 'No preference'];

const DEMOGRAPHICS = [
  'First-generation',
  'Low-income background',
  'Veteran/military family',
  'Underrepresented minority',
  'International student',
  'Student with disabilities',
  'Community volunteer/service',
];

const TIMELINES = ['Early Decision', 'Early Action', 'Regular Decision', 'Rolling Admissions'];

type DropdownKey = 'major' | 'gpa' | 'enrollment' | 'budget' | 'campus' | 'timeline';

const DROPDOWN_TITLES: Record<DropdownKey, string> = {
  major: 'Intended Major / Program of Study',
  gpa: 'Current GPA',
  enrollment: 'Enrollment Type',
  budget: 'Maximum Annual Budget',
  campus: 'Preferred Campus Size',
  timeline: 'Preferred Admission Timeline',
};

const DROPDOWN_OPTIONS: Record<DropdownKey, string[]> = {
  major: MAJORS,
  gpa: GPA_RANGES,
  enrollment: ENROLLMENT_TYPES,
  budget: BUDGETS,
  campus: CAMPUS_SIZES,
  timeline: TIMELINES,
};

type SchoolMatch = School & { matchPercent: number; matchTier: string | null; whyMatch: string[] };

type MatchContext = MatchAnswers & {
  country: string | null;
  gpaValue: number | null;
  degreeLevel: string | null;
};

type RecommendedScholarship = {
  id: string;
  title: string;
  provider: string;
  amount: string;
  deadline: string;
  matchPercent: number;
  matchTier: string | null;
  isDemographicMatch: boolean;
};

function formatScholarshipDeadline(deadline: string) {
  const date = new Date(`${deadline}T00:00:00`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Tells Rhetor (via the edge function's system prompt) which of the four
// undergraduate-prep vs. graduate-professional contexts applies, so it never
// confuses a Pre-Law freshman with a JD applicant, or Pre-Med with an MD/DO one.
const PROGRAM_CONTEXT_NOTES: Record<string, string> = {
  'Pre-Law': 'Pre-Law (undergraduate prep, not yet applying to law school).',
  'Law / JD': 'Law / JD (graduate — actively applying to law school).',
  'Pre-Med': 'Pre-Med (undergraduate prep, not yet applying to medical school).',
  'MD / DO': 'MD / DO (graduate — actively applying to medical school).',
};

function getProgramContextNote(major: string | null): string | null {
  if (!major) return null;
  return PROGRAM_CONTEXT_NOTES[major] ?? null;
}

const DONE_TOOLBAR_ID = 'profileSetupDoneToolbar';

function generateUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function toggleInArray(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function DropdownField({
  label,
  value,
  placeholder,
  onPress,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.dropdownInput} onPress={onPress} activeOpacity={0.8}>
        <Text style={[styles.dropdownValue, !value && styles.dropdownPlaceholder]}>{value ?? placeholder}</Text>
        <Text style={styles.dropdownChevron}>⌄</Text>
      </TouchableOpacity>
    </View>
  );
}

function CheckRow({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.checkRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.checkbox, checked && styles.checkboxActive]}>{checked && <Text style={styles.checkmark}>✓</Text>}</View>
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function ProfileSetupScreen() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<DropdownKey | null>(null);

  const [country, setCountry] = useState<string | null>(null);

  const [major, setMajor] = useState<string | null>(null);
  const [gpaRange, setGpaRange] = useState<string | null>(null);
  const [enrollmentType, setEnrollmentType] = useState<string | null>(null);

  const [extracurriculars, setExtracurriculars] = useState('');
  const [preferredLocations, setPreferredLocations] = useState<string[]>([]);
  const [maxBudget, setMaxBudget] = useState<string | null>(null);
  const [campusSize, setCampusSize] = useState<string | null>(null);

  const [demographics, setDemographics] = useState<string[]>([]);
  const [admissionTimeline, setAdmissionTimeline] = useState<string | null>(null);
  const [hardConstraints, setHardConstraints] = useState('');

  const [results, setResults] = useState<SchoolMatch[] | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [savedSchoolIds, setSavedSchoolIds] = useState<Set<string>>(new Set());
  const [expandedSchoolId, setExpandedSchoolId] = useState<string | null>(null);
  const [savingSearch, setSavingSearch] = useState(false);
  const [searchSaved, setSearchSaved] = useState(false);
  const [relaxedNotice, setRelaxedNotice] = useState<string | null>(null);

  const [recommendedScholarships, setRecommendedScholarships] = useState<RecommendedScholarship[]>([]);
  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});
  const [aiExplanationsLoading, setAiExplanationsLoading] = useState<Set<string>>(new Set());

  const { savedSearchId } = useLocalSearchParams<{ savedSearchId?: string }>();

  const loadAiExplanations = (matches: SchoolMatch[], context: MatchContext) => {
    matches.forEach((school) => {
      if (aiExplanations[school.id] || aiExplanationsLoading.has(school.id)) return;

      setAiExplanationsLoading((prev) => new Set(prev).add(school.id));

      const programContextNote = getProgramContextNote(context.major);

      const prompt =
        `In exactly 2 sentences, explain why ${school.name} (located in ${school.location ?? 'the U.S.'}, ` +
        `tuition $${school.tuition ?? 'unknown'}, programs: ${(school.programs ?? []).join(', ') || 'unknown'}) ` +
        `is a good fit for a student studying ${context.major ?? 'an undecided field'} who prefers ` +
        `${context.preferredLocations.join(', ') || 'any location'}, has a budget of ${context.maxBudget ?? 'no stated limit'}, ` +
        `and prefers a ${context.campusSize ?? 'any size'} campus. Be specific and personal, not generic.` +
        (programContextNote ? `\n\nStudent program context: ${programContextNote}` : '');

      supabase.functions
        .invoke('ai-assistant', { body: { messages: [{ role: 'user', content: prompt }] } })
        .then(({ data }) => {
          const reply = (data as { reply?: string } | null)?.reply;
          if (reply) {
            setAiExplanations((prev) => ({ ...prev, [school.id]: reply }));
          }
        })
        .finally(() => {
          setAiExplanationsLoading((prev) => {
            const next = new Set(prev);
            next.delete(school.id);
            return next;
          });
        });
    });
  };

  const buildSchoolsQuery = (context: MatchContext) => {
    let schoolsQuery = supabase.from('schools').select('*');

    const regionFilter = resolveRegionFilter(context.preferredLocations);
    if (regionFilter != null) {
      schoolsQuery = schoolsQuery.in('region', regionFilter);
    }

    if (context.maxBudget) {
      const ceiling = BUDGET_CEILINGS[context.maxBudget] ?? Infinity;
      if (ceiling !== Infinity) {
        schoolsQuery = schoolsQuery.lte('tuition', ceiling);
      }
    }

    if (context.campusSize && context.campusSize !== 'No preference') {
      const range = CAMPUS_SIZE_RANGES[context.campusSize];
      if (range) {
        schoolsQuery = schoolsQuery.gte('enrollment_size', range[0]);
        if (range[1] !== Infinity) {
          schoolsQuery = schoolsQuery.lt('enrollment_size', range[1]);
        }
      }
    }

    // "Law / JD" and "MD / DO" mean the student is applying TO a professional
    // school right now — only real law/medical schools should ever appear, and
    // community/technical colleges are excluded outright. This is intentionally
    // NOT relaxed by the fallback passes below (major never changes across
    // RELAXATION_PASSES), unlike Pre-Law/Pre-Med which have no such filter at all.
    if (context.major === 'Law / JD') {
      schoolsQuery = schoolsQuery
        .or(
          'programs.cs.{Law},name.ilike.%school of law%,name.ilike.%college of law%,name.ilike.%law school%,name.ilike.%law center%'
        )
        .not('name', 'ilike', '%community college%')
        .not('name', 'ilike', '%technical college%');
    } else if (context.major === 'MD / DO') {
      schoolsQuery = schoolsQuery
        .or(
          'programs.cs.{Medicine},programs.cs.{Medicine/Health},name.ilike.%school of medicine%,name.ilike.%college of medicine%,name.ilike.%medical college%,name.ilike.%osteopathic%'
        )
        .not('name', 'ilike', '%community college%')
        .not('name', 'ilike', '%technical college%');
    }

    return schoolsQuery;
  };

  // Relaxation order when the full filter intersection is empty: campus size first
  // (least likely to be a hard dealbreaker), then budget, then location last (location
  // stays as long as possible since "Anywhere in U.S." is already the explicit escape
  // hatch for that dimension).
  const RELAXATION_PASSES: { context: (c: MatchContext) => MatchContext; notice: string | null }[] = [
    { context: (c) => c, notice: null },
    { context: (c) => ({ ...c, campusSize: null }), notice: 'campus size' },
    { context: (c) => ({ ...c, campusSize: null, maxBudget: null }), notice: 'campus size and budget' },
    { context: (c) => ({ ...c, campusSize: null, maxBudget: null, preferredLocations: [] }), notice: 'campus size, budget, and location' },
  ];

  const runMatching = async (context: MatchContext) => {
    setResultsLoading(true);
    setResultsError(null);
    setRelaxedNotice(null);

    // Debug: confirm the actual profile row driving this match (per user request, to
    // catch any save/read mismatch independent of the local component state).
    const { data: userDataForLog } = await supabase.auth.getUser();
    if (userDataForLog.user) {
      const { data: profileDebug } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userDataForLog.user.id)
        .maybeSingle();
      console.log('PROFILE DATA:', JSON.stringify(profileDebug));
    }

    const { data: schoolsSample, error: sampleError } = await supabase
      .from('schools')
      .select('name, region, state, tuition, enrollment_size')
      .limit(5);
    console.log('SCHOOLS SAMPLE:', JSON.stringify(schoolsSample));
    console.log('SCHOOLS ERROR:', sampleError);

    console.log('PREFERRED LOCATIONS:', context.preferredLocations);
    console.log('REGION FILTER:', resolveRegionFilter(context.preferredLocations));

    const savedIds = await getSavedSchoolIds();
    setSavedSchoolIds(savedIds);

    let schools: School[] = [];
    let fetchError: { message: string } | null = null;
    let appliedNotice: string | null = null;
    let successContext: MatchContext = context;

    for (const pass of RELAXATION_PASSES) {
      const passContext = pass.context(context);
      const { data, error } = await buildSchoolsQuery(passContext);

      console.log(
        `PASS (relaxed: ${pass.notice ?? 'none'}) — rows returned:`,
        data?.length ?? 0,
        error ? `ERROR: ${error.message}` : ''
      );

      if (error) {
        fetchError = error;
        break;
      }

      const eligible = ((data ?? []) as School[]).filter((school) => isSchoolEligible(school, passContext));

      if (eligible.length > 0) {
        schools = eligible;
        appliedNotice = pass.notice;
        successContext = passContext;
        break;
      }
    }

    setResultsLoading(false);

    if (fetchError) {
      setResultsError(fetchError.message);
      setResults([]);
    } else {
      setRelaxedNotice(appliedNotice);

      const matches = schools
        .map((school) => {
          const matchPercent = getSchoolMatchPercent(school, successContext);
          return {
            ...school,
            matchPercent,
            matchTier: getSchoolMatchTier(matchPercent),
            whyMatch: getWhyThisMatch(school, successContext),
          };
        })
        .sort((a, b) => b.matchPercent - a.matchPercent)
        .slice(0, 10);

      setResults(matches);
      loadAiExplanations(matches, successContext);
    }

    setSearchSaved(false);

    const today = new Date().toISOString().slice(0, 10);

    const { data: scholarships } = await supabase
      .from('scholarships')
      .select(
        'id, title, provider, amount, deadline, eligible_degree_levels, eligible_countries, eligible_majors, min_gpa, tags, financial_need_required'
      )
      .gte('deadline', today)
      .order('deadline', { ascending: true });

    const matchProfile = {
      degree_level: context.degreeLevel,
      field_of_study: context.major,
      country: context.country,
      gpa: context.gpaValue,
    };

    const recommended = (scholarships ?? [])
      .filter((scholarship) => isEligible(scholarship, matchProfile, today))
      .map((scholarship) => {
        const matchPercent = getMatchPercent(scholarship, matchProfile);
        return {
          id: scholarship.id as string,
          title: scholarship.title as string,
          provider: scholarship.provider as string,
          amount: scholarship.amount as string,
          deadline: scholarship.deadline as string,
          matchPercent,
          matchTier: getMatchTier(matchPercent),
          isDemographicMatch: matchesDemographic(scholarship, context.demographics),
        };
      })
      .sort((a, b) => {
        if (a.isDemographicMatch !== b.isDemographicMatch) return a.isDemographicMatch ? -1 : 1;
        return b.matchPercent - a.matchPercent;
      })
      .slice(0, 5);

    setRecommendedScholarships(recommended);
  };

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getUser().then(async ({ data: userData }) => {
      const user = userData.user;
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }

      if (savedSearchId) {
        const { data: search } = await supabase
          .from('saved_searches')
          .select('answers, results_count')
          .eq('id', savedSearchId)
          .maybeSingle();

        if (!cancelled && search?.answers) {
          const answers = search.answers as Record<string, unknown>;
          setCountry((answers.country as string) ?? null);
          setMajor((answers.major as string) ?? null);
          setGpaRange((answers.gpaRange as string) ?? null);
          setEnrollmentType((answers.enrollmentType as string) ?? null);
          setExtracurriculars((answers.extracurriculars as string) ?? '');
          setPreferredLocations((answers.preferredLocations as string[]) ?? []);
          setMaxBudget((answers.maxBudget as string) ?? null);
          setCampusSize((answers.campusSize as string) ?? null);
          setDemographics((answers.demographics as string[]) ?? []);
          setAdmissionTimeline((answers.admissionTimeline as string) ?? null);
          setHardConstraints((answers.hardConstraints as string) ?? '');
          setLoading(false);

          const savedEnrollmentType = (answers.enrollmentType as string) ?? null;
          const savedGpaRange = (answers.gpaRange as string) ?? null;

          await runMatching({
            major: (answers.major as string) ?? null,
            preferredLocations: (answers.preferredLocations as string[]) ?? [],
            maxBudget: (answers.maxBudget as string) ?? null,
            campusSize: (answers.campusSize as string) ?? null,
            demographics: (answers.demographics as string[]) ?? [],
            country: (answers.country as string) ?? null,
            gpaValue: savedGpaRange ? GPA_RANGE_VALUES[savedGpaRange] ?? null : null,
            degreeLevel: savedEnrollmentType ? ENROLLMENT_TYPE_DEGREE_LEVELS[savedEnrollmentType] ?? null : null,
          });
          return;
        }
      }

      const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();

      if (cancelled) return;

      if (data) {
        setCountry(data.country ?? null);
        setMajor(data.field_of_study ?? null);
        setGpaRange(data.gpa_range ?? null);
        setEnrollmentType(data.enrollment_type ?? null);
        setExtracurriculars(data.extracurriculars ?? '');
        setPreferredLocations(data.preferred_locations ?? []);
        setMaxBudget(data.max_budget ?? null);
        setCampusSize(data.campus_size ?? null);
        setDemographics(data.demographics ?? []);
        setAdmissionTimeline(data.admission_timeline ?? null);
        setHardConstraints(data.hard_constraints ?? '');
      }

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleDropdownSelect = (value: string) => {
    if (!activeDropdown) return;
    if (activeDropdown === 'major') setMajor(value);
    if (activeDropdown === 'gpa') setGpaRange(value);
    if (activeDropdown === 'enrollment') setEnrollmentType(value);
    if (activeDropdown === 'budget') setMaxBudget(value);
    if (activeDropdown === 'campus') setCampusSize(value);
    if (activeDropdown === 'timeline') setAdmissionTimeline(value);
    setActiveDropdown(null);
  };

  const validateStep = (current: number): string | null => {
    if (current === 1) {
      if (!major) return 'Please select your intended major.';
      if (!gpaRange) return 'Please select your current GPA.';
      if (!enrollmentType) return 'Please select your enrollment type.';
    }
    if (current === 2) {
      if (!extracurriculars.trim()) return 'Please describe your extracurriculars or talents.';
      if (preferredLocations.length === 0) return 'Please select at least one preferred location.';
      if (!maxBudget) return 'Please select your maximum annual budget.';
      if (!campusSize) return 'Please select your preferred campus size.';
    }
    if (current === 3) {
      if (!admissionTimeline) return 'Please select your preferred admission timeline.';
    }
    return null;
  };

  const handleNext = () => {
    const validationError = validateStep(step);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setStep((prev) => Math.min(prev + 1, 3));
  };

  const handlePrevious = () => {
    setError(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    const validationError = validateStep(3);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setSaving(false);
      setError('You must be signed in to save your profile.');
      return;
    }

    const degreeLevel = enrollmentType ? ENROLLMENT_TYPE_DEGREE_LEVELS[enrollmentType] : null;
    const gpaValue = gpaRange ? GPA_RANGE_VALUES[gpaRange] : null;

    const payload = {
      user_id: user.id,
      degree_level: degreeLevel,
      field_of_study: major,
      gpa: gpaValue,
      enrollment_type: enrollmentType,
      gpa_range: gpaRange,
      extracurriculars: extracurriculars.trim() || null,
      preferred_locations: preferredLocations,
      max_budget: maxBudget,
      campus_size: campusSize,
      demographics,
      admission_timeline: admissionTimeline,
      hard_constraints: hardConstraints.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let saveError;
    if (existing) {
      ({ error: saveError } = await supabase.from('profiles').update(payload).eq('user_id', user.id));
    } else {
      ({ error: saveError } = await supabase.from('profiles').insert(payload));

      if (saveError?.code === '23502' && saveError.message.includes('"id"')) {
        ({ error: saveError } = await supabase.from('profiles').insert({ ...payload, id: generateUuid() }));
      }
    }

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    await runMatching({
      major,
      preferredLocations,
      maxBudget,
      campusSize,
      demographics,
      country,
      gpaValue,
      degreeLevel,
    });
  };

  const handleSaveSearch = async () => {
    if (!results) return;
    setSavingSearch(true);

    const { error: saveSearchError } = await saveSearch(
      {
        country,
        major,
        gpaRange,
        enrollmentType,
        extracurriculars,
        preferredLocations,
        maxBudget,
        campusSize,
        demographics,
        admissionTimeline,
        hardConstraints,
      },
      results.length
    );

    setSavingSearch(false);

    if (saveSearchError) {
      setResultsError(saveSearchError);
      return;
    }

    setSearchSaved(true);
  };

  const handleToggleSavedSchool = async (schoolId: string) => {
    const nowSaved = await toggleSchoolSaved(schoolId);
    setSavedSchoolIds((prev) => {
      const next = new Set(prev);
      if (nowSaved) {
        next.add(schoolId);
      } else {
        next.delete(schoolId);
      }
      return next;
    });
  };

  const progressPercent = (step / 3) * 100;

  if (loading) {
    return (
      <GradientBackground>
        <ActivityIndicator color={theme.textSecondary} style={styles.stateIndicator} />
      </GradientBackground>
    );
  }

  if (results) {
    return (
      <GradientBackground>
        <View style={styles.container}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.backButtonText}>‹ Back</Text>
          </Pressable>

          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.greeting}>Smart Matching</Text>
            <Text style={styles.heading}>Your Matches</Text>

            <TouchableOpacity
              style={[styles.secondaryButton, (savingSearch || searchSaved) && styles.buttonDisabled]}
              onPress={handleSaveSearch}
              disabled={savingSearch || searchSaved}
              activeOpacity={0.8}
            >
              {savingSearch ? (
                <ActivityIndicator color={theme.textPrimary} />
              ) : (
                <Text style={styles.secondaryButtonText}>
                  {searchSaved ? '✓ Search Saved' : 'Save This Search'}
                </Text>
              )}
            </TouchableOpacity>

            {resultsLoading && <ActivityIndicator color={theme.textSecondary} style={styles.stateIndicator} />}

            {!resultsLoading && resultsError && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>⚠️ Couldn't load matches</Text>
                <Text style={styles.cardBody}>{resultsError}</Text>
              </View>
            )}

            {!resultsLoading && !resultsError && relaxedNotice && results.length > 0 && (
              <View style={styles.noticeCard}>
                <Text style={styles.noticeText}>
                  No exact matches for your {relaxedNotice} preference{relaxedNotice.includes(' and ') ? 's' : ''}, so
                  we widened the search to show these instead.
                </Text>
              </View>
            )}

            {!resultsLoading && !resultsError && results.length === 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>No matches yet</Text>
                <Text style={styles.cardBody}>
                  We couldn't find any schools matching your answers right now, even after widening the search.
                  Check back soon as we add more schools.
                </Text>
              </View>
            )}

            {!resultsLoading &&
              !resultsError &&
              results.map((item) => {
                const isExpanded = expandedSchoolId === item.id;
                const schoolScholarships = item.scholarships ?? [];
                const isSaved = savedSchoolIds.has(item.id);

                return (
                  <View key={item.id} style={styles.resultCard}>
                    <View style={styles.schoolTopRow}>
                      <Text style={styles.resultTitle}>{item.name}</Text>
                      <TouchableOpacity
                        onPress={() => handleToggleSavedSchool(item.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.bookmarkIcon}>{isSaved ? '★' : '☆'}</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.resultOrg}>{item.location}</Text>

                    <View style={styles.resultMeta}>
                      {item.tuition != null && (
                        <View style={styles.metaPill}>
                          <Text style={styles.metaPillText}>${Math.round(item.tuition).toLocaleString()}/yr</Text>
                        </View>
                      )}
                      {item.matchTier && (
                        <View style={[styles.metaPill, styles.matchPill]}>
                          <Text style={[styles.metaPillText, styles.matchPillText]}>{item.matchTier}</Text>
                        </View>
                      )}
                      <Text style={styles.resultDeadline}>{item.matchPercent}% match</Text>
                    </View>

                    {item.whyMatch.length > 0 && (
                      <View style={styles.whyMatchBox}>
                        <Text style={styles.whyMatchTitle}>Why this match</Text>
                        {item.whyMatch.map((reason) => (
                          <Text key={reason} style={styles.whyMatchBullet}>
                            • {reason}
                          </Text>
                        ))}
                      </View>
                    )}

                    <View style={styles.aiExplanationBox}>
                      <Text style={styles.aiExplanationTitle}>✨ Rhetor's Take</Text>
                      {aiExplanationsLoading.has(item.id) ? (
                        <ActivityIndicator color={theme.textSecondary} size="small" style={styles.aiExplanationLoading} />
                      ) : (
                        <Text style={styles.aiExplanationText}>
                          {aiExplanations[item.id] ?? 'Personalized insight unavailable right now.'}
                        </Text>
                      )}
                    </View>

                    <TouchableOpacity
                      style={styles.expandRow}
                      onPress={() => setExpandedSchoolId(isExpanded ? null : item.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.expandRowText}>
                        Available Scholarships ({schoolScholarships.length})
                      </Text>
                      <Text style={styles.expandRowChevron}>{isExpanded ? '⌃' : '⌄'}</Text>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.scholarshipList}>
                        {schoolScholarships.length === 0 && (
                          <Text style={styles.cardBody}>No school-specific scholarships listed yet.</Text>
                        )}
                        {schoolScholarships.map((scholarship, index) => (
                          <View key={`${item.id}-${index}`} style={styles.scholarshipRow}>
                            <Text style={styles.scholarshipName}>{scholarship.name ?? 'Scholarship'}</Text>
                            <View style={styles.scholarshipMetaRow}>
                              {scholarship.amount && (
                                <Text style={styles.scholarshipMeta}>{scholarship.amount}</Text>
                              )}
                              {scholarship.deadline && (
                                <Text style={styles.scholarshipMeta}>Due {scholarship.deadline}</Text>
                              )}
                            </View>
                          </View>
                        ))}
                        <TouchableOpacity onPress={() => router.push('/search')} activeOpacity={0.8}>
                          <Text style={styles.viewAllLink}>View All Scholarships ›</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}

            {!resultsLoading && !resultsError && recommendedScholarships.length > 0 && (
              <>
                <Text style={styles.resultsSectionTitle}>Recommended Scholarships For You</Text>
                {recommendedScholarships.map((scholarship) => (
                  <Pressable
                    key={scholarship.id}
                    style={styles.resultCard}
                    onPress={() => router.push({ pathname: '/scholarship/[id]', params: { id: scholarship.id } })}
                  >
                    <Text style={styles.resultTitle}>{scholarship.title}</Text>
                    <Text style={styles.resultOrg}>{scholarship.provider}</Text>
                    <View style={styles.resultMeta}>
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText}>{scholarship.amount}</Text>
                      </View>
                      {scholarship.matchTier && (
                        <View style={[styles.metaPill, styles.matchPill]}>
                          <Text style={[styles.metaPillText, styles.matchPillText]}>{scholarship.matchTier}</Text>
                        </View>
                      )}
                      <Text style={styles.resultDeadline}>Due {formatScholarshipDeadline(scholarship.deadline)}</Text>
                    </View>
                  </Pressable>
                ))}
              </>
            )}

            <TouchableOpacity style={styles.button} onPress={() => router.back()} activeOpacity={0.8}>
              <Text style={styles.buttonText}>Done</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <View style={styles.container}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </Pressable>

        <KeyboardAvoidingView
          style={styles.flexFill}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.greeting}>Smart Matching</Text>
            <Text style={styles.heading}>Help Us Find Your Matches</Text>

            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Step {step} of 3</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>

            {step === 1 && (
              <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Academic Information</Text>

                  <DropdownField
                    label="Intended Major / Program of Study"
                    value={major}
                    placeholder="Select a major"
                    onPress={() => setActiveDropdown('major')}
                  />

                  <DropdownField
                    label="Current GPA"
                    value={gpaRange}
                    placeholder="Select your GPA range"
                    onPress={() => setActiveDropdown('gpa')}
                  />

                  <DropdownField
                    label="Enrollment Type"
                    value={enrollmentType}
                    placeholder="Select enrollment type"
                    onPress={() => setActiveDropdown('enrollment')}
                  />
                </View>
              </TouchableWithoutFeedback>
            )}

            {step === 2 && (
              <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Preferences & Activities</Text>

                  <View style={styles.field}>
                    <Text style={styles.label}>Extracurricular Activities & Special Talents</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="e.g. Varsity soccer captain, robotics club, volunteer tutoring"
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      value={extracurriculars}
                      onChangeText={setExtracurriculars}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      returnKeyType="done"
                      onSubmitEditing={() => Keyboard.dismiss()}
                      inputAccessoryViewID={Platform.OS === 'ios' ? DONE_TOOLBAR_ID : undefined}
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Preferred U.S. Locations</Text>
                    {LOCATIONS.map((location) => (
                      <CheckRow
                        key={location}
                        label={location}
                        checked={preferredLocations.includes(location)}
                        onPress={() => setPreferredLocations((prev) => toggleInArray(prev, location))}
                      />
                    ))}
                  </View>

                  <DropdownField
                    label="Maximum Annual Budget"
                    value={maxBudget}
                    placeholder="Select your budget"
                    onPress={() => setActiveDropdown('budget')}
                  />

                  <DropdownField
                    label="Preferred Campus Size"
                    value={campusSize}
                    placeholder="Select a campus size"
                    onPress={() => setActiveDropdown('campus')}
                  />
                </View>
              </TouchableWithoutFeedback>
            )}

            {step === 3 && (
              <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Final Details</Text>

                  <View style={styles.field}>
                    <Text style={styles.label}>Demographic Information (optional)</Text>
                    {DEMOGRAPHICS.map((item) => (
                      <CheckRow
                        key={item}
                        label={item}
                        checked={demographics.includes(item)}
                        onPress={() => setDemographics((prev) => toggleInArray(prev, item))}
                      />
                    ))}
                  </View>

                  <DropdownField
                    label="Preferred Admission Timeline"
                    value={admissionTimeline}
                    placeholder="Select a timeline"
                    onPress={() => setActiveDropdown('timeline')}
                  />

                  <View style={styles.field}>
                    <Text style={styles.label}>Any Hard Constraints (optional)</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="e.g. Must stay within driving distance of home"
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      value={hardConstraints}
                      onChangeText={setHardConstraints}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      returnKeyType="done"
                      onSubmitEditing={() => Keyboard.dismiss()}
                      inputAccessoryViewID={Platform.OS === 'ios' ? DONE_TOOLBAR_ID : undefined}
                    />
                  </View>
                </View>
              </TouchableWithoutFeedback>
            )}

            {error && (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            )}

            <View style={styles.navRow}>
              {step > 1 && (
                <TouchableOpacity style={styles.secondaryButton} onPress={handlePrevious} activeOpacity={0.8}>
                  <Text style={styles.secondaryButtonText}>Previous</Text>
                </TouchableOpacity>
              )}

              {step < 3 ? (
                <TouchableOpacity style={styles.button} onPress={handleNext} activeOpacity={0.8}>
                  <Text style={styles.buttonText}>Next</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.button, saving && styles.buttonDisabled]}
                  onPress={handleSubmit}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  {saving ? (
                    <ActivityIndicator color={theme.accentText} />
                  ) : (
                    <Text style={styles.buttonText}>Generate My Matches</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={DONE_TOOLBAR_ID}>
          <View style={styles.accessoryToolbar}>
            <TouchableOpacity onPress={() => Keyboard.dismiss()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.accessoryDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}

      <Modal visible={!!activeDropdown} animationType="fade" transparent onRequestClose={() => setActiveDropdown(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setActiveDropdown(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{activeDropdown ? DROPDOWN_TITLES[activeDropdown] : ''}</Text>
            <ScrollView style={styles.modalList}>
              {activeDropdown === 'major'
                ? MAJOR_GROUPS.map((group) => (
                    <View key={group.category}>
                      <Text style={styles.modalGroupHeader}>{group.category}</Text>
                      {group.options.map((option) => (
                        <TouchableOpacity
                          key={option}
                          style={styles.modalOption}
                          onPress={() => handleDropdownSelect(option)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.modalOptionText}>{option}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))
                : activeDropdown &&
                  DROPDOWN_OPTIONS[activeDropdown].map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={styles.modalOption}
                      onPress={() => handleDropdownSelect(option)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.modalOptionText}>{option}</Text>
                    </TouchableOpacity>
                  ))}
            </ScrollView>
            <Pressable style={styles.cancelButton} onPress={() => setActiveDropdown(null)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flexFill: {
    flex: 1,
  },
  accessoryToolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0A2463',
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  accessoryDoneText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.accent,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 4,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  stateIndicator: {
    marginTop: 200,
  },
  content: {
    paddingHorizontal: 24,
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
    marginBottom: 20,
  },
  progressHeader: {
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    marginBottom: 28,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: theme.accent,
  },
  stepContent: {
    marginBottom: 8,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 20,
  },
  field: {
    marginBottom: 20,
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
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  dropdownInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropdownValue: {
    fontSize: 16,
    color: theme.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  dropdownPlaceholder: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  dropdownChevron: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
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
    color: theme.textPrimary,
    fontSize: 15,
    fontWeight: '500',
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
  navRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    backgroundColor: theme.accent,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: theme.accentText,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: theme.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxHeight: '70%',
    backgroundColor: '#0A2463',
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 12,
  },
  modalList: {
    marginBottom: 8,
  },
  modalGroupHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 4,
  },
  modalOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalOptionText: {
    fontSize: 15,
    color: theme.textPrimary,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  cancelButtonText: {
    color: theme.textSecondary,
    fontSize: 15,
    fontWeight: '600',
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
  whyMatchBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  whyMatchTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  whyMatchBullet: {
    fontSize: 13,
    color: theme.textPrimary,
    lineHeight: 19,
  },
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  expandRowText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  expandRowChevron: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  scholarshipList: {
    marginTop: 10,
  },
  scholarshipRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  scholarshipName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  scholarshipMetaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  scholarshipMeta: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  viewAllLink: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.accent,
    marginTop: 10,
  },
  aiExplanationBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  aiExplanationTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.accent,
    marginBottom: 6,
  },
  aiExplanationLoading: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  aiExplanationText: {
    fontSize: 13,
    color: theme.textPrimary,
    lineHeight: 19,
  },
  noticeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.accent,
    padding: 14,
    marginBottom: 16,
  },
  noticeText: {
    fontSize: 13,
    color: theme.textPrimary,
    lineHeight: 19,
  },
  resultsSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 12,
  },
});
