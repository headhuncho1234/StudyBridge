import { supabase } from './supabase';

export type Comment = {
  id: string;
  post_id: string;
  parent_comment_id: string | null;
  user_id: string;
  content: string;
  images: string[] | null;
  link_url: string | null;
  link_title: string | null;
  likes_count: number | null;
  created_at: string;
  author_name: string;
};

export type CommentWithReplies = Comment & { replies: Comment[] };

export async function listComments(postId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(
      'id, post_id, parent_comment_id, user_id, content, images, link_url, link_title, likes_count, created_at'
    )
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  const userIds = Array.from(new Set(data.map((comment) => comment.user_id)));
  const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);

  const nameByUserId = new Map((profiles ?? []).map((profile) => [profile.user_id, profile.full_name]));

  return data.map((comment) => ({
    ...comment,
    author_name: nameByUserId.get(comment.user_id) || 'Student',
  })) as Comment[];
}

/** Groups a flat comment list into top-level comments with their direct replies — capped at 2 levels deep. */
export function buildCommentTree(comments: Comment[]): CommentWithReplies[] {
  const topLevel = comments.filter((comment) => !comment.parent_comment_id);

  return topLevel.map((comment) => ({
    ...comment,
    replies: comments.filter((reply) => reply.parent_comment_id === comment.id),
  }));
}

export async function createComment(params: {
  postId: string;
  userId: string;
  content: string;
  parentCommentId?: string | null;
  images?: string[];
  linkUrl?: string | null;
  linkTitle?: string | null;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('comments').insert({
    post_id: params.postId,
    user_id: params.userId,
    content: params.content,
    parent_comment_id: params.parentCommentId ?? null,
    images: params.images ?? [],
    link_url: params.linkUrl ?? null,
    link_title: params.linkTitle ?? null,
  });

  if (error) return { error: error.message };

  const { data: post } = await supabase
    .from('community_posts')
    .select('comments_count')
    .eq('id', params.postId)
    .maybeSingle();

  await supabase
    .from('community_posts')
    .update({ comments_count: (post?.comments_count ?? 0) + 1 })
    .eq('id', params.postId);

  return { error: null };
}
