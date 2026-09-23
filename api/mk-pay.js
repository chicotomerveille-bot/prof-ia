/* Maketou — création de panier (Pack 3 900 FCFA).
   Secrets côté serveur UNIQUEMENT (ne jamais exposer la clé API au navigateur) :
   - MK_API_KEY : clé secrète Maketou (Vercel → Settings → Environment Variables)
   - MK_PRODUCT_ID : identifiant public du produit (dashboard Maketou → produit) */
const MK_API_KEY = process.env.MK_API_KEY || '';
const MK_PRODUCT_ID = process.env.MK_PRODUCT_ID || 'REPLACE_MAKETOU_PRODUCT_ID';

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
  const firstName = (body.prenom || '').toString().trim();
  const lastName = (body.nom || '').toString().trim();
  const email = (body.email || '').toString().trim();
  const phone = (body.phone || '').toString().replace(/[\s.\-()]/g, '');
  if (firstName.length < 2 || lastName.length < 2) {
    res.status(400).json({ error: 'Indique ton prénom et ton nom.' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Adresse e-mail invalide.' });
    return;
  }
  if (phone && !/^[0-9+]{8,15}$/.test(phone)) {
    res.status(400).json({ error: 'Numéro de téléphone invalide.' });
    return;
  }
  if (!MK_API_KEY || !MK_PRODUCT_ID || MK_PRODUCT_ID.indexOf('REPLACE_') === 0) {
    res.status(503).json({ error: 'Paiement en cours d\u2019activation. Réessaie dans un moment.' });
    return;
  }
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const payload = {
    productDocumentId: MK_PRODUCT_ID,
    email: email,
    firstName: firstName,
    lastName: lastName,
    redirectURL: 'https://' + host + '/merci-mk.html',
    meta: { produit: 'pack-prof-ia', source: 'site' }
  };
  if (phone) payload.phone = phone;
  try {
    const r = await fetch('https://api.maketou.net/api/v1/stores/cart/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + MK_API_KEY
      },
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (!data || !data.redirectUrl || !data.cart || !data.cart.id) {
      res.status(502).json({ error: 'Paiement indisponible, réessaie.' });
      return;
    }
    res.status(200).json({ url: data.redirectUrl, cartId: data.cart.id });
  } catch (e) {
    res.status(502).json({ error: 'Paiement indisponible, réessaie.' });
  }
};
