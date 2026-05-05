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

    const key = String(supabaseKey).replace(/[^\x21-\x7E]/g, '');
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${clientId}&select=ig_access_token,ig_account_id`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    const profiles = await profileRes.json();
    const profile  = Array.isArray(profiles) ? profiles[0] : null;

    if (!profile?.ig_access_token || !profile?.ig_account_id) return resp({ error: 'no_token' }, 404);

    const token = profile.ig_access_token;
    const igId  = profile.ig_account_id;

    const [igProfile, igMedia] = await Promise.all([
      fetch(`https://graph.instagram.com/${igId}?fields=id,username,followers_count,media_count,biography,website,profile_picture_url&access_token=${token}`).then(r => r.json()),
      fetch(`https://graph.instagram.com/${igId}/media?fields=id,caption,like_count,comments_count,timestamp,media_type,permalink,thumbnail_url,media_url&limit=9&access_token=${token}`).then(r => r.json()),
    ]);

    if (igProfile.error) return resp({ error: 'token_invalid', detail: igProfile.error }, 401);

    const rawMedia = igMedia?.data || [];

    // Insights par post en parallèle :
    // - shares              = partages (✈️, tous médias)
    // - clips_replays_count = republications (↻, reels uniquement, appel séparé)
    const mediaWithInsights = await Promise.all(
      rawMedia.map(async (post) => {
        let shares_count  = null;
        let reposts_count = null;

        // Appel 1 : partages (tous médias)
        try {
          const res  = await fetch(`https://graph.instagram.com/${post.id}/insights?metric=shares&access_token=${token}`);
          const json = await res.json();
          if (json.data && !json.error) {
            shares_count = json.data.find(m => m.name === 'shares')?.values?.[0]?.value ?? null;
          }
        } catch(_) {}

        // Appel 2 : republications (reels uniquement)
        if (post.media_type === 'VIDEO') {
          try {
            const res  = await fetch(`https://graph.instagram.com/${post.id}/insights?metric=clips_replays_count&access_token=${token}`);
            const json = await res.json();
            if (json.data && !json.error) {
              reposts_count = json.data.find(m => m.name === 'clips_replays_count')?.values?.[0]?.value ?? null;
            }
          } catch(_) {}
        }

        return { ...post, shares_count, reposts_count };
      })
    );

    return resp({ profile: igProfile, media: mediaWithInsights });
  } catch(err) {
    return resp({ error: 'server_error', detail: err.message }, 500);
  }
}
