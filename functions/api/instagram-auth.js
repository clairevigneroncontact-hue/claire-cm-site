export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get('clientId') || '';

  const APP_ID      = env.META_APP_ID || '1651793712524049';
  const REDIRECT    = 'https://claire-cm-site.pages.dev/api/instagram-callback';
  const SCOPE       = 'instagram_business_basic';
  const from        = url.searchParams.get('from') || 'admin';
  const state       = btoa(JSON.stringify({ clientId, from }));

  const authUrl = `https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT)}&response_type=code&scope=${SCOPE}&state=${encodeURIComponent(state)}`;

  return Response.redirect(authUrl, 302);
}
