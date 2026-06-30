import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { supabase } from './supabase';

export async function pickAndUploadAvatar(userId: string): Promise<{ url: string | null; error: string | null }> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { url: null, error: 'Permission to access your photo library was denied.' };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });

  if (result.canceled || !result.assets?.[0]) {
    return { url: null, error: null };
  }

  const asset = result.assets[0];

  try {
    // React Native's fetch(file://...).blob() frequently produces a Blob that
    // supabase-js can't read correctly (uploads succeed with 0 bytes / corrupt
    // data, no error surfaced). Reading the file's raw bytes via expo-file-system
    // and uploading that Uint8Array directly is the reliable path on RN.
    const bytes = await new File(asset.uri).bytes();
    const fileExt = asset.uri.split('.').pop()?.split('?')[0] || 'jpg';
    const filePath = `${userId}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, bytes, {
      contentType: asset.mimeType ?? 'image/jpeg',
      upsert: true,
    });

    if (uploadError) {
      return { url: null, error: uploadError.message };
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    // Cache-bust so the <Image> re-fetches immediately instead of reusing a
    // stale cached response from a previous avatar at the same path.
    return { url: `${data.publicUrl}?t=${Date.now()}`, error: null };
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : 'Failed to upload photo.' };
  }
}
