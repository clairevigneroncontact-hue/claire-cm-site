function resp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const { clientId, commentId, text } = await request.json();
    if (!clientId || !commentId || !text) return resp({ error: 'clientId, commentId et text requis' }, 400);

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_KEY;
    const key = String(supabaseKey).replace(/[^\x21-\x7E]/g, '');

    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${clientId}&select=ig_access_token`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    const profiles = await profileRes.json();
    const profile  = Array.isArray(profiles) ? profiles[0] : null;
    if (!profile?.ig_access_token) return resp({ error: 'no_token' }, 404);

    const token = profile.ig_access_token;

    const res = await fetch(`https://graph.instagram.com/${commentId}/replies`, {
      method: 'POST',
      body:   new URLSearchParams({ message: text, access_token: token }),
    });
    const json = await res.json();
    if (json.error) return resp({ error: json.error.message }, 400);

    return resp({ success: true, reply_id: json.id });
  } catch(err) {
    return resp({ error: err.message }, 500);
  }
}
