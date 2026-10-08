import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const tenant = "10000000-0000-0000-0000-000000000001";
const otherTenant = "10000000-0000-0000-0000-000000000002";
const eventA = "20000000-0000-0000-0000-000000000001";
const eventB = "20000000-0000-0000-0000-000000000002";
const foreignEvent = "20000000-0000-0000-0000-000000000003";
const member = "30000000-0000-0000-0000-000000000001";
const participant = "40000000-0000-0000-0000-000000000001";
const qr = "50000000-0000-0000-0000-000000000001";
const rpc = async (sql, params) => (await db.query(sql, params)).rows[0].result;
const enable = (id, recommended = false, enabled = true, owner = tenant) =>
  rpc("select staff_set_event_access($1,$2,$3,$4) as result", [
    owner,
    id,
    enabled,
    recommended,
  ]);
const change = (id, hash = "device") =>
  rpc("select staff_switch_event($1,$2) as result", [hash, id]);
const scan = (id = eventA, token = qr, hash = "device") =>
  rpc("select staff_check_in($1,$2,$3) as result", [hash, id, token]);
before(async () => {
  // Minimal existing schema fixture; the production migration below is applied unchanged.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table tenants(id uuid primary key);
    create table events(id uuid primary key,tenant_id uuid references tenants(id),name text);
    create table master_data(id uuid primary key,name text,employee_id text);
    create table participations(id uuid primary key,event_id uuid references events(id),master_data_id uuid references master_data(id),checkin_token uuid,name text,company_code text,status text default 'pending',checked_in_at timestamptz,updated_at timestamptz,re_entry_history jsonb default '[]',ticket_type text,start_time text);
  `);
  await db.exec(
    await readFile(
      new URL("../supabase/migration_v8_staff_devices.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.query("insert into tenants values ($1),($2)", [tenant, otherTenant]);
  await db.query(
    "insert into events values ($1,$4,'A'),($2,$4,'B'),($3,$5,'Other tenant')",
    [eventA, eventB, foreignEvent, tenant, otherTenant],
  );
  await db.query(
    "insert into master_data values ($1,'Test participant','MEMBER-1')",
    [member],
  );
});
after(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.exec(
    "truncate staff_invites,staff_devices,staff_event_access,participations",
  );
  await enable(eventA);
  await enable(eventB);
  await enable(foreignEvent, false, true, otherTenant);
  await db.query(
    "insert into staff_devices(tenant_id,token_hash,label,expires_at,current_event_id) values ($1,'device','Front desk',now()+interval '7 days',$2)",
    [tenant, eventA],
  );
  await db.query(
    "insert into participations(id,event_id,master_data_id,checkin_token,company_code,ticket_type,start_time) values ($1,$2,$3,$4,'MEMBER-1','VIP','18:00')",
    [participant, eventA, member, qr],
  );
});

test("invitation creates one device and cannot be redeemed twice", async () => {
  await db.query(
    "insert into staff_invites(tenant_id,token_hash,label,expires_at) values ($1,'invite','Side door',now()+interval '1 day')",
    [tenant],
  );
  const redeem = () =>
    rpc("select staff_redeem_invite('invite','new-device') as result");
  assert.ok(await redeem());
  await assert.rejects(redeem(), /Invitation unavailable/);
  const device = (
    await db.query("select * from staff_devices where token_hash='new-device'")
  ).rows[0];
  assert.equal(device.tenant_id, tenant);
  assert.equal(device.current_event_id, null);
  assert.equal(device.allowed_event_id, null);
  assert.ok(new Date(device.expires_at) > new Date());
});
test("expired and revoked invitations cannot create devices", async () => {
  await db.query(
    "insert into staff_invites(tenant_id,token_hash,label,expires_at,revoked_at) values ($1,'expired','X',now()-interval '1 minute',null),($1,'revoked','Y',now()+interval '1 day',now())",
    [tenant],
  );
  for (const hash of ["expired", "revoked", "missing"])
    await assert.rejects(
      rpc("select staff_redeem_invite($1,$2) as result", [
        hash,
        hash + "-device",
      ]),
      /Invitation unavailable/,
    );
});
test("tenant boundary prevents event switching and configuration", async () => {
  assert.equal(await change(foreignEvent), false);
  await assert.rejects(enable(foreignEvent), /Event unavailable/);
});
test("recommendation does not change current event; one recommendation per tenant", async () => {
  await enable(eventA, true);
  await enable(eventB, true);
  const rec = (
    await db.query(
      "select event_id from staff_event_access where tenant_id=$1 and recommended",
      [tenant],
    )
  ).rows;
  assert.deepEqual(rec, [{ event_id: eventB }]);
  assert.equal(
    (
      await db.query(
        "select current_event_id from staff_devices where token_hash='device'",
      )
    ).rows[0].current_event_id,
    eventA,
  );
});
test("explicit switching works, stale screens cannot check in", async () => {
  assert.equal(await change(eventB), true);
  assert.equal((await scan(eventA)).success, false);
  assert.equal((await scan(eventB)).success, false); // ticket belongs to A
  assert.equal(
    (await db.query("select status from participations")).rows[0].status,
    "pending",
  );
});
test("closed event cannot be selected or checked in", async () => {
  await enable(eventA, false, false);
  assert.equal(await change(eventA), false);
  assert.equal((await scan()).success, false);
});
test("revoked and expired devices cannot switch or check in", async () => {
  await db.exec("update staff_devices set revoked_at=now()");
  assert.equal(await change(eventB), false);
  assert.equal((await scan()).success, false);
  await db.exec(
    "update staff_devices set revoked_at=null,expires_at=now()-interval '1 minute'",
  );
  assert.equal(await change(eventB), false);
  assert.equal((await scan()).success, false);
  assert.equal((await scan(eventA, qr, "unknown")).success, false);
});
test("legacy event-scoped device cannot gain other-event access", async () => {
  await db.query("update staff_devices set allowed_event_id=$1", [eventA]);
  assert.equal(await change(eventB), false);
  assert.equal(await change(eventA), true);
});
test("first entry, reentry, ticket details and master ID work", async () => {
  const first = await scan(eventA, "MEMBER-1");
  assert.equal(first.success, true);
  assert.equal(first.participant.entryType, "first");
  assert.equal(first.participant.name, "Test participant");
  assert.equal(first.participant.ticketType, "VIP");
  const second = await scan();
  assert.equal(second.participant.entryType, "re_entry");
  assert.equal(
    (await db.query("select re_entry_history from participations")).rows[0]
      .re_entry_history.length,
    1,
  );
});
test("cancelled tickets and ambiguous member IDs do not check in", async () => {
  await db.exec("update participations set status='cancelled'");
  assert.equal((await scan()).success, false);
  await db.query(
    "insert into participations(id,event_id,company_code,checkin_token) values (gen_random_uuid(),$1,'MEMBER-1',gen_random_uuid())",
    [eventA],
  );
  assert.equal((await scan(eventA, "MEMBER-1")).success, false);
});
test("untrusted API roles cannot read device secrets or invoke staff RPCs", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(
        db.query("select * from staff_devices"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select * from staff_invites"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select staff_switch_event('device',$1)", [eventB]),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select staff_redeem_invite('x','y')"),
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
  }
});
