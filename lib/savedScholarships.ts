import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'savedScholarshipIds';

export async function getSavedIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function isSaved(id: string): Promise<boolean> {
  const ids = await getSavedIds();
  return ids.includes(id);
}

export async function toggleSaved(id: string): Promise<boolean> {
  const ids = await getSavedIds();
  const index = ids.indexOf(id);

  let next: string[];
  let saved: boolean;

  if (index === -1) {
    next = [...ids, id];
    saved = true;
  } else {
    next = ids.filter((existingId) => existingId !== id);
    saved = false;
  }

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return saved;
}
