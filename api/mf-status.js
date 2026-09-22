/* MoneyFusion — vérification du statut d'un paiement (via token). */
module.exports = async (req, res) => {
  const token = ((req.query && req.query.token) || '').toString();
  if (!token) {
    res.status(400).json({ error: 'Token manquant' });
    return;
  }
  try {
    const r = await fetch('https://www.pay.moneyfusion.net/paiementNotif/' + encodeURIComponent(token));
    const data = await r.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: 'Vérification impossible pour le moment.' });
  }
};
