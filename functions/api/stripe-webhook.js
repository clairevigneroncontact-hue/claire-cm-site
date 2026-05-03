/**
 * Cloudflare Pages Function — Stripe webhook
 * Écoute invoice.payment_succeeded et sauvegarde la facture dans Supabase.
 *
 * Variables d'environnement requises (Cloudflare Pages → Settings → Variables) :
 *   STRIPE_WEBHOOK_SECRET  → whsec_... (obtenu lors de la création du webhook dans Stripe)
 *   SUPABASE_URL           → https://etubpowlffhdvnfqkjij.supabase.co
 *   SUPABASE_SERVICE_KEY   → clé service_role (Supabase → Project Settings → API)
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const webhookSecret  = env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl    = env.SUPABASE_URL;
  const supabaseKey    = env.SUPABASE_SERVICE_KEY;

  if (!webhookSecret || !supabaseUrl || !supabaseKey) {
    return new Response('Configuration manquante', { status: 500 });
  }

  const body = await request.text();
  const sig  = request.headers.get('stripe-signature');

  // ── Vérification de la signature Stripe ──────────────────────────────────
  let event;
  try {
    event = await verifyStripeSignature(body, sig, webhookSecret);
  } catch (err) {
    console.error('Stripe signature invalide :', err.message);
    return new Response(`Signature invalide : ${err.message}`, { status: 400 });
  }

  // ── Traitement de l'événement ─────────────────────────────────────────────
  let customerEmail, pdfUrl, docName;

  if (event.type === 'invoice.payment_succeeded') {
    // Factures Stripe (abonnements récurrents)
    const invoice   = event.data.object;
    customerEmail   = invoice.customer_email?.toLowerCase().trim();
    pdfUrl          = invoice.invoice_pdf;
    const invoiceNumber = invoice.number || invoice.id;
    const amount    = ((invoice.amount_paid || 0) / 100).toFixed(2).replace('.', ',');
    const currency  = (invoice.currency || 'eur').toUpperCase();
    const invoiceDate = new Date((invoice.created || Date.now() / 1000) * 1000)
      .toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    docName = `Facture ${invoiceNumber} · ${amount} ${currency} · ${invoiceDate}`;

  } else if (event.type === 'checkout.session.completed') {
    // Payment Links (paiements uniques via buy.stripe.com)
    const session   = event.data.object;
    if (session.payment_status !== 'paid') return new Response('Non payé', { status: 200 });
    customerEmail   = session.customer_details?.email?.toLowerCase().trim();
    pdfUrl          = null; // Stripe génère la facture en différé — on stocke le reçu
    const amount    = ((session.amount_total || 0) / 100).toFixed(2).replace('.', ',');
    const currency  = (session.currency || 'eur').toUpperCase();
    const date      = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    const product   = session.metadata?.product_name || 'Prestation';
    docName         = `Reçu · ${product} · ${amount} ${currency} · ${date}`;

    // Récupérer l'URL du reçu Stripe (disponible sur le payment_intent)
    if (session.payment_intent) {
      const piRes = await fetch(
        `https://api.stripe.com/v1/payment_intents/${session.payment_intent}`,
        { headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` } }
      );
      if (piRes.ok) {
        const pi = await piRes.json();
        const chargeId = pi.latest_charge;
        if (chargeId) {
          const chargeRes = await fetch(
            `https://api.stripe.com/v1/charges/${chargeId}`,
            { headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` } }
          );
          if (chargeRes.ok) {
            const charge = await chargeRes.json();
            pdfUrl = charge.receipt_url || null;
          }
        }
      }
    }
  } else {
    return new Response('Événement ignoré', { status: 200 });
  }

  if (!customerEmail) {
    console.warn('Aucun email client dans l\'événement, ignoré.');
    return new Response('Ignoré', { status: 200 });
  }

  // Chercher le client dans Supabase par email
  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(customerEmail)}&role=eq.client&select=id`,
    { headers: supabaseHeaders(supabaseKey) }
  );
  const profiles = await profileRes.json();

  if (!profiles?.length) {
    console.warn(`Aucun client trouvé pour l'email ${customerEmail}`);
    return new Response('Client introuvable', { status: 200 });
  }

  const clientId = profiles[0].id;

  const insertRes = await fetch(
    `${supabaseUrl}/rest/v1/documents`,
    {
      method: 'POST',
      headers: { ...supabaseHeaders(supabaseKey), 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        client_id:  clientId,
        name:       docName,
        type:       'Facture',
        file_url:   pdfUrl || '',
        created_at: new Date().toISOString(),
      }),
    }
  );

  if (!insertRes.ok) {
    const err = await insertRes.text();
    console.error('Erreur insertion Supabase :', err);
    return new Response('Erreur Supabase', { status: 500 });
  }

  console.log(`Document sauvegardé pour ${customerEmail} : ${docName}`);
  return new Response('OK', { status: 200 });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function supabaseHeaders(serviceKey) {
  return {
    'apikey':        serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type':  'application/json',
  };
}

async function verifyStripeSignature(payload, sigHeader, secret) {
  if (!sigHeader) throw new Error('En-tête stripe-signature absent');

  const parts     = sigHeader.split(',');
  const tPart     = parts.find(p => p.startsWith('t='));
  const v1Parts   = parts.filter(p => p.startsWith('v1='));

  if (!tPart || !v1Parts.length) throw new Error('Format stripe-signature invalide');

  const timestamp = tPart.slice(2);
  const sigs      = v1Parts.map(p => p.slice(3));

  // Tolérance anti-replay : 5 minutes
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) {
    throw new Error('Timestamp trop ancien (replay attack)');
  }

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const expected = Array.from(new Uint8Array(sigBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  if (!sigs.includes(expected)) throw new Error('Signature HMAC incorrecte');

  return JSON.parse(payload);
}
