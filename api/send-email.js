// Fonction serverless Vercel — envoi d'email via Resend, SÉCURISÉE.
// - Authentification obligatoire : jeton d'accès Supabase de l'utilisateur.
// - Le destinataire est FORCÉ à l'email de l'utilisateur authentifié
//   (empêche tout usage en relais ouvert / spam).
// Config Vercel > Settings > Environment Variables :
//   RESEND_API_KEY = re_xxx     (secret, jamais dans le code)
//   MAIL_FROM       = Galop Academy <contact@ton-domaine.fr>   (optionnel)

const SUPABASE_URL  = "https://cqkvfsosihdjvyhoafja.supabase.co";
const SUPABASE_ANON = "sb_publishable_s1eCT9MBCjuYif8O-4Fveg_98KFf-0B";

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }
  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY non configurée' });
  }

  // 1) Authentification : jeton Supabase requis
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Authentification requise' });

  let email;
  try {
    const u = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + token },
    });
    if (!u.ok) return res.status(401).json({ error: 'Jeton invalide' });
    const user = await u.json();
    email = user && user.email;
  } catch (e) {
    return res.status(401).json({ error: 'Vérification du jeton impossible' });
  }
  if (!email) return res.status(401).json({ error: 'Utilisateur sans email' });

  // 2) Contenu (le destinataire est ignoré s'il est fourni : on force l'email vérifié)
  const { subject, html, text } = req.body || {};
  if (!subject || (!html && !text)) {
    return res.status(400).json({ error: 'Champs manquants (subject, html/text)' });
  }

  // 3) Envoi via Resend, uniquement vers l'utilisateur authentifié
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'Galop Academy <onboarding@resend.dev>',
        to: [email],
        subject: subject,
        html: html || undefined,
        text: text || undefined,
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data });
    return res.status(200).json({ ok: true, id: data.id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
