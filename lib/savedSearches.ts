import { supabase } from './supabase';

export type SavedSearch = {
  id: string;
  search_name: string;
  answers: Record<string, unknown>;
  results_count: number | null;
  created_at: string;
};

export async function listSavedSearches(): Promise<SavedSearch[]> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return [];

  const { data, error } = await supabase
    .from('saved_searches')
    .select('id, search_name, answers, results_count, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data ?? []) as SavedSearch[];
}

export async function getSavedSearch(id: string): Promise<SavedSearch | null> {
  const { data, error } = await supabase
    .from('saved_searches')
    .select('id, search_name, answers, results_count, created_at')
    .eq('id', id)
    .maybeSingle();

  if (error) return null;
  return (data as SavedSearch) ?? null;
}

export async function saveSearch(
  answers: Record<string, unknown>,
  resultsCount: number,
  searchName?: string
): Promise<{ error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { error: 'You must be signed in to save a search.' };

  const name =
    searchName?.trim() ||
    `${(answers.major as string) || 'Smart Match'} — ${new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;

  const { error } = await supabase.from('saved_searches').insert({
    user_id: user.id,
    search_name: name,
    answers,
    results_count: resultsCount,
  });

  return { error: error?.message ?? null };
}

export async function deleteSavedSearch(id: string): Promise<void> {
  await supabase.from('saved_searches').delete().eq('id', id);
}
