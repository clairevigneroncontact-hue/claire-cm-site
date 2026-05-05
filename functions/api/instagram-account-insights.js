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

    const sinceParam = url.searchParams.get('since');
    const untilParam = url.searchParams.get('until');
    const days  = parseInt(url.searchParams.get('days') || '30', 10);
    const since = sinceParam ? Math.floor(new Date(sinceParam).getTime() / 1000) : Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
    const until = untilParam ? Math.floor(new Date(untilParam + 'T23:59:59').getTime() / 1000) : Math.floor(Date.now() / 1000);

    const extract = (json) => {
      if (json.error || !json.data?.[0]?.values) return [];
      return json.data[0].values.map(v => ({
        date:  new Date(v.end_time).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        value: v.value || 0,
      }));
    };

    // Fetch en parallèle — reach et impressions via insights, followers via profil direct
    const [reachRes, impressionsRes, profileRes2] = await Promise.all([
      fetch(`https://graph.instagram.com/${igId}/insights?metric=reach&period=day&since=${since}&until=${until}&access_token=${token}`).then(r => r.json()),
      fetch(`https://graph.instagram.com/${igId}/insights?metric=impressions&period=day&since=${since}&until=${until}&access_token=${token}`).then(r => r.json()),
      fetch(`https://graph.instagram.com/${igId}?fields=followers_count,media_count&access_token=${token}`).then(r => r.json()),
    ]);

    const reachData       = extract(reachRes);
    let   impressionsData = extract(impressionsRes);

    // Fallback impressions : essayer period=week si day est vide
    if (!impressionsData.length && impressionsRes.error) {
      const impWeek = await fetch(
        `https://graph.instagram.com/${igId}/insights?metric=impressions&period=week&since=${since}&until=${until}&access_token=${token}`
      ).then(r => r.json());
      impressionsData = extract(impWeek);
    }

    // Followers : valeur courante depuis le profil (plus fiable que l'insights pour les petits comptes)
    const followersCount = profileRes2?.followers_count ?? null;
    // Construire une courbe "flat" avec la valeur actuelle si pas de données historiques
    const followersData = followersCount !== null
      ? [{ date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }), value: followersCount }]
      : [];

    return resp({
      reach:         reachData,
      followers:     followersData,
      followersCount,
      impressions:   impressionsData,
      mediaCount:    profileRes2?.media_count ?? null,
    });
  } catch(err) {
    return resp({ error: err.message }, 500);
  }
}
