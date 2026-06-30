import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { theme } from '../../lib/theme';
import GradientBackground from '../../components/GradientBackground';
import { pickAndUploadAvatar } from '../../lib/avatarUpload';
import { getCountryFlag } from '../../lib/countryFlags';
import { School } from '../../lib/schoolMatching';
import { getSavedIds } from '../../lib/savedScholarships';
import { getSavedSchoolIds } from '../../lib/savedSchools';
import { listSavedSearches } from '../../lib/savedSearches';

const DEGREE_LEVEL_LABELS: Record<string, string> = {
  undergraduate: 'Undergraduate',
  graduate: 'Graduate',
  doctoral: 'Doctoral',
};

const CHANNEL_LABELS: Record<string, string> = {
  general: 'General',
  housing: 'Housing',
  roommates: 'Roommates',
  wellness: 'Wellness',
  scholarships: 'Scholarships',
  visa: 'Visa',
  career: 'Career',
};

const BIO_MAX_LENGTH = 150;

type Profile = {
  full_name: string | null;
  bio: string | null;
  country_of_origin: string | null;
  profile_picture_url: string | null;
  dream_schools: string[] | null;
  degree_level: string | null;
  field_of_study: string | null;
  gpa_range: string | null;
  enrollment_type: string | null;
  admission_timeline: string | null;
};

type Post = {
  id: string;
  title: string;
  channel: string;
  likes_count: number | null;
  created_at: string;
};

type DocStats = {
  complete: number;
  inProgress: number;
  needed: number;
};

function getInitials(fullName: string | null): string {
  if (!fullName?.trim()) return 'SB';
  const parts = fullName.trim().split(/\s+/);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '');
  return initials.join('') || 'SB';
}

function formatPostDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ProfileScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  const [savingBio, setSavingBio] = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [allSchools, setAllSchools] = useState<School[]>([]);
  const [schoolPickerSlot, setSchoolPickerSlot] = useState<number | null>(null);
  const [schoolSearch, setSchoolSearch] = useState('');

  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);

  const [settingsExpanded, setSettingsExpanded] = useState(false);

  // Saved items summary
  const [savedScholarshipCount, setSavedScholarshipCount] = useState(0);
  const [savedSchoolCount, setSavedSchoolCount] = useState(0);
  const [savedSearchCount, setSavedSearchCount] = useState(0);

  // Document stats
  const [docStats, setDocStats] = useState<DocStats>({ complete: 0, inProgress: 0, needed: 0 });

  // Change password modal
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from('schools')
      .select('*')
      .then(({ data }) => {
        if (!cancelled) setAllSchools((data ?? []) as School[]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);

      supabase.auth.getUser().then(async ({ data: userData }) => {
        const user = userData.user;
        if (!user) {
          if (!cancelled) setLoading(false);
          return;
        }

        if (!cancelled) setUserId(user.id);

        const { data } = await supabase
          .from('profiles')
          .select(
            'full_name, bio, country_of_origin, profile_picture_url, dream_schools, degree_level, field_of_study, gpa_range, enrollment_type, admission_timeline'
          )
          .eq('user_id', user.id)
          .maybeSingle();

        if (!cancelled) {
          setProfile(data);
          setLoading(false);
        }
      });

      return () => {
        cancelled = true;
      };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setPostsLoading(true);
      setPostsError(null);

      supabase.auth.getUser().then(async ({ data: userData }) => {
        const user = userData.user;
        if (!user) {
          if (!cancelled) {
            setPosts([]);
            setPostsLoading(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from('community_posts')
          .select('id, title, channel, likes_count, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (cancelled) return;
        if (error) {
          setPostsError(error.message);
        } else {
          setPosts((data ?? []) as Post[]);
        }
        setPostsLoading(false);
      });

      return () => {
        cancelled = true;
      };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      Promise.all([
        getSavedIds(),
        getSavedSchoolIds(),
        listSavedSearches(),
      ]).then(([scholarshipIds, schoolIds, searches]) => {
        if (cancelled) return;
        setSavedScholarshipCount(scholarshipIds.length);
        setSavedSchoolCount(schoolIds.size);
        setSavedSearchCount(searches.length);
      });

      return () => {
        cancelled = true;
      };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      supabase.auth.getUser().then(async ({ data: userData }) => {
        const user = userData.user;
        if (!user) return;

        const { data } = await supabase
          .from('application_documents')
          .select('status')
          .eq('user_id', user.id);

        if (cancelled || !data) return;

        const stats: DocStats = { complete: 0, inProgress: 0, needed: 0 };
        for (const doc of data) {
          if (doc.status === 'complete') stats.complete++;
          else if (doc.status === 'in-progress') stats.inProgress++;
          else stats.needed++;
        }
        setDocStats(stats);
      });

      return () => {
        cancelled = true;
      };
    }, [])
  );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  const handlePickAvatar = async () => {
    if (!userId) return;
    setUploadingAvatar(true);

    const { url, error } = await pickAndUploadAvatar(userId);

    if (error) {
      setUploadingAvatar(false);
      Alert.alert("Couldn't update photo", error);
      return;
    }

    if (url) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_picture_url: url })
        .eq('user_id', userId);

      if (updateError) {
        setUploadingAvatar(false);
        Alert.alert("Couldn't save photo", updateError.message);
        return;
      }

      setProfile((prev) => (prev ? { ...prev, profile_picture_url: url } : prev));
    }

    setUploadingAvatar(false);
  };

  const handleStartEditBio = () => {
    setBioDraft(profile?.bio ?? '');
    setEditingBio(true);
  };

  const handleSaveBio = async () => {
    if (!userId) {
      setEditingBio(false);
      return;
    }

    setSavingBio(true);
    const trimmed = bioDraft.trim().slice(0, BIO_MAX_LENGTH);
    await supabase.from('profiles').update({ bio: trimmed || null }).eq('user_id', userId);
    setProfile((prev) => (prev ? { ...prev, bio: trimmed || null } : prev));
    setSavingBio(false);
    setEditingBio(false);
  };

  const dreamSchoolSlots: string[] = [0, 1, 2].map((i) => profile?.dream_schools?.[i] ?? '');

  const persistDreamSchools = async (slots: string[]) => {
    if (!userId) return;
    const cleaned = slots.filter((name) => name.trim() !== '');
    await supabase.from('profiles').update({ dream_schools: cleaned }).eq('user_id', userId);
    setProfile((prev) => (prev ? { ...prev, dream_schools: cleaned } : prev));
  };

  const handleSelectSchool = (schoolName: string) => {
    if (schoolPickerSlot == null) return;
    const next = [...dreamSchoolSlots];
    next[schoolPickerSlot] = schoolName;
    persistDreamSchools(next);
    setSchoolPickerSlot(null);
    setSchoolSearch('');
  };

  const handleRemoveDreamSchool = (slotIndex: number) => {
    const next = [...dreamSchoolSlots];
    next[slotIndex] = '';
    persistDreamSchools(next);
  };

  const handleChangePassword = async () => {
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);

    if (error) {
      setPasswordError(error.message);
      return;
    }

    setShowChangePassword(false);
    setNewPassword('');
    setConfirmPassword('');
    Alert.alert('Password Updated', 'Your password has been changed successfully.');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'To permanently delete your account and all data, please email support@studybridge.app with the subject "Account Deletion Request".',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out Now',
          style: 'destructive',
          onPress: handleSignOut,
        },
      ]
    );
  };

  const filteredSchools = allSchools.filter((school) =>
    school.name.toLowerCase().includes(schoolSearch.toLowerCase().trim())
  );

  const academicBadges = [
    { label: 'Degree', value: profile?.degree_level ? DEGREE_LEVEL_LABELS[profile.degree_level] ?? profile.degree_level : 'Add degree' },
    { label: 'GPA', value: profile?.gpa_range ?? 'Add GPA' },
    { label: 'Enrollment', value: profile?.enrollment_type ?? 'Add type' },
    { label: 'Timeline', value: profile?.admission_timeline ?? 'Add timeline' },
  ];

  const totalDocs = docStats.complete + docStats.inProgress + docStats.needed;

  if (loading) {
    return (
      <GradientBackground>
        <ActivityIndicator color={theme.textSecondary} style={styles.stateIndicator} />
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <View />
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push('/profile/edit-name')}
            activeOpacity={0.8}
          >
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroSection}>
          <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.8} disabled={uploadingAvatar}>
            <View style={styles.avatar}>
              {uploadingAvatar ? (
                <ActivityIndicator color={theme.accentText} />
              ) : profile?.profile_picture_url ? (
                <Image source={{ uri: profile.profile_picture_url }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{getInitials(profile?.full_name ?? null)}</Text>
              )}
            </View>
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditIcon}>📷</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.fullName}>{profile?.full_name || 'Add your name'}</Text>

          {profile?.country_of_origin && (
            <Text style={styles.countryLine}>
              {getCountryFlag(profile.country_of_origin)} {profile.country_of_origin}
            </Text>
          )}

          <Text style={styles.tagline}>
            {profile?.field_of_study ? `Aspiring ${profile.field_of_study}` : 'Add your field of study'}
          </Text>
        </View>

        {editingBio ? (
          <View style={styles.bioEditBox}>
            <TextInput
              style={styles.bioInput}
              placeholder="Tell your story — where you're from, where you're going..."
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={bioDraft}
              onChangeText={(text) => setBioDraft(text.slice(0, BIO_MAX_LENGTH))}
              multiline
              autoFocus
              onBlur={handleSaveBio}
            />
            <View style={styles.bioFooterRow}>
              <Text style={styles.bioCounter}>
                {bioDraft.length}/{BIO_MAX_LENGTH}
              </Text>
              <TouchableOpacity onPress={handleSaveBio} disabled={savingBio}>
                <Text style={styles.bioSaveText}>{savingBio ? 'Saving…' : 'Done'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.bioBox} onPress={handleStartEditBio} activeOpacity={0.7}>
            <Text style={profile?.bio ? styles.bioText : styles.bioPlaceholder}>
              {profile?.bio || "Tell your story — where you're from, where you're going..."}
            </Text>
          </TouchableOpacity>
        )}

        {/* Academic badges — tap to edit-academic */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgeRow} contentContainerStyle={styles.badgeRowContent}>
          {academicBadges.map((badge) => (
            <TouchableOpacity
              key={badge.label}
              style={styles.badge}
              onPress={() => router.push('/profile/edit-academic')}
              activeOpacity={0.8}
            >
              <Text style={styles.badgeLabel}>{badge.label}</Text>
              <Text style={styles.badgeValue}>{badge.value}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.sectionTitle}>Dream Schools 🎓</Text>
        <View style={styles.dreamSchoolsRow}>
          {dreamSchoolSlots.map((schoolName, index) =>
            schoolName ? (
              <View key={index} style={styles.dreamSchoolSlotFilled}>
                <Text style={styles.dreamSchoolName} numberOfLines={2}>
                  {schoolName}
                </Text>
                <TouchableOpacity
                  onPress={() => handleRemoveDreamSchool(index)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.dreamSchoolRemove}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                key={index}
                style={styles.dreamSchoolSlotEmpty}
                onPress={() => setSchoolPickerSlot(index)}
                activeOpacity={0.8}
              >
                <Text style={styles.dreamSchoolAddIcon}>+</Text>
                <Text style={styles.dreamSchoolAddText}>Add School</Text>
              </TouchableOpacity>
            )
          )}
        </View>

        {/* Saved items summary */}
        <Text style={styles.sectionTitle}>My Saved Items</Text>
        <TouchableOpacity
          style={styles.summaryCard}
          onPress={() => router.push('/(tabs)/saved')}
          activeOpacity={0.8}
        >
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryCount}>{savedScholarshipCount}</Text>
              <Text style={styles.summaryLabel}>Scholarships</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryCount}>{savedSchoolCount}</Text>
              <Text style={styles.summaryLabel}>Schools</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryCount}>{savedSearchCount}</Text>
              <Text style={styles.summaryLabel}>Searches</Text>
            </View>
          </View>
          <Text style={styles.summaryChevron}>View All ›</Text>
        </TouchableOpacity>

        {/* Document tracker summary */}
        <Text style={styles.sectionTitle}>Application Documents 📄</Text>
        <TouchableOpacity
          style={styles.summaryCard}
          onPress={() => router.push('/(tabs)/documents')}
          activeOpacity={0.8}
        >
          {totalDocs === 0 ? (
            <Text style={styles.cardBody}>No documents tracked yet. Tap to start tracking.</Text>
          ) : (
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryCount, styles.summaryCountComplete]}>{docStats.complete}</Text>
                <Text style={styles.summaryLabel}>Complete</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryCount, styles.summaryCountInProgress]}>{docStats.inProgress}</Text>
                <Text style={styles.summaryLabel}>In Progress</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryCount, styles.summaryCountNeeded]}>{docStats.needed}</Text>
                <Text style={styles.summaryLabel}>Needed</Text>
              </View>
            </View>
          )}
          <Text style={styles.summaryChevron}>Manage ›</Text>
        </TouchableOpacity>

        {/* Smart Matching */}
        <Text style={styles.sectionTitle}>Smart Matching 🎯</Text>
        <TouchableOpacity
          style={styles.summaryCard}
          onPress={() => router.push('/profile-setup')}
          activeOpacity={0.8}
        >
          <Text style={styles.cardBody}>
            {savedSearchCount > 0
              ? `${savedSearchCount} saved search${savedSearchCount > 1 ? 'es' : ''}. Tap to run a new search or view saved results.`
              : 'Find your perfect university and scholarship matches.'}
          </Text>
          <Text style={styles.summaryChevron}>Start ›</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>My Posts</Text>

        {postsLoading && <ActivityIndicator color={theme.textSecondary} style={styles.stateIndicator} />}

        {!postsLoading && postsError && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>⚠️ Couldn't load your posts</Text>
            <Text style={styles.cardBody}>{postsError}</Text>
          </View>
        )}

        {!postsLoading && !postsError && posts.length === 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No posts yet</Text>
            <Text style={styles.cardBody}>Share something in the Student Community to see it here.</Text>
          </View>
        )}

        {!postsLoading &&
          !postsError &&
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
                <Text style={styles.postDate}>{formatPostDate(post.created_at)}</Text>
              </View>
              <Text style={styles.postTitle}>{post.title}</Text>
              <View style={styles.likeRow}>
                <Text style={styles.likeIcon}>♥</Text>
                <Text style={styles.likeCount}>{post.likes_count ?? 0}</Text>
              </View>
            </TouchableOpacity>
          ))}

        <TouchableOpacity
          style={styles.settingsHeader}
          onPress={() => setSettingsExpanded((prev) => !prev)}
          activeOpacity={0.8}
        >
          <Text style={styles.sectionTitle}>Settings</Text>
          <Text style={styles.settingsChevron}>{settingsExpanded ? '⌃' : '⌄'}</Text>
        </TouchableOpacity>

        {settingsExpanded && (
          <>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.7}
                onPress={() => Alert.alert('Notifications', 'Notification settings coming soon.')}
              >
                <Text style={styles.rowIcon}>🔔</Text>
                <Text style={styles.menuLabel}>Notifications</Text>
                <Text style={styles.menuChevron}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.7}
                onPress={() => Alert.alert('Privacy & Security', 'Privacy settings coming soon.')}
              >
                <Text style={styles.rowIcon}>🔒</Text>
                <Text style={styles.menuLabel}>Privacy & Security</Text>
                <Text style={styles.menuChevron}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.7}
                onPress={() => setShowChangePassword(true)}
              >
                <Text style={styles.rowIcon}>🔑</Text>
                <Text style={styles.menuLabel}>Change Password</Text>
                <Text style={styles.menuChevron}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.7}
                onPress={() => Alert.alert('Help & Support', 'Email us at support@studybridge.app for help.')}
              >
                <Text style={styles.rowIcon}>❓</Text>
                <Text style={styles.menuLabel}>Help & Support</Text>
                <Text style={styles.menuChevron}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.menuItem, styles.rowLast]}
                activeOpacity={0.7}
                onPress={handleDeleteAccount}
              >
                <Text style={styles.rowIcon}>🗑️</Text>
                <Text style={[styles.menuLabel, styles.destructiveLabel]}>Delete Account</Text>
                <Text style={styles.menuChevron}>›</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.8}>
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* School picker modal */}
      <Modal
        visible={schoolPickerSlot != null}
        animationType="slide"
        transparent
        onRequestClose={() => setSchoolPickerSlot(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSchoolPickerSlot(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Add a Dream School</Text>
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search schools..."
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={schoolSearch}
              onChangeText={setSchoolSearch}
              autoCapitalize="none"
            />
            <ScrollView style={styles.modalList}>
              {filteredSchools.map((school) => (
                <TouchableOpacity
                  key={school.id}
                  style={styles.modalOption}
                  onPress={() => handleSelectSchool(school.name)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalOptionText}>{school.name}</Text>
                  {school.location && <Text style={styles.modalOptionSub}>{school.location}</Text>}
                </TouchableOpacity>
              ))}
              {filteredSchools.length === 0 && (
                <Text style={styles.cardBody}>No schools found.</Text>
              )}
            </ScrollView>
            <Pressable style={styles.cancelButton} onPress={() => setSchoolPickerSlot(null)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Change password modal */}
      <Modal
        visible={showChangePassword}
        animationType="slide"
        transparent
        onRequestClose={() => setShowChangePassword(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowChangePassword(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Change Password</Text>

            <Text style={styles.passwordLabel}>New Password</Text>
            <TextInput
              style={styles.passwordInput}
              placeholder="At least 8 characters"
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <Text style={styles.passwordLabel}>Confirm New Password</Text>
            <TextInput
              style={styles.passwordInput}
              placeholder="Repeat new password"
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            {passwordError && (
              <Text style={styles.passwordError}>{passwordError}</Text>
            )}

            <TouchableOpacity
              style={[styles.passwordSaveButton, changingPassword && { opacity: 0.6 }]}
              onPress={handleChangePassword}
              disabled={changingPassword}
              activeOpacity={0.8}
            >
              {changingPassword ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.passwordSaveText}>Update Password</Text>
              )}
            </TouchableOpacity>

            <Pressable style={styles.cancelButton} onPress={() => {
              setShowChangePassword(false);
              setNewPassword('');
              setConfirmPassword('');
              setPasswordError(null);
            }}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 120,
  },
  stateIndicator: {
    marginTop: 80,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  editButton: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 96,
    height: 96,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.accentText,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0A2463',
  },
  avatarEditIcon: {
    fontSize: 14,
  },
  fullName: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.textPrimary,
    marginTop: 16,
  },
  countryLine: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 6,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.accent,
    marginTop: 6,
  },
  bioBox: {
    backgroundColor: theme.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 16,
    marginBottom: 20,
  },
  bioText: {
    fontSize: 14,
    color: theme.textPrimary,
    lineHeight: 20,
  },
  bioPlaceholder: {
    fontSize: 14,
    color: theme.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  bioEditBox: {
    backgroundColor: theme.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.accent,
    padding: 16,
    marginBottom: 20,
  },
  bioInput: {
    fontSize: 14,
    color: theme.textPrimary,
    lineHeight: 20,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  bioFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  bioCounter: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  bioSaveText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.accent,
  },
  badgeRow: {
    flexGrow: 0,
    marginBottom: 8,
  },
  badgeRowContent: {
    paddingRight: 8,
  },
  badge: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 10,
    minWidth: 110,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  badgeValue: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 12,
  },
  dreamSchoolsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dreamSchoolSlotFilled: {
    flex: 1,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: 16,
    padding: 12,
    minHeight: 88,
    justifyContent: 'space-between',
  },
  dreamSchoolName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  dreamSchoolRemove: {
    fontSize: 14,
    color: theme.textSecondary,
    alignSelf: 'flex-end',
  },
  dreamSchoolSlotEmpty: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.accent,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 12,
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dreamSchoolAddIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.accent,
    marginBottom: 4,
  },
  dreamSchoolAddText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.accent,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: theme.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 20,
    ...theme.shadow,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: theme.border,
  },
  summaryCount: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.textPrimary,
  },
  summaryCountComplete: {
    color: '#4ADE80',
  },
  summaryCountInProgress: {
    color: '#FACC15',
  },
  summaryCountNeeded: {
    color: theme.textSecondary,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textSecondary,
    marginTop: 2,
  },
  summaryChevron: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.accent,
    textAlign: 'right',
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
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 6,
  },
  cardBody: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 19,
    marginBottom: 8,
  },
  postCard: {
    backgroundColor: theme.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 16,
    marginBottom: 10,
  },
  postMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  channelTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  channelTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  postDate: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  postTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  likeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeIcon: {
    fontSize: 12,
    color: theme.accent,
    marginRight: 4,
  },
  likeCount: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingsChevron: {
    fontSize: 16,
    color: theme.textSecondary,
    marginTop: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowIcon: {
    fontSize: 18,
    marginRight: 16,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  destructiveLabel: {
    color: '#F87171',
  },
  menuChevron: {
    fontSize: 20,
    color: theme.accent,
  },
  signOutButton: {
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0A2463',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '75%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.textPrimary,
    marginBottom: 16,
  },
  modalSearchInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.textPrimary,
    marginBottom: 12,
  },
  modalList: {
    marginBottom: 8,
  },
  modalOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  modalOptionSub: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  cancelButtonText: {
    color: theme.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  passwordLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  passwordInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.textPrimary,
  },
  passwordError: {
    fontSize: 13,
    color: '#F87171',
    marginTop: 10,
    fontWeight: '600',
  },
  passwordSaveButton: {
    backgroundColor: theme.accent,
    borderRadius: 30,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  passwordSaveText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.accentText,
  },
});
