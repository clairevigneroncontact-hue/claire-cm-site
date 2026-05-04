function resp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

export async function onRequestGet({ request, env }) {
  const url      = new URL(request.url);
  const clientId = url.searchParams.get('clientId');
  if (!clientId) return resp({ error: 'clientId requis' }, 400);

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_KEY;

  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${clientId}&select=ig_access_token,ig_account_id,ig_token_expires_at`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  );
  const profiles = await profileRes.json();
  const profile  = profiles?.[0];

  if (!profile?.ig_access_token) return resp({ error: 'no_token' }, 404);

  const token = profile.ig_access_token;

  const [igProfile, igMedia] = await Promise.all([
    fetch(`https://graph.instagram.com/me?fields=id,username,followers_count,media_count,biography,website,profile_picture_url&access_token=${token}`).then(r => r.json()),
    fetch(`https://graph.instagram.com/me/media?fields=id,caption,like_count,comments_count,timestamp,media_type,permalink,thumbnail_url,media_url&limit=9&access_token=${token}`).then(r => r.json()),
  ]);

  if (igProfile.error) return resp({ error: 'token_invalid', detail: igProfile.error }, 401);

  return resp({ profile: igProfile, media: igMedia?.data || [] });
}
