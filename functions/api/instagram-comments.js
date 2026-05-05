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
    if (!clientId) return resp({ error: 'clientId requis' }, 400);

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_KEY;
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

    // Récupérer les 6 derniers posts
    const mediaRes = await fetch(
      `https://graph.instagram.com/${igId}/media?fields=id,thumbnail_url,media_url,media_type,permalink,timestamp&limit=6&access_token=${token}`
    );
    const mediaJson = await mediaRes.json();
    if (mediaJson.error) return resp({ error: mediaJson.error.message }, 400);

    const media = mediaJson.data || [];

    // Récupérer les commentaires de chaque post en parallèle
    const postsWithComments = await Promise.all(
      media.map(async (post) => {
        try {
          const cRes  = await fetch(
            `https://graph.instagram.com/${post.id}/comments?fields=id,text,username,timestamp,like_count,replies{id,text,username,timestamp}&limit=20&access_token=${token}`
          );
          const cJson = await cRes.json();
          return { ...post, comments: cJson.data || [] };
        } catch(_) {
          return { ...post, comments: [] };
        }
      })
    );

    // Ne renvoyer que les posts qui ont des commentaires
    return resp({ posts: postsWithComments.filter(p => p.comments.length > 0) });
  } catch(err) {
    return resp({ error: err.message }, 500);
  }
}
