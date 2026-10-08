-- Additive migration. Existing participants/events are never deleted.
-- Activate reception events in /admin/staff after applying this migration.
begin;
create table public.staff_event_access (
  event_id uuid primary key references public.events(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  enabled boolean not null default false,
  recommended boolean not null default false,
  check (not recommended or enabled)
);
create unique index staff_one_recommended on public.staff_event_access(tenant_id) where recommended;

create table public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  token_hash text unique not null,
  label text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.staff_devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  token_hash text unique not null,
  label text not null,
  current_event_id uuid references public.events(id) on delete set null,
  -- Legacy passcode login remains scoped to that event only.
  allowed_event_id uuid references public.events(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index staff_devices_tenant on public.staff_devices(tenant_id);
create index staff_invites_tenant on public.staff_invites(tenant_id);
-- Tokens and access configuration must never be accessible through public API keys.
alter table public.staff_event_access enable row level security;
alter table public.staff_invites enable row level security;
alter table public.staff_devices enable row level security;
revoke all on public.staff_event_access, public.staff_invites, public.staff_devices from anon, authenticated;
grant all on public.staff_event_access, public.staff_invites, public.staff_devices to service_role;

create or replace function public.staff_redeem_invite(p_hash text, p_device_hash text)
returns uuid language plpgsql set search_path = public as $$
declare invitation staff_invites; device_id uuid;
begin
  select * into invitation from staff_invites where token_hash = p_hash for update;
  if not found or invitation.revoked_at is not null or invitation.consumed_at is not null or invitation.expires_at <= now() then
    raise exception 'Invitation unavailable';
  end if;
  insert into staff_devices(tenant_id,token_hash,label,expires_at)
  values(invitation.tenant_id,p_device_hash,invitation.label,now()+interval '7 days') returning id into device_id;
  update staff_invites set consumed_at=now() where id=invitation.id;
  return device_id;
end $$;

create or replace function public.staff_set_event_access(p_tenant uuid, p_event uuid, p_enabled boolean, p_recommended boolean)
returns void language plpgsql set search_path = public as $$
begin
  -- Serialize recommendation changes for a tenant.
  perform 1 from tenants where id=p_tenant for update;
  if not exists(select 1 from events where id=p_event and tenant_id=p_tenant) then raise exception 'Event unavailable'; end if;
  if p_recommended and not p_enabled then raise exception 'Closed event'; end if;
  if p_recommended then update staff_event_access set recommended=false where tenant_id=p_tenant; end if;
  insert into staff_event_access(event_id,tenant_id,enabled,recommended) values(p_event,p_tenant,p_enabled,p_recommended)
  on conflict(event_id) do update set enabled=excluded.enabled,recommended=excluded.recommended;
end $$;

create or replace function public.staff_switch_event(p_hash text, p_event uuid)
returns boolean language plpgsql set search_path = public as $$
declare device staff_devices;
begin
  select * into device from staff_devices where token_hash=p_hash for update;
  if not found or device.revoked_at is not null or device.expires_at <= now() then return false; end if;
  if device.allowed_event_id is not null and device.allowed_event_id <> p_event then return false; end if;
  perform 1 from staff_event_access a join events e on e.id=a.event_id
    where a.event_id=p_event and a.tenant_id=device.tenant_id and e.tenant_id=device.tenant_id and a.enabled for share of a;
  if not found then return false; end if;
  update staff_devices set current_event_id=p_event,last_seen_at=now() where id=device.id;
  return true;
end $$;

create or replace function public.staff_check_in(p_hash text, p_event uuid, p_token text)
returns jsonb language plpgsql set search_path = public as $$
declare device staff_devices; participant participations; candidate uuid; candidates uuid[]; display_name text; first_entry boolean;
begin
  -- Revocation, switching and concurrent scans serialize on this device.
  select * into device from staff_devices where token_hash=p_hash for update;
  if not found or device.revoked_at is not null or device.expires_at <= now() then
    return jsonb_build_object('success',false,'error','端末登録が無効です。管理者に招待QRの再発行を依頼してください。');
  end if;
  if p_event is null or device.current_event_id is distinct from p_event or (device.allowed_event_id is not null and device.allowed_event_id <> p_event) then
    return jsonb_build_object('success',false,'error','受付イベントが変更されています。イベントを選び直してください。');
  end if;
  perform 1 from staff_event_access a join events e on e.id=a.event_id
    where a.event_id=p_event and a.tenant_id=device.tenant_id and e.tenant_id=device.tenant_id and a.enabled for share of a;
  if not found then return jsonb_build_object('success',false,'error','このイベントの受付は終了しています。イベントを切り替えてください。'); end if;

  select array_agg(id) into candidates from participations where event_id=p_event
    and (checkin_token::text=p_token or id::text=p_token);
  if coalesce(cardinality(candidates),0)=0 then
    select array_agg(p.id) into candidates from participations p left join master_data m on m.id=p.master_data_id
      where p.event_id=p_event and (p.company_code=p_token or m.employee_id=p_token);
  end if;
  if coalesce(cardinality(candidates),0)=0 then
    return jsonb_build_object('success',false,'error','このイベントの参加者が見つかりません。QRコードと受付イベントを確認してください。');
  end if;
  if cardinality(candidates)>1 then
    return jsonb_build_object('success',false,'error','同じIDの参加者が複数います。参加者本人のQRコードで受付してください。');
  end if;
  candidate := candidates[1];
  select * into participant from participations where id=candidate for update;
  if not found or participant.status='cancelled' then
    return jsonb_build_object('success',false,'error','このチケットは受付できません。管理者に確認してください。');
  end if;
  select coalesce(participant.name,m.name,'未登録') into display_name from (select 1) x left join master_data m on m.id=participant.master_data_id;
  first_entry := participant.checked_in_at is null;
  update participations set status='checked_in',updated_at=now(),
    checked_in_at=coalesce(checked_in_at,now()),
    re_entry_history=case when first_entry then re_entry_history else coalesce(re_entry_history,'[]'::jsonb) || jsonb_build_array(now()) end
    where id=participant.id;
  update staff_devices set last_seen_at=now() where id=device.id;
  return jsonb_build_object('success',true,'message',case when first_entry then 'チェックイン完了' else '再入場を受け付けました' end,
    'participant',jsonb_build_object('name',display_name,'ticketType',participant.ticket_type,'startTime',participant.start_time,'entryType',case when first_entry then 'first' else 're_entry' end));
end $$;

revoke all on function public.staff_redeem_invite(text,text), public.staff_set_event_access(uuid,uuid,boolean,boolean), public.staff_switch_event(text,uuid), public.staff_check_in(text,uuid,text) from public, anon, authenticated;
grant execute on function public.staff_redeem_invite(text,text), public.staff_set_event_access(uuid,uuid,boolean,boolean), public.staff_switch_event(text,uuid), public.staff_check_in(text,uuid,text) to service_role;
commit;
