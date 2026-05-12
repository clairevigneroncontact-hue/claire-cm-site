export async function onRequestPost(context) {
  const SUPABASE_URL    = context.env.SUPABASE_URL || context.env.PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = context.env.SUPABASE_SERVICE_KEY;
  const PUBLIC_ADMIN_EMAIL   = context.env.PUBLIC_ADMIN_EMAIL;

  let body;
  try { body = await context.request.json(); }
  catch { return json({ error: 'Requête invalide' }, 400); }

  const { email, name, instagram, phone, offer, accessToken } = body;

  // Vérifier que l'appelant est bien l'admin
  if (!accessToken) return json({ error: 'Non autorisé' }, 401);

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) return json({ error: 'Non autorisé' }, 401);
  const userData = await userRes.json();
  if (userData.email !== PUBLIC_ADMIN_EMAIL) return json({ error: 'Accès refusé' }, 403);

  if (!email) return json({ error: 'Email obligatoire' }, 400);

  // Inviter le client via Supabase Admin API
  const inviteRes = await fetch(`${SUPABASE_URL}/auth/v1/invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({
      email,
      data: { full_name: name || '' },
      redirect_to: 'https://clairevigneron.com/espace-client/nouveau-mot-de-passe',
    }),
  });

  const inviteData = await inviteRes.json();
  if (!inviteRes.ok) return json({
    error: inviteData.msg || inviteData.message || inviteData.error_description || 'Erreur invitation',
    detail: inviteData,
  }, 400);

  // Créer le profil avec le vrai ID Supabase Auth
  if (inviteData.id) {
    await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: inviteData.id,
        email,
        full_name: name || '',
        instagram_handle: instagram ? instagram.replace('@', '') : '',
        phone: phone || '',
        offer: offer || '',
        role: 'client',
      }),
    });
  }

  return json({ success: true }, 200);
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
