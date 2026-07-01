// Campus Board SQL (run once in Supabase SQL editor):
// create table campus_posts (id uuid default gen_random_uuid() primary key, user_id uuid references auth.users, university_name text, content text, anonymous_tag text, created_at timestamptz default now(), like_count int default 0, report_count int default 0);
// create table campus_post_reports (id uuid default gen_random_uuid() primary key, post_id uuid references campus_posts, reporter_id uuid references auth.users, reason text, created_at timestamptz default now());
// create table campus_verifications (id uuid default gen_random_uuid() primary key, user_id uuid references auth.users unique, university_name text, verified_at timestamptz default now(), method text, anonymous_tag text);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Modal,
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
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { theme } from '../../lib/theme';
import GradientBackground from '../../components/GradientBackground';

// ──────────────────────────────────────────────
// Community Feed types & constants
// ──────────────────────────────────────────────
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

// ──────────────────────────────────────────────
// Campus Board types & constants
// ──────────────────────────────────────────────
const CAMPUS_BOARD_AGREED_KEY = 'campus_board_agreed';
const POST_CHAR_LIMIT = 250;
const POSTS_PER_HOUR_LIMIT = 5;

const ANONYMOUS_ANIMALS = [
  'Bear', 'Wolf', 'Fox', 'Owl', 'Eagle', 'Hawk', 'Lion', 'Tiger', 'Panda',
  'Koala', 'Otter', 'Deer', 'Moose', 'Lynx', 'Falcon', 'Raven', 'Crane',
  'Bison', 'Jaguar', 'Gecko',
];

type CampusVerification = {
  id: string;
  user_id: string;
  university_name: string;
  verified_at: string;
  method: string;
  anonymous_tag: string | null;
};

type CampusPost = {
  id: string;
  user_id: string;
  university_name: string;
  content: string;
  anonymous_tag: string | null;
  created_at: string;
  like_count: number;
  report_count: number;
};

// Known university lat/lngs for location-based verification
const KNOWN_UNIVERSITIES: { name: string; lat: number; lng: number }[] = [
  { name: 'Harvard University', lat: 42.3770, lng: -71.1167 },
  { name: 'MIT', lat: 42.3601, lng: -71.0942 },
  { name: 'Stanford University', lat: 37.4275, lng: -122.1697 },
  { name: 'UCLA', lat: 34.0689, lng: -118.4452 },
  { name: 'University of Michigan', lat: 42.2780, lng: -83.7382 },
  { name: 'NYU', lat: 40.7295, lng: -73.9965 },
  { name: 'University of Texas at Austin', lat: 30.2849, lng: -97.7341 },
  { name: 'Georgia Tech', lat: 33.7756, lng: -84.3963 },
  { name: 'University of Washington', lat: 47.6553, lng: -122.3035 },
  { name: 'Columbia University', lat: 40.8075, lng: -73.9626 },
];

const MILES_TO_DEGREES = 1 / 69; // rough conversion

function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dlat = lat1 - lat2;
  const dlng = (lng1 - lng2) * Math.cos((lat1 * Math.PI) / 180);
  return Math.sqrt(dlat * dlat + dlng * dlng) * 69;
}

function generateAnonymousTag(): string {
  const animal = ANONYMOUS_ANIMALS[Math.floor(Math.random() * ANONYMOUS_ANIMALS.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  return `Anonymous ${animal} ${num}`;
}

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

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────
export default function CommunityScreen() {
  // Tab state
  const [activeTab, setActiveTab] = useState<'feed' | 'board'>('feed');

  // Community feed state
  const [selectedChannel, setSelectedChannel] = useState(CHANNELS[0].value);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Campus Board state
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [verification, setVerification] = useState<CampusVerification | null | undefined>(undefined); // undefined = loading
  const [boardAgreed, setBoardAgreed] = useState<boolean | null>(null); // null = loading
  const [showGuidelinesModal, setShowGuidelinesModal] = useState(false);

  // Verification flow
  const [eduEmail, setEduEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [sentCode, setSentCode] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  // Board post composer
  const [postText, setPostText] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  // Board posts
  const [campusPosts, setCampusPosts] = useState<CampusPost[]>([]);
  const [campusLoading, setCampusLoading] = useState(false);

  // ── Fetch user ID once ──
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  // ── Check campus verification ──
  useEffect(() => {
    if (!currentUserId) return;
    supabase
      .from('campus_verifications')
      .select('*')
      .eq('user_id', currentUserId)
      .maybeSingle()
      .then(({ data }) => {
        setVerification(data as CampusVerification | null);
      });
  }, [currentUserId]);

  // ── Check board agreement ──
  useEffect(() => {
    AsyncStorage.getItem(CAMPUS_BOARD_AGREED_KEY).then((val) => {
      setBoardAgreed(val === 'true');
      if (val === 'true') setShowGuidelinesModal(false);
    });
  }, []);

  // ── Show guidelines modal when board becomes active and user is verified but hasn't agreed ──
  useEffect(() => {
    if (activeTab === 'board' && verification && boardAgreed === false) {
      setShowGuidelinesModal(true);
    }
  }, [activeTab, verification, boardAgreed]);

  // ── Load campus posts when on board tab ──
  const loadCampusPosts = useCallback(() => {
    if (!verification?.university_name) return;
    setCampusLoading(true);
    supabase
      .from('campus_posts')
      .select('*')
      .eq('university_name', verification.university_name)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setCampusPosts((data ?? []) as CampusPost[]);
        setCampusLoading(false);
      });
  }, [verification]);

  useEffect(() => {
    if (activeTab === 'board' && verification && boardAgreed) {
      loadCampusPosts();
    }
  }, [activeTab, verification, boardAgreed, loadCampusPosts]);

  // ── Community feed load ──
  useFocusEffect(
    useCallback(() => {
      if (activeTab !== 'feed') return;
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
    }, [selectedChannel, activeTab])
  );

  // ──────────────────────────────────────────────
  // Verification handlers
  // ──────────────────────────────────────────────
  const handleSendEduCode = () => {
    setVerifyError(null);
    const email = eduEmail.trim().toLowerCase();
    if (!email.endsWith('.edu')) {
      setVerifyError('Please enter a valid .edu email address.');
      return;
    }
    // Generate 6-digit code (MVP: auto-verify on .edu submission, show code hint)
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setSentCode(code);
    // In production you'd send this via email. For now, auto-proceed after showing code.
  };

  const handleVerifyEduCode = async () => {
    if (!sentCode || !currentUserId) return;
    setVerifyError(null);

    if (verifyCode.trim() !== sentCode) {
      setVerifyError('Incorrect code. Check the hint below and try again.');
      return;
    }

    setVerifying(true);
    const universityName = eduEmail.split('@')[1]?.replace('.edu', '').replace(/\./g, ' ') ?? 'Unknown University';
    const tag = generateAnonymousTag();

    const { error } = await supabase.from('campus_verifications').upsert({
      user_id: currentUserId,
      university_name: universityName,
      method: 'edu_email',
      verified_via: 'edu_email',
      anonymous_tag: tag,
      verified_at: new Date().toISOString(),
    });

    setVerifying(false);
    if (error) {
      setVerifyError(error.message);
      return;
    }

    setVerification({
      id: '',
      user_id: currentUserId,
      university_name: universityName,
      verified_at: new Date().toISOString(),
      method: 'edu_email',
      anonymous_tag: tag,
    });
  };

  const handleLocationVerify = async () => {
    setVerifyError(null);
    setLocating(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setVerifyError('Location permission denied. Try the .edu email option instead.');
        setLocating(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;

      let nearest: { name: string; dist: number } | null = null;
      for (const uni of KNOWN_UNIVERSITIES) {
        const dist = distanceMiles(latitude, longitude, uni.lat, uni.lng);
        if (!nearest || dist < nearest.dist) nearest = { name: uni.name, dist };
      }

      if (!nearest || nearest.dist > 5) {
        setVerifyError('No recognized university found within 5 miles. Try the .edu email option.');
        setLocating(false);
        return;
      }

      const tag = generateAnonymousTag();
      const { error } = await supabase.from('campus_verifications').upsert({
        user_id: currentUserId!,
        university_name: nearest.name,
        method: 'location',
      verified_via: 'location',
        anonymous_tag: tag,
        verified_at: new Date().toISOString(),
      });

      setLocating(false);
      if (error) {
        setVerifyError(error.message);
        return;
      }

      setVerification({
        id: '',
        user_id: currentUserId!,
        university_name: nearest.name,
        verified_at: new Date().toISOString(),
        method: 'location',
        anonymous_tag: tag,
      });
    } catch (e: unknown) {
      setLocating(false);
      setVerifyError(e instanceof Error ? e.message : 'Location check failed. Try .edu email instead.');
    }
  };

  // ──────────────────────────────────────────────
  // Post handlers
  // ──────────────────────────────────────────────
  const handlePost = async () => {
    if (!currentUserId || !verification || !postText.trim()) return;
    setPostError(null);

    // Rate limit check: count posts in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentPosts } = await supabase
      .from('campus_posts')
      .select('id')
      .eq('user_id', currentUserId)
      .gte('created_at', oneHourAgo);

    if ((recentPosts?.length ?? 0) >= POSTS_PER_HOUR_LIMIT) {
      setRateLimited(true);
      return;
    }
    setRateLimited(false);

    setPosting(true);
    const { error } = await supabase.from('campus_posts').insert({
      user_id: currentUserId,
      university_name: verification.university_name,
      content: postText.trim(),
      anonymous_tag: verification.anonymous_tag ?? generateAnonymousTag(),
    });

    setPosting(false);
    if (error) {
      setPostError(error.message);
      return;
    }

    setPostText('');
    loadCampusPosts();
  };

  const handleLike = async (postId: string, currentCount: number) => {
    await supabase
      .from('campus_posts')
      .update({ like_count: currentCount + 1 })
      .eq('id', postId);

    setCampusPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, like_count: currentCount + 1 } : p))
    );
  };

  const handleReport = (postId: string) => {
    const reasons = ['Harassment', 'Spam', 'Inappropriate', 'Other'];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', ...reasons],
          cancelButtonIndex: 0,
          title: 'Report Post',
          message: 'Why are you reporting this post?',
        },
        async (buttonIndex) => {
          if (buttonIndex === 0) return;
          const reason = reasons[buttonIndex - 1];
          await supabase.from('campus_post_reports').insert({
            post_id: postId,
            reporter_id: currentUserId,
            reason,
          });
          Alert.alert('Reported', 'Thank you for helping keep the board safe.');
        }
      );
    } else {
      Alert.alert('Report Post', 'Why are you reporting this post?', [
        ...reasons.map((reason) => ({
          text: reason,
          onPress: async () => {
            await supabase.from('campus_post_reports').insert({
              post_id: postId,
              reporter_id: currentUserId,
              reason,
            });
            Alert.alert('Reported', 'Thank you for helping keep the board safe.');
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const handleAgreeToGuidelines = async () => {
    await AsyncStorage.setItem(CAMPUS_BOARD_AGREED_KEY, 'true');
    setBoardAgreed(true);
    setShowGuidelinesModal(false);
  };

  // ──────────────────────────────────────────────
  // Render helpers
  // ──────────────────────────────────────────────
  const renderVerificationScreen = () => (
    <ScrollView contentContainerStyle={styles.boardContent}>
      <View style={styles.verifyCard}>
        <Text style={styles.verifyTitle}>Join Your Campus Board</Text>
        <Text style={styles.verifyBody}>
          The Campus Board is an anonymous space for verified students at your school. Verify your enrollment to
          get in.
        </Text>

        <Text style={styles.verifyOptionLabel}>Option 1 — .edu Email</Text>
        <TextInput
          style={styles.verifyInput}
          placeholder="yourname@university.edu"
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={eduEmail}
          onChangeText={setEduEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        {!sentCode ? (
          <TouchableOpacity style={styles.verifyButton} onPress={handleSendEduCode} activeOpacity={0.8}>
            <Text style={styles.verifyButtonText}>Send Code</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TextInput
              style={[styles.verifyInput, { marginTop: 12 }]}
              placeholder="Enter 6-digit code"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={verifyCode}
              onChangeText={setVerifyCode}
              keyboardType="numeric"
              maxLength={6}
            />
            <Text style={styles.codeHint}>Dev hint — Code: {sentCode}</Text>
            <TouchableOpacity
              style={[styles.verifyButton, verifying && styles.verifyButtonDisabled]}
              onPress={handleVerifyEduCode}
              disabled={verifying}
              activeOpacity={0.8}
            >
              {verifying ? (
                <ActivityIndicator color="#0A2463" />
              ) : (
                <Text style={styles.verifyButtonText}>Verify</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        <View style={styles.verifyDivider}>
          <View style={styles.verifyDividerLine} />
          <Text style={styles.verifyDividerText}>or</Text>
          <View style={styles.verifyDividerLine} />
        </View>

        <Text style={styles.verifyOptionLabel}>Option 2 — Use My Location</Text>
        <Text style={styles.verifyOptionSub}>
          We'll check if you're within 5 miles of a recognized university campus.
        </Text>
        <TouchableOpacity
          style={[styles.verifyButtonOutline, locating && styles.verifyButtonDisabled]}
          onPress={handleLocationVerify}
          disabled={locating}
          activeOpacity={0.8}
        >
          {locating ? (
            <ActivityIndicator color={theme.accent} />
          ) : (
            <Text style={styles.verifyButtonOutlineText}>Use My Location</Text>
          )}
        </TouchableOpacity>

        {verifyError && <Text style={styles.verifyError}>{verifyError}</Text>}
      </View>
    </ScrollView>
  );

  const renderCampusBoard = () => (
    <ScrollView contentContainerStyle={styles.boardContent} keyboardShouldPersistTaps="handled">
      <View style={styles.boardMeta}>
        <Text style={styles.boardUniversity}>{verification?.university_name}</Text>
        <Text style={styles.boardTag}>{verification?.anonymous_tag ?? 'Anonymous'}</Text>
      </View>

      {/* Post composer */}
      {rateLimited ? (
        <View style={styles.rateLimitCard}>
          <Text style={styles.rateLimitText}>
            You've reached the 5 post/hour limit. Come back later!
          </Text>
        </View>
      ) : (
        <View style={styles.composerCard}>
          <TextInput
            style={styles.composerInput}
            placeholder="Share something anonymously..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={postText}
            onChangeText={(t) => setPostText(t.slice(0, POST_CHAR_LIMIT))}
            multiline
            maxLength={POST_CHAR_LIMIT}
          />
          <View style={styles.composerFooter}>
            <Text style={styles.composerCounter}>
              {postText.length}/{POST_CHAR_LIMIT}
            </Text>
            <TouchableOpacity
              style={[styles.postButton, (!postText.trim() || posting) && styles.postButtonDisabled]}
              onPress={handlePost}
              disabled={!postText.trim() || posting}
              activeOpacity={0.8}
            >
              {posting ? (
                <ActivityIndicator color="#0A2463" size="small" />
              ) : (
                <Text style={styles.postButtonText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
          {postError && <Text style={styles.postError}>{postError}</Text>}
        </View>
      )}

      {/* Feed */}
      {campusLoading && <ActivityIndicator color={theme.textSecondary} style={styles.stateIndicator} />}

      {!campusLoading && campusPosts.length === 0 && (
        <View style={styles.emptyBoard}>
          <Text style={styles.emptyBoardText}>No posts yet. Be the first to share something!</Text>
        </View>
      )}

      {campusPosts.map((cp) => (
        <View key={cp.id} style={styles.campusPostCard}>
          <View style={styles.campusPostHeader}>
            <Text style={styles.campusPostTag}>{cp.anonymous_tag ?? 'Anonymous'}</Text>
            <Text style={styles.campusPostTime}>{formatRelativeTime(cp.created_at)}</Text>
          </View>
          <Text style={styles.campusPostContent}>{cp.content}</Text>
          <View style={styles.campusPostFooter}>
            <TouchableOpacity
              style={styles.campusPostAction}
              onPress={() => handleLike(cp.id, cp.like_count)}
              activeOpacity={0.7}
            >
              <Text style={styles.campusPostActionIcon}>♥</Text>
              <Text style={styles.campusPostActionCount}>{cp.like_count}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.campusPostAction}
              onPress={() => handleReport(cp.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.campusPostActionIcon}>⚑</Text>
              <Text style={styles.campusPostActionText}>Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  // ──────────────────────────────────────────────
  // Main render
  // ──────────────────────────────────────────────
  return (
    <GradientBackground>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Connect</Text>
            <Text style={styles.heading}>Community</Text>
          </View>
          {activeTab === 'feed' && (
            <TouchableOpacity
              style={styles.composeButton}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/community/new', params: { channel: selectedChannel } })}
            >
              <Text style={styles.composeButtonText}>＋</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tab toggle */}
        <View style={styles.tabToggle}>
          <TouchableOpacity
            style={[styles.tabToggleBtn, activeTab === 'feed' && styles.tabToggleBtnActive]}
            onPress={() => setActiveTab('feed')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabToggleText, activeTab === 'feed' && styles.tabToggleTextActive]}>
              Community Feed
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabToggleBtn, activeTab === 'board' && styles.tabToggleBtnActive]}
            onPress={() => setActiveTab('board')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabToggleText, activeTab === 'board' && styles.tabToggleTextActive]}>
              Campus Board
            </Text>
          </TouchableOpacity>
        </View>

        {/* Community Feed */}
        {activeTab === 'feed' && (
          <>
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
          </>
        )}

        {/* Campus Board */}
        {activeTab === 'board' && (
          <>
            {/* Loading state */}
            {verification === undefined && (
              <ActivityIndicator color={theme.textSecondary} style={styles.stateIndicator} />
            )}

            {/* Not verified */}
            {verification === null && renderVerificationScreen()}

            {/* Verified but not agreed — will show modal */}
            {verification !== null && verification !== undefined && !boardAgreed && (
              <View style={styles.boardContent}>
                <ActivityIndicator color={theme.textSecondary} style={styles.stateIndicator} />
              </View>
            )}

            {/* Verified and agreed */}
            {verification !== null && verification !== undefined && boardAgreed && renderCampusBoard()}
          </>
        )}

        {/* Community Guidelines Modal */}
        <Modal
          visible={showGuidelinesModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowGuidelinesModal(false)}
        >
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Campus Board Guidelines</Text>
                <ScrollView style={styles.guidelinesScroll}>
                  <Text style={styles.guidelinesText}>
                    Welcome to the Campus Board — an anonymous space for verified students at your school.
                    {'\n\n'}By participating, you agree to:{'\n\n'}
                    • Be respectful and kind to all members{'\n'}
                    • No harassment, bullying, or hate speech{'\n'}
                    • No sharing of private or personal information{'\n'}
                    • No spam or repeated posting{'\n'}
                    • No illegal content or activity{'\n\n'}
                    Violations may result in removal from the board. Posts are anonymous but moderated.
                    {'\n\n'}
                    Let's keep this space supportive and safe for everyone.
                  </Text>
                </ScrollView>
                <TouchableOpacity
                  style={styles.agreeButton}
                  onPress={handleAgreeToGuidelines}
                  activeOpacity={0.8}
                >
                  <Text style={styles.agreeButtonText}>I Agree</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  // Tab toggle
  tabToggle: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginBottom: 12,
    backgroundColor: theme.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 4,
  },
  tabToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabToggleBtnActive: {
    backgroundColor: theme.accent,
  },
  tabToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  tabToggleTextActive: {
    color: '#0A2463',
  },
  // Community feed
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
  // Campus Board
  boardContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 120,
  },
  boardMeta: {
    marginBottom: 16,
  },
  boardUniversity: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  boardTag: {
    fontSize: 13,
    color: theme.accent,
    marginTop: 2,
  },
  // Verification
  verifyCard: {
    backgroundColor: theme.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 24,
    ...theme.shadow,
  },
  verifyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  verifyBody: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
    marginBottom: 24,
  },
  verifyOptionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  verifyOptionSub: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 10,
    lineHeight: 18,
  },
  verifyInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: theme.textPrimary,
  },
  verifyButton: {
    backgroundColor: theme.accent,
    borderRadius: 30,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  verifyButtonOutline: {
    borderWidth: 2,
    borderColor: theme.accent,
    borderRadius: 30,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0A2463',
  },
  verifyButtonOutlineText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.accent,
  },
  verifyDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 10,
  },
  verifyDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.border,
  },
  verifyDividerText: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  codeHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 6,
    marginBottom: 4,
    textAlign: 'center',
  },
  verifyError: {
    fontSize: 13,
    color: '#F87171',
    marginTop: 12,
    fontWeight: '600',
  },
  // Composer
  composerCard: {
    backgroundColor: theme.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 16,
    marginBottom: 16,
    ...theme.shadow,
  },
  composerInput: {
    fontSize: 15,
    color: theme.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  composerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  composerCounter: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  postButton: {
    backgroundColor: theme.accent,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A2463',
  },
  postError: {
    fontSize: 12,
    color: '#F87171',
    marginTop: 8,
  },
  rateLimitCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  rateLimitText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBoard: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyBoardText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Campus post cards
  campusPostCard: {
    backgroundColor: theme.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 16,
    marginBottom: 12,
    ...theme.shadow,
  },
  campusPostHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  campusPostTag: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.accent,
  },
  campusPostTime: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  campusPostContent: {
    fontSize: 15,
    color: theme.textPrimary,
    lineHeight: 21,
    marginBottom: 12,
  },
  campusPostFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  campusPostAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  campusPostActionIcon: {
    fontSize: 14,
    color: theme.accent,
  },
  campusPostActionCount: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  campusPostActionText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0A2463',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.textPrimary,
    marginBottom: 16,
  },
  guidelinesScroll: {
    maxHeight: 300,
    marginBottom: 20,
  },
  guidelinesText: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 22,
  },
  agreeButton: {
    backgroundColor: theme.accent,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
  },
  agreeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A2463',
  },
});
