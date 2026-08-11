import { sbAdminSelect, sbAdminUpdate, sbAdminUpsert } from './_lib/supabaseAdmin.js';

const APP_URL = 'https://onelist-phi.vercel.app';

export default async function handler(req, res) {
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    res.status(400).send(`Google sign-in was cancelled or failed: ${oauthError}`);
    return;
  }
  if (!code || !state) {
    res.status(400).send('Missing code or state in Google redirect.');
    return;
  }

  let stateRow;
  try {
    const rows = await sbAdminSelect('gmail_oauth_state', `state_token=eq.${encodeURIComponent(state)}&select=*&limit=1`);
    stateRow = rows[0];
  } catch (err) {
    res.status(500).send('Failed to verify sign-in request.');
    return;
  }

  if (!stateRow || stateRow.used || new Date(stateRow.expires_at) < new Date()) {
    res.status(400).send('This Gmail sign-in link expired or was already used. Go back to OneList and click "Connect Gmail" again.');
    return;
  }

  // Mark used immediately, before the token exchange, to close the replay window.
  await sbAdminUpdate('gmail_oauth_state', `state_token=eq.${encodeURIComponent(state)}`, { used: true });

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const redirectUri = process.env.GMAIL_REDIRECT_URI;

  let tokenData;
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.refresh_token) {
      throw new Error(tokenData.error_description || tokenData.error || 'Google did not return a refresh token');
    }
  } catch (err) {
    res.status(502).send(
      `Failed to connect Gmail: ${err.message}. If you've connected before, disconnect and reconnect — ` +
      `Google only issues a refresh token on the first consent for an account.`
    );
    return;
  }

  try {
    await sbAdminUpsert('gmail_connections', [{
      user_id: stateRow.user_id,
      refresh_token: tokenData.refresh_token,
      connected_at: new Date().toISOString(),
    }], 'user_id');
  } catch (err) {
    res.status(500).send('Connected to Google, but failed to save the connection. Please try again.');
    return;
  }

  const redirectTarget = stateRow.platform === 'electron'
    ? 'onelist://oauth-callback#gmail=connected'
    : `${APP_URL}/#gmail=connected`;
  res.redirect(302, redirectTarget);
}
