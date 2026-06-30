export type School = {
  id: string;
  name: string;
  website: string | null;
  tuition: number | null;
  acceptance_rate: string | null;
  difficulty: string | null;
  scholarships: { name?: string; amount?: string; deadline?: string; eligibility?: string }[] | null;
  details: { campus_size?: string; description?: string; student_body?: number } | null;
  location: string | null;
  ranking: string | null;
  programs: string[] | null;
  state: string | null;
  region: string | null;
  enrollment_size: number | null;
};

export type MatchAnswers = {
  major: string | null;
  preferredLocations: string[];
  maxBudget: string | null;
  campusSize: string | null;
  demographics: string[];
};

export const REGIONS = [
  'Northeast',
  'Southeast',
  'Midwest',
  'Southwest',
  'West Coast',
  'Mountain West',
  'Hawaii, Alaska & Territories',
] as const;

export const BUDGET_CEILINGS: Record<string, number> = {
  'Under $20k': 20000,
  '$20k-$30k': 30000,
  '$30k-$50k': 50000,
  '$50k-$75k': 75000,
  'Over $75k': Infinity,
  'No limit': Infinity,
};

export const CAMPUS_SIZE_RANGES: Record<string, [number, number]> = {
  'Small <5k': [0, 5000],
  'Medium 5k-15k': [5000, 15000],
  'Large 15k-30k': [15000, 30000],
  'Very Large 30k+': [30000, Infinity],
};

export const MAJOR_GROUPS: { category: string; options: string[] }[] = [
  {
    category: 'Undergraduate',
    options: [
      'Undecided',
      'Liberal Arts & Humanities',
      'Business Administration',
      'Computer Science',
      'Engineering',
      'Biology / Life Sciences',
      'Chemistry',
      'Physics',
      'Mathematics',
      'Psychology',
      'Sociology / Anthropology',
      'Political Science',
      'Economics',
      'History',
      'Pre-Law',
      'Pre-Med',
      'English / Literature',
      'Communications / Journalism',
      'Education',
      'Nursing (BSN)',
      'Kinesiology / Exercise Science',
      'Environmental Science',
      'Criminal Justice',
      'Social Work',
      'Fine Arts',
      'Music',
      'Film & Media',
      'Architecture',
      'Fashion Design',
      'Culinary Arts',
    ],
  },
  {
    category: 'Graduate & Professional',
    options: [
      'MBA (Business)',
      'MS Computer Science',
      'MS Data Science / AI',
      'MS Engineering',
      'MA Education',
      'MA Psychology / Counseling',
      'MSW (Social Work)',
      'MPH (Public Health)',
      'MFA (Fine Arts / Film / Writing)',
      'Master of Architecture',
    ],
  },
  {
    category: 'Doctoral',
    options: [
      'PhD Computer Science',
      'PhD Engineering',
      'PhD Psychology',
      'PhD Education',
      'PhD Economics',
      'PhD Biology / Sciences',
      'PhD Political Science',
    ],
  },
  {
    category: 'Law',
    options: ['Law / JD', 'LLM (Master of Laws)'],
  },
  {
    category: 'Medical & Health',
    options: [
      'MD / DO',
      'PA Studies (Physician Assistant)',
      'DNP / MSN (Nurse Practitioner)',
      'Pharmacy (PharmD)',
      'Dentistry (DDS/DMD)',
      'Veterinary Medicine (DVM)',
      'Optometry (OD)',
      'Physical Therapy (DPT)',
      'Occupational Therapy (OTD)',
      'Public Health (MPH)',
    ],
  },
  {
    category: 'Theology & Ministry',
    options: ['Divinity / Theology (MDiv)', 'Seminary / Ministry'],
  },
  {
    category: 'Military',
    options: ['Military Science / ROTC'],
  },
];

/**
 * Explicit major → school.programs tag mapping. Built directly against the real
 * tags currently produced by scripts/seed-schools.js and the original hand-seeded
 * rows (Law, Business, Medicine, Medicine/Health, Education, Computer Science,
 * Engineering, Arts, Music, Film & Media, Architecture, Doctoral/PhD, Culinary Arts,
 * Fashion & Design, Military Science, Social Sciences, Economics, Biology, Sciences,
 * Natural Sciences, Mathematics, Physics, Journalism, Liberal Arts).
 *
 * Nursing, Pharmacy, Dentistry, Veterinary Medicine, Social Work, Public Health, and
 * Theology are mapped per spec even though no school currently carries those tags —
 * harmless since program match is a soft score, never a hard filter, but it means
 * those majors won't get the +25 field-of-study boost until schools get tagged with
 * them specifically.
 */
const MAJOR_PROGRAM_TAGS: Record<string, string[]> = {
  'Undecided': [],
  'Liberal Arts & Humanities': ['Liberal Arts'],
  'Business Administration': ['Business'],
  'Computer Science': ['Computer Science'],
  'Engineering': ['Engineering'],
  'Biology / Life Sciences': ['Biology', 'Sciences', 'Natural Sciences'],
  'Chemistry': ['Sciences', 'Natural Sciences'],
  'Physics': ['Physics'],
  'Mathematics': ['Mathematics'],
  'Psychology': ['Social Sciences'],
  'Sociology / Anthropology': ['Social Sciences'],
  'Political Science': ['Social Sciences'],
  'Economics': ['Economics', 'Social Sciences'],
  'History': ['Liberal Arts', 'Social Sciences'],
  // Pre-Law/Pre-Med are undergraduate prep majors — deliberately NOT mapped to
  // 'Law' or 'Medicine'. Those tags (and the professional-school name/community-
  // college filter in passesProfessionalProgramFilter) are reserved for the actual
  // graduate-level "Law / JD" and "MD / DO" majors below, so a pre-law freshman
  // doesn't get hard-filtered down to only schools with law schools attached.
  'Pre-Law': ['Social Sciences', 'Liberal Arts'],
  'Pre-Med': ['Biology', 'Sciences', 'Natural Sciences'],
  'English / Literature': ['Liberal Arts'],
  'Communications / Journalism': ['Journalism', 'Liberal Arts'],
  'Education': ['Education'],
  'Nursing (BSN)': ['Nursing', 'Medicine/Health'],
  'Kinesiology / Exercise Science': ['Medicine/Health'],
  'Environmental Science': ['Sciences', 'Natural Sciences'],
  'Criminal Justice': ['Social Sciences'],
  'Social Work': ['Social Work'],
  'Fine Arts': ['Arts'],
  'Music': ['Music'],
  'Film & Media': ['Film & Media'],
  'Architecture': ['Architecture'],
  'Fashion Design': ['Fashion & Design'],
  'Culinary Arts': ['Culinary Arts'],

  'MBA (Business)': ['Business'],
  'MS Computer Science': ['Computer Science'],
  'MS Data Science / AI': ['Computer Science'],
  'MS Engineering': ['Engineering'],
  'MA Education': ['Education'],
  'MA Psychology / Counseling': ['Social Sciences'],
  'MSW (Social Work)': ['Social Work'],
  'MPH (Public Health)': ['Public Health', 'Medicine/Health'],
  'MFA (Fine Arts / Film / Writing)': ['Arts', 'Film & Media'],
  'Master of Architecture': ['Architecture'],

  'PhD Computer Science': ['Doctoral/PhD', 'Computer Science'],
  'PhD Engineering': ['Doctoral/PhD', 'Engineering'],
  'PhD Psychology': ['Doctoral/PhD', 'Social Sciences'],
  'PhD Education': ['Doctoral/PhD', 'Education'],
  'PhD Economics': ['Doctoral/PhD', 'Economics', 'Social Sciences'],
  'PhD Biology / Sciences': ['Doctoral/PhD', 'Biology', 'Sciences'],
  'PhD Political Science': ['Doctoral/PhD', 'Social Sciences'],

  'Law / JD': ['Law'],
  'LLM (Master of Laws)': ['Law'],

  'MD / DO': ['Medicine', 'Medicine/Health'],
  'PA Studies (Physician Assistant)': ['Medicine', 'Medicine/Health'],
  'DNP / MSN (Nurse Practitioner)': ['Nursing', 'Medicine/Health'],
  'Pharmacy (PharmD)': ['Pharmacy', 'Medicine/Health'],
  'Dentistry (DDS/DMD)': ['Dentistry', 'Medicine/Health'],
  'Veterinary Medicine (DVM)': ['Veterinary Medicine'],
  'Optometry (OD)': ['Medicine/Health'],
  'Physical Therapy (DPT)': ['Medicine/Health'],
  'Occupational Therapy (OTD)': ['Medicine/Health'],
  'Public Health (MPH)': ['Public Health', 'Medicine/Health'],

  'Divinity / Theology (MDiv)': ['Theology'],
  'Seminary / Ministry': ['Theology'],

  'Military Science / ROTC': ['Military Science'],
};

function getMajorProgramTags(major: string | null): string[] {
  if (!major) return [];
  return MAJOR_PROGRAM_TAGS[major] ?? [];
}

const DEMOGRAPHIC_KEYWORDS: Record<string, string[]> = {
  'First-generation': ['first-generation', 'first generation'],
  'Low-income background': ['low-income', 'low income', 'need-based', 'need based'],
  'Veteran/military family': ['veteran', 'military'],
  'Underrepresented minority': [
    'minority', 'underrepresented', 'diversity', 'hispanic', 'latino',
    'african-american', 'african american', 'native american', 'indigenous',
  ],
  'International student': ['international'],
  'Student with disabilities': ['disability', 'disabilities', 'accessible'],
  'Community volunteer/service': ['community service', 'volunteer', 'civic', 'public service'],
};

/** Resolves the user's preferred-location answers to actual `region` column values for a hard `.in()` filter. */
export function resolveRegionFilter(preferredLocations: string[]): string[] | null {
  if (preferredLocations.length === 0 || preferredLocations.includes('Anywhere in U.S.')) return null;
  return preferredLocations.filter((loc): loc is (typeof REGIONS)[number] => (REGIONS as readonly string[]).includes(loc));
}

function programMatchesMajor(programs: string[] | null, major: string | null): boolean {
  const tags = getMajorProgramTags(major);
  if (tags.length === 0 || !programs || programs.length === 0) return false;
  return programs.some((program) => tags.includes(program));
}

function getMatchedProgramTag(programs: string[] | null, major: string | null): string | null {
  const tags = getMajorProgramTags(major);
  if (tags.length === 0 || !programs) return null;
  return programs.find((program) => tags.includes(program)) ?? null;
}

function locationMatches(school: School, preferredLocations: string[]): boolean {
  const regions = resolveRegionFilter(preferredLocations);
  if (regions == null) return true;
  return !!school.region && regions.includes(school.region);
}

function withinBudget(school: School, maxBudget: string | null): boolean {
  if (!maxBudget) return true;
  const ceiling = BUDGET_CEILINGS[maxBudget] ?? Infinity;
  return school.tuition == null || school.tuition <= ceiling;
}

function campusSizeMatches(school: School, campusSize: string | null): boolean {
  if (!campusSize || campusSize === 'No preference') return true;
  const range = CAMPUS_SIZE_RANGES[campusSize];
  if (!range || school.enrollment_size == null) return false;
  return school.enrollment_size >= range[0] && school.enrollment_size < range[1];
}

const COMMUNITY_OR_TECHNICAL_COLLEGE_PATTERN = /(community college|technical college)/i;
const LAW_SCHOOL_NAME_PATTERN = /(school of law|college of law|law school|law center)/i;
const MEDICAL_SCHOOL_NAME_PATTERN = /(school of medicine|college of medicine|medical college|osteopathic)/i;

function isCommunityOrTechnicalCollege(school: School): boolean {
  return COMMUNITY_OR_TECHNICAL_COLLEGE_PATTERN.test(school.name);
}

function isLawSchool(school: School): boolean {
  return (school.programs ?? []).includes('Law') || LAW_SCHOOL_NAME_PATTERN.test(school.name);
}

function isMedicalSchool(school: School): boolean {
  const programs = school.programs ?? [];
  return programs.includes('Medicine') || programs.includes('Medicine/Health') || MEDICAL_SCHOOL_NAME_PATTERN.test(school.name);
}

/**
 * "Law / JD" and "MD / DO" mean the student is applying TO a professional school
 * right now, not preparing for one someday — so unlike every other major, these
 * two are a hard filter: only real law/medical schools survive, and community or
 * technical colleges are excluded outright. "Pre-Law" and "Pre-Med" are deliberately
 * NOT covered here — those students are undergrads, and any accredited university
 * is a valid match (scored softly via Social Sciences/Biology tags instead).
 */
