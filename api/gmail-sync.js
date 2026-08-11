import { sbAdminSelect, sbAdminInsertIgnoreDup, sbAdminUpdate } from './_lib/supabaseAdmin.js';

async function refreshAccessToken(refreshToken) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error_description || d.error || 'Gmail token refresh failed');
  return d.access_token;
}

// sinceCursorSeconds is a Unix-epoch-seconds string. Gmail's `after:` search
// operator has day-level granularity in some cases, so this can occasionally
// re-list a message already imported — harmless, since gmail_imports'
// unique(user_id, gmail_message_id) + ignore-duplicates makes re-import a no-op.
async function listNewMessageIds(accessToken, labelId, sinceCursorSeconds) {
  const params = new URLSearchParams({ labelIds: labelId, maxResults: '20' });
  if (sinceCursorSeconds) params.set('q', `after:${sinceCursorSeconds}`);
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`Gmail message list failed: ${r.status}`);
  const d = await r.json();
  return (d.messages || []).map(m => m.id);
}

async function fetchMessageMeta(accessToken, id) {
  const params = new URLSearchParams({ format: 'metadata' });
  params.append('metadataHeaders', 'Subject');
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) return null;
  const d = await r.json();
  const subject = d.payload?.headers?.find(h => h.name === 'Subject')?.value || '(no subject)';
  return { subject, snippet: d.snippet || '', internalDate: d.internalDate };
}

export default async function handler(req, res) {
  // Accepts both Vercel's own cron invocations (which auto-send this header)
  // and the GitHub Actions scheduled workflow, using the same shared secret.
  const auth = req.headers.authorization || '';
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  let connections;
  try {
    connections = await sbAdminSelect('gmail_connections', 'select=*');
  } catch (err) {
    res.status(500).json({ error: 'Failed to load Gmail connections', detail: err.message });
    return;
  }

  const results = [];
  for (const conn of connections) {
    if (!conn.gmail_label_id) {
      results.push({ user_id: conn.user_id, skipped: 'no label chosen yet' });
      continue;
    }
    try {
      const accessToken = await refreshAccessToken(conn.refresh_token);
      const ids = await listNewMessageIds(accessToken, conn.gmail_label_id, conn.sync_cursor);

      let imported = 0;
      let latestCursor = conn.sync_cursor ? Number(conn.sync_cursor) : 0;
      for (const id of ids) {
        const meta = await fetchMessageMeta(accessToken, id);
        if (!meta) continue;
        await sbAdminInsertIgnoreDup('gmail_imports', [{
          user_id: conn.user_id,
          gmail_message_id: id,
          gmail_label: conn.gmail_label_name,
          title: meta.subject,
          snippet: meta.snippet,
        }], 'user_id,gmail_message_id');
        imported++;
        const epochSeconds = Math.floor(Number(meta.internalDate) / 1000);
        if (epochSeconds > latestCursor) latestCursor = epochSeconds;
      }

      await sbAdminUpdate('gmail_connections', `user_id=eq.${conn.user_id}`, {
        sync_cursor: latestCursor ? String(latestCursor) : conn.sync_cursor,
        last_synced_at: new Date().toISOString(),
      });
      results.push({ user_id: conn.user_id, imported });
    } catch (err) {
      // One user's failure (e.g. expired refresh token after 7 days in
      // Testing mode) shouldn't stop the rest of the batch from syncing.
      results.push({ user_id: conn.user_id, error: err.message });
    }
  }

  res.status(200).json({ synced: results.length, results });
}
