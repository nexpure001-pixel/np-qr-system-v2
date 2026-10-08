"use server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { hashToken, newToken, validId } from "@/lib/staff/tokens";

async function ownerContext() {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) throw new Error("管理者としてログインしてください。");
  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  if (!tenant) throw new Error("管理権限がありません。");
  return { db, tenantId: tenant.id as string };
}
export async function getStaffManagement() {
  const { db, tenantId } = await ownerContext();
  const results = await Promise.all([
    db
      .from("events")
      .select("id,name")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    db
      .from("staff_event_access")
      .select("event_id,enabled,recommended")
      .eq("tenant_id", tenantId),
    db
      .from("staff_devices")
      .select(
        "id,label,current_event_id,allowed_event_id,last_seen_at,expires_at,revoked_at",
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    db
      .from("staff_invites")
      .select("id,label,expires_at,consumed_at,revoked_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
  ]);
  if (results.some((r) => r.error))
    throw new Error(
      "スタッフ管理を取得できません。データベースの更新とサーバー設定を確認してください。",
    );
  return {
    events: (results[0].data || []).map((e) => ({
      ...e,
      enabled: !!results[1].data?.find((a) => a.event_id === e.id)?.enabled,
      recommended: !!results[1].data?.find((a) => a.event_id === e.id)
        ?.recommended,
    })),
    devices: results[2].data || [],
    invites: results[3].data || [],
  };
}
export async function setStaffEventAccess(
  eventId: string,
  enabled: boolean,
  recommended: boolean,
) {
  const { db, tenantId } = await ownerContext();
  if (
    !validId(eventId) ||
    typeof enabled !== "boolean" ||
    typeof recommended !== "boolean"
  )
    throw new Error("入力が正しくありません。");
  const { error } = await db.rpc("staff_set_event_access", {
    p_tenant: tenantId,
    p_event: eventId,
    p_enabled: enabled,
    p_recommended: recommended,
  });
  if (error) throw new Error("受付状態の変更に失敗しました。");
}
export async function createStaffInvite(label: string) {
  const { db, tenantId } = await ownerContext();
  if (typeof label !== "string" || !label.trim() || label.trim().length > 60)
    throw new Error("端末名を60文字以内で入力してください。");
  const token = newToken();
  const expiresAt = new Date(Date.now() + 86400000).toISOString();
  const { error } = await db
    .from("staff_invites")
    .insert({
      tenant_id: tenantId,
      label: label.trim(),
      token_hash: hashToken(token),
      expires_at: expiresAt,
    });
  if (error) throw new Error("招待を発行できませんでした。");
  return { token, expiresAt };
}
export async function revokeStaffAccess(kind: "device" | "invite", id: string) {
  const { db, tenantId } = await ownerContext();
  if (!validId(id) || !["device", "invite"].includes(kind))
    throw new Error("対象が正しくありません。");
  const { error } = await db
    .from(kind === "device" ? "staff_devices" : "staff_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (error) throw new Error("無効化できませんでした。");
}
