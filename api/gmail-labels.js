import { sbAdminSelect, sbAdminUpdate, sbAdminDelete, sbVerifyUser } from './_lib/supabaseAdmin.js';

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

// GET: list the connected account's labels (+ whichever is currently chosen).
// POST: save the chosen label. Both require a valid Supabase session and an
// existing Gmail connection — the client never sees a raw Gmail token.
export default async function handler(req, res) {
  const accessToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const user = accessToken ? await sbVerifyUser(accessToken) : null;
  if (!user?.id) {
    res.status(401).json({ error: 'Invalid session' });
    return;
  }

  if (req.method === 'DELETE') {
    try {
      await sbAdminDelete('gmail_connections', `user_id=eq.${user.id}`);
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to disconnect Gmail', detail: err.message });
    }
    return;
  }

  const rows = await sbAdminSelect(
    'gmail_connections',
    `user_id=eq.${user.id}&select=refresh_token,gmail_label_id,gmail_label_name&limit=1`
  );
  const conn = rows[0];
  if (!conn) {
    res.status(404).json({ error: 'Gmail not connected' });
    return;
  }

  if (req.method === 'GET') {
    try {
      const gmailToken = await refreshAccessToken(conn.refresh_token);
      const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        headers: { Authorization: `Bearer ${gmailToken}` },
      });
      if (!r.ok) throw new Error(`Gmail labels fetch failed: ${r.status}`);
      const d = await r.json();
      const labels = (d.labels || [])
        .filter(l => l.type === 'user' || l.id === 'INBOX')
        .map(l => ({ id: l.id, name: l.name }));
      res.status(200).json({
        labels,
        selected: conn.gmail_label_id ? { id: conn.gmail_label_id, name: conn.gmail_label_name } : null,
      });
    } catch (err) {
      res.status(502).json({ error: 'Failed to load Gmail labels', detail: err.message });
    }
    return;
  }

  if (req.method === 'POST') {
    const { labelId, labelName } = req.body || {};
    if (!labelId) { res.status(400).json({ error: 'Missing labelId' }); return; }
    try {
      await sbAdminUpdate('gmail_connections', `user_id=eq.${user.id}`, {
        gmail_label_id: labelId,
        gmail_label_name: labelName || labelId,
      });
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to save label', detail: err.message });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
