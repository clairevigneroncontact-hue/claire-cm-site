export async function onRequestGet({ request, env }) {
  const ADMIN_URL = 'https://clairevigneron.com/espace-client/admin';
  const DASH_URL  = 'https://clairevigneron.com/espace-client/dashboard';

  try {
    const url   = new URL(request.url);
    const code  = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error || !code) return Response.redirect(`${ADMIN_URL}?ig_error=access_denied`, 302);

    let clientId = '', from = 'admin', app = '';
    try { const s = JSON.parse(atob(decodeURIComponent(state || ''))); clientId = s.clientId; from = s.from || 'admin'; app = s.app || ''; } catch {}

    const isCMspace = app === 'cmspace';
    const APP_ID     = env.META_IG_APP_ID || '2342204119523490';
    const APP_SECRET = env.META_IG_APP_SECRET || env.META_APP_SECRET || '';
    const REDIRECT   = 'https://claire-cm-site.pages.dev/api/instagram-callback';

    // Échange code → token court Instagram
    // Note: redirect_uri doit être non-encodé pour correspondre à l'URL d'autorisation
    const t1Body = `client_id=${APP_ID}&client_secret=${APP_SECRET}&grant_type=authorization_code&redirect_uri=${REDIRECT}&code=${code}`;
    const t1Res  = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: t1Body,
    });
    const t1Data = await t1Res.json();
    if (!t1Data.access_token) return Response.redirect(`${ADMIN_URL}?ig_error=${encodeURIComponent('token_failed: ' + JSON.stringify(t1Data))}`, 302);

    const shortToken = t1Data.access_token;
    const igUserId   = String(t1Data.user_id || '');

    // Échange → token long (60 jours)
    const t2Res  = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&access_token=${shortToken}`);
    const t2Data = await t2Res.json();
    const longToken = t2Data.access_token || shortToken;

    // Profil Instagram
    const igRes  = await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${longToken}`);
    const igData = await igRes.json();
    const igAccountId = String(igData.id || igUserId);
    const username    = igData.username || '';

    // Sauvegarde en base (claire-cm-site ou CMspace selon le state)
    if (isCMspace) {
      await _saveCMspace(env, clientId, longToken, igAccountId, username);
      const cmDest = from === 'dashboard'
        ? `https://cm-space.pages.dev/client?ig_connected=1`
        : `https://cm-space.pages.dev/admin?ig_connected=1&open_client=${clientId}`;
      return Response.redirect(cmDest, 302);
    }

    await _save(env, clientId, longToken, igAccountId, username);
    const dest = from === 'dashboard' ? `${DASH_URL}?ig_connected=1` : `${ADMIN_URL}?ig_connected=1&open_client=${clientId}`;
    return Response.redirect(dest, 302);

  } catch(err) {
    return Response.redirect(`${ADMIN_URL}?ig_error=${encodeURIComponent(err.message)}`, 302);
  }
}

async function _saveCMspace(env, clientId, token, igAccountId, username) {
  if (!clientId) return;
  const url = 'https://rntayoagpujvcpkhgyob.supabase.co';
  const key = String(env.CMSPACE_SUPABASE_SERVICE_KEY || '').replace(/[^\x21-\x7E]/g, '');
  if (!key) return;
  const expiresAt = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();
  await fetch(`${url}/rest/v1/profiles?id=eq.${clientId}`, {
    method: 'PATCH',
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({ ig_access_token: token, ig_account_id: igAccountId, ig_token_expires_at: expiresAt, ...(username ? { instagram_handle: username } : {}) }),
  });
}

async function _save(env, clientId, token, igAccountId, username) {
  if (!clientId || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return;
  const key = String(env.SUPABASE_SERVICE_KEY).replace(/[^\x21-\x7E]/g, '');
  const url = String(env.SUPABASE_URL).replace(/\s/g, '');
  const expiresAt = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();
  await fetch(`${url}/rest/v1/profiles?id=eq.${clientId}`, {
    method: 'PATCH',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ ig_access_token: token, ig_account_id: igAccountId, ig_token_expires_at: expiresAt, ...(username ? { instagram_handle: username } : {}) }),
  });
}
