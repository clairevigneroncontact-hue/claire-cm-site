export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    const resendKey   = env.RESEND_API_KEY;
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_KEY;

    if (!resendKey || !supabaseUrl || !supabaseKey) {
      return resp({ error: 'Configuration manquante' }, 500);
    }

    let body;
    try { body = await request.json(); } catch (e) { return resp({ error: 'Body invalide' }, 400); }

    const { clientId, title, contentType, caption, scheduledAt } = body || {};
    if (!clientId || !title) return resp({ error: 'clientId et title requis' }, 400);

    // Récupérer le profil client
    let client;
    try {
      const profileRes = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(clientId)}&select=full_name,email,notif_email`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
      );
      const profiles = await profileRes.json();
      client = Array.isArray(profiles) ? profiles[0] : null;
    } catch (e) {
      return resp({ error: 'Erreur Supabase' }, 500);
    }

    if (!client || !client.email) return resp({ skipped: 'Client introuvable' }, 200);
    if (client.notif_email === false) return resp({ skipped: 'Notifications désactivées' }, 200);

    const prenom    = String(client.full_name || client.email).split(' ')[0];
    const typeLabel = ({ post: 'Post', story: 'Story', reel: 'Reel', carrousel: 'Carrousel' })[String(contentType || '').toLowerCase()] || contentType || 'Contenu';
    const dateLabel = scheduledAt
      ? new Date(scheduledAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
      : '';

    const captionLine = caption ? `<p style="color:#767A55;font-style:italic;margin:0 0 16px">"${String(caption).slice(0, 200)}${caption.length > 200 ? '...' : ''}"</p>` : '';
    const dateLine    = dateLabel ? `<p style="color:#767A55;font-size:13px;margin:0 0 20px">Publication prevue le ${dateLabel}</p>` : '';

    const html = [
      '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>',
      '<body style="margin:0;padding:0;background:#F5EDE4;font-family:Arial,sans-serif">',
      '<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">',
      '<tr><td align="center">',
      '<table width="100%" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden">',
      '<tr><td style="background:#2C2416;padding:24px 32px">',
      '<p style="margin:0;color:#F5EDE4;font-size:18px">Claire Vigneron &middot; CM</p>',
      '</td></tr>',
      '<tr><td style="padding:32px">',
      `<p style="color:#2C2416;margin:0 0 8px">Bonjour ${prenom},</p>`,
      '<h1 style="color:#2C2416;font-size:22px;margin:0 0 20px">Nouveau contenu a valider</h1>',
      '<table width="100%" style="background:#F5EDE4;border-radius:12px;margin:0 0 20px"><tr><td style="padding:20px">',
      `<p style="color:#8B3E22;font-size:11px;font-weight:600;text-transform:uppercase;margin:0 0 6px">${typeLabel}</p>`,
      `<p style="color:#2C2416;font-size:17px;font-weight:600;margin:0 0 12px">${String(title)}</p>`,
      captionLine,
      dateLine,
      '<a href="https://claire-cm-site.pages.dev/espace-client/dashboard"',
      ' style="display:inline-block;background:#8B3E22;color:#F5EDE4;padding:12px 24px;border-radius:50px;font-size:14px;text-decoration:none">',
      'Valider ou refuser &rarr;</a>',
      '</td></tr></table>',
      '<p style="color:#767A55;font-size:13px;margin:0">Connectez-vous a votre espace pour voir le visuel complet et laisser un commentaire.</p>',
      '</td></tr>',
      '<tr><td style="background:#F5EDE4;padding:20px 32px;border-top:1px solid #D6CCC0">',
      '<p style="color:#767A55;font-size:12px;margin:0">Claire Vigneron &middot; Community Manager &middot; Rennes<br>',
      '<a href="mailto:clairevigneron.contact@gmail.com" style="color:#8B3E22">clairevigneron.contact@gmail.com</a></p>',
      '</td></tr>',
      '</table></td></tr></table></body></html>',
    ].join('');

    // Envoi via Resend
    let sendRes;
    try {
      sendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from:    'Claire Vigneron CM <onboarding@resend.dev>',
          to:      [client.email],
          subject: `Nouveau contenu a valider : ${String(title)}`,
          html,
        }),
      });
    } catch (e) {
      return resp({ error: 'Erreur reseau Resend' }, 500);
    }

    if (!sendRes.ok) {
      const err = await sendRes.text().catch(() => 'unknown');
      return resp({ error: 'Resend: ' + err }, 500);
    }

    return resp({ sent: true }, 200);

  } catch (err) {
    return resp({ error: 'Exception: ' + String(err) }, 500);
  }
}

function resp(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
