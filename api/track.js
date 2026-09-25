/* Stats privées : beacon visiteur + lecture protégée par mot de passe.
   Stockage : Vercel Blob (1 fichier JSON par jour).
   - POST /api/track {sid, view, dt, ref, p} → enregistre (public, anonyme)
   - GET  /api/track?key=MOT_DE_PASSE → stats agrégées (protégé)
   Variables Vercel : BLOB_READ_WRITE_TOKEN (auto via Blob Store), ADMIN_STATS_KEY (ton mot de passe). */
const { list, put } = require('@vercel/blob');

function today() { return new Date().toISOString().slice(0, 10); }

module.exports = async (req, res) => {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    res.status(503).json({ error: 'Stockage non configuré.' });
    return;
  }
  if (req.method === 'GET') {
    if (!process.env.ADMIN_STATS_KEY || req.query.key !== process.env.ADMIN_STATS_KEY) {
      res.status(401).json({ error: 'Non autorisé.' });
      return;
    }
    try {
      const out = await list({ prefix: 'stats/days/', limit: 60 });
      const files = (out.blobs || []).slice(-30);
      const days = [];
      let totalViews = 0, totalTime = 0, sessions = 0;
      const uniq = new Set();
      const refs = {};
      const devices = { mobile: 0, desktop: 0 };
      for (const b of files) {
        try {
          const r = await fetch(b.url);
          const d = await r.json();
          const sids = Object.keys(d.s || {});
          days.push({ day: b.pathname.split('/').pop().replace('.json', ''), views: d.v || 0, visitors: sids.length });
          totalViews += d.v || 0;
          for (const entry of Object.entries(d.s || {})) {
            const sid = entry[0], s = entry[1];
            sessions++;
            totalTime += s.t || 0;
            uniq.add(sid);
            const ref = s.r || 'direct';
            refs[ref] = (refs[ref] || 0) + 1;
            devices[s.d === 'mobile' ? 'mobile' : 'desktop']++;
          }
        } catch (e) {}
      }
      res.status(200).json({
        days,
        totalViews,
        visitors: uniq.size,
        sessions,
        avgTime: sessions ? Math.round(totalTime / sessions) : 0,
        refs: Object.entries(refs).sort((a, b) => b[1] - a[1]).slice(0, 10),
        devices
      });
    } catch (e) {
      res.status(502).json({ error: 'Lecture impossible.' });
    }
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({});
    return;
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};
  const sid = (body.sid || 'anon').toString().slice(0, 40);
  const path = 'stats/days/' + today() + '.json';
  let d = { v: 0, s: {} };
  try {
    const out = await list({ prefix: path, limit: 1 });
    if (out.blobs && out.blobs.length) {
      const r = await fetch(out.blobs[0].url);
      d = await r.json();
    }
  } catch (e) {}
  d.v = (d.v || 0) + (body.view ? 1 : 0);
  const s = d.s[sid] || { t: 0 };
  s.t = (s.t || 0) + Math.min(120, Number(body.dt) || 0);
  if (body.ref) s.r = body.ref.toString().slice(0, 120);
  if (body.p) s.p = body.p.toString().slice(0, 80);
  const ua = req.headers['user-agent'] || '';
  s.d = /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop';
  d.s[sid] = s;
  const keys = Object.keys(d.s);
  if (keys.length > 2000) {
    for (const k of keys.slice(0, keys.length - 2000)) delete d.s[k];
  }
  try {
    await put(path, JSON.stringify(d), {
      accessToken: token,
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true
    });
  } catch (e) {}
  res.status(200).json({ ok: true });
};
