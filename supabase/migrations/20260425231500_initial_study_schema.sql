create table if not exists public.user_video_activity (
  user_id text not null,
  video_id text not null,
  video_title text,
  opened_count integer not null default 0,
  total_word_clicks integer not null default 0,
  flashcards_created integer not null default 0,
  last_opened_at text not null,
  created_at text not null,
  primary key (user_id, video_id)
);

create table if not exists public.user_word_activity (
  user_id text not null,
  word text not null,
  click_count integer not null default 0,
  flashcard_count integer not null default 0,
  last_clicked_at text,
  last_flashcard_at text,
  last_sentence text,
  primary key (user_id, word)
);

create table if not exists public.user_video_word_activity (
  user_id text not null,
  video_id text not null,
  word text not null,
  click_count integer not null default 0,
  flashcard_count integer not null default 0,
  last_clicked_at text,
  last_flashcard_at text,
  last_sentence text,
  primary key (user_id, video_id, word)
);

create table if not exists public.user_anki_exports (
  user_id text not null,
  video_id text not null,
  word text not null,
  sentence text not null,
  note_id bigint not null,
  deck_name text not null,
  model_name text not null,
  exported_at text not null,
  primary key (user_id, video_id, word, sentence)
);

create index if not exists user_video_activity_user_last_opened_idx
  on public.user_video_activity (user_id, last_opened_at desc);

create index if not exists user_word_activity_user_last_seen_idx
  on public.user_word_activity (
    user_id,
    coalesce(last_flashcard_at, last_clicked_at) desc,
    click_count desc
  );

create index if not exists user_video_word_activity_user_video_click_idx
  on public.user_video_word_activity (user_id, video_id, click_count desc);

create index if not exists user_anki_exports_user_exported_at_idx
  on public.user_anki_exports (user_id, exported_at desc);

