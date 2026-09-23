/* Maketou — vérification du statut d'un panier.
   Le produit n'est livré que si status === 'completed'. */
const MK_API_KEY = process.env.MK_API_KEY || '';

module.exports = async (req, res) => {
  const cartId = ((req.query && req.query.cartId) || '').toString();
  if (!cartId) {
    res.status(400).json({ error: 'Panier manquant' });
    return;
  }
  if (!MK_API_KEY) {
    res.status(503).json({ error: 'Vérification indisponible.' });
    return;
  }
  try {
    const r = await fetch('https://api.maketou.net/api/v1/stores/cart/' + encodeURIComponent(cartId), {
      headers: { 'Authorization': 'Bearer ' + MK_API_KEY }
    });
    if (r.status === 404) {
      res.status(404).json({ error: 'Panier introuvable.' });
      return;
    }
    const data = await r.json();
    res.status(200).json({ status: data && data.status ? data.status : 'unknown' });
  } catch (e) {
    res.status(502).json({ error: 'Vérification impossible pour le moment.' });
  }
};
