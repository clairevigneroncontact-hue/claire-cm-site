// Fonction générique de notification email
// type: 'contenu' | 'document' | 'message' | 'bilan' | 'rappel'
export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const resendKey   = env.RESEND_API_KEY;
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_KEY;
    if (!resendKey || !supabaseUrl || !supabaseKey) return resp({ error: 'Config manquante' }, 500);

    let body;
    try { body = await request.json(); } catch(e) { return resp({ error: 'Body invalide' }, 400); }
    const { clientId, type, data = {} } = body || {};
    if (!clientId || !type) return resp({ error: 'clientId et type requis' }, 400);

    // Récupérer profil + prefs
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(clientId)}&select=full_name,email,notif_prefs`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const profiles = await profileRes.json();
    const client = Array.isArray(profiles) ? profiles[0] : null;
    if (!client?.email) return resp({ skipped: 'Client introuvable' }, 200);

    // Vérifier prefs
    const prefs = client.notif_prefs || {};
    if (prefs.email === false) return resp({ skipped: 'Email désactivé' }, 200);
    if (type !== 'rappel' && prefs.motifs?.[type] === false) return resp({ skipped: `Motif "${type}" désactivé` }, 200);

    const prenom = String(client.full_name || client.email).split(' ')[0];
    const { subject, html } = buildEmail(type, prenom, data);

    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    'Claire Vigneron CM <onboarding@resend.dev>',
        to:      [client.email],
        subject,
        html,
      }),
    });
    if (!sendRes.ok) {
      const err = await sendRes.text().catch(() => '?');
      return resp({ error: 'Resend: ' + err }, 500);
    }
    return resp({ sent: true, type }, 200);
  } catch(err) {
    return resp({ error: String(err) }, 500);
  }
}

function resp(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function shell(body) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F5EDE4;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="100%" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:#2C2416;padding:24px 32px">
  <p style="margin:0;color:#F5EDE4;font-size:18px">Claire Vigneron &middot; CM</p>
</td></tr>
<tr><td style="padding:32px">${body}</td></tr>
<tr><td style="background:#F5EDE4;padding:20px 32px;border-top:1px solid #D6CCC0">
  <p style="color:#767A55;font-size:12px;margin:0">Claire Vigneron &middot; Community Manager &middot; Rennes<br>
  <a href="mailto:clairevigneron.contact@gmail.com" style="color:#8B3E22">clairevigneron.contact@gmail.com</a></p>
</td></tr>
</table></td></tr></table></body></html>`;
}

const DASHBOARD_URL = 'https://claire-cm-site.pages.dev/espace-client/dashboard';
const BTN = (label, href) =>
  `<a href="${href}" style="display:inline-block;background:#8B3E22;color:#F5EDE4;padding:12px 24px;border-radius:50px;font-size:14px;text-decoration:none">${label} &rarr;</a>`;

