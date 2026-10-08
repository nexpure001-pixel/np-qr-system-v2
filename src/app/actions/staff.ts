"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  DEVICE_COOKIE,
  DEVICE_SECONDS,
  hashToken,
  newToken,
  validId,
  validToken,
} from "@/lib/staff/tokens";

export type StaffEvent = { id: string; name: string; recommended: boolean };
export type StaffSession = {
  eventId: string | null;
  eventName: string;
  tenantName: string;
  deviceName: string;
  events: StaffEvent[];
};

async function deviceContext() {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!validToken(token)) return null;
  const db = createAdminClient();
  const hash = hashToken(token);
  const { data: device, error } = await db
    .from("staff_devices")
    .select(
      "id,tenant_id,label,current_event_id,allowed_event_id,expires_at,revoked_at",
    )
    .eq("token_hash", hash)
    .single();
  if (error) throw new Error("端末情報を取得できません。");
  if (
    !device ||
    device.revoked_at ||
    Date.parse(device.expires_at) <= Date.now()
  )
    return null;
  return { db, device, hash };
}
async function saveDeviceCookie(token: string) {
  const store = await cookies();
  store.set(DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: DEVICE_SECONDS,
    path: "/",
  });
  store.delete("staff_session");
}

export async function redeemStaffInvite(token: string) {
  if (!validToken(token))
    return { success: false, error: "招待リンクが正しくありません。" };
  const deviceToken = newToken();
  try {
    const { error } = await createAdminClient().rpc("staff_redeem_invite", {
      p_hash: hashToken(token),
      p_device_hash: hashToken(deviceToken),
    });
    if (error)
      return {
        success: false,
        error:
          "この招待は使用済み・期限切れ・無効化済みです。管理者に新しい招待を依頼してください。",
      };
    await saveDeviceCookie(deviceToken);
    return { success: true };
  } catch {
    return {
      success: false,
      error: "端末を登録できません。通信とサーバー設定を確認してください。",
    };
  }
}

// Existing code/passcode login is retained, scoped to its single event.
export async function staffLogin(formData: FormData) {
  const company = String(formData.get("company_code") || "").trim();
  const code = String(formData.get("event_code") || "").trim();
  const passcode = String(formData.get("passcode") || "");
  if (!company || !code || !passcode)
    return { success: false, error: "全ての項目を入力してください。" };
  try {
    const db = createAdminClient();
    const { data: tenant } = await db
      .from("tenants")
      .select("id")
      .eq("company_code", company)
      .single();
    if (!tenant)
      return { success: false, error: "ログイン情報を確認してください。" };
    const { data: event } = await db
      .from("events")
      .select("id,staff_passcode")
      .eq("tenant_id", tenant.id)
      .eq("event_code", code)
      .single();
    if (!event || event.staff_passcode !== passcode)
      return { success: false, error: "ログイン情報を確認してください。" };
    const { data: access } = await db
      .from("staff_event_access")
      .select("enabled")
      .eq("event_id", event.id)
      .single();
    if (!access?.enabled)
      return {
        success: false,
        error:
          "このイベントは受付を開始していません。管理者に確認してください。",
      };
    const token = newToken();
    const { error } = await db
      .from("staff_devices")
      .insert({
        tenant_id: tenant.id,
        token_hash: hashToken(token),
        label: "コードでログインした端末",
        current_event_id: event.id,
        allowed_event_id: event.id,
        expires_at: new Date(Date.now() + DEVICE_SECONDS * 1000).toISOString(),
      });
    if (error) return { success: false, error: "端末登録に失敗しました。" };
    await saveDeviceCookie(token);
    return { success: true };
  } catch {
    return {
      success: false,
      error: "ログインできません。通信とサーバー設定を確認してください。",
    };
  }
}

export async function staffLogout() {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (validToken(token)) {
    try {
      await createAdminClient()
        .from("staff_devices")
        .update({ revoked_at: new Date().toISOString() })
        .eq("token_hash", hashToken(token));
    } catch {
      /* Cookie removal still logs this browser out. */
    }
  }
  const store = await cookies();
  store.delete(DEVICE_COOKIE);
  store.delete("staff_session");
  redirect("/staff");
}

export async function getStaffSession(): Promise<StaffSession | null> {
  const context = await deviceContext();
  if (!context) return null;
  const { db, device } = context;
  const [
    { data: tenant, error: tenantError },
    { data: access, error: accessError },
    { data: events, error: eventError },
  ] = await Promise.all([
    db.from("tenants").select("name").eq("id", device.tenant_id).single(),
    db
      .from("staff_event_access")
      .select("event_id,recommended")
      .eq("tenant_id", device.tenant_id)
      .eq("enabled", true),
    db
      .from("events")
      .select("id,name")
      .eq("tenant_id", device.tenant_id)
      .order("created_at", { ascending: false }),
  ]);
  if (tenantError || accessError || eventError)
    throw new Error("イベント情報を取得できません。");
  const available: StaffEvent[] = (events || [])
    .filter(
      (e) =>
        access?.some((a) => a.event_id === e.id) &&
        (!device.allowed_event_id || device.allowed_event_id === e.id),
    )
    .map((e) => ({
      ...e,
      recommended: !!access?.find((a) => a.event_id === e.id)?.recommended,
    }));
  const current = available.find((e) => e.id === device.current_event_id);
  return {
    eventId: current?.id || null,
    eventName: current?.name || "受付イベントを選んでください",
    tenantName: tenant?.name || "",
    deviceName: device.label,
    events: available,
  };
}

export async function switchStaffEvent(eventId: string) {
  if (!validId(eventId))
    return { success: false, error: "イベントを選択してください。" };
  try {
    const context = await deviceContext();
    if (!context)
      return {
        success: false,
        error: "端末登録が無効です。管理者に招待を依頼してください。",
      };
    const { data, error } = await context.db.rpc("staff_switch_event", {
      p_hash: context.hash,
      p_event: eventId,
    });
    if (error || !data)
      return {
        success: false,
        error: "このイベントは受付できません。受付状態を確認してください。",
      };
    return { success: true, session: await getStaffSession() };
  } catch {
    return {
      success: false,
      error: "切り替えに失敗しました。もう一度お試しください。",
    };
  }
}

type CheckInResponse = {
  success: boolean;
  error?: string;
  message?: string;
  participant?: {
    name: string;
    ticketType?: string;
    startTime?: string;
    entryType: "first" | "re_entry";
  };
};
export async function checkIn(
  token: string,
  expectedEventId: string,
): Promise<CheckInResponse> {
  if (
    typeof token !== "string" ||
    !token.trim() ||
    token.length > 2048 ||
    !validId(expectedEventId)
  )
    return {
      success: false,
      error: "受付イベントとQRコードを確認してください。",
    };
  const raw = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!validToken(raw))
    return {
      success: false,
      error: "端末登録が無効です。管理者に招待を依頼してください。",
    };
  let actualToken = token.trim();
  if (actualToken.includes("/checkin/"))
    actualToken = actualToken.split("/checkin/").pop()?.split(/[?#]/)[0] || "";
  const { data, error } = await createAdminClient().rpc("staff_check_in", {
    p_hash: hashToken(raw),
    p_event: expectedEventId,
    p_token: actualToken,
  });
  if (error)
    return {
      success: false,
      error: "受付を更新できませんでした。管理者に確認してください。",
    };
  return data as CheckInResponse;
}
