/* Reitit ja matkalaskenta. Piste = [t(ms), lat, lon, tarkkuus_m?] */
(function (root) {
  'use strict';
  const R = 6371000, rad = d => d * Math.PI / 180;
  function dist(a, b) { // metriä
    const dLat = rad(b[1] - a[1]), dLon = rad(b[2] - a[2]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  // Pisteet aikavälillä
  function slice(tr, t0, t1) { return (tr || []).filter(p => p[0] >= t0 && p[0] <= t1); }
  // Reitin pituus metreinä aikavälillä; hyppyjen suodatus (> 60 m/s) GPS-virheiden varalta
  function length(tr, t0, t1) {
    const pts = slice(tr, t0, t1); let m = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = dist(pts[i - 1], pts[i]), dt = Math.max(1, (pts[i][0] - pts[i - 1][0]) / 1000);
      if (d / dt < 60) m += d;
    }
    return m;
  }
  // Sijainti hetkellä t (lineaarinen interpolointi); null jos reitti ei kata hetkeä (sallittu rako maxGap)
  function at(tr, t, maxGap = 3 * 60000) {
    if (!tr || !tr.length) return null;
    if (t <= tr[0][0]) return tr[0][0] - t <= maxGap ? tr[0] : null;
    const last = tr[tr.length - 1];
    if (t >= last[0]) return t - last[0] <= maxGap ? last : null;
    let lo = 0, hi = tr.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (tr[mid][0] <= t) lo = mid; else hi = mid; }
    const a = tr[lo], b = tr[hi];
    if (b[0] - a[0] > 2 * maxGap) return (t - a[0] <= maxGap) ? a : (b[0] - t <= maxGap ? b : null);
    const f = (t - a[0]) / (b[0] - a[0] || 1);
    return [t, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }
  // Ryhmän sijainti: ryhmän reitti, muuten lähin aiempi sijainnillinen tapahtuma
  function groupAt(group, events, t) {
    const g = at(group, t, 5 * 60000);
    if (g) return g;
    const ev = events.filter(e => e.pos && e.t <= t).sort((a, b) => b.t - a.t)[0]
      || events.filter(e => e.pos).sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0];
    return ev ? [ev.t, ev.pos[0], ev.pos[1]] : null;
  }
  function maxFrom(tr, refFn, t0, t1) {
    let m = null;
    for (const p of slice(tr, t0, t1)) { const r = refFn(p[0]); if (r) { const d = dist(p, r); if (m === null || d > m) m = d; } }
    return m;
  }

  /* Matkat arvosteluun. tl = HIRV.timeline(), events = kokeen tapahtumat */
  function distances(tl, events, group, dog) {
    const hasDog = dog && dog.length > 1;
    const gAt = t => groupAt(group, events, t);
    const out = { hasDog, lenkit: [], loyto: null, seurKm: null, lhSade: [], groupKm: group && group.length > 1 ? length(group, -Infinity, Infinity) / 1000 : 0, dogKm: hasDog ? length(dog, -Infinity, Infinity) / 1000 : 0 };
    tl.lenkit.forEach(l => {
      const o = { min: l.min, loyto: l.loyto, noud: l.noud, km: null, dist: null };
      if (hasDog) {
        o.km = +(length(dog, l.start, l.end) / 1000).toFixed(2);
        const md = maxFrom(dog, gAt, l.start, l.end);
        if (md !== null) o.dist = Math.round(md);
      }
      out.lenkit.push(o);
    });
    const firstLoyto = tl.loydot[0];
    if (firstLoyto) {
      const lk = tl.lenkit.filter(l => l.start <= firstLoyto.t).pop();
      const t0 = lk ? lk.start : null;
      const o = { matka: null, suora: null };
      if (hasDog && t0 !== null) o.matka = +(length(dog, t0, firstLoyto.t) / 1000).toFixed(2);
      const dAt = hasDog ? at(dog, firstLoyto.t) : null;
      const start = t0 !== null ? gAt(t0) : null;
      if (start && dAt) o.suora = +(dist(start, dAt) / 1000).toFixed(2);
      out.loyto = o;
    }
    if (hasDog && tl.seurIv.length) out.seurKm = +(tl.seurIv.reduce((a, iv) => a + length(dog, iv.start, iv.end), 0) / 1000).toFixed(2);
    out.lhSade = tl.loydot.map(l => {
      if (!hasDog || !l.start) return null;
      const p0 = at(dog, l.t); if (!p0) return null;
      const m = maxFrom(dog, () => p0, l.start, l.end);
      return m === null ? null : Math.round(m);
    });
    return out;
  }
  const sadeBucket = m => m === null || m === undefined ? null : m <= 200 ? '0.2' : m <= 400 ? '0.4' : '0.6';

  /* GPX / KML -tuonti */
  function parseTrack(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const pts = [];
    // GPX trkpt / rtept / wpt
    doc.querySelectorAll('trkpt, rtept').forEach(n => {
      const tm = n.getElementsByTagName('time')[0];
      const t = tm ? Date.parse(tm.textContent.trim()) : NaN;
      if (!isNaN(t)) pts.push([t, +n.getAttribute('lat'), +n.getAttribute('lon')]);
    });
    // KML gx:Track
    if (!pts.length) {
      const whens = [...doc.getElementsByTagName('when')], coords = [...doc.getElementsByTagName('gx:coord')];
      whens.forEach((w, i) => { const c = coords[i]; if (c) { const [lon, lat] = c.textContent.trim().split(/\s+/).map(Number); const t = Date.parse(w.textContent.trim()); if (!isNaN(t)) pts.push([t, lat, lon]); } });
    }
    pts.sort((a, b) => a[0] - b[0]);
    return pts.filter(p => isFinite(p[1]) && isFinite(p[2]));
  }
  function toGPX(tracks, name) {
    const seg = (pts) => pts.map(p => `<trkpt lat="${p[1].toFixed(7)}" lon="${p[2].toFixed(7)}"><time>${new Date(p[0]).toISOString()}</time></trkpt>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="HIRV arvostelukortti" xmlns="http://www.topografix.com/GPX/1/1">\n` +
      Object.entries(tracks).filter(([, p]) => p && p.length).map(([n, p]) => `<trk><name>${name} – ${n}</name><trkseg>\n${seg(p)}\n</trkseg></trk>`).join('\n') + '\n</gpx>';
  }

  const api = { dist, length, at, groupAt, distances, sadeBucket, parseTrack, toGPX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GEO = api;
})(this);
