// Only needed for the Electron desktop app's Calendar connect flow.
//
// Google's OAuth console rejects a custom scheme (onelist://) as a
// registered redirect URI for a "Web application" client — it must be a
// real https URL. So this endpoint IS the registered redirect_uri (an
// ordinary https URL, no rejection), exchanges the code for a token
// server-side, and only THEN redirects to onelist://oauth-callback as its
// own follow-up hop — which is Electron's own registered protocol handler
// catching a redirect from US, not something Google's console ever
// validates. The web (browser tab) flow is untouched: it still uses the
// implicit grant directly against Google, no server round-trip needed.
//
// Reuses the same Google Cloud OAuth client as Gmail (confirmed to be the
// same client in Google Cloud Console) — hence GMAIL_CLIENT_ID/SECRET here
// too, not a separate GCAL_* pair.
const APP_URL = 'https://onelist-phi.vercel.app';

export default async function handler(req, res) {
  const { code, error: oauthError } = req.query;

  if (oauthError) {
    res.status(400).send(`Google sign-in was cancelled or failed: ${oauthError}`);
    return;
  }
  if (!code) {
    res.status(400).send('Missing code in Google redirect.');
    return;
  }

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const redirectUri = process.env.GCAL_REDIRECT_URI;

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
    if (!tokenRes.ok) {
      throw new Error(tokenData.error_description || tokenData.error || 'Token exchange failed');
    }
  } catch (err) {
    res.status(502).send(`Failed to connect Google Calendar: ${err.message}`);
    return;
  }

  // Hand the token to the desktop app exactly like the implicit-flow web path
  // does — same #access_token=...&state=gcal hash the existing App.jsx
  // OAuth-hash effect already parses, so no client-side changes needed.
  res.redirect(302, `onelist://oauth-callback#access_token=${encodeURIComponent(tokenData.access_token)}&state=gcal`);
}