function buildEmail(type, prenom, data) {
  switch (type) {

    case 'contenu': {
      const { title = 'Contenu', contentType = '', caption = '', scheduledAt } = data;
      const typeLabel = ({ post:'Post', story:'Story', reel:'Reel', carrousel:'Carrousel' })[String(contentType).toLowerCase()] || contentType || 'Contenu';
      const dateLabel = scheduledAt ? new Date(scheduledAt).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' }) : '';
      return {
        subject: `Nouveau contenu à valider : ${title}`,
        html: shell(`
          <p style="color:#2C2416;margin:0 0 8px">Bonjour ${prenom},</p>
          <h1 style="color:#2C2416;font-size:22px;margin:0 0 20px">Nouveau contenu à valider</h1>
          <table width="100%" style="background:#F5EDE4;border-radius:12px;margin:0 0 20px"><tr><td style="padding:20px">
            <p style="color:#8B3E22;font-size:11px;font-weight:600;text-transform:uppercase;margin:0 0 6px">${typeLabel}</p>
            <p style="color:#2C2416;font-size:17px;font-weight:600;margin:0 0 12px">${title}</p>
            ${caption ? `<p style="color:#767A55;font-style:italic;margin:0 0 12px">"${String(caption).slice(0,200)}${caption.length>200?'...':''}"</p>` : ''}
            ${dateLabel ? `<p style="color:#767A55;font-size:13px;margin:0 0 16px">Publication prévue le ${dateLabel}</p>` : ''}
            ${BTN('Valider ou refuser', DASHBOARD_URL + '?goto=content')}
          </td></tr></table>
          <p style="color:#767A55;font-size:13px;margin:0">Connectez-vous à votre espace pour voir le visuel complet et laisser un commentaire.</p>
        `),
      };
    }

    case 'document': {
      const { docName = 'Document', docType = '' } = data;
      const typeMap = { contrat:'un Contrat', facture:'une Facture', devis:'un Devis', 'audit-instagram':'un Audit Instagram', 'compte-rendu':'un Compte rendu mensuel' };
      const typeLabel = typeMap[docType] || 'un document';
      return {
        subject: `Nouveau document disponible : ${docName}`,
        html: shell(`
          <p style="color:#2C2416;margin:0 0 8px">Bonjour ${prenom},</p>
          <h1 style="color:#2C2416;font-size:22px;margin:0 0 20px">Nouveau document disponible</h1>
          <table width="100%" style="background:#F5EDE4;border-radius:12px;margin:0 0 20px"><tr><td style="padding:20px">
            <p style="color:#767A55;font-size:13px;margin:0 0 8px">Claire vous a déposé ${typeLabel} :</p>
            <p style="color:#2C2416;font-size:16px;font-weight:600;margin:0 0 16px">${docName}</p>
            ${BTN('Voir dans mon espace', DASHBOARD_URL + '?goto=docs')}
          </td></tr></table>
          <p style="color:#767A55;font-size:13px;margin:0">Retrouvez ce document dans l'onglet "Mes documents" de votre espace client.</p>
        `),
      };
    }

    case 'message': {
      const { preview = '' } = data;
      return {
        subject: 'Nouveau message de Claire',
        html: shell(`
          <p style="color:#2C2416;margin:0 0 8px">Bonjour ${prenom},</p>
          <h1 style="color:#2C2416;font-size:22px;margin:0 0 20px">Claire vous a envoyé un message</h1>
          ${preview ? `<table width="100%" style="background:#F5EDE4;border-radius:12px;margin:0 0 20px"><tr><td style="padding:20px">
            <p style="color:#767A55;font-style:italic;margin:0 0 12px">"${String(preview).slice(0,300)}${preview.length>300?'...':''}"</p>
            ${BTN('Lire et répondre', DASHBOARD_URL + '?goto=discussion')}
          </td></tr></table>` : BTN('Voir le message', DASHBOARD_URL + '?goto=discussion')}
          <p style="color:#767A55;font-size:13px;margin:0">Répondez directement depuis votre espace client via la bulle de discussion.</p>
        `),
      };
    }

    case 'rappel': {
      const { contentTitle = 'un contenu', daysPending = 5 } = data;
      return {
        subject: 'Rappel : vous avez un contenu en attente de validation',
        html: shell(`
          <p style="color:#2C2416;margin:0 0 8px">Bonjour ${prenom},</p>
          <h1 style="color:#2C2416;font-size:22px;margin:0 0 20px">Un contenu attend votre validation</h1>
          <table width="100%" style="background:#FEF9C3;border-radius:12px;border:1px solid #FDE68A;margin:0 0 20px"><tr><td style="padding:20px">
            <p style="color:#92400E;font-size:13px;margin:0 0 8px">⏳ En attente depuis ${daysPending} jours</p>
            <p style="color:#2C2416;font-size:16px;font-weight:600;margin:0 0 16px">${contentTitle}</p>
            ${BTN('Valider maintenant', DASHBOARD_URL + '?goto=content')}
          </td></tr></table>
          <p style="color:#767A55;font-size:13px;margin:0">Si vous avez des questions ou souhaitez des modifications, utilisez la bulle de discussion.</p>
        `),
      };
    }

    case 'bilan': {
      const { month = '', year = new Date().getFullYear() } = data;
      const monthLabel = month || new Date().toLocaleDateString('fr-FR', { month: 'long' });
      const bestPost = data.bestPost;
      return {
        subject: `Bilan mensuel ${monthLabel} ${year} — Votre Instagram`,
        html: shell(`
          <p style="color:#2C2416;margin:0 0 8px">Bonjour ${prenom},</p>
          <h1 style="color:#2C2416;font-size:22px;margin:0 0 4px">Bilan ${monthLabel} ${year}</h1>
          <p style="color:#767A55;font-size:14px;margin:0 0 24px">Récapitulatif de votre activité Instagram ce mois-ci</p>
          <table width="100%" style="background:#F5EDE4;border-radius:12px;margin:0 0 20px"><tr><td style="padding:24px">
            <p style="color:#8B3E22;font-size:11px;font-weight:600;text-transform:uppercase;margin:0 0 16px">Résumé du mois</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #D6CCC0"><p style="margin:0;color:#2C2416;font-size:13px">Contenus publiés</p></td>
                <td align="right" style="padding:8px 0;border-bottom:1px solid #D6CCC0"><p style="margin:0;color:#8B3E22;font-weight:600;font-size:13px">${data.contenusPublies ?? '—'}</p></td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #D6CCC0"><p style="margin:0;color:#2C2416;font-size:13px">Nouveaux abonnés</p></td>
                <td align="right" style="padding:8px 0;border-bottom:1px solid #D6CCC0"><p style="margin:0;color:#8B3E22;font-weight:600;font-size:13px">${data.nouveauxAbonnes ?? '—'}</p></td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #D6CCC0"><p style="margin:0;color:#2C2416;font-size:13px">Portée totale</p></td>
                <td align="right" style="padding:8px 0;border-bottom:1px solid #D6CCC0"><p style="margin:0;color:#8B3E22;font-weight:600;font-size:13px">${data.porteeMovenne ?? '—'}</p></td>
              </tr>
              <tr>
                <td style="padding:8px 0"><p style="margin:0;color:#2C2416;font-size:13px">Taux d'engagement</p></td>
                <td align="right" style="padding:8px 0"><p style="margin:0;color:#8B3E22;font-weight:600;font-size:13px">${data.engagementMoyen ?? '—'}</p></td>
              </tr>
            </table>
            ${bestPost ? `
            <div style="margin:20px 0 0;padding:16px;background:#fff;border-radius:10px">
              <p style="color:#8B3E22;font-size:11px;font-weight:600;text-transform:uppercase;margin:0 0 12px">🏆 Meilleur post du mois</p>
              <table width="100%" cellpadding="0" cellspacing="0"><tr>
                ${bestPost.img ? `<td style="width:64px;padding-right:12px"><a href="${bestPost.url||'#'}"><img src="${bestPost.img}" width="64" height="64" style="border-radius:8px;object-fit:cover;display:block" /></a></td>` : ''}
                <td>
                  <p style="margin:0 0 6px;color:#2C2416;font-size:13px;line-height:1.4">${bestPost.caption ? bestPost.caption.slice(0,80) + (bestPost.caption.length > 80 ? '…' : '') : '—'}</p>
                  <p style="margin:0;color:#767A55;font-size:12px">❤️ ${bestPost.likes||0} &nbsp; 💬 ${bestPost.comments||0}${bestPost.reposts != null ? ` &nbsp; ↻ ${bestPost.reposts}` : ''}${bestPost.saves != null ? ` &nbsp; 🔖 ${bestPost.saves}` : ''}</p>
                </td>
              </tr></table>
            </div>` : ''}
            ${data.highlights ? `<div style="margin:16px 0 0;padding:12px 16px;background:#fff;border-radius:10px;border-left:3px solid #8B3E22"><p style="color:#8B3E22;font-size:11px;font-weight:600;text-transform:uppercase;margin:0 0 6px">Points forts du mois</p><p style="color:#2C2416;font-size:13px;margin:0;line-height:1.6">${String(data.highlights).replace(/\n/g,'<br>')}</p></div>` : ''}
            ${data.next ? `<div style="margin:12px 0 0;padding:12px 16px;background:#fff;border-radius:10px;border-left:3px solid #D6CCC0"><p style="color:#767A55;font-size:11px;font-weight:600;text-transform:uppercase;margin:0 0 6px">Le mois prochain</p><p style="color:#2C2416;font-size:13px;margin:0;line-height:1.6">${String(data.next).replace(/\n/g,'<br>')}</p></div>` : ''}
            ${BTN('Voir mes statistiques', DASHBOARD_URL)}
          </td></tr></table>
          <p style="color:#767A55;font-size:13px;margin:0">À bientôt pour le mois prochain !</p>
        `),
      };
    }

    default:
      return { subject: 'Notification Claire CM', html: shell(`<p>Bonjour ${prenom},<br>Vous avez une notification dans votre espace client.</p>${BTN('Accéder', DASHBOARD_URL)}`) };
  }
}
