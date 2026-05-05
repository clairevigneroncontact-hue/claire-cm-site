function resp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { email, full_name, instagram_handle, phone, offer, cm_id } = body;
    if (!email || !cm_id) return resp({ error: 'email et cm_id requis' }, 400);

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_KEY;
    const key = String(supabaseKey).replace(/[^\x21-\x7E]/g, '');

    // Inviter le client via Supabase Admin API
    const inviteRes = await fetch(`${supabaseUrl}/auth/v1/invite`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, data: { full_name: full_name || '' } }),
    });
    const inviteData = await inviteRes.json();
    if (inviteData.error) return resp({ error: inviteData.error.message || inviteData.error }, 400);

    const userId = inviteData.id || inviteData.user?.id;
    if (!userId) return resp({ error: 'Impossible de créer l\'utilisateur' }, 500);

    // Créer ou mettre à jour le profil avec cm_id et role = 'client'
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ full_name: full_name || '', instagram_handle: instagram_handle || '', phone: phone || '', offer: offer || '', cm_id, role: 'client' }),
      }
    );

    // Si le profil n'existe pas encore, l'insérer
    if (!profileRes.ok || profileRes.status === 404) {
      await fetch(`${supabaseUrl}/rest/v1/profiles`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ id: userId, full_name: full_name || '', email, instagram_handle: instagram_handle || '', phone: phone || '', offer: offer || '', cm_id, role: 'client' }),
      });
    }

    return resp({ success: true, userId });
  } catch (err) {
    return resp({ error: err.message }, 500);
  }
}
