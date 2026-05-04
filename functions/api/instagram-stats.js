function resp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

export async function onRequestGet({ request, env }) {
  try {
    const url      = new URL(request.url);
    const clientId = url.searchParams.get('clientId');
    if (!clientId || clientId === 'undefined' || clientId === 'null') return resp({ error: 'clientId requis' }, 400);

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) return resp({ error: 'config manquante' }, 500);

    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${clientId}&select=ig_access_token,ig_account_id`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const profiles = await profileRes.json();
    const profile  = Array.isArray(profiles) ? profiles[0] : null;

    if (!profile?.ig_access_token || !profile?.ig_account_id) return resp({ error: 'no_token' }, 404);

    const token = profile.ig_access_token;
    const igId  = profile.ig_account_id;

    const [igProfile, igMedia] = await Promise.all([
      fetch(`https://graph.facebook.com/v21.0/${igId}?fields=id,username,followers_count,media_count,biography,website,profile_picture_url&access_token=${token}`).then(r => r.json()),
      fetch(`https://graph.facebook.com/v21.0/${igId}/media?fields=id,caption,like_count,comments_count,timestamp,media_type,permalink,thumbnail_url,media_url&limit=9&access_token=${token}`).then(r => r.json()),
    ]);

    if (igProfile.error) return resp({ error: 'token_invalid', detail: igProfile.error }, 401);

    return resp({ profile: igProfile, media: igMedia?.data || [] });
  } catch(err) {
    return resp({ error: 'server_error', detail: err.message }, 500);
  }
}
