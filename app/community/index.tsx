import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { theme } from '../../lib/theme';
import GradientBackground from '../../components/GradientBackground';

const CHANNELS = [
  { value: 'general', label: 'General' },
  { value: 'housing', label: 'Housing' },
  { value: 'roommates', label: 'Roommates' },
  { value: 'wellness', label: 'Wellness' },
  { value: 'scholarships', label: 'Scholarships' },
  { value: 'visa', label: 'Visa' },
  { value: 'career', label: 'Career' },
];

const CHANNEL_LABELS: Record<string, string> = CHANNELS.reduce(
  (acc, channel) => ({ ...acc, [channel.value]: channel.label }),
  {} as Record<string, string>
);

type Post = {
  id: string;
  title: string;
  author_name: string | null;
  channel: string;
  likes_count: number | null;
  comments_count: number | null;
  images: string[] | null;
  created_at: string;
};

function formatRelativeTime(isoDate: string) {
  const date = new Date(isoDate);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function CommunityScreen() {
  const [selectedChannel, setSelectedChannel] = useState(CHANNELS[0].value);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setError(null);

      supabase
        .from('community_posts')
        .select('id, title, author_name, channel, likes_count, comments_count, images, created_at')
        .eq('channel', selectedChannel)
        .order('created_at', { ascending: false })
        .then(({ data, error: fetchError }) => {
          if (cancelled) return;
          if (fetchError) {
            setError(fetchError.message);
          } else {
            setPosts((data ?? []) as Post[]);
          }
          setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [selectedChannel])
  );

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

        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Connect</Text>
            <Text style={styles.heading}>Community</Text>
          </View>
          <TouchableOpacity
            style={styles.composeButton}
            activeOpacity={0.8}
            onPress={() => router.push({ pathname: '/community/new', params: { channel: selectedChannel } })}
          >
            <Text style={styles.composeButtonText}>＋</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.channelRow}
          contentContainerStyle={styles.channelRowContent}
        >
          {CHANNELS.map((channel) => (
            <TouchableOpacity
              key={channel.value}
              style={[styles.channelChip, selectedChannel === channel.value && styles.channelChipActive]}
              onPress={() => setSelectedChannel(channel.value)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.channelChipText,
                  selectedChannel === channel.value && styles.channelChipTextActive,
                ]}
              >
                {channel.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView contentContainerStyle={styles.feed}>
          {loading && <ActivityIndicator color={theme.textSecondary} style={styles.stateIndicator} />}

          {!loading && error && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>⚠️ Couldn't load posts</Text>
              <Text style={styles.cardBody}>{error}</Text>
            </View>
          )}

          {!loading && !error && posts.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>No posts yet</Text>
              <Text style={styles.emptyBody}>
                Be the first to start a conversation in {CHANNEL_LABELS[selectedChannel]}.
              </Text>
            </View>
          )}

          {!loading &&
            !error &&
            posts.map((post) => (
              <TouchableOpacity
                key={post.id}
                style={styles.postCard}
                activeOpacity={0.8}
                onPress={() => router.push({ pathname: '/community/[id]', params: { id: post.id } })}
              >
                <View style={styles.postMetaRow}>
                  <View style={styles.channelTag}>
                    <Text style={styles.channelTagText}>{CHANNEL_LABELS[post.channel] ?? post.channel}</Text>
                  </View>
                  <Text style={styles.postTimestamp}>{formatRelativeTime(post.created_at)}</Text>
                </View>
                <Text style={styles.postTitle}>{post.title}</Text>
                {(post.images?.length ?? 0) > 0 && (
                  <Image source={{ uri: post.images![0] }} style={styles.postThumbnail} />
                )}
                <View style={styles.postFooterRow}>
                  <Text style={styles.postAuthor}>{post.author_name ?? 'Student'}</Text>
                  <View style={styles.postStatsRow}>
                    <View style={styles.likeRow}>
                      <Text style={styles.likeIcon}>♥</Text>
                      <Text style={styles.likeCount}>{post.likes_count ?? 0}</Text>
                    </View>
                    <View style={styles.likeRow}>
                      <Text style={styles.commentIcon}>💬</Text>
                      <Text style={styles.likeCount}>{post.comments_count ?? 0}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
        </ScrollView>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
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
  },
  composeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composeButtonText: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.accentText,
    lineHeight: 24,
  },
  channelRow: {
    flexGrow: 0,
    marginBottom: 8,
  },
  channelRowContent: {
    paddingHorizontal: 24,
  },
  channelChip: {
    backgroundColor: theme.card,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 10,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  channelChipActive: {
    backgroundColor: theme.textPrimary,
    borderColor: theme.textPrimary,
  },
  channelChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  channelChipTextActive: {
    color: theme.accentText,
  },
  feed: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 120,
  },
  stateIndicator: {
    marginTop: 24,
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
  emptyState: {
    backgroundColor: theme.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 32,
    alignItems: 'center',
    marginTop: 16,
    ...theme.shadow,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
  postCard: {
    backgroundColor: theme.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 20,
    marginBottom: 12,
    ...theme.shadow,
  },
  postMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  channelTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  channelTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  postTimestamp: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 12,
    lineHeight: 22,
  },
  postThumbnail: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    marginBottom: 12,
  },
  postFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  commentIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  postAuthor: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  likeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeIcon: {
    fontSize: 13,
    color: theme.accent,
    marginRight: 4,
  },
  likeCount: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
});
