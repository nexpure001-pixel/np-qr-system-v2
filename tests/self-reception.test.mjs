import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(await readFile(new URL('../src/lib/staff/scan-gate.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
const { createScanGate, ticketToken } = exports;
test('a ticket held in frame is accepted only once even after the result delay', () => {
  const gate = createScanGate();
  assert.equal(gate('A', 0), true);
  assert.equal(gate('A', 3500), false);
  assert.equal(gate('A', 30000), false);
});
test('brief decode misses do not cause duplicate entry; one second of absence rearms', () => {
  const gate = createScanGate();
  gate('A', 0);
  gate(null, 1000);
  gate(null, 1500);
  assert.equal(gate('A', 1750), false);
  gate(null, 2000);
  gate(null, 3000);
  assert.equal(gate('A', 3250), true);
});
test('a different attendee can scan immediately without waiting for a blank frame', () => {
  const gate = createScanGate();
  assert.equal(gate('A', 0), true);
  assert.equal(gate('B', 4000), true);
  assert.equal(gate('B', 4250), false);
});
test('self reception accepts ticket UUIDs and ticket URLs, not member IDs or arbitrary QR content', () => {
  const qr = '6abbd3ca-697e-4903-b8b5-0269fc0a01aa';
  assert.equal(ticketToken(qr), qr);
  assert.equal(ticketToken(`https://example.test/checkin/${qr}?test=1`), qr);
  for (const invalid of ['12345678', 'np001', 'https://example.test', '', 'hello']) assert.equal(ticketToken(invalid), null);
});
