drop extension if exists pg_net;
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_order_status()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _lang text;
  _short text;
  _copy text[];
  _base text;
  _key text;
  _notif_id uuid;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  select coalesce(language, 'uz') into _lang from public.profiles where id = new.user_id;
  _short := '#' || upper(substring(new.id::text, 1, 8));
  _copy := public.order_status_copy(new.status, coalesce(_lang, 'uz'), _short);

  insert into public.notifications (user_id, kind, title, body, order_id)
  values (new.user_id, 'order_' || new.status, _copy[1], _copy[2], new.id)
  returning id into _notif_id;

  select value into _base from public.app_settings where key = 'app_base_url';
  select value into _key from public.app_settings where key = 'telegram_bot_token';

  if coalesce(_base, '') <> '' and coalesce(_key, '') <> '' then
    begin
      perform extensions.http_post(
        url := _base || '/api/public/telegram/order-status',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object('notification_id', _notif_id, 'order_id', new.id, 'status', new.status)
      );
    exception when others then
      null;
    end;
  end if;

  return new;
end
$$;
revoke execute on function public.notify_order_status() from public, anon, authenticated;