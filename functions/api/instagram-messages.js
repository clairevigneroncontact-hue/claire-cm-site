function resp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

export async function onRequestGet({ request, env }) {
  try {
    const url      = new URL(request.url);
    const clientId = url.searchParams.get('clientId');
    if (!clientId) return resp({ error: 'clientId requis' }, 400);

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_KEY;
    const key = String(supabaseKey).replace(/[^\x21-\x7E]/g, '');

    // Récupérer token + username (pour identifier Claire dans les conversations)
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${clientId}&select=ig_access_token,ig_account_id,instagram_handle`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    const profiles = await profileRes.json();
    const profile  = Array.isArray(profiles) ? profiles[0] : null;
    if (!profile?.ig_access_token || !profile?.ig_account_id) return resp({ error: 'no_token' }, 404);

    const token      = profile.ig_access_token;
    const igId       = String(profile.ig_account_id).trim();
    const myUsername = (profile.instagram_handle || '').replace('@', '').toLowerCase().trim();

    const res  = await fetch(
      `https://graph.instagram.com/${igId}/conversations?platform=instagram&fields=id,participants{id,name,username,profile_pic,profile_picture_url},messages{id,message,from{id,name,username,profile_pic,profile_picture_url},created_time}&limit=20&access_token=${token}`
    );
    const json = await res.json();

    if (json.error) return resp({ error: json.error.message, code: json.error.code }, 400);

    const allConvs = json.data || [];

    // Enrichir les profils manquants
    const unknownIds = new Set();
    for (const conv of allConvs) {
      for (const p of (conv.participants?.data || [])) {
        const pid = String(p.id).trim();
        if (pid !== igId && !p.username && !p.name) unknownIds.add(pid);
      }
    }
    const profileCache = {};
    if (unknownIds.size > 0) {
      await Promise.all([...unknownIds].map(async (pid) => {
        try {
          const pr = await fetch(`https://graph.instagram.com/${pid}?fields=name,username,profile_pic,profile_picture_url&access_token=${token}`);
          const pj = await pr.json();
          if (!pj.error) profileCache[pid] = pj;
        } catch(_) {}
      }));
    }

    const conversations = allConvs.map(conv => {
      // Index des participants enrichi
      const participantMap = {};
      (conv.participants?.data || []).forEach(p => {
        const pid = String(p.id).trim();
        const cached = profileCache[pid] || {};
        participantMap[pid] = {
          ...p,
          name:        p.name              || cached.name              || '',
          username:    p.username          || cached.username          || '',
          profile_pic: p.profile_pic       || p.profile_picture_url   ||
                       cached.profile_pic  || cached.profile_picture_url || '',
        };
      });

      // Identifier l'ID de Claire dans CETTE conversation par son username
      // (l'IGSID dans les conversations ≠ ig_account_id stocké en base)
      const myParticipantId = (() => {
        if (myUsername) {
          const found = Object.values(participantMap).find(
            p => (p.username || '').toLowerCase() === myUsername
          );
          if (found) return String(found.id).trim();
        }
        // Fallback : ig_account_id stocké
        return igId;
      })();

      return {
        ...conv,
        messages: conv.messages ? {
          ...conv.messages,
          data: (conv.messages.data || []).map(m => {
            const fromId   = String(m.from?.id || '').trim();
            const fromPart = participantMap[fromId] || profileCache[fromId] || {};
            return {
              ...m,
              from: {
                id:          fromId,
                name:        m.from?.name                 || fromPart.name        || '',
                username:    m.from?.username             || fromPart.username    || '',
                profile_pic: m.from?.profile_pic          || m.from?.profile_picture_url ||
                             fromPart.profile_pic         || fromPart.profile_picture_url || '',
              },
              isMine: fromId === myParticipantId,
            };
          }),
        } : conv.messages,
        // Passer l'ID résolu de Claire pour ce contexte
        _myId: myParticipantId,
      };
    });

    // igAccountId = l'ID réel de Claire dans les conversations (premier résolu)
    const resolvedMyId = conversations[0]?._myId || igId;

    return resp({ conversations, igAccountId: resolvedMyId, myUsername });
  } catch(err) {
    return resp({ error: err.message }, 500);
  }
}
