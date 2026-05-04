export async function onRequestGet({ request, env }) {
  const url       = new URL(request.url);
  const code      = url.searchParams.get('code');
  const state     = url.searchParams.get('state');
  const error     = url.searchParams.get('error');
  const ADMIN_URL = 'https://claire-cm-site.pages.dev/espace-client/admin';

  if (error || !code) return Response.redirect(`${ADMIN_URL}?ig_error=access_denied`, 302);

  let clientId = '';
  try { clientId = JSON.parse(atob(decodeURIComponent(state || ''))).clientId; } catch {}

  const APP_ID      = env.META_APP_ID || '1651793712524049';
  const APP_SECRET  = env.META_APP_SECRET;
  const REDIRECT    = 'https://claire-cm-site.pages.dev/api/instagram-callback';

  // Échange code → token court
  const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: APP_ID, client_secret: APP_SECRET, grant_type: 'authorization_code', redirect_uri: REDIRECT, code }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) return Response.redirect(`${ADMIN_URL}?ig_error=token_failed`, 302);

  // Échange token court → token long (60 jours)
  const llRes  = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&access_token=${tokenData.access_token}`);
  const llData = await llRes.json();
  const longToken  = llData.access_token || tokenData.access_token;
  const expiresIn  = llData.expires_in || 5184000;
  const expiresAt  = new Date(Date.now() + expiresIn * 1000).toISOString();

  // Profil Instagram
  const profileRes  = await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${longToken}`);
  const igProfile   = await profileRes.json();
  const igAccountId = String(igProfile.id || tokenData.user_id || '');
  const igUsername  = igProfile.username || '';

  // Sauvegarde en base
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_KEY;
  if (clientId && supabaseUrl && supabaseKey) {
    await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${clientId}`, {
      method: 'PATCH',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ ig_access_token: longToken, ig_account_id: igAccountId, ig_token_expires_at: expiresAt, instagram_handle: igUsername }),
    });
  }

  return Response.redirect(`${ADMIN_URL}?ig_connected=1&open_client=${clientId}`, 302);
}
