// Cron : envoi automatique du bilan mensuel le 1er du mois
// URL : POST /api/cron-monthly-report avec header X-Cron-Secret: <CRON_SECRET>
export async function onRequestPost(context) {
  const { request, env } = context;
  const secret = env.CRON_SECRET;
  if (secret && request.headers.get('X-Cron-Secret') !== secret)
    return new Response('Unauthorized', { status: 401 });

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_KEY;
  const siteUrl     = env.SITE_URL || 'https://claire-cm-site.pages.dev';
  if (!supabaseUrl || !supabaseKey) return json({ error: 'Config manquante' }, 500);

  // Mois précédent
  const now   = new Date();
  const prev  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const month = prev.toLocaleDateString('fr-FR', { month: 'long' });
  const year  = prev.getFullYear();

  // Récupérer tous les clients actifs (avec notif bilan activée)
  const res = await fetch(
    `${supabaseUrl}/rest/v1/profiles?role=eq.client&select=id,email,full_name,notif_prefs`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  );
  const clients = await res.json();
  if (!Array.isArray(clients)) return json({ error: 'Supabase error' }, 500);

  let sent = 0, skipped = 0;
  for (const client of clients) {
    if (!client.email) { skipped++; continue; }
    const prefs = client.notif_prefs || {};
    if (prefs.email === false || prefs.motifs?.bilan === false) { skipped++; continue; }

    const sendRes = await fetch(`${siteUrl}/api/send-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: client.id,
        type: 'bilan',
        data: { month, year },
      }),
    });
    if (sendRes.ok) sent++; else skipped++;
  }

  return json({ month, year, total: clients.length, sent, skipped });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
