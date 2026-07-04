// Fonction serverless Vercel — envoi d'email via Resend (moderne, clé côté serveur)
// Config requise dans Vercel > Settings > Environment Variables :
//   RESEND_API_KEY = re_xxx        (ta clé Resend, JAMAIS dans le code)
//   MAIL_FROM       = Galop Academy <contact@ton-domaine.fr>   (optionnel)
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }
  const { to, subject, html, text, replyTo } = req.body || {};
  if (!to || !subject || (!html && !text)) {
    return res.status(400).json({ error: 'Champs manquants (to, subject, html/text)' });
  }
  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY non configurée sur Vercel' });
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'Galop Academy <onboarding@resend.dev>',
        to: Array.isArray(to) ? to : [to],
        subject,
        html: html || undefined,
        text: text || undefined,
        reply_to: replyTo || undefined,
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data });
    return res.status(200).json({ ok: true, id: data.id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
