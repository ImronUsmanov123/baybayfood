-- Roles
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

create policy "user_roles_select_own" on public.user_roles
for select to authenticated using (auth.uid() = user_id);

create policy "user_roles_admin_all" on public.user_roles
for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- Orders: manual payment verification fields
alter table public.orders
  add column if not exists receipt_url text,
  add column if not exists payment_reference text,
  add column if not exists paid_amount numeric,
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid,
  add column if not exists rejection_reason text;

create index if not exists orders_payment_status_idx on public.orders (payment_status, created_at desc);

create policy "orders_admin_select" on public.orders
for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy "orders_admin_update" on public.orders
for update to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- App settings: payment instructions
drop policy if exists app_settings_select_public_keys on public.app_settings;

create policy "app_settings_select_payment" on public.app_settings
for select to authenticated
using (key like 'payment_%');

create policy "app_settings_admin_all" on public.app_settings
for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

insert into public.app_settings (key, value) values
  ('payment_card_number', '8600 1234 5678 9012'),
  ('payment_card_holder', 'OSH PIZZA LLC'),
  ('payment_bank_name', 'Kapitalbank'),
  ('payment_instructions', 'Transfer the exact order total to the card above, then upload your receipt screenshot and the transaction reference. We verify transfers within 10 minutes.'),
  ('payment_qr_url', '')
on conflict (key) do nothing;