// Fonction serverless Vercel — lecture d'un agenda iCal (.ics)
// Récupère un flux public (Google Agenda, Outlook, logiciels métier équestres…)
// et renvoie les créneaux (date, heure, titre). Contourne le CORS côté serveur.
// Appel : GET /api/ical?url=<lien .ics encodé>

function isPrivateHost(host) {
  host = (host || '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.local')) return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;                 // link-local / metadata
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;  // 172.16-31
  if (host === '0.0.0.0' || host === '::1' || host === 'metadata.google.internal') return true;
  return false;
}

function unfold(text) {
  // iCal : les lignes repliées commencent par un espace/tab
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

module.exports = async (req, res) => {
  const url = req.query && req.query.url;
  if (!url) return res.status(400).json({ error: 'Paramètre url manquant' });
  let u;
  try { u = new URL(url); } catch (e) { return res.status(400).json({ error: 'URL invalide' }); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return res.status(400).json({ error: 'Protocole non autorisé' });
  if (isPrivateHost(u.hostname)) return res.status(400).json({ error: 'Hôte non autorisé' });

  try {
    const r = await fetch(u.toString(), { headers: { 'User-Agent': 'GalopAcademy/1.0' } });
    if (!r.ok) return res.status(502).json({ error: 'Agenda inaccessible (HTTP ' + r.status + ')' });
    const raw = unfold(await r.text());
    const events = [];
    const parts = raw.split('BEGIN:VEVENT').slice(1);
    for (const part of parts) {
      const seg = part.split('END:VEVENT')[0];
      const field = (k) => {
        const m = seg.match(new RegExp('(?:^|\\n)' + k + '(?:;[^:\\n]*)?:([^\\n]*)'));
        return m ? m[1].trim() : '';
      };
      const dtstart = field('DTSTART');
      const dtend = field('DTEND');
      const summary = field('SUMMARY').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, ' ');
      const ms = dtstart.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
      if (!ms) continue;
      const date = ms[1] + '-' + ms[2] + '-' + ms[3];
      const start_time = ms[4] ? (ms[4] + ':' + ms[5]) : '';
      let duration = 60;
      const me = dtend.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
      if (ms[4] && me && me[4]) {
        const a = parseInt(ms[4]) * 60 + parseInt(ms[5]);
        const b = parseInt(me[4]) * 60 + parseInt(me[5]);
        if (b > a) duration = b - a;
      }
      events.push({ date: date, start_time: start_time, title: summary || 'Cours', duration: duration });
    }
    // Trie par date et limite (sécurité)
    events.sort((x, y) => (x.date + x.start_time).localeCompare(y.date + y.start_time));
    return res.status(200).json({ count: events.length, events: events.slice(0, 500) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
