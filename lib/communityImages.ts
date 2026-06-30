import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { supabase } from './supabase';

export async function pickCommunityImage(userId: string): Promise<{ url: string | null; error: string | null }> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { url: null, error: 'Permission to access your photo library was denied.' };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
  });

  if (result.canceled || !result.assets?.[0]) {
    return { url: null, error: null };
  }

  const asset = result.assets[0];

  try {
    const bytes = await new File(asset.uri).bytes();
    const fileExt = asset.uri.split('.').pop()?.split('?')[0] || 'jpg';
    const filePath = `${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage.from('community-images').upload(filePath, bytes, {
      contentType: asset.mimeType ?? 'image/jpeg',
    });

    if (uploadError) {
      return { url: null, error: uploadError.message };
    }

    const { data } = supabase.storage.from('community-images').getPublicUrl(filePath);
    return { url: data.publicUrl, error: null };
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : 'Failed to upload image.' };
  }
}
