import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the actual server action with a controlled Supabase boundary.
const source = await readFile(new URL('../src/app/actions/settings.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function scenario({ loggedIn = true, owned = true, deleted = true, failDelete = false } = {}) {
  const queries = [];
  const supabase = {
    auth: { getUser: async () => ({ data: { user: loggedIn ? { id: 'owner' } : null } }) },
    from(table) {
      const query = { table, deleting: false, filters: [] };
      queries.push(query);
      const finish = async () => {
        if (query.deleting) return { data: deleted && !failDelete ? { id: 'event' } : null, error: failDelete ? { code: '23503' } : null };
        return { data: table === 'tenants' ? { id: 'tenant' } : owned ? { id: 'event', name: '対象イベント' } : null };
      };
      const builder = { select() { return builder; }, eq(key, value) { query.filters.push([key, value]); return builder; }, delete() { query.deleting = true; return builder; }, single: finish, maybeSingle: finish };
      return builder;
    },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: name => {
    assert.equal(name, '@/utils/supabase/server');
    return { createClient: async () => supabase };
  }, console: { error() {} } });
  return { remove: exports.deleteEvent, queries };
}
test('signed-out callers cannot read or delete events', async () => {
  const s = scenario({ loggedIn: false });
  assert.equal((await s.remove('event', '対象イベント')).success, false);
  assert.equal(s.queries.length, 0);
});
test('another tenant event cannot be deleted', async () => {
  const s = scenario({ owned: false });
  assert.equal((await s.remove('event', '対象イベント')).success, false);
  assert.ok(s.queries[1].filters.some(([key,value]) => key === 'tenant_id' && value === 'tenant'));
  assert.ok(s.queries.every(q => !q.deleting));
});
test('confirmation is required on the server, not only the button', async () => {
  for (const name of ['', undefined, '別イベント']) {
    const s = scenario();
    assert.equal((await s.remove('event', name)).success, false);
    assert.ok(s.queries.every(q => !q.deleting));
  }
});
test('deletion uses one tenant-and-name-scoped event operation, never a participant pre-delete', async () => {
  const s = scenario();
  assert.equal((await s.remove('event', '対象イベント')).success, true);
  const mutations = s.queries.filter(q => q.deleting);
  assert.equal(mutations.length, 1);
  assert.equal(mutations[0].table, 'events');
  assert.deepEqual(mutations[0].filters, [['id','event'],['tenant_id','tenant'],['name','対象イベント']]);
});
test('failed or stale deletion is not reported as success', async () => {
  for (const config of [{failDelete:true}, {deleted:false}]) {
    const s = scenario(config);
    assert.equal((await s.remove('event', '対象イベント')).success, false);
    assert.deepEqual(s.queries.filter(q => q.deleting).map(q => q.table), ['events']);
  }
});
