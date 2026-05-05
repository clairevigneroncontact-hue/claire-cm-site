function resp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const { contentItemId } = await request.json();
    if (!contentItemId) return resp({ error: 'contentItemId requis' }, 400);

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) return resp({ error: 'config manquante' }, 500);
    const key = String(supabaseKey).replace(/[^\x21-\x7E]/g, '');

    // 1. Récupérer le contenu
    const itemRes = await fetch(
      `${supabaseUrl}/rest/v1/content_items?id=eq.${contentItemId}&select=*`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    const items = await itemRes.json();
    const item  = Array.isArray(items) ? items[0] : null;
    if (!item) return resp({ error: 'Contenu introuvable' }, 404);

    // 2. Récupérer les credentials Instagram du client
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${item.client_id}&select=ig_access_token,ig_account_id`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    const profiles = await profileRes.json();
    const profile  = Array.isArray(profiles) ? profiles[0] : null;
    if (!profile?.ig_access_token || !profile?.ig_account_id)
      return resp({ error: 'Instagram non connecté pour ce client' }, 400);

    const token = profile.ig_access_token;
    const igId  = profile.ig_account_id;

    // 3. Récupérer l'URL du fichier
    let files = [];
    try { files = Array.isArray(item.files) ? item.files : JSON.parse(item.files || '[]'); } catch(_) {}
    const file = files[0];
    if (!file?.url) return resp({ error: 'Aucun fichier joint au contenu' }, 400);

    const fileUrl = file.url;
    const isVideo = /\.(mp4|mov|avi|m4v)$/i.test(file.name || '') || item.type === 'reel';

    // 4. Calculer si on programme ou on publie maintenant
    const scheduledAt = item.scheduled_at ? new Date(item.scheduled_at) : null;
    const now         = new Date();
    const isScheduled = scheduledAt && (scheduledAt - now) > 10 * 60 * 1000;

    // 5. Créer le container Meta
    const params = new URLSearchParams({ access_token: token });
    const caption = (item.description || item.title || '').trim();
    if (caption) params.set('caption', caption);

    if (isVideo) {
      params.set('media_type', 'REELS');
      params.set('video_url', fileUrl);
    } else {
      params.set('image_url', fileUrl);
    }

    if (isScheduled) {
      params.set('published', 'false');
      params.set('scheduled_publish_time', String(Math.floor(scheduledAt.getTime() / 1000)));
    }

    const containerRes = await fetch(`https://graph.instagram.com/${igId}/media`, {
      method: 'POST',
      body: params,
    });
    const container = await containerRes.json();
    if (container.error) return resp({ error: container.error.message, detail: container.error }, 400);

    // 6. Pour les vidéos : attendre que le container soit prêt (max 20s)
    if (isVideo) {
      let status   = 'IN_PROGRESS';
      let attempts = 0;
      while (status === 'IN_PROGRESS' && attempts < 10) {
        await new Promise(r => setTimeout(r, 2000));
        const sRes = await fetch(
          `https://graph.instagram.com/${container.id}?fields=status_code&access_token=${token}`
        );
        const sJson = await sRes.json();
        status = sJson.status_code || 'ERROR';
        attempts++;
      }
      if (status !== 'FINISHED') return resp({ error: `Vidéo en cours de traitement (status: ${status}). Réessaie dans quelques secondes.` }, 202);
    }

    // 7. Publier ou confirmer la programmation
    const publishRes = await fetch(`https://graph.instagram.com/${igId}/media_publish`, {
      method: 'POST',
      body: new URLSearchParams({ creation_id: container.id, access_token: token }),
    });
    const publish = await publishRes.json();
    if (publish.error) return resp({ error: publish.error.message }, 400);

    // 8. Mettre à jour le content_item avec l'ID Instagram
    await fetch(`${supabaseUrl}/rest/v1/content_items?id=eq.${contentItemId}`, {
      method:  'PATCH',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body:    JSON.stringify({ ig_post_id: publish.id }),
    });

    return resp({ success: true, ig_post_id: publish.id, scheduled: isScheduled });
  } catch(err) {
    return resp({ error: err.message }, 500);
  }
}
