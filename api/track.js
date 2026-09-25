/* Stats privées : beacons en fichiers immuables (aucune réécriture → aucune perte).
   Stockage : Vercel Blob, un petit fichier par envoi.
   - POST /api/track {sid, view, dt, ref, p} → ajoute un fichier (public, anonyme)
   - GET  /api/track?key=MOT_DE_PASSE → stats agrégées (protégé)
   Variables Vercel : BLOB_READ_WRITE_TOKEN (auto), ADMIN_STATS_KEY (mot de passe). */
const { list, put } = require('@vercel/blob');

const MAX_FILES = 3000;

function day() { return new Date().toISOString().slice(0, 10); }

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
      let files = [];
      let cursor;
      do {
        const out = await list({ prefix: 'stats/e/', limit: 1000, cursor, token });
        files = files.concat(out.blobs || []);
        cursor = out.hasMore ? out.cursor : undefined;
      } while (cursor && files.length < MAX_FILES);
      files = files.slice(-MAX_FILES);
      const byDay = {};
      const visitors = new Set();
      let totalViews = 0, totalTime = 0;
      const refs = {};
      const devices = { mobile: 0, desktop: 0 };
      const seenDevices = new Set();
      await Promise.all(files.map(async (b) => {
        try {
          const r = await fetch(b.url, { headers: { Authorization: 'Bearer ' + token } });
          const e = await r.json();
          const d = (b.pathname.split('/')[2] || '').slice(0, 10);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
          const dayRow = byDay[d] || (byDay[d] = { views: 0, sids: new Set(), time: 0 });
          dayRow.views += e.v ? 1 : 0;
          totalViews += e.v ? 1 : 0;
          if (e.sid && e.sid !== 'anon') {
            visitors.add(e.sid);
            dayRow.sids.add(e.sid);
            if (!seenDevices.has(e.sid)) {
              seenDevices.add(e.sid);
              devices[e.d === 'mobile' ? 'mobile' : 'desktop']++;
            }
          }
          dayRow.time += Math.min(300, Number(e.t) || 0);
          totalTime += Math.min(300, Number(e.t) || 0);
          const ref = e.r || 'direct';
          refs[ref] = (refs[ref] || 0) + (e.v ? 1 : 0);
        } catch (e) {}
      }));
      const days = Object.keys(byDay).sort().slice(-30).map((k) => ({
        day: k, views: byDay[k].views, visitors: byDay[k].sids.size
      }));
      res.status(200).json({
        days,
        totalViews,
        visitors: visitors.size,
        sessions: visitors.size,
        avgTime: visitors.size ? Math.round(totalTime / visitors.size) : 0,
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
  if (!body.view && !(Number(body.dt) > 0)) {
    res.status(200).json({ ok: true });
    return;
  }
  const ua = req.headers['user-agent'] || '';
  const evt = {
    sid,
    v: body.view ? 1 : 0,
    t: Math.min(300, Number(body.dt) || 0),
    r: (body.ref || '').toString().slice(0, 120),
    p: (body.p || '').toString().slice(0, 80),
    d: /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop'
  };
  const name = 'stats/e/' + day() + '/' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + '.json';
  try {
    await put(name, JSON.stringify(evt), {
      accessToken: token,
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      cacheControlMaxAge: 0
    });
  } catch (e) {
    console.error('[track] put failed:', e && e.message);
  }
  res.status(200).json({ ok: true });
};
