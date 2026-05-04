export async function onRequestGet({ request, env }) {
  const url      = new URL(request.url);
  const clientId = url.searchParams.get('clientId') || '';
  const from     = url.searchParams.get('from') || 'admin';

  const APP_ID   = env.META_APP_ID || '1651793712524049';
  const REDIRECT = 'https://claire-cm-site.pages.dev/api/instagram-callback';
  const SCOPE    = 'instagram_basic,instagram_content_publishing,pages_read_engagement,pages_show_list,business_management';
  const state    = btoa(JSON.stringify({ clientId, from }));

  const authUrl = `https://www.facebook.com/dialog/oauth?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT)}&response_type=code&scope=${encodeURIComponent(SCOPE)}&state=${encodeURIComponent(state)}`;

  return Response.redirect(authUrl, 302);
}
