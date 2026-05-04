export async function onRequestGet({ request, env }) {
  const url       = new URL(request.url);
  const code      = url.searchParams.get('code');
  const state     = url.searchParams.get('state');
  const error     = url.searchParams.get('error');
  const ADMIN_URL = 'https://claire-cm-site.pages.dev/espace-client/admin';
  const DASH_URL  = 'https://claire-cm-site.pages.dev/espace-client/dashboard';

  if (error || !code) return Response.redirect(`${ADMIN_URL}?ig_error=access_denied`, 302);

  let clientId = '', from = 'admin';
  try { const s = JSON.parse(atob(decodeURIComponent(state || ''))); clientId = s.clientId; from = s.from || 'admin'; } catch {}

  const APP_ID     = env.META_APP_ID || '1651793712524049';
  const APP_SECRET = env.META_APP_SECRET;
  const REDIRECT   = 'https://claire-cm-site.pages.dev/api/instagram-callback';

  // 1. Échange code → token Facebook court
  const tokenRes = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT)}&client_secret=${APP_SECRET}&code=${code}`);
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) return Response.redirect(`${ADMIN_URL}?ig_error=token_failed`, 302);

  // 2. Échange → token long (60 jours)
  const llRes  = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${tokenData.access_token}`);
  const llData = await llRes.json();
  const longToken = llData.access_token || tokenData.access_token;

  // 3. Pages Facebook du compte → Instagram Business Account lié
  const pagesRes  = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account&access_token=${longToken}`);
  const pagesData = await pagesRes.json();
  const page      = (pagesData.data || []).find(p => p.instagram_business_account);

  if (!page) {
    // Pas de Page Facebook liée à un compte Instagram Pro — on stocke quand même le token
    const meRes  = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${longToken}`);
    const meData = await meRes.json();
    await _save(env, clientId, longToken, '', '');
    const dest = from === 'dashboard' ? `${DASH_URL}?ig_connected=1` : `${ADMIN_URL}?ig_connected=1&open_client=${clientId}`;
    return Response.redirect(dest, 302);
  }

  const igAccountId = page.instagram_business_account.id;

  // 4. Token de page (pour accéder à l'API Instagram avec ce compte)
  const pageTokenRes  = await fetch(`https://graph.facebook.com/v21.0/${page.id}?fields=access_token&access_token=${longToken}`);
  const pageTokenData = await pageTokenRes.json();
  const pageToken     = pageTokenData.access_token || longToken;

  // 5. Username Instagram
  const igRes  = await fetch(`https://graph.facebook.com/v21.0/${igAccountId}?fields=username&access_token=${pageToken}`);
  const igData = await igRes.json();

  await _save(env, clientId, pageToken, igAccountId, igData.username || '');

  const dest = from === 'dashboard' ? `${DASH_URL}?ig_connected=1` : `${ADMIN_URL}?ig_connected=1&open_client=${clientId}`;
  return Response.redirect(dest, 302);
}

async function _save(env, clientId, token, igAccountId, username) {
  if (!clientId || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return;
  const expiresAt = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(); // 60 jours
  await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${clientId}`, {
    method: 'PATCH',
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ ig_access_token: token, ig_account_id: igAccountId, ig_token_expires_at: expiresAt, ...(username ? { instagram_handle: username } : {}) }),
  });
}
