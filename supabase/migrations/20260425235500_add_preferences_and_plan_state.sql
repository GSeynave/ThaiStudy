create table if not exists public.user_preferences (
  user_id text primary key,
  default_deck_name text,
  auto_export_to_anki boolean not null default false,
  theme text not null default 'cozy',
  show_tone_colors boolean not null default false,
  updated_at text not null
);

create table if not exists public.user_plan_state (
  user_id text primary key,
  plan_tier text not null default 'free',
  plan_status text not null default 'active',
  monthly_flashcard_limit integer not null default 20,
  current_period_starts_at text,
  current_period_ends_at text,
  updated_at text not null
);

create index if not exists user_plan_state_tier_status_idx
  on public.user_plan_state (plan_tier, plan_status);
