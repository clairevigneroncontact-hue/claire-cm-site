export async function onRequestGet({ request, env }) {
  const url      = new URL(request.url);
  const clientId = url.searchParams.get('clientId') || '';
  const from     = url.searchParams.get('from') || 'admin';

  const APP_ID   = env.META_IG_APP_ID || '2342204119523490';
  const REDIRECT = 'https://claire-cm-site.pages.dev/api/instagram-callback';
  const state    = btoa(JSON.stringify({ clientId, from }));

  const authUrl = `https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=${APP_ID}&redirect_uri=${REDIRECT}&response_type=code&scope=instagram_business_basic,instagram_business_manage_insights,instagram_business_content_publish&state=${encodeURIComponent(state)}`;

  return Response.redirect(authUrl, 302);
}