function passesProfessionalProgramFilter(school: School, major: string | null): boolean {
  if (major === 'Law / JD') {
    return isLawSchool(school) && !isCommunityOrTechnicalCollege(school);
  }
  if (major === 'MD / DO') {
    return isMedicalSchool(school) && !isCommunityOrTechnicalCollege(school);
  }
  return true;
}

function getDemographicsSignal(school: School, demographics: string[]): number {
  if (demographics.length === 0) return 5;

  const eligibilityText = (school.scholarships ?? [])
    .map((s) => s.eligibility ?? '')
    .join(' ')
    .toLowerCase();

  const hasMatch = demographics.some((demo) =>
    (DEMOGRAPHIC_KEYWORDS[demo] ?? []).some((keyword) => eligibilityText.includes(keyword))
  );

  return hasMatch ? 10 : 2;
}

/**
 * Hard filter — location, budget, and campus size are exclusionary, not scored.
 * A school that fails any of these should never appear in results, regardless of
 * how well it scores on field of study or demographics. This is also applied
 * client-side as a safety net even though the same filters are pushed into the
 * Supabase query itself (region .in(), tuition .lte(), enrollment_size range).
 */
export function isSchoolEligible(school: School, answers: MatchAnswers): boolean {
  return (
    locationMatches(school, answers.preferredLocations) &&
    withinBudget(school, answers.maxBudget) &&
    campusSizeMatches(school, answers.campusSize) &&
    passesProfessionalProgramFilter(school, answers.major)
  );
}

export const MAX_SCHOOL_MATCH_SCORE = 100;

/**
 * Scoring only applies to schools that already passed isSchoolEligible, so
 * location (30) + budget (20) + campus size (15) are constant for every
 * candidate here — they're guaranteed by the hard filter. The remaining 35
 * points (field of study 25, demographics/diversity 10) are where match
 * quality actually varies between eligible schools.
 */
export function computeSchoolMatchScore(school: School, answers: MatchAnswers): number {
  let score = 30 + 20 + 15;

  if (programMatchesMajor(school.programs, answers.major)) {
    score += 25;
  } else if (!school.programs || school.programs.length === 0 || !answers.major) {
    score += 10;
  } else {
    score += 5;
  }

  score += getDemographicsSignal(school, answers.demographics);

  return score;
}

export function getSchoolMatchPercent(school: School, answers: MatchAnswers): number {
  return Math.round((computeSchoolMatchScore(school, answers) / MAX_SCHOOL_MATCH_SCORE) * 100);
}

export function getSchoolMatchTier(matchPercent: number): string | null {
  if (matchPercent >= 80) return 'Strong Match';
  if (matchPercent >= 60) return 'Good Match';
  if (matchPercent >= 40) return 'Consider';
  return null;
}

export function getWhyThisMatch(school: School, answers: MatchAnswers): string[] {
  const reasons: string[] = [];

  const matchedProgram = getMatchedProgramTag(school.programs, answers.major);
  if (matchedProgram) {
    reasons.push(`Offers ${matchedProgram} program`);
  } else if (answers.major === 'Law / JD' && isLawSchool(school)) {
    reasons.push('Accredited law school');
  } else if (answers.major === 'MD / DO' && isMedicalSchool(school)) {
    reasons.push('Accredited medical school');
  }

  if (answers.preferredLocations.length > 0) {
    if (answers.preferredLocations.includes('Anywhere in U.S.')) {
      reasons.push(`Located in ${school.region ?? school.location ?? 'the U.S.'}`);
    } else if (school.region) {
      reasons.push(`Located in ${school.region}`);
    }
  }

  if (answers.maxBudget && school.tuition != null) {
    reasons.push('Within your budget range');
  }

  if (answers.campusSize && answers.campusSize !== 'No preference') {
    reasons.push('Matches your preferred campus size');
  }

  if (getDemographicsSignal(school, answers.demographics) === 10) {
    reasons.push('Offers scholarships for your background');
  }

  return reasons.slice(0, 3);
}
