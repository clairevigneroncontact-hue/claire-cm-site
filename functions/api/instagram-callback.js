export async function onRequestGet({ request, env }) {
  const ADMIN_URL = 'https://claire-cm-site.pages.dev/espace-client/admin';
  const DASH_URL  = 'https://claire-cm-site.pages.dev/espace-client/dashboard';

  try {
    const url   = new URL(request.url);
    const code  = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error || !code) return Response.redirect(`${ADMIN_URL}?ig_error=access_denied`, 302);

    let clientId = '', from = 'admin';
    try { const s = JSON.parse(atob(decodeURIComponent(state || ''))); clientId = s.clientId; from = s.from || 'admin'; } catch {}

    const APP_ID     = env.META_APP_ID || '1651793712524049';
    const APP_SECRET = env.META_APP_SECRET || '';
    const REDIRECT   = 'https://claire-cm-site.pages.dev/api/instagram-callback';

    // 1. Échange code → token court Facebook
    const t1Params = new URLSearchParams({ client_id: APP_ID, redirect_uri: REDIRECT, client_secret: APP_SECRET, code });
    const t1Res  = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${t1Params}`);
    const t1Data = await t1Res.json();
    if (!t1Data.access_token) return Response.redirect(`${ADMIN_URL}?ig_error=token_failed`, 302);

    // 2. Échange → token long (60 jours)
    const t2Params = new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: APP_ID, client_secret: APP_SECRET, fb_exchange_token: t1Data.access_token });
    const t2Res  = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${t2Params}`);
    const t2Data = await t2Res.json();
    const longToken = t2Data.access_token || t1Data.access_token;

    // 3. Pages Facebook → compte Instagram Business lié
    const pagesRes  = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account&access_token=${longToken}`);
    const pagesData = await pagesRes.json();
    const page      = (pagesData.data || []).find(p => p.instagram_business_account);

    const dest = from === 'dashboard' ? `${DASH_URL}?ig_connected=1` : `${ADMIN_URL}?ig_connected=1&open_client=${clientId}`;

    if (!page) {
      await _save(env, clientId, longToken, '', '');
      return Response.redirect(dest, 302);
    }

    const igAccountId = page.instagram_business_account.id;

    // 4. Token de page
    const ptRes  = await fetch(`https://graph.facebook.com/v21.0/${page.id}?fields=access_token&access_token=${longToken}`);
    const ptData = await ptRes.json();
    const pageToken = ptData.access_token || longToken;

    // 5. Username Instagram
    const igRes  = await fetch(`https://graph.facebook.com/v21.0/${igAccountId}?fields=username&access_token=${pageToken}`);
    const igData = await igRes.json();

    await _save(env, clientId, pageToken, igAccountId, igData.username || '');
    return Response.redirect(dest, 302);

  } catch(err) {
    return Response.redirect(`${ADMIN_URL}?ig_error=${encodeURIComponent(err.message)}`, 302);
  }
}

async function _save(env, clientId, token, igAccountId, username) {
  if (!clientId || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return;
  const expiresAt = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();
  await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${clientId}`, {
    method: 'PATCH',
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ ig_access_token: token, ig_account_id: igAccountId, ig_token_expires_at: expiresAt, ...(username ? { instagram_handle: username } : {}) }),
  });
}
