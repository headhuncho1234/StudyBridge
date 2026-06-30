export type MatchableScholarship = {
  id: string;
  deadline: string;
  eligible_degree_levels: string[] | null;
  eligible_countries: string[] | null;
  eligible_majors: string[] | null;
  min_gpa: number | null;
};

export type MatchableProfile = {
  degree_level: string | null;
  field_of_study: string | null;
  country: string | null;
  gpa: number | null;
};

export const OPEN_COUNTRY_TOKENS = [
  'all',
  'all countries',
  'any',
  'any country',
  'international',
  'worldwide',
  'united states',
];
export const OPEN_MAJOR_TOKENS = ['all majors', 'all', 'any major', 'any'];

export const MAX_MATCH_SCORE = 100;

export function isEligible(scholarship: MatchableScholarship, profile: MatchableProfile, today: string): boolean {
  if (scholarship.deadline < today) return false;

  const countries = (scholarship.eligible_countries ?? []).map((c) => c.toLowerCase().trim());
  if (countries.length > 0) {
    const studentCountry = profile.country?.toLowerCase().trim();
    const isOpen = countries.some((c) => OPEN_COUNTRY_TOKENS.includes(c));
    const matchesStudent = !!studentCountry && countries.includes(studentCountry);
    if (!isOpen && !matchesStudent) return false;
  }

  const degreeLevels = (scholarship.eligible_degree_levels ?? []).map((d) => d.toLowerCase().trim());
  if (degreeLevels.length > 0) {
    const studentDegree = profile.degree_level?.toLowerCase().trim();
    if (!studentDegree || !degreeLevels.includes(studentDegree)) return false;
  }

  if (scholarship.min_gpa != null && profile.gpa != null && profile.gpa < scholarship.min_gpa) {
    return false;
  }

  return true;
}

export function fieldsMatch(major: string, fieldOfStudy: string): boolean {
  return major === fieldOfStudy || major.includes(fieldOfStudy) || fieldOfStudy.includes(major);
}

export function computeMatchScore(scholarship: MatchableScholarship, profile: MatchableProfile): number {
  let score = 0;

  const majors = (scholarship.eligible_majors ?? []).map((m) => m.toLowerCase().trim());
  const fieldOfStudy = profile.field_of_study?.toLowerCase().trim();
  if (majors.length === 0 || majors.some((m) => OPEN_MAJOR_TOKENS.includes(m))) {
    score += 15;
  } else if (!!fieldOfStudy && majors.some((m) => fieldsMatch(m, fieldOfStudy))) {
    score += 40;
  }

  const countries = (scholarship.eligible_countries ?? []).map((c) => c.toLowerCase().trim());
  const studentCountry = profile.country?.toLowerCase().trim();
  score += countries.length > 0 && !!studentCountry && countries.includes(studentCountry) ? 25 : 10;

  const degreeLevels = scholarship.eligible_degree_levels ?? [];
  score += degreeLevels.length > 0 ? 20 : 8;

  score += scholarship.min_gpa != null ? 15 : 5;

  return score;
}

export function getMatchPercent(scholarship: MatchableScholarship, profile: MatchableProfile): number {
  return Math.round((computeMatchScore(scholarship, profile) / MAX_MATCH_SCORE) * 100);
}

export function getMatchTier(matchPercent: number): string | null {
  if (matchPercent >= 85) return 'Excellent match';
  if (matchPercent >= 65) return 'Strong match';
  if (matchPercent >= 40) return 'Good match';
  return null;
}

const DEMOGRAPHIC_TAGS: Record<string, string[]> = {
  'First-generation': ['first-generation'],
  'Low-income background': ['low-income', 'need-based'],
  'Veteran/military family': ['veteran', 'military'],
  'Underrepresented minority': [
    'minority', 'underrepresented', 'diversity', 'hispanic', 'latino',
    'african-american', 'native-american', 'indigenous', 'asian-american',
    'pacific-islander', 'hbcu', 'tribal',
  ],
  'International student': ['international'],
  'Student with disabilities': ['accessible', 'ada'],
  'Community volunteer/service': ['community-service', 'civic', 'service', 'public-service', 'community'],
};

export type DemographicTaggedScholarship = {
  tags: string[] | null;
  financial_need_required: boolean | null;
};

/** Soft signal, not a hard filter — used to prioritize scholarships relevant to the student's background. */
export function matchesDemographic(scholarship: DemographicTaggedScholarship, demographics: string[]): boolean {
  if (demographics.length === 0) return false;

  const tags = (scholarship.tags ?? []).map((t) => t.toLowerCase());

  return demographics.some((demo) => {
    if (demo === 'Low-income background' && scholarship.financial_need_required) return true;
    return (DEMOGRAPHIC_TAGS[demo] ?? []).some((tag) => tags.includes(tag));
  });
}
