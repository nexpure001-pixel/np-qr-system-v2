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
  } catch (e) {
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

  // 2. Find Participation by Token
  const { data: participation, error: findError } = await supabase
    .from('participations')
    .select(`
      id,
      status,
      checked_in_at,
      master_data (
        name
      )
    `)
    .eq('checkin_token', token)
    .eq('event_id', session.eventId)
    .single();

  if (findError || !participation) {
    return { success: false, error: '無効なQRコードです。', errorCode: 'INVALID_TOKEN' };
  }

  // 3. Check if Already Checked In
  if (participation.status === 'checked_in') {
    return {
      success: false,
      error: '既にチェックイン済みです。',
      errorCode: 'ALREADY_CHECKED_IN',
      participant: { name: (participation.master_data as any)?.name }
    };
  }

  // 4. Update Status to Checked In
  const { error: updateError } = await supabase
    .from('participations')
    .update({
      status: 'checked_in',
      checked_in_at: new Date().toISOString()
    })
    .eq('id', participation.id);

  if (updateError) {
    console.error('Check-in Update Error:', updateError);
    return { success: false, error: 'チェックインの更新に失敗しました。' };
  }

  return {
    success: true,
    message: 'チェックイン完了',
    participant: { name: (participation.master_data as any)?.name }
  };
}
