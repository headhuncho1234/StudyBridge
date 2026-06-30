import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
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
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { theme } from '../../lib/theme';
import GradientBackground from '../../components/GradientBackground';
import { buildCommentTree, createComment, listComments, Comment } from '../../lib/communityComments';
import { pickCommunityImage } from '../../lib/communityImages';

const CHANNEL_LABELS: Record<string, string> = {
  general: 'General',
  housing: 'Housing',
  roommates: 'Roommates',
  wellness: 'Wellness',
  scholarships: 'Scholarships',
  visa: 'Visa',
  career: 'Career',
};

type PostDetail = {
  id: string;
  title: string;
  content: string;
  author_name: string | null;
  channel: string;
  likes_count: number | null;
  comments_count: number | null;
  images: string[] | null;
  link_url: string | null;
  link_title: string | null;
  created_at: string;
};

function formatDate(isoDate: string) {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

function CommentRow({
  comment,
  isReply,
  onReplyPress,
}: {
  comment: Comment;
  isReply: boolean;
  onReplyPress: (comment: Comment) => void;
}) {
  return (
    <View style={[styles.commentRow, isReply && styles.replyRow]}>
      <View style={styles.commentHeaderRow}>
        <Text style={styles.commentAuthor}>{comment.author_name}</Text>
        <Text style={styles.commentDate}>{formatRelativeTime(comment.created_at)}</Text>
      </View>
      <Text style={styles.commentContent}>{stripHtml(comment.content)}</Text>

      {(comment.images?.length ?? 0) > 0 && (
        <Image source={{ uri: comment.images![0] }} style={styles.commentImage} />
      )}

      {comment.link_url && (
        <TouchableOpacity onPress={() => Linking.openURL(comment.link_url!)} activeOpacity={0.8}>
          <View style={styles.linkCard}>
            <Text style={styles.linkCardTitle}>{comment.link_title || comment.link_url}</Text>
            <Text style={styles.linkCardUrl} numberOfLines={1}>
              {comment.link_url}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {!isReply && (
        <TouchableOpacity onPress={() => onReplyPress(comment)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.replyLink}>Reply</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liking, setLiking] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [commentText, setCommentText] = useState('');
  const [commentImageUrl, setCommentImageUrl] = useState<string | null>(null);
  const [uploadingCommentImage, setUploadingCommentImage] = useState(false);
  const [showCommentLinkFields, setShowCommentLinkFields] = useState(false);
  const [commentLinkUrl, setCommentLinkUrl] = useState('');
  const [commentLinkTitle, setCommentLinkTitle] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);

  const loadPost = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from('community_posts')
      .select(
        'id, title, content, author_name, channel, likes_count, comments_count, images, link_url, link_title, created_at'
      )
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) {
          setError(fetchError.message);
        } else {
          setPost(data as PostDetail | null);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const loadComments = useCallback(() => {
    let cancelled = false;
    setCommentsLoading(true);

    listComments(id).then((data) => {
      if (!cancelled) {
        setComments(data);
        setCommentsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      const cancelPost = loadPost();
      const cancelComments = loadComments();
      supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
      return () => {
        cancelPost();
        cancelComments();
      };
    }, [loadPost, loadComments])
  );

  const handleLike = async () => {
    if (!post || liking) return;
    setLiking(true);

    const newCount = (post.likes_count ?? 0) + 1;
    const { error: updateError } = await supabase
      .from('community_posts')
      .update({ likes_count: newCount })
      .eq('id', post.id);

    setLiking(false);

    if (!updateError) {
      setPost({ ...post, likes_count: newCount });
    }
  };

  const handlePickCommentImage = async () => {
    if (!userId) return;
    setUploadingCommentImage(true);
    const { url, error: uploadError } = await pickCommunityImage(userId);
    if (uploadError) {
      setCommentError(uploadError);
    } else if (url) {
      setCommentImageUrl(url);
    }
    setUploadingCommentImage(false);
  };

  const resetCommentComposer = () => {
    setCommentText('');
    setCommentImageUrl(null);
    setShowCommentLinkFields(false);
    setCommentLinkUrl('');
    setCommentLinkTitle('');
    setReplyingTo(null);
    setCommentError(null);
  };

  const handleSubmitComment = async () => {
    setCommentError(null);

    if (!commentText.trim()) {
      setCommentError('Write something before posting.');
      return;
    }
    if (!userId) {
      setCommentError('You must be signed in to comment.');
      return;
    }
    if (showCommentLinkFields && commentLinkUrl.trim() && !/^https?:\/\//i.test(commentLinkUrl.trim())) {
      setCommentError('Link must start with http:// or https://');
      return;
    }

    setPostingComment(true);

    // Cap threading at 2 levels: replying to a reply attaches to that reply's
    // top-level parent, not the reply itself.
    const parentCommentId = replyingTo ? replyingTo.parent_comment_id ?? replyingTo.id : null;

    const { error: createError } = await createComment({
      postId: id,
      userId,
      content: commentText.trim(),
      parentCommentId,
      images: commentImageUrl ? [commentImageUrl] : [],
      linkUrl: showCommentLinkFields && commentLinkUrl.trim() ? commentLinkUrl.trim() : null,
      linkTitle: showCommentLinkFields && commentLinkTitle.trim() ? commentLinkTitle.trim() : null,
    });

    setPostingComment(false);

    if (createError) {
      setCommentError(createError);
      return;
    }

    resetCommentComposer();
    loadComments();
    setPost((prev) => (prev ? { ...prev, comments_count: (prev.comments_count ?? 0) + 1 } : prev));
  };

  const commentTree = buildCommentTree(comments);

  return (
    <GradientBackground>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </Pressable>

        {loading && <ActivityIndicator color={theme.textSecondary} style={styles.stateIndicator} />}

        {!loading && error && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>⚠️ Couldn't load post</Text>
            <Text style={styles.cardBody}>{error}</Text>
          </View>
        )}

        {!loading && !error && !post && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Post not found</Text>
            <Text style={styles.cardBody}>This post may have been removed.</Text>
          </View>
        )}

        {!loading && !error && post && (
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <View style={styles.channelTag}>
                <Text style={styles.channelTagText}>{CHANNEL_LABELS[post.channel] ?? post.channel}</Text>
              </View>

              <Text style={styles.title}>{post.title}</Text>

              <View style={styles.metaRow}>
                <Text style={styles.author}>{post.author_name ?? 'Student'}</Text>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.date}>{formatDate(post.created_at)}</Text>
              </View>

              <Text style={styles.body}>{stripHtml(post.content)}</Text>

              {(post.images?.length ?? 0) > 0 && (
                <Image source={{ uri: post.images![0] }} style={styles.postImage} />
              )}

              {post.link_url && (
                <TouchableOpacity onPress={() => Linking.openURL(post.link_url!)} activeOpacity={0.8}>
                  <View style={styles.linkCard}>
                    <Text style={styles.linkCardTitle}>{post.link_title || post.link_url}</Text>
                    <Text style={styles.linkCardUrl} numberOfLines={1}>
                      {post.link_url}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.likeButton} onPress={handleLike} disabled={liking} activeOpacity={0.8}>
                <Text style={styles.likeIcon}>♥</Text>
                <Text style={styles.likeButtonText}>{post.likes_count ?? 0}</Text>
              </TouchableOpacity>

              <Text style={styles.commentsHeading}>
                Comments ({post.comments_count ?? comments.length})
              </Text>

              {commentsLoading && <ActivityIndicator color={theme.textSecondary} style={styles.stateIndicator} />}

              {!commentsLoading && commentTree.length === 0 && (
                <Text style={styles.cardBody}>No comments yet. Be the first to reply.</Text>
              )}

              {!commentsLoading &&
                commentTree.map((comment) => (
                  <View key={comment.id}>
                    <CommentRow comment={comment} isReply={false} onReplyPress={setReplyingTo} />
                    {comment.replies.map((reply) => (
                      <CommentRow key={reply.id} comment={reply} isReply onReplyPress={setReplyingTo} />
                    ))}
                  </View>
                ))}
            </ScrollView>
          </TouchableWithoutFeedback>
        )}

        {!loading && !error && post && (
          <View style={styles.composer}>
            {replyingTo && (
              <View style={styles.replyingBanner}>
                <Text style={styles.replyingBannerText}>Replying to {replyingTo.author_name}</Text>
                <TouchableOpacity onPress={() => setReplyingTo(null)}>
                  <Text style={styles.replyingBannerCancel}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            {commentImageUrl && (
              <View style={styles.composerImagePreviewWrap}>
                <Image source={{ uri: commentImageUrl }} style={styles.composerImagePreview} />
                <TouchableOpacity style={styles.removeImageButton} onPress={() => setCommentImageUrl(null)}>
                  <Text style={styles.removeImageText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            {showCommentLinkFields && (
              <View style={styles.linkFields}>
                <TextInput
                  style={styles.linkInput}
                  placeholder="https://example.com"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  value={commentLinkUrl}
                  onChangeText={setCommentLinkUrl}
                  autoCapitalize="none"
                  keyboardType="url"
                  returnKeyType="done"
                />
                <TextInput
                  style={styles.linkInput}
                  placeholder="Link title (optional)"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  value={commentLinkTitle}
                  onChangeText={setCommentLinkTitle}
                  returnKeyType="done"
                />
              </View>
            )}

            {commentError && (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>⚠️ {commentError}</Text>
              </View>
            )}

            <View style={styles.composerRow}>
              <TouchableOpacity
                onPress={handlePickCommentImage}
                disabled={uploadingCommentImage}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {uploadingCommentImage ? (
                  <ActivityIndicator color={theme.textSecondary} size="small" />
                ) : (
                  <Text style={styles.composerIcon}>📷</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowCommentLinkFields((prev) => !prev)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.composerIcon}>🔗</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.composerInput}
                placeholder={replyingTo ? 'Write a reply...' : 'Write a comment...'}
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendButton, (!commentText.trim() || postingComment) && styles.sendButtonDisabled]}
                onPress={handleSubmitComment}
                disabled={!commentText.trim() || postingComment}
                activeOpacity={0.8}
              >
                {postingComment ? (
                  <ActivityIndicator color={theme.accentText} size="small" />
                ) : (
                  <Text style={styles.sendButtonText}>➤</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
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
  stateIndicator: {
    marginTop: 40,
  },
  content: {
    padding: 24,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 20,
    marginHorizontal: 24,
    marginTop: 16,
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
  channelTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  channelTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.textPrimary,
    lineHeight: 32,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  author: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  dot: {
    fontSize: 14,
    color: theme.textSecondary,
    marginHorizontal: 6,
  },
  date: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  body: {
    fontSize: 16,
    color: theme.textPrimary,
    lineHeight: 24,
    marginBottom: 20,
  },
  postImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    marginBottom: 20,
  },
  linkCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 14,
    marginBottom: 20,
  },
  linkCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  linkCardUrl: {
    fontSize: 12,
    color: theme.accent,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: theme.card,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  likeIcon: {
    fontSize: 18,
    color: theme.accent,
    marginRight: 8,
  },
  likeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  commentsHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  commentRow: {
    backgroundColor: theme.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 14,
    marginBottom: 10,
  },
  replyRow: {
    marginLeft: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  commentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  commentDate: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  commentContent: {
    fontSize: 14,
    color: theme.textPrimary,
    lineHeight: 20,
  },
  commentImage: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    marginTop: 10,
  },
  replyLink: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.accent,
    marginTop: 8,
  },
  composer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  replyingBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  replyingBannerText: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  replyingBannerCancel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.accent,
  },
  composerImagePreviewWrap: {
    position: 'relative',
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  composerImagePreview: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  removeImageButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: {
    color: theme.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  linkFields: {
    marginBottom: 8,
    gap: 8,
  },
  linkInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: theme.textPrimary,
  },
  errorCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  errorText: {
    color: theme.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  composerIcon: {
    fontSize: 20,
    marginBottom: 10,
  },
  composerInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.textPrimary,
    maxHeight: 100,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: 16,
    color: theme.accentText,
    fontWeight: '700',
  },
});
