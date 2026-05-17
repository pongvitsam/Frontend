/**
 * Smoke test GAS JSONP API (read-only + safe calls)
 * Run: node scripts/test-api-smoke.mjs
 */
const EXEC =
  'https://script.google.com/macros/s/AKfycby8V8L2CRZINAgkEcqfwjduA8w_7Yrl9t5AoQmISqtzq9BsghYbVjKOlZHvMuZdVUsagw/exec';

function jsonp(action, args) {
  const url = new URL(EXEC);
  url.searchParams.set('action', action);
  if (args) url.searchParams.set('args', JSON.stringify(args));
  url.searchParams.set('callback', 'cb');
  return fetch(url).then((r) => r.text()).then((t) => {
    const m = t.match(/cb\(([\s\S]*)\)/);
    if (!m) throw new Error('Invalid JSONP: ' + t.slice(0, 120));
    return JSON.parse(m[1]);
  });
}

const tests = [
  ['getInitialData', null, (r) => r.ok && Array.isArray(r.data.apps)],
  ['getAdminDashboardData', null, (r) => r.ok && Array.isArray(r.data.logs)],
  ['verifyLogin', ['wrong', 'wrong'], (r) => r.ok && r.data === false],
  ['recordClick', ['1', 'test'], (r) => r.ok],
];

let passed = 0;
let failed = 0;

for (const [action, args, check] of tests) {
  try {
    const res = await jsonp(action, args);
    if (check(res)) {
      console.log('OK', action);
      passed++;
    } else {
      console.log('FAIL', action, JSON.stringify(res).slice(0, 200));
      failed++;
    }
  } catch (e) {
    console.log('ERR', action, e.message);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
