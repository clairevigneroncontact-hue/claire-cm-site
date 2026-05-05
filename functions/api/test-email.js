// Endpoint de test email — à supprimer après validation
// GET /api/test-email?to=email@example.com&type=contenu
export async function onRequestGet(context) {
  const { request, env } = context;
  const url  = new URL(request.url);
  const to   = url.searchParams.get('to');
  const type = url.searchParams.get('type') || 'contenu';

  if (!to) return json({ error: 'Paramètre ?to= manquant' }, 400);

  const resendKey = env.RESEND_API_KEY;
  if (!resendKey) return json({ error: 'RESEND_API_KEY non configurée dans Cloudflare' }, 500);

  const DASHBOARD = 'https://clairevigneron.com/espace-client/dashboard';
  const BTN = (label, href) =>
    `<a href="${href}" style="display:inline-block;background:#8B3E22;color:#F5EDE4;padding:12px 24px;border-radius:50px;font-size:14px;text-decoration:none">${label} &rarr;</a>`;

  const shell = (body) => `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
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

  const templates = {
    contenu: {
      subject: '[TEST] Nouveau contenu à valider : Coulisses de la forge ✨',
      html: shell(`
        <p style="color:#2C2416;margin:0 0 8px">Bonjour Claire,</p>
        <h1 style="color:#2C2416;font-size:22px;margin:0 0 20px">Nouveau contenu à valider</h1>
        <table width="100%" style="background:#F5EDE4;border-radius:12px;margin:0 0 20px"><tr><td style="padding:20px">
          <p style="color:#8B3E22;font-size:11px;font-weight:600;text-transform:uppercase;margin:0 0 6px">Reel</p>
          <p style="color:#2C2416;font-size:17px;font-weight:600;margin:0 0 12px">Coulisses de la forge ✨</p>
          <p style="color:#767A55;font-style:italic;margin:0 0 12px">"Le feu, le métal, les mains qui façonnent — voici un aperçu de mon quotidien d'artisan..."</p>
          <p style="color:#767A55;font-size:13px;margin:0 0 16px">Publication prévue le vendredi 9 mai</p>
          ${BTN('Valider ou refuser', DASHBOARD + '?goto=content')}
        </td></tr></table>
        <p style="color:#767A55;font-size:13px;margin:0">Connectez-vous à votre espace pour voir le visuel complet et laisser un commentaire.</p>
        <p style="color:#D6CCC0;font-size:11px;margin:16px 0 0">— Ceci est un email de test —</p>
      `),
    },
    document: {
      subject: '[TEST] Nouveau document disponible : Audit Instagram — Avril 2026',
      html: shell(`
        <p style="color:#2C2416;margin:0 0 8px">Bonjour Claire,</p>
        <h1 style="color:#2C2416;font-size:22px;margin:0 0 20px">Nouveau document disponible</h1>
        <table width="100%" style="background:#F5EDE4;border-radius:12px;margin:0 0 20px"><tr><td style="padding:20px">
          <p style="color:#767A55;font-size:13px;margin:0 0 8px">Claire vous a déposé un Audit Instagram :</p>
          <p style="color:#2C2416;font-size:16px;font-weight:600;margin:0 0 16px">Audit Instagram — Avril 2026</p>
          ${BTN('Voir dans mon espace', DASHBOARD + '?goto=docs')}
        </td></tr></table>
        <p style="color:#767A55;font-size:13px;margin:0">Retrouvez ce document dans l'onglet "Mes documents" de votre espace client.</p>
        <p style="color:#D6CCC0;font-size:11px;margin:16px 0 0">— Ceci est un email de test —</p>
      `),
    },
    message: {
      subject: '[TEST] Nouveau message de Claire',
      html: shell(`
        <p style="color:#2C2416;margin:0 0 8px">Bonjour Claire,</p>
        <h1 style="color:#2C2416;font-size:22px;margin:0 0 20px">Claire vous a envoyé un message</h1>
        <table width="100%" style="background:#F5EDE4;border-radius:12px;margin:0 0 20px"><tr><td style="padding:20px">
          <p style="color:#767A55;font-style:italic;margin:0 0 12px">"Bonjour ! J'ai besoin de quelques photos récentes de votre atelier pour les posts de juin. Avez-vous des clichés à me transmettre ?"</p>
          ${BTN('Lire et répondre', DASHBOARD + '?goto=discussion')}
        </td></tr></table>
        <p style="color:#767A55;font-size:13px;margin:0">Répondez directement depuis votre espace client via la bulle de discussion.</p>
        <p style="color:#D6CCC0;font-size:11px;margin:16px 0 0">— Ceci est un email de test —</p>
      `),
    },
    rappel: {
      subject: '[TEST] Rappel : vous avez un contenu en attente de validation',
      html: shell(`
        <p style="color:#2C2416;margin:0 0 8px">Bonjour Claire,</p>
        <h1 style="color:#2C2416;font-size:22px;margin:0 0 20px">Un contenu attend votre validation</h1>
        <table width="100%" style="background:#FEF9C3;border-radius:12px;border:1px solid #FDE68A;margin:0 0 20px"><tr><td style="padding:20px">
          <p style="color:#92400E;font-size:13px;margin:0 0 8px">⏳ En attente depuis 5 jours</p>
          <p style="color:#2C2416;font-size:16px;font-weight:600;margin:0 0 16px">Coulisses de la forge ✨</p>
          ${BTN('Valider maintenant', DASHBOARD + '?goto=content')}
        </td></tr></table>
        <p style="color:#767A55;font-size:13px;margin:0">Si vous avez des questions ou souhaitez des modifications, utilisez la bulle de discussion.</p>
        <p style="color:#D6CCC0;font-size:11px;margin:16px 0 0">— Ceci est un email de test —</p>
      `),
    },
    bilan: {
      subject: '[TEST] Bilan mensuel avril 2026 — Votre Instagram',
      html: shell(`
        <p style="color:#2C2416;margin:0 0 8px">Bonjour Claire,</p>
        <h1 style="color:#2C2416;font-size:22px;margin:0 0 4px">Bilan avril 2026</h1>
        <p style="color:#767A55;font-size:14px;margin:0 0 24px">Récapitulatif de votre activité Instagram ce mois-ci</p>
        <table width="100%" style="background:#F5EDE4;border-radius:12px;margin:0 0 20px"><tr><td style="padding:24px">
          <p style="color:#8B3E22;font-size:11px;font-weight:600;text-transform:uppercase;margin:0 0 16px">Résumé du mois</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:10px 0;border-bottom:1px solid #D6CCC0"><p style="margin:0;color:#2C2416;font-size:13px">Contenus publiés</p></td><td align="right" style="padding:10px 0;border-bottom:1px solid #D6CCC0"><p style="margin:0;color:#8B3E22;font-weight:700;font-size:15px">12</p></td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #D6CCC0"><p style="margin:0;color:#2C2416;font-size:13px">Nouveaux abonnés</p></td><td align="right" style="padding:10px 0;border-bottom:1px solid #D6CCC0"><p style="margin:0;color:#8B3E22;font-weight:700;font-size:15px">+47</p></td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #D6CCC0"><p style="margin:0;color:#2C2416;font-size:13px">Portée moyenne</p></td><td align="right" style="padding:10px 0;border-bottom:1px solid #D6CCC0"><p style="margin:0;color:#8B3E22;font-weight:700;font-size:15px">—</p></td></tr>
            <tr><td style="padding:10px 0"><p style="margin:0;color:#2C2416;font-size:13px">Engagement moyen</p></td><td align="right" style="padding:10px 0"><p style="margin:0;color:#8B3E22;font-weight:700;font-size:15px">—</p></td></tr>
          </table>
          <p style="color:#767A55;font-size:11px;font-style:italic;margin:16px 0 16px">Les statistiques détaillées seront disponibles prochainement.</p>
          ${BTN('Voir mon espace client', DASHBOARD)}
        </td></tr></table>
        <p style="color:#767A55;font-size:13px;margin:0">À bientôt pour le mois prochain !</p>
        <p style="color:#D6CCC0;font-size:11px;margin:16px 0 0">— Ceci est un email de test —</p>
      `),
    },
  };

  const tpl = templates[type] || templates.contenu;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Claire Vigneron CM <onboarding@resend.dev>', to: [to], ...tpl }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '?');
    return json({ error: 'Resend: ' + err }, 500);
  }

  return json({ sent: true, to, type, subject: tpl.subject });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { 'Content-Type': 'application/json' } });
}
