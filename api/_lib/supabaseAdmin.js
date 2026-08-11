// Shared server-side Supabase REST helpers for the Gmail sync feature.
// Uses raw fetch (matching the rest of this app's style — no @supabase/supabase-js
// dependency) with the service-role key, which bypasses RLS. Never import this
// from client code; it must only run inside api/*.js serverless functions.

export const SB_URL = 'https://fkffanvwmkswjukjjenp.supabase.co';

// Same anon key already embedded in src/App.jsx — public by design, paired
// with RLS. Only used here to verify a user's own session token.
const SB_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrZmZhbnZ3bWtzd2p1a2pqZW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMjM0MjEsImV4cCI6MjA5Mjg5OTQyMX0.Vu2t3TuJ3U7ts9DDIoH3mV42oAGwRm-xaSXp_nP6aiw';

function adminHeaders(extra = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...extra };
}

export async function sbAdminSelect(table, query) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, { headers: adminHeaders() });
  if (!r.ok) throw new Error(`Supabase select ${table} failed: ${r.status}`);
  return r.json();
}

export async function sbAdminInsert(table, rows) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: adminHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`Supabase insert ${table} failed: ${r.status} ${await r.text()}`);
  return r.json();
}

// Insert, silently skipping rows that violate a unique constraint — used for
// gmail_imports de-duplication by (user_id, gmail_message_id).
export async function sbAdminInsertIgnoreDup(table, rows, onConflictCols) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?on_conflict=${onConflictCols}`, {
    method: 'POST',
    headers: adminHeaders({ Prefer: 'return=minimal,resolution=ignore-duplicates' }),
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`Supabase insert ${table} failed: ${r.status} ${await r.text()}`);
}

export async function sbAdminDelete(table, query) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: adminHeaders(),
  });
  if (!r.ok) throw new Error(`Supabase delete ${table} failed: ${r.status}`);
}

export async function sbAdminUpdate(table, query, patch) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: adminHeaders(),
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(`Supabase update ${table} failed: ${r.status}`);
}

// Upsert by a unique column — only the columns present in `rows` are
// overwritten on conflict, other existing columns are left untouched.
export async function sbAdminUpsert(table, rows, onConflictCol) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?on_conflict=${onConflictCol}`, {
    method: 'POST',
    headers: adminHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`Supabase upsert ${table} failed: ${r.status} ${await r.text()}`);
  return r.json();
}

// Verify a Supabase session access token belongs to a real logged-in user.
export async function sbVerifyUser(accessToken) {
  const r = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: SB_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) return null;
  return r.json();
}
