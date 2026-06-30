// One-time seeding script: pulls all US colleges from the College Scorecard API
// and upserts them into the Supabase `schools` table.
//
// Run with:
//   node scripts/seed-schools.js
//
// Requires in .env:
//   EXPO_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   (bulk insert needs to bypass RLS — the anon key won't have INSERT/UPDATE grants)
//   EXPO_PUBLIC_SCORECARD_KEY

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SCORECARD_KEY = process.env.EXPO_PUBLIC_SCORECARD_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SCORECARD_KEY) {
  console.error(
    'Missing required env vars. Need EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and EXPO_PUBLIC_SCORECARD_KEY in .env.'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const SCORECARD_BASE = 'https://api.data.gov/ed/collegescorecard/v1/schools';
const PER_PAGE = 100;

const FIELDS = [
  'id',
  'school.name',
  'school.city',
  'school.state',
  'school.school_url',
  'latest.cost.tuition.in_state',
  'latest.cost.tuition.out_of_state',
  'latest.student.size',
  'latest.admissions.admission_rate.overall',
  'latest.academics.program_percentage',
  'school.degrees_awarded.predominant',
].join(',');

const STATE_TO_REGION = {
  // West Coast
  CA: 'West Coast', WA: 'West Coast', OR: 'West Coast',
  // Mountain West
  CO: 'Mountain West', UT: 'Mountain West', ID: 'Mountain West', MT: 'Mountain West', WY: 'Mountain West', NV: 'Mountain West',
  // Southwest
  TX: 'Southwest', AZ: 'Southwest', NM: 'Southwest', OK: 'Southwest',
  // Midwest
  IL: 'Midwest', MI: 'Midwest', OH: 'Midwest', IN: 'Midwest', WI: 'Midwest',
  MN: 'Midwest', IA: 'Midwest', MO: 'Midwest', KS: 'Midwest', NE: 'Midwest', ND: 'Midwest', SD: 'Midwest',
  // Southeast
  FL: 'Southeast', GA: 'Southeast', NC: 'Southeast', SC: 'Southeast', VA: 'Southeast',
  TN: 'Southeast', AL: 'Southeast', MS: 'Southeast', AR: 'Southeast', LA: 'Southeast', WV: 'Southeast', KY: 'Southeast',
  // Northeast
  NY: 'Northeast', MA: 'Northeast', CT: 'Northeast', NH: 'Northeast', VT: 'Northeast', ME: 'Northeast',
  RI: 'Northeast', PA: 'Northeast', NJ: 'Northeast', MD: 'Northeast', DE: 'Northeast', DC: 'Northeast',
  // Hawaii, Alaska & Territories — non-contiguous states plus US territories /
  // freely-associated states that Scorecard includes (confirmed via live query:
  // PR, HI, AK, GU, AS, FM, PW, MH, MP, VI).
  HI: 'Hawaii, Alaska & Territories', AK: 'Hawaii, Alaska & Territories', PR: 'Hawaii, Alaska & Territories',
  GU: 'Hawaii, Alaska & Territories', AS: 'Hawaii, Alaska & Territories', MP: 'Hawaii, Alaska & Territories',
  VI: 'Hawaii, Alaska & Territories', FM: 'Hawaii, Alaska & Territories', PW: 'Hawaii, Alaska & Territories',
  MH: 'Hawaii, Alaska & Territories',
};

// The College Scorecard API returns latest.academics.program_percentage.* as flat
// dotted keys on the result object, not as a nested sub-object — and two of its real
// field names differ from the commonly-assumed ones: it's "legal" (not
// "law_legal_studies") and "visual_performing" (not "visual_performing_arts").
// Verified directly against the live API before writing this mapping.
const PROGRAM_PERCENTAGE_PREFIX = 'latest.academics.program_percentage.';

function mapPrograms(result) {
  const get = (key) => result[`${PROGRAM_PERCENTAGE_PREFIX}${key}`] ?? 0;
  const programs = [];

  if (get('education') > 0.1) programs.push('Education');
  if (get('engineering') > 0.1) programs.push('Engineering');
  if (get('business_marketing') > 0.1) programs.push('Business');
  if (get('legal') > 0.05) programs.push('Law');
  if (get('health') > 0.1) programs.push('Medicine/Health');
  if (get('computer') > 0.1) programs.push('Computer Science');
  if (get('visual_performing') > 0.1) programs.push('Arts');
  if (get('social_science') > 0.1) programs.push('Social Sciences');

  return programs;
}

function formatAcceptanceRate(rate) {
  if (rate == null) return null;
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Maps one College Scorecard result to a `schools` row, or null if it fails
 * the required-data filter (name, state, both tuitions, and student size).
 */
function mapSchool(result) {
  const name = result['school.name'];
  const state = result['school.state'];
  const city = result['school.city'];
  const tuitionInState = result['latest.cost.tuition.in_state'];
  const tuitionOutOfState = result['latest.cost.tuition.out_of_state'];
  const studentSize = result['latest.student.size'];

  if (!name || !state) return null;
  if (tuitionInState == null && tuitionOutOfState == null) return null;
  if (studentSize == null || studentSize === 0) return null;

  // International students pay out-of-state rates; fall back to in-state only
  // when out-of-state specifically is missing but in-state is available.
  const tuition = tuitionOutOfState ?? tuitionInState;

  return {
    name,
    location: city ? `${city}, ${state}` : state,
    website: result['school.school_url'] || null,
    tuition,
    acceptance_rate: formatAcceptanceRate(result['latest.admissions.admission_rate.overall']),
    difficulty: null,
    scholarships: [],
    details: {},
    ranking: null,
    programs: mapPrograms(result),
    state,
    region: STATE_TO_REGION[state] ?? null,
    enrollment_size: studentSize,
  };
}

async function fetchPage(page) {
  const params = new URLSearchParams({
    api_key: SCORECARD_KEY,
    fields: FIELDS,
    per_page: String(PER_PAGE),
    page: String(page),
  });

  const response = await fetch(`${SCORECARD_BASE}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Scorecard API request failed (page ${page}): ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function upsertBatch(rows) {
  if (rows.length === 0) return;

  const { error } = await supabase.from('schools').upsert(rows, { onConflict: 'name' });
  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }
}

async function main() {
  let page = 0;
  const allSchools = [];

  // Fetch every page first instead of upserting page-by-page. College Scorecard
  // has multiple distinct institution IDs that share the same display name for
  // some universities (e.g. a main campus plus a satellite/extension reporting
  // unit). Deduping only within a single 100-row page let a later, thinner
  // duplicate silently overwrite an earlier, richer one via ON CONFLICT — this is
  // exactly how Harvard, Yale, Stanford, Duke, Penn, BU, and Georgetown lost their
  // Law/Medicine program tags in a previous run. Collecting everything first lets
  // us dedupe once, globally, keeping whichever duplicate has the richer record.
  while (true) {
    console.log(`Fetching page ${page}...`);
    const json = await fetchPage(page);
    const results = json.results ?? [];

    if (results.length === 0) break;

    allSchools.push(...results.map(mapSchool).filter(Boolean));

    const total = json.metadata?.total ?? 0;
    if ((page + 1) * PER_PAGE >= total) break;

    page += 1;
  }

  console.log(`Fetched ${allSchools.length} raw rows across all pages. Deduping by name...`);

  const byName = new Map();
  for (const school of allSchools) {
    const existing = byName.get(school.name);
    if (!existing || school.programs.length > existing.programs.length) {
      byName.set(school.name, school);
    }
  }

  const dedupedSchools = Array.from(byName.values());
  console.log(`${dedupedSchools.length} unique schools after dedup. Upserting in batches of ${PER_PAGE}...`);

  let totalSeeded = 0;
  for (let i = 0; i < dedupedSchools.length; i += PER_PAGE) {
    const chunk = dedupedSchools.slice(i, i + PER_PAGE);
    await upsertBatch(chunk);
    totalSeeded += chunk.length;
    console.log(`Inserted ${totalSeeded} schools so far...`);
  }

  const seededSchools = dedupedSchools;

  console.log(`Done! Total: ${totalSeeded} schools seeded`);

  const regionCounts = {};
  let lawProgramCount = 0;
  let under30kCount = 0;

  for (const school of seededSchools) {
    const region = school.region ?? 'Unknown';
    regionCounts[region] = (regionCounts[region] ?? 0) + 1;

    if (school.programs.includes('Law')) lawProgramCount += 1;
    if (school.tuition != null && school.tuition < 30000) under30kCount += 1;
  }

  console.log('\n--- Summary ---');
  console.log(`Total schools seeded: ${totalSeeded}`);
  console.log('Breakdown by region:');
  for (const [region, count] of Object.entries(regionCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${region}: ${count}`);
  }
  console.log(`Schools with Law programs: ${lawProgramCount}`);
  console.log(`Schools with tuition under $30k: ${under30kCount}`);
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
