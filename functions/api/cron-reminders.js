// Cron : rappels automatiques pour les contenus en attente depuis plus de 5 jours
// Appelé quotidiennement — déclencher depuis Cloudflare Cron ou cron-job.org
// URL : POST /api/cron-reminders avec header X-Cron-Secret: <CRON_SECRET>
export async function onRequestPost(context) {
  const { request, env } = context;
  const secret = env.CRON_SECRET;
  if (secret && request.headers.get('X-Cron-Secret') !== secret)
    return new Response('Unauthorized', { status: 401 });

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_KEY;
  const siteUrl     = env.SITE_URL || 'https://claire-cm-site.pages.dev';
  if (!supabaseUrl || !supabaseKey) return json({ error: 'Config manquante' }, 500);

  // Chercher contenus pending depuis > 5 jours
  const cutoff = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();
  const res = await fetch(
    `${supabaseUrl}/rest/v1/content_items?select=id,title,created_at,client_id,profiles(email,full_name,notif_prefs)&status=eq.pending&created_at=lt.${encodeURIComponent(cutoff)}`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  );
  const items = await res.json();
  if (!Array.isArray(items)) return json({ error: 'Supabase error' }, 500);

  let sent = 0, skipped = 0;
  for (const item of items) {
    const client = item.profiles;
    if (!client?.email) { skipped++; continue; }
    const prefs = client.notif_prefs || {};
    if (prefs.email === false || prefs.motifs?.contenu === false) { skipped++; continue; }

    const daysPending = Math.floor((Date.now() - new Date(item.created_at).getTime()) / (24 * 3600 * 1000));
    const sendRes = await fetch(`${siteUrl}/api/send-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: item.client_id,
        type: 'rappel',
        data: { contentTitle: item.title || 'Contenu en attente', daysPending },
      }),
    });
    if (sendRes.ok) sent++; else skipped++;
  }

  return json({ checked: items.length, sent, skipped });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
