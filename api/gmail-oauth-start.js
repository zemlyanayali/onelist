import crypto from 'node:crypto';
import { sbAdminInsert, sbVerifyUser } from './_lib/supabaseAdmin.js';

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes to complete the consent screen

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const accessToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!accessToken) {
    res.status(401).json({ error: 'Missing session token' });
    return;
  }

  const user = await sbVerifyUser(accessToken);
  if (!user?.id) {
    res.status(401).json({ error: 'Invalid session' });
    return;
  }

  const clientId = process.env.GMAIL_CLIENT_ID;
  const redirectUri = process.env.GMAIL_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  // state is minted here, server-side, tied to the verified session — not
  // built from client-supplied data — so it's real CSRF protection, not
  // just an identity string an attacker could forge against someone else's
  // account.
  const platform = req.body?.platform === 'electron' ? 'electron' : 'web';
  const stateToken = crypto.randomUUID();

  try {
    await sbAdminInsert('gmail_oauth_state', [{
      state_token: stateToken,
      user_id: user.id,
      platform,
      expires_at: new Date(Date.now() + STATE_TTL_MS).toISOString(),
    }]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to start Gmail connection', detail: err.message });
    return;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPE,
    state: stateToken,
  });

  res.status(200).json({ authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
}
