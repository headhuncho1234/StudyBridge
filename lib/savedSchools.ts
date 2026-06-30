import { supabase } from './supabase';

export async function getSavedSchoolIds(): Promise<Set<string>> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return new Set();

  const { data } = await supabase.from('saved_schools').select('school_id').eq('user_id', user.id);
  return new Set((data ?? []).map((row) => row.school_id as string));
}

export async function isSchoolSaved(schoolId: string): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return false;

  const { data } = await supabase
    .from('saved_schools')
    .select('id')
    .eq('user_id', user.id)
    .eq('school_id', schoolId)
    .maybeSingle();

  return !!data;
}

export async function toggleSchoolSaved(schoolId: string): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return false;

  const existing = await isSchoolSaved(schoolId);

  if (existing) {
    await supabase.from('saved_schools').delete().eq('user_id', user.id).eq('school_id', schoolId);
    return false;
  }

  await supabase.from('saved_schools').insert({ user_id: user.id, school_id: schoolId });
  return true;
}
