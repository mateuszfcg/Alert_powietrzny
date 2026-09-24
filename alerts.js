const WEST_UA = {
  'Волинська область': { pl: 'Obwód wołyński', lat: 50.75, lon: 25.34, band: '0–50 km', border: true },
  'Львівська область': { pl: 'Obwód lwowski', lat: 49.84, lon: 24.03, band: '0–50 km', border: true },
  'Рівненська область': { pl: 'Obwód rówieński', lat: 50.62, lon: 26.25, band: '50–150 km', border: false },
  'Тернопільська область': { pl: 'Obwód tarnopolski', lat: 49.55, lon: 25.59, band: '50–150 km', border: false },
  'Закарпатська область': { pl: 'Obwód zakarpacki', lat: 48.62, lon: 22.30, band: '50–150 km', border: false },
  'Івано-Франківська область': { pl: 'Obwód iwanofrankiwski', lat: 48.92, lon: 24.71, band: '100–250 km', border: false },
  'Хмельницька область': { pl: 'Obwód chmielnicki', lat: 49.42, lon: 26.99, band: '100–250 km', border: false },
  'Житомирська область': { pl: 'Obwód żytomierski', lat: 50.25, lon: 28.66, band: '100–250 km', border: false },
  'Чернівецька область': { pl: 'Obwód czerniowiecki', lat: 48.29, lon: 25.94, band: '150–300 km', border: false }
};

function stripHtml(s='') {
  return s.replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/g,' ')
    .replace(/&quot;/g,'"')
    .replace(/&#39;/g,"'")
    .replace(/&amp;/g,'&')
    .replace(/\s+/g,' ').trim();
}

async function getRcb() {
  const indexUrl = 'https://www.gov.pl/web/rcb/komunikaty';
  try {
    const res = await fetch(indexUrl, { headers: { 'user-agent': 'Mozilla/5.0 AlertPLUA/1.0' }, cache: 'no-store' });
    if (!res.ok) throw new Error(`RCB index HTTP ${res.status}`);
    const html = await res.text();
    const linkRe = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m; const candidates = [];
    while ((m = linkRe.exec(html))) {
      const title = stripHtml(m[2]);
      if (/Alert RCB/i.test(title) && /(zagrożenie.*powietrza|atak.*Ukrain|zagrożenie atakiem)/i.test(title)) {
        const href = m[1].startsWith('http') ? m[1] : `https://www.gov.pl${m[1]}`;
        candidates.push({ title, href });
      }
      if (candidates.length >= 6) break;
    }
    if (!candidates.length) return { ok: true, source: indexUrl, found: false, active: false, items: [] };

    const latest = candidates[0];
    const artRes = await fetch(latest.href, { headers: { 'user-agent': 'Mozilla/5.0 AlertPLUA/1.0' }, cache: 'no-store' });
    const articleHtml = artRes.ok ? await artRes.text() : '';
    const text = stripHtml(articleHtml).slice(0, 40000);
    const ended = /(Brak zagrożenia na (terenie Polski|terytorium RP)|Zakończył się atak|Odwołano zagrożenie)/i.test(text);
    const activeLanguage = /(Zagrożenie atakiem z powietrza|Rosyjski atak powietrzny|zmasowany.*atak powietrzny)/i.test(text);
    const active = activeLanguage && !ended;
    const regions = [];
    if (/lubelsk/i.test(text)) regions.push({ name: 'Woj. lubelskie', lat: 51.25, lon: 22.57 });
    if (/podkarpack/i.test(text)) regions.push({ name: 'Woj. podkarpackie', lat: 50.04, lon: 22.00 });

    const dateMatch = text.match(/\b(\d{2}\.\d{2}\.\d{4})\b/);
    return {
      ok: true,
      source: latest.href,
      found: true,
      active,
      title: latest.title,
      date: dateMatch ? dateMatch[1] : null,
      regions,
      statusText: active ? 'Aktywny komunikat/alert dotyczący zagrożenia z powietrza' : 'Najnowszy komunikat został odwołany lub nie wskazuje aktywnego zagrożenia'
    };
  } catch (error) {
    return { ok: false, source: indexUrl, error: String(error?.message || error), active: false, regions: [] };
  }
}

function normalizeThreatType(alert) {
  const types = new Set((alert.threats || []).map(t => t.threat_type));
  if (types.has('drones')) return 'Zagrożenie dronowe';
  if (types.has('ballistic')) return 'Zagrożenie balistyczne';
  if (types.has('missiles')) return 'Zagrożenie rakietowe';
  if (alert.alert_type === 'air_raid') return 'Alarm powietrzny';
  return 'Zagrożenie powietrzne';
}

async function getUa() {
  const token = process.env.ALERTS_IN_UA_TOKEN;
  if (!token) return { ok: true, configured: false, source: 'https://alerts.in.ua/', items: [] };
  try {
    const res = await fetch('https://api.alerts.in.ua/v1/alerts/active.json', {
      headers: { Authorization: `Bearer ${token}`, 'user-agent': 'AlertPLUA/1.0' },
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`alerts.in.ua HTTP ${res.status}`);
    const data = await res.json();
    const items = (data.alerts || [])
      .filter(a => WEST_UA[a.location_oblast || a.location_title])
      .map(a => {
        const region = WEST_UA[a.location_oblast || a.location_title];
        return {
          id: `ua-${a.id}`,
          country: 'UA',
          region: region.pl,
          lat: region.lat,
          lon: region.lon,
          distanceBandToPoland: region.band,
          borderRegion: region.border,
          category: normalizeThreatType(a),
          startedAt: a.started_at,
          updatedAt: a.updated_at,
          alertType: a.alert_type,
          alertLevel: a.alert_level || null,
          direction: 'Brak potwierdzonej informacji w regionalnym alercie',
          source: 'alerts.in.ua (źródła oficjalne/agregowane)',
          sourceUrl: 'https://alerts.in.ua/',
          note: 'Znacznik reprezentuje region objęty alertem, a nie dokładną pozycję obiektu.'
        };
      });
    return { ok: true, configured: true, source: 'https://alerts.in.ua/', items };
  } catch (error) {
    return { ok: false, configured: true, source: 'https://alerts.in.ua/', error: String(error?.message || error), items: [] };
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  const [rcb, ua] = await Promise.all([getRcb(), getUa()]);
  res.status(200).json({
    generatedAt: new Date().toISOString(),
    safety: 'Dane regionalne i cywilne. Brak dokładnych pozycji, wysokości, prędkości i trajektorii aktywnych obiektów bojowych.',
    rcb,
    ua
  });
}
