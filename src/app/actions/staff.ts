'use server';

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Staff Session Types
export type StaffSession = {
  eventId: string;
  eventName: string;
  tenantName: string;
};

const SESSION_COOKIE_NAME = 'staff_session';

// Staff Login
export async function staffLogin(formData: FormData) {
  const supabase = await createClient();
  const cookieStore = await cookies();

  const companyCode = formData.get('company_code') as string;
  const eventCode = formData.get('event_code') as string;
  const passcode = formData.get('passcode') as string;

  if (!companyCode || !eventCode || !passcode) {
    return { success: false, error: '全ての項目を入力してください。' };
  }

  // 1. Find Tenant by Company Code
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('company_code', companyCode)
    .single();

  if (!tenant) {
    return { success: false, error: '企業コードが見つかりません。' };
  }

  // 2. Find Event by Tenant ID + Event Code
  const { data: event } = await supabase
    .from('events')
    .select('id, name, staff_passcode')
    .eq('tenant_id', tenant.id)
    .eq('event_code', eventCode)
    .single();

  if (!event) {
    return { success: false, error: 'イベントコードが見つかりません。' };
  }

  // 3. Verify Passcode
  if (event.staff_passcode !== passcode) {
    return { success: false, error: 'パスコードが間違っています。' };
  }

  // 4. Create Session (Simple JSON in Cookie for MVP)
  const sessionData: StaffSession = {
    eventId: event.id,
    eventName: event.name,
    tenantName: tenant.name
  };

  cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(sessionData), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  });

  return { success: true };
}

// Staff Logout
export async function staffLogout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect('/staff');
}

// Get Session logic
export async function getStaffSession(): Promise<StaffSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie) return null;

  try {
    return JSON.parse(sessionCookie.value);
  } catch {
    return null;
  }
}

// Check-in Function (QR Scan)
export async function checkIn(token: string) {
  const supabase = await createClient();

  // 1. Get Staff Session
  const session = await getStaffSession();
  if (!session) {
    return { success: false, error: 'セッションが無効です。再ログインしてください。' };
  }

  // 2. Extract token/id from URL if necessary
  let actualToken = token;
  if (token.includes('/checkin/')) {
    // legacy support: extract ID from URL
    actualToken = token.split('/checkin/').pop() || token;
  }

  // 2. Find Participation by Token, ID, or Member ID
  let { data: participation, error: findError } = await supabase
    .from('participations')
    .select(`
      id,
      status,
      checked_in_at,
      ticket_type,
      start_time,
      re_entry_history,
      name,
      event_id,
      events (
        name
      ),
      master_data (
        name,
        employee_id
      )
    `)
    .or(`checkin_token.eq.${actualToken},id.eq.${actualToken}`)
    .single();

  // If not found by token/ID, try searching by Member ID (company_code or master_data.employee_id) within the current event
  if (findError || !participation) {
    // 1. First, search by company_code in participations (covers both members and guests)
    const { data: companyParts, error: companyError } = await supabase
      .from('participations')
      .select(`
        id, status, checked_in_at, ticket_type, start_time, re_entry_history, name, event_id,
        events ( name ),
        master_data ( name, employee_id )
      `)
      .eq('event_id', session.eventId)
      .eq('company_code', actualToken)
      .order('status', { ascending: false }); // Prioritize 'pending' over 'checked_in' if lucky, but we'll filter

    if (!companyError && companyParts && companyParts.length > 0) {
      // Pick the first 'pending' one, or just the first if all checked in
      participation = companyParts.find(p => p.status === 'pending') || companyParts[0];
      findError = null;
    } else {
      // 2. Fallback: Search by employee_id via master_data join (if not captured in company_code)
      const { data: memberParts, error: memberError } = await supabase
        .from('participations')
        .select(`
          id, status, checked_in_at, ticket_type, start_time, re_entry_history, name, event_id,
          events ( name ),
          master_data!inner ( name, employee_id )
        `)
        .eq('event_id', session.eventId)
        .eq('master_data.employee_id', actualToken);

      if (!memberError && memberParts && memberParts.length > 0) {
        participation = memberParts.find(p => p.status === 'pending') || memberParts[0];
        findError = null;
      }
    }
  }

  if (findError || !participation) {
    console.warn(`Check-in: Token not found [${actualToken}]`);
    return { success: false, error: '該当する参加者が見つかりません。', errorCode: 'NOT_FOUND' };
  }

  // Check Event Mismatch
  if (participation.event_id !== session.eventId) {
    const eventName = (participation.events as unknown as { name: string })?.name || '別のイベント';
    return {
      success: false,
      error: `このチケットは「${eventName}」のものです。現在のイベント（${session.eventName}）では使用できません。`,
      errorCode: 'EVENT_MISMATCH'
    };
  }

  // Get Name (Guest or Master Data)
  const masterData = participation.master_data as unknown as { name: string } | null;
  const participantName = participation.name || (Array.isArray(masterData) ? masterData[0]?.name : masterData?.name) || '未登録';

  // 3. Handle Entry Type
  const isFirstEntry = !participation.checked_in_at;
  const entryType = isFirstEntry ? 'first' : 're_entry';

  // 4. Update Status and History
  const now = new Date().toISOString();
  const updates: {
    status: string;
    updated_at: string;
    checked_in_at?: string;
    re_entry_history?: string[];
  } = {
    status: 'checked_in',
    updated_at: now
  };

  if (isFirstEntry) {
    updates.checked_in_at = now;
  } else {
    // Append to re-entry history
    const history = Array.isArray(participation.re_entry_history) ? participation.re_entry_history : [];
    updates.re_entry_history = [...history, now];
  }

  const { error: updateError } = await supabase
    .from('participations')
    .update(updates)
    .eq('id', participation.id);

  if (updateError) {
    console.error('Check-in Update Error:', updateError);
    return { success: false, error: 'チェックインの更新に失敗しました。' };
  }

  return {
    success: true,
    message: isFirstEntry ? 'チェックイン完了' : '途中入場（再入場）',
    participant: {
      name: participantName,
      ticketType: participation.ticket_type,
      startTime: participation.start_time,
      entryType: entryType as 'first' | 're_entry'
    }
  };
}
