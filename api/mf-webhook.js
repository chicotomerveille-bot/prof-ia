/* MoneyFusion — webhook (notifications payin.session.*).
   Étape 2 (e-mail auto) : brancher ici l'envoi du Pack (Brevo/Resend).
   Pour l'instant : accusé de réception uniquement. */
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const evt = (req.body && req.body.event) || 'unknown';
  const ref = (req.body && (req.body.tokenPay || req.body.token)) || 'n/a';
  console.log('[mf-webhook]', evt, ref);
  res.status(200).json({ ok: true });
};
