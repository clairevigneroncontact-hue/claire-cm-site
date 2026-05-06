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

    // Heures d'activité des abonnés (online_followers)
    const res = await fetch(
      `https://graph.instagram.com/${igId}/insights?metric=online_followers&period=lifetime&access_token=${token}`
    );
    const json = await res.json();

    if (json.error) return resp({ error: json.error.message, code: json.error.code }, 400);

    // Restructurer : { "0": {Mon: X, Tue: Y, ...}, "1": {...} ... "23": {...} }
    const raw = json?.data?.[0]?.values?.[0]?.value || json?.data?.[0]?.value || null;

    if (!raw) return resp({ error: 'no_data' }, 404);

    // Calculer les meilleurs créneaux (top 5 par heure × jour)
    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const dayKeys = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const slots = [];
    for (const [hour, dayData] of Object.entries(raw)) {
      for (const [dayKey, count] of Object.entries(dayData)) {
        const dayIndex = dayKeys.indexOf(dayKey);
        if (dayIndex === -1) continue;
        slots.push({ day: days[dayIndex], hour: parseInt(hour), count });
      }
    }

    // Top 5 créneaux
    const top = slots
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map(s => ({ day: s.day, time: `${String(s.hour).padStart(2, '0')}:00`, count: s.count }));

    // Heatmap 7×24 normalisée (0–100)
    const maxCount = Math.max(...slots.map(s => s.count), 1);
    const heatmap = {};
    for (const s of slots) {
      if (!heatmap[s.day]) heatmap[s.day] = {};
      heatmap[s.day][s.hour] = Math.round((s.count / maxCount) * 100);
    }

    return resp({ top, heatmap, raw });
  } catch (err) {
    return resp({ error: err.message }, 500);
  }
}
