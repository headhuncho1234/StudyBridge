-- Community rich posts: link attachments.
-- Neither community_posts nor comments had link_url/link_title columns
-- (confirmed via REST probing). images already exists on both tables as a
-- text[] (used for image attachments), so only the link columns are added here.

alter table public.community_posts add column if not exists link_url text;
alter table public.community_posts add column if not exists link_title text;

alter table public.comments add column if not exists link_url text;
alter table public.comments add column if not exists link_title text;
