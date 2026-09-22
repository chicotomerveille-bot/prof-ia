/* MoneyFusion — création de paiement (3 900 FCFA).
   Configure l'URL API dans le dashboard Vercel : variable MF_API_URL
   (dashboard MoneyFusion → API de paiement → créer une application).
   Pense à déclarer le domaine du site + l'URL de retour dans l'application. */
const MF_API_URL = process.env.MF_API_URL || 'REPLACE_MONEYFUSION_API_URL';
const PRICE = 3900;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};
  const name = (body.nom || '').toString().trim();
  const phone = (body.phone || '').toString().replace(/[\s.\-()]/g, '');
  if (name.length < 2) {
    res.status(400).json({ error: 'Indique ton nom pour continuer.' });
    return;
  }
  if (!/^[0-9+]{8,15}$/.test(phone)) {
    res.status(400).json({ error: 'Numéro Mobile Money invalide.' });
    return;
  }
  if (!MF_API_URL || MF_API_URL.indexOf('REPLACE_') === 0) {
    res.status(503).json({ error: 'Paiement en cours d\u2019activation. Réessaie dans un moment.' });
    return;
  }
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const base = 'https://' + host;
  const payload = {
    totalPrice: PRICE,
    article: [{ 'Pack Systeme Prof IA': PRICE }],
    nomclient: name,
    numeroSend: phone,
    personal_Info: [{ produit: 'pack-prof-ia', prix: PRICE }],
    return_url: base + '/merci.html',
    webhook_url: base + '/api/mf-webhook'
  };
  try {
    const r = await fetch(MF_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (!data || !data.statut || !data.url) {
      res.status(502).json({ error: 'Paiement indisponible, réessaie.' });
      return;
    }
    res.status(200).json({ url: data.url, token: data.token || null });
  } catch (e) {
    res.status(502).json({ error: 'Paiement indisponible, réessaie.' });
  }
};
