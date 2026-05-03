/**
 * Cloudflare Pages Function — envoi email "contenu à valider"
 *
 * Variables d'environnement requises :
 *   RESEND_API_KEY     → re_... (Resend Dashboard → API Keys)
 *   SUPABASE_URL       → déjà configuré
 *   SUPABASE_SERVICE_KEY → déjà configuré
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const resendKey    = env.RESEND_API_KEY;
  const supabaseUrl  = env.SUPABASE_URL;
  const supabaseKey  = env.SUPABASE_SERVICE_KEY;

  if (!resendKey || !supabaseUrl || !supabaseKey) {
    return json({ error: 'Configuration manquante' }, 500);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Body invalide' }, 400); }

  const { clientId, title, contentType, caption, scheduledAt } = body;
  if (!clientId || !title) return json({ error: 'clientId et title requis' }, 400);

  // Récupérer le profil client
  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${clientId}&select=full_name,email,notif_email`,
    { headers: supabaseHeaders(supabaseKey) }
  );
  const profiles = await profileRes.json();
  const client = profiles?.[0];

  if (!client?.email) return json({ error: 'Client introuvable' }, 404);

  // Respecter la préférence de notification (true par défaut si non défini)
  if (client.notif_email === false) return json({ skipped: true }, 200);

  const prenom      = (client.full_name || client.email).split(' ')[0];
  const typeLabel   = { post: 'Post', story: 'Story', reel: 'Reel', carrousel: 'Carrousel' }[contentType?.toLowerCase()] || contentType || 'Contenu';
  const dateLabel   = scheduledAt
    ? new Date(scheduledAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    : null;
  const captionHtml = caption ? `<p style="color:#767A55;font-style:italic;margin:0 0 20px">"${caption.slice(0, 200)}${caption.length > 200 ? '…' : ''}"</p>` : '';
  const dateHtml    = dateLabel ? `<p style="color:#767A55;font-size:13px;margin:0 0 24px">📅 Publication prévue le <strong>${dateLabel}</strong></p>` : '';

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5EDE4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5EDE4;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(44,36,22,.08)">

        <!-- Header -->
        <tr>
          <td style="background:#2C2416;padding:24px 32px">
            <p style="margin:0;color:#F5EDE4;font-family:Georgia,serif;font-size:18px;letter-spacing:-.3px">
              Claire Vigneron <span style="color:#767A55">·</span> CM
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px">
            <p style="color:#2C2416;font-size:15px;margin:0 0 8px">Bonjour ${prenom} 👋</p>
            <h1 style="color:#2C2416;font-size:22px;font-weight:600;margin:0 0 20px;line-height:1.3">
              Nouveau contenu à valider
            </h1>

            <!-- Carte contenu -->
            <table width="100%" style="background:#F5EDE4;border-radius:12px;margin:0 0 20px">
              <tr>
                <td style="padding:20px 24px">
                  <p style="color:#8B3E22;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;margin:0 0 6px">${typeLabel}</p>
                  <p style="color:#2C2416;font-size:17px;font-weight:600;margin:0 0 12px">${title}</p>
                  ${captionHtml}
                  ${dateHtml}
                  <a href="https://claire-cm-site.pages.dev/espace-client/dashboard"
                     style="display:inline-block;background:#8B3E22;color:#F5EDE4;padding:12px 24px;border-radius:50px;font-size:14px;font-weight:500;text-decoration:none">
                    Valider ou refuser →
                  </a>
                </td>
              </tr>
            </table>

            <p style="color:#767A55;font-size:13px;margin:0">
              Connectez-vous à votre espace pour voir le visuel complet, laisser un commentaire et valider ou refuser ce contenu.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F5EDE4;padding:20px 32px;border-top:1px solid #D6CCC0">
            <p style="color:#767A55;font-size:12px;margin:0">
              Claire Vigneron · Community Manager · Rennes<br>
              <a href="mailto:clairevigneron.contact@gmail.com" style="color:#8B3E22">clairevigneron.contact@gmail.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // Envoi via Resend
  const sendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    'Claire Vigneron CM <noreply@claire-cm-site.pages.dev>',
      to:      [client.email],
      subject: `Nouveau contenu à valider — ${title}`,
      html,
    }),
  });

  if (!sendRes.ok) {
    const err = await sendRes.text();
    console.error('Erreur Resend :', err);
    return json({ error: 'Erreur envoi email' }, 500);
  }

  return json({ sent: true }, 200);
}

function supabaseHeaders(key) {
  return { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
