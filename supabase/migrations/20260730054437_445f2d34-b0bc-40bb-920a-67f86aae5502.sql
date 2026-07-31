create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  avatar_url text,
  phone text,
  address text,
  language text not null default 'ru' check (language in ('en','ru','uz')),
  telegram_chat_id bigint unique,
  telegram_username text,
  first_name text,
  last_name text,
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);

create table public.telegram_accounts (
  chat_id bigint primary key,
  phone text not null unique,
  username text,
  first_name text,
  last_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant all on public.telegram_accounts to service_role;
alter table public.telegram_accounts enable row level security;
create policy "telegram_accounts_no_access" on public.telegram_accounts for all to anon, authenticated using (false) with check (false);

create table public.telegram_login_requests (
  id uuid primary key default gen_random_uuid(),
  start_token text not null unique,
  phone text not null,
  chat_id bigint,
  telegram_username text,
  telegram_first_name text,
  telegram_last_name text,
  code_hash text,
  code_sent_at timestamptz,
  resend_count int not null default 0,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  verified_at timestamptz,
  consumed_at timestamptz,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);
grant all on public.telegram_login_requests to service_role;
alter table public.telegram_login_requests enable row level security;
create policy "tg_login_no_access" on public.telegram_login_requests for all to anon, authenticated using (false) with check (false);
create index tg_login_start_token_idx on public.telegram_login_requests(start_token);
create index tg_login_phone_idx on public.telegram_login_requests(phone);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  items jsonb not null,
  subtotal numeric(12,2) not null,
  delivery numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  payment_method text not null check (payment_method in ('click','payme','cash','card')),
  address text not null,
  phone text,
  comment text,
  promo_code text,
  paid boolean not null default false,
  paid_at timestamptz,
  status text not null default 'placed' check (status in ('placed','cooking','on_the_way','arriving_soon','delivered','cancelled')),
  receipt_url text,
  payment_reference text,
  paid_amount numeric,
  payment_status text not null default 'unpaid',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "orders_select_own" on public.orders for select to authenticated using (auth.uid() = user_id);
create policy "orders_insert_own" on public.orders for insert to authenticated with check (auth.uid() = user_id);
create policy "orders_update_own" on public.orders for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index orders_user_idx on public.orders(user_id, created_at desc);
create index orders_payment_status_idx on public.orders (payment_status, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  image_url text,
  order_id uuid references public.orders(id) on delete set null,
  delivered_to_telegram boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "notifications_select_own" on public.notifications for select to authenticated using (auth.uid() = user_id);
create policy "notifications_update_own" on public.notifications for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index notifications_user_idx on public.notifications(user_id, created_at desc);

create table public.telegram_admins (
  chat_id bigint primary key,
  label text,
  created_at timestamptz not null default now()
);
grant all on public.telegram_admins to service_role;
alter table public.telegram_admins enable row level security;
create policy "telegram_admins_no_access" on public.telegram_admins for all to anon, authenticated using (false) with check (false);

create table public.promo_codes (
  code text primary key,
  discount_percent integer not null default 0,
  discount_amount numeric(12,2) not null default 0,
  min_subtotal numeric(12,2) not null default 0,
  free_delivery boolean not null default false,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
grant select on public.promo_codes to authenticated;
grant all on public.promo_codes to service_role;
alter table public.promo_codes enable row level security;
create policy "promo_codes_select_active" on public.promo_codes for select to authenticated using (active = true);

create table public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
grant select on public.app_settings to authenticated;
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;

create type public.app_role as enum ('admin', 'moderator', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

create policy "user_roles_select_own" on public.user_roles
for select to authenticated using (auth.uid() = user_id);
create policy "user_roles_admin_all" on public.user_roles
for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "orders_admin_select" on public.orders
for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "orders_admin_update" on public.orders
for update to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "app_settings_select_payment" on public.app_settings
for select to authenticated
using (key like 'payment_%');
create policy "app_settings_admin_all" on public.app_settings
for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

insert into public.promo_codes (code, discount_percent, min_subtotal) values ('WELCOME10', 10, 0);
insert into public.promo_codes (code, discount_percent, min_subtotal) values ('OSH15', 15, 100000);
insert into public.promo_codes (code, free_delivery) values ('FREEDEL', true);
insert into public.app_settings (key, value) values
  ('payment_card_number', '8600 1234 5678 9012'),
  ('payment_card_holder', 'OSH PIZZA LLC'),
  ('payment_bank_name', 'Kapitalbank'),
  ('payment_instructions', 'Transfer the exact order total to the card above, then upload your receipt screenshot and the transaction reference. We verify transfers within 10 minutes.'),
  ('payment_qr_url', '')
on conflict (key) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end
$$;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_telegram_accounts_updated before update on public.telegram_accounts
  for each row execute function public.set_updated_at();
create trigger trg_orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

create policy "receipts_insert_own" on storage.objects
for insert to authenticated
with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "receipts_select_own" on storage.objects
for select to authenticated
using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "receipts_update_own" on storage.objects
for update to authenticated
using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "receipts_select_admin" on storage.objects
for select to authenticated
using (bucket_id = 'receipts' and public.has_role(auth.uid(), 'admin'));

do $$
begin
  begin
    alter publication supabase_realtime add table public.orders;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then null;
  end;
end $$;