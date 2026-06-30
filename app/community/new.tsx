import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
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
import { supabase } from '../../lib/supabase';
import { theme } from '../../lib/theme';
import GradientBackground from '../../components/GradientBackground';
import { pickCommunityImage } from '../../lib/communityImages';

const CHANNELS = [
  { value: 'general', label: 'General' },
  { value: 'housing', label: 'Housing' },
  { value: 'roommates', label: 'Roommates' },
  { value: 'wellness', label: 'Wellness' },
  { value: 'scholarships', label: 'Scholarships' },
  { value: 'visa', label: 'Visa' },
  { value: 'career', label: 'Career' },
];

export default function NewPostScreen() {
  const params = useLocalSearchParams<{ channel?: string }>();
  const initialChannel = CHANNELS.some((c) => c.value === params.channel) ? params.channel! : CHANNELS[0].value;

  const [channel, setChannel] = useState(initialChannel);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showLinkFields, setShowLinkFields] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getUser().then(async ({ data: userData }) => {
      const user = userData.user;
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      setUserId(user.id);
      setAuthorName(data?.full_name ?? user.email ?? 'Student');
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePickImage = async () => {
    if (!userId) return;
    setUploadingImage(true);

    const { url, error: uploadError } = await pickCommunityImage(userId);

    if (uploadError) {
      setError(uploadError);
    } else if (url) {
      setImageUrl(url);
    }

    setUploadingImage(false);
  };

  const handlePost = async () => {
    setError(null);

    if (!title.trim()) {
      setError('Please add a title.');
      return;
    }
    if (!content.trim()) {
      setError('Please add some content.');
      return;
    }
    if (!userId) {
      setError('You must be signed in to post.');
      return;
    }
    if (showLinkFields && linkUrl.trim() && !/^https?:\/\//i.test(linkUrl.trim())) {
      setError('Link must start with http:// or https://');
      return;
    }

    setSaving(true);

    const { error: insertError } = await supabase.from('community_posts').insert({
      user_id: userId,
      author_name: authorName,
      title: title.trim(),
      content: content.trim(),
      channel,
      images: imageUrl ? [imageUrl] : [],
      link_url: showLinkFields && linkUrl.trim() ? linkUrl.trim() : null,
      link_title: showLinkFields && linkTitle.trim() ? linkTitle.trim() : null,
    });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.back();
  };

  return (
    <GradientBackground>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.flexFill}>
            <View style={styles.header}>
              <Pressable
                onPress={() => router.back()}
                style={styles.backButton}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.backButtonText}>‹ Back</Text>
              </Pressable>
            </View>

            {loading ? (
              <ActivityIndicator color={theme.textSecondary} style={styles.stateIndicator} />
            ) : (
              <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={styles.greeting}>Community</Text>
                <Text style={styles.heading}>New Post</Text>

                <View style={styles.field}>
                  <Text style={styles.label}>Channel</Text>
                  <View style={styles.chipRow}>
                    {CHANNELS.map((c) => (
                      <TouchableOpacity
                        key={c.value}
                        style={[styles.chip, channel === c.value && styles.chipActive]}
                        onPress={() => setChannel(c.value)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, channel === c.value && styles.chipTextActive]}>
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Title</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="What's your post about?"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    value={title}
                    onChangeText={setTitle}
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />
                </View>

                <View style={styles.field}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Content</Text>
                    <TouchableOpacity onPress={() => Keyboard.dismiss()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.doneLabel}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Share the details..."
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    value={content}
                    onChangeText={setContent}
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                    returnKeyType="default"
                    blurOnSubmit={false}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Photo (optional)</Text>
                  {imageUrl ? (
                    <View style={styles.imagePreviewWrap}>
                      <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
                      <TouchableOpacity style={styles.removeImageButton} onPress={() => setImageUrl(null)}>
                        <Text style={styles.removeImageText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.attachButton}
                      onPress={handlePickImage}
                      disabled={uploadingImage}
                      activeOpacity={0.8}
                    >
                      {uploadingImage ? (
                        <ActivityIndicator color={theme.textPrimary} />
                      ) : (
                        <Text style={styles.attachButtonText}>📷 Add Photo</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.field}>
                  <TouchableOpacity
                    style={styles.attachButton}
                    onPress={() => setShowLinkFields((prev) => !prev)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.attachButtonText}>
                      {showLinkFields ? '🔗 Remove Link' : '🔗 Add Link'}
                    </Text>
                  </TouchableOpacity>

                  {showLinkFields && (
                    <View style={styles.linkFields}>
                      <TextInput
                        style={[styles.input, styles.linkInput]}
                        placeholder="https://example.com"
                        placeholderTextColor="rgba(255, 255, 255, 0.5)"
                        value={linkUrl}
                        onChangeText={setLinkUrl}
                        autoCapitalize="none"
                        keyboardType="url"
                        returnKeyType="done"
                        onSubmitEditing={() => Keyboard.dismiss()}
                      />
                      <TextInput
                        style={[styles.input, styles.linkInput]}
                        placeholder="Link title (optional)"
                        placeholderTextColor="rgba(255, 255, 255, 0.5)"
                        value={linkTitle}
                        onChangeText={setLinkTitle}
                        returnKeyType="done"
                        onSubmitEditing={() => Keyboard.dismiss()}
                      />
                    </View>
                  )}
                </View>

                {error && (
                  <View style={styles.errorCard}>
                    <Text style={styles.errorText}>⚠️ {error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.button, saving && styles.buttonDisabled]}
                  onPress={handlePost}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  {saving ? <ActivityIndicator color={theme.accentText} /> : <Text style={styles.buttonText}>Post</Text>}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
  stateIndicator: {
    marginTop: 40,
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
    marginBottom: 32,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  doneLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.accent,
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
    minHeight: 140,
    paddingTop: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: theme.textPrimary,
    borderColor: theme.textPrimary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  chipTextActive: {
    color: theme.accentText,
  },
  attachButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  attachButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  imagePreviewWrap: {
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 14,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: {
    color: theme.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  linkFields: {
    marginTop: 10,
    gap: 10,
  },
  linkInput: {
    fontSize: 14,
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
  button: {
    backgroundColor: theme.accent,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: theme.accentText,
    fontSize: 16,
    fontWeight: '700',
  },
});
