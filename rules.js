/* HIRV-säännöt ja ohjeet (voimassa 1.8.2023) – pisteytyslogiikka.
   Kaikki funktiot palauttavat ehdotuksen {p, note, cap}. p = 0–10 tai '-' (ei voida arvostella). */
(function (root) {
  'use strict';
  const num = v => { if (v === '' || v === null || v === undefined) return null; const n = +String(v).trim().replace(',', '.'); return isNaN(n) ? null : n; };

  const CATS = [
    { id: 1, key: 'haku', name: 'Haku', k: 1.5 },
    { id: 2, key: 'loyto', name: 'Löytötehokkuus', k: 1.0 },
    { id: 3, key: 'lh', name: 'Löytöhaukku', k: 1.0 },
    { id: 4, key: 'ht', name: 'Haukkutyöskentelyn laatu', k: 1.5 },
    { id: 5, key: 'seur', name: 'Seuraaminen', k: 1.0 },
    { id: 6, key: 'pys', name: 'Pysäyttäminen', k: 1.0 },
    { id: 7, key: 'ha', name: 'Haukkuaika', k: 1.0 },
    { id: 8, key: 'kuu', name: 'Haukun kuuluvuus', k: 0.5 },
    { id: 9, key: 'tih', name: 'Haukun tiheys ja peittävyys', k: 0.5 },
    { id: 10, key: 'tot', name: 'Tottelevaisuus ja yhteistyö', k: 1.0 }
  ];

  const SCALE = p => p === '-' ? 'ei voida arvostella' : p >= 9 ? 'kiitettävä' : p >= 7 ? 'hyvä' : p >= 5 ? 'tyydyttävä' : p >= 3 ? 'välttävä' : p >= 1 ? 'heikko' : 'erittäin heikko';

  /* 1. HAKU – hakulenkkien keskiarvo.
     Bändi 5 = 9–10, 4 = 7–8, 3 = 5–6, 2 = 3–4, 1 = 1–2.
     Pituus TAI etäisyys ryhmästä on täytyttävä; kestoa käytetään, jos matkoja ei ole mitattu. */
  function hakuBand(l) {
    const km = num(l.km), d = num(l.dist), m = num(l.min);
    let b = 0;
    if (km !== null) b = Math.max(b, km >= 2 ? 5 : km >= 1.5 ? 4 : km >= 1 ? 3 : km >= 0.5 ? 2 : 1);
    if (d !== null) b = Math.max(b, d >= 800 ? 5 : d >= 600 ? 4 : d >= 400 ? 3 : d >= 300 ? 2 : 1);
    if (km === null && d === null && m !== null) b = m >= 15 ? 5 : m >= 10 ? 4 : m >= 5 ? 3 : m >= 2 ? 2 : 1;
    return b;
  }
  /* Hakunopeus km/h = lenkin pituus (km) / kesto (h). Kiitettävä, kun ≥ 6 km/h (0,1 km/min). */
  function hakuNopeus(l) {
    const km = num(l.km), m = num(l.min);
    return (km !== null && km > 0 && m !== null && m > 0) ? km / (m / 60) : null;
  }
  function hakuLenkki(l) {
    if (l.eihae) return 0;
    const b = hakuBand(l);
    if (!b) return null;
    const speed = hakuNopeus(l);
    let p = b * 2 - 1;                       // bändin alaraja
    if (speed !== null && speed >= 6) p += 1; // kiitettävä nopeus → yläraja
    if (l.noud) p = Math.min(p, 7);          // noudettu hakulenkki enintään 7
    return p;
  }
  function haku(s) {
    const lenkit = (s.lenkit || []);
    if (s.lel) { // löytö ensimmäiseltä lenkiltä: 8/7/6/5/4
      const l = lenkit[0];
      if (!l) return { p: null, note: 'Syötä ensimmäisen lenkin tiedot' };
      if (l.eihae) return { p: 0, note: 'Koira ei hae' };
      const b = hakuBand(l);
      if (!b) return { p: null, note: 'Syötä lenkin pituus tai etäisyys' };
      return { p: [0, 4, 5, 6, 7, 8][b], note: 'Löytö ensimmäiseltä lenkiltä (enintään 8 p)' };
    }
    const ps = lenkit.map(hakuLenkki).filter(p => p !== null);
    if (!ps.length) return { p: null, note: 'Lisää hakulenkit' };
    const avg = ps.reduce((a, b) => a + b, 0) / ps.length;
    return { p: Math.round(avg), note: `Lenkit: ${ps.join(', ')} → ka ${avg.toFixed(1)}` };
  }

  /* 2. LÖYTÖTEHOKKUUS */
  function loyto(s) {
    const m = num(s.matka), d = num(s.suora);
    if (m === null && d === null) return { p: null, note: 'Syötä löytömatka tai suora etäisyys' };
    const bm = m === null ? 0 : m > 2 ? 5 : m > 1.5 ? 4 : m >= 1 ? 3 : 0;
    const bd = d === null ? 0 : d >= 0.8 ? 5 : d >= 0.6 ? 4 : d >= 0.4 ? 3 : d >= 0.3 ? 2 : 1;
    const b = Math.max(bm, bd, 1);
    let p = b === 1 ? 1 : b * 2 - 1;
    if (b > 1 && bm >= b && bd >= b) p += 1; // molemmat ehdot täyttyvät → yläraja
    const notes = [];
    let cap = null;
    if (s.toteamaton) { cap = 8; if (p > 8) p = 8; notes.push('toteamaton löytö max 8'); }
    if (s.avust) { p = Math.max(0, p - 2); notes.push('avustettu −2'); }
    return { p, note: notes.join(', '), cap };
  }

  /* 3. LÖYTÖHAUKKU – keskiarvo useista löydöistä */
  const LH = { '0.2': [5, 8, 9, 10], '0.4': [4, 7, 8, 9], '0.6': [3, 6, 7, 8] };
  function lhOne(min, sade) {
    min = num(min); if (min === null) return null;
    if (min < 2) return 1;
    if (min < 10) return 2;
    const col = min >= 90 ? 3 : min >= 60 ? 2 : min >= 30 ? 1 : 0;
    return (LH[String(sade)] || LH['0.2'])[col];
  }
  function lh(s) {
    const ld = (s.loydot || []).map(l => lhOne(l.min, l.sade)).filter(p => p !== null);
    if (!ld.length) return { p: null, note: 'Ei löytöjä kirjattuna' };
    const avg = ld.reduce((a, b) => a + b, 0) / ld.length;
    return { p: Math.round(avg), note: ld.length > 1 ? `Löydöt: ${ld.join(', ')} → ka ${avg.toFixed(1)}` : '' };
  }

  /* 4. HAUKKUTYÖSKENTELYN LAATU */
  function ht(v) { // v: {amp, karkot, tyo, seis, hauk}
    const A = v.amp || 0, K = v.karkot || 0, T = v.tyo || 0, S = v.seis || 0, H = v.hauk || 0;
    const rows = [[10, 3, 3, 300, 200], [9, 3, 3, 270, 180], [8, 2, 2, 240, 150], [7, 2, 2, 200, 120], [6, 1, 1, 120, 90]];
    for (const [p, a, k, t, s] of rows) if (A >= a && K >= k && T >= t && S >= s) return { p, note: `${A} amp.tilaisuutta, ${K} karkkoa, työ ${T} min, seisontahaukku ${S} min` };
    if (S >= 90) return { p: 5, note: 'Seisontahaukku ≥ 90 min' };
    if (S >= 60) return { p: 4, note: 'Seisontahaukku ≥ 60 min' };
    if (H >= 120) return { p: 3, note: 'Haukkuaika ≥ 120 min (siirtyvä mukaan)' };
    if (S >= 20) return { p: 2, note: 'Seisontahaukku ≥ 20 min' };
    if (H >= 60) return { p: 1, note: 'Haukkuaika ≥ 60 min (siirtyvä mukaan)' };
    if (S === 0 && H === 0) return { p: '-', note: 'Ei seisontahaukkua' };
    return { p: 0, note: 'Seisontahaukku < 20 min ja haukkuaika < 60 min' };
  }

  /* 5. SEURAAMINEN – parempi matkasta tai ajasta */
  function seur(v) {
    const km = num(v.km), min = num(v.min);
    if (km === null && min === null) return { p: null, note: 'Syötä seurattu matka tai aika' };
    const kmT = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5];
    let pk = 0, pm = 0;
    if (km !== null) { const i = kmT.findIndex(t => km >= t); pk = i < 0 ? 0 : 10 - i; }
    if (min !== null) pm = min > 60 ? 10 : min >= 50 ? 9 : min >= 40 ? 8 : min >= 30 ? 7 : min >= 20 ? 6 : min >= 10 ? 5 : min >= 7 ? 4 : min >= 5 ? 3 : min >= 3 ? 2 : min >= 1 ? 1 : 0;
    return { p: Math.max(pk, pm), note: '' };
  }

  /* 6. PYSÄYTTÄMINEN – tuomari valitsee rivin */
  const PYS_ROWS = [
    [10, '30 KH, 30 KH, 10 KH ja haukku erän lopussa'],
    [9, '30 KH, 30 KH, alle 10 min UH ja seisontahaukku erän lopussa'],
    [8, '30 KH, 30 KH'],
    [7, '30 KH, 10 KH'],
    [6, '30 KH, alle 10 min UH'],
    [5, '1 × 30 KH tai 2 × 10 KH'],
    [4, '10 KH, alle 10 min UH'],
    [3, '10 KH'],
    [2, 'Alle 10 min UH'],
    [1, 'Pysäytysyrityksiä / seuraa, ei uusintahaukkua'],
    [0, 'Ei seuraa pakenevaa hirveä']
  ];
  function pys(s) {
    if (s.row === '' || s.row === undefined || s.row === null) return { p: null, note: 'Valitse uusintahaukkujen mukainen rivi' };
    return { p: +s.row, note: '' };
  }

  /* 7. HAUKKUAIKA */
  const HA_T = [20, 40, 60, 80, 100, 120, 140, 160, 190, 220];
  function ha(min) {
    min = num(min) || 0;
    let p = 0; HA_T.forEach((t, i) => { if (min >= t) p = i + 1; });
    return { p, note: `${min} min` };
  }

  /* 8. KUULUVUUS – tuomarin arvio, rajoitukset */
  function kuu(s, H) {
    if (H < 20) return { p: 0, note: 'Haukkuaika < 20 min – ei arvostella', cap: 0 };
    const cap = H < 180 ? 8 : null;
    const p = num(s.p);
    return { p: p === null ? null : (cap !== null ? Math.min(p, cap) : p), note: cap ? 'Kiitettävään vaaditaan ≥ 180 min haukkuaikaa (max 8)' : '', cap, judge: true };
  }

  /* 9. TIHEYS JA PEITTÄVYYS */
  const TIH = { tasainen: [10, 9, 8, 7, 4, 2], jaksottainen: [9, 8, 7, 5, 3, 1], tauot: [7, 6, 5, 4, 2, 0] };
  function tih(s, H) {
    if (H < 20) return { p: 0, note: 'Haukkuaika < 20 min – ei arvostella', cap: 0 };
    const counts = String(s.counts || '').split(/[\s,;]+/).map(Number).filter(n => !isNaN(n) && n > 0);
    if (!counts.length) return { p: null, note: 'Syötä haukahdusmäärät / min' };
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const r = avg >= 75 ? 0 : avg >= 65 ? 1 : avg >= 55 ? 2 : avg >= 45 ? 3 : avg >= 25 ? 4 : 5;
    let p = (TIH[s.tas] || TIH.tasainen)[r];
    const cap = H < 180 ? 8 : null;
    if (cap !== null) p = Math.min(p, cap);
    return { p, note: `ka ${avg.toFixed(0)} haukahdusta/min` + (cap ? ' · max 8 (haukkuaika < 180 min)' : ''), cap };
  }

  /* 10. TOTTELEVAISUUS JA YHTEISTYÖ */
  function tot(s, T) {
    const a = num(s.a), b = num(s.b), c = num(s.c);
    if (a === null || b === null || c === null) return { p: null, note: 'Valitse kaikki kolme osaa' };
    let p = a + b + c; const notes = []; let cap = null;
    if (s.fail && p > 9) { p = 9; cap = 9; notes.push('epäonnistunut kutsu → max 9'); }
    if (T < 240 || (num(s.yht) || 0) > 2) { cap = 6; if (p > 6) p = 6; notes.push(T < 240 ? 'työskentelyaika < 240 min → max 6' : 'yli 2 oma-aloitteista yhteydenottoa → max 6'); }
    return { p, note: notes.join(', '), cap };
  }

  const PRIZE = total => total >= 70 ? 1 : total >= 60 ? 2 : total >= 50 ? 3 : 0;

  /* ---- Ajanotto: tapahtumista lasketut ajat ---- */
  const MIN = 60000;
  function timeline(events, now) {
    const ev = [...events].sort((a, b) => a.t - b.t);
    const first = type => ev.find(e => e.type === type);
    const irti = first('irti'), loyto1 = first('loyto'), era = first('era'), pimea = first('pimea');
    let workEnd = era ? era.t : now;
    if (loyto1) workEnd = Math.min(workEnd, loyto1.t + 300 * MIN);
    if (pimea) workEnd = Math.min(workEnd, pimea.t + 120 * MIN);
    // haukkujaksot
    const segs = []; let open = null;
    for (const e of ev) {
      if (e.type === 'kh' || e.type === 'sh') { if (open) { open.end = e.t; segs.push(open); } open = { type: e.type, start: e.t }; }
      else if (['hl', 'karkko', 'era', 'kytk'].includes(e.type)) { if (open) { open.end = e.t; segs.push(open); open = null; } }
    }
    if (open) { open.end = era ? era.t : now; open.live = !era; segs.push(open); }
    const clip = segs.map(s => ({ ...s, start: Math.max(s.start, loyto1 ? loyto1.t : s.start), end: Math.min(s.end, workEnd) })).filter(s => s.end > s.start);
    let kh = 0, sh = 0, gapAll = 0, gapKh = 0;
    clip.forEach((s, i) => {
      const d = s.end - s.start; if (s.type === 'kh') kh += d; else sh += d;
      const n = clip[i + 1];
      if (n) { const g = n.start - s.end; if (g > 0 && g < 2 * MIN) { gapAll += g; if (s.type === 'kh' && n.type === 'kh') gapKh += g; } }
    });
    // ketjut: peräkkäiset samantyyppiset jaksot, joiden välissä alle 2 min tauko
    const chains = [];
    clip.forEach(s => {
      const c = chains[chains.length - 1];
      if (c && c.type === s.type && s.start - c.end < 2 * MIN) { c.end = s.end; }
      else chains.push({ type: s.type, start: s.start, end: s.end });
    });
    const loydot = ev.filter(e => e.type === 'loyto');
    const karkot = ev.filter(e => e.type === 'karkko' && (!loyto1 || e.t >= loyto1.t) && e.t <= workEnd);
    const amp = ev.filter(e => e.type === 'amp' && e.t <= workEnd).length;
    // löytöhaukut: ensimmäinen KH-ketju löydön jälkeen (ennen seuraavaa löytöä tai karkkoa)
    const lhaukut = loydot.map((l, i) => {
      const next = loydot[i + 1] ? loydot[i + 1].t : Infinity;
      const k = karkot.find(x => x.t > l.t);
      const lim = Math.min(next, k ? k.t : Infinity);
      const c = chains.find(c => c.start >= l.t && c.start < lim);
      const ok = c && c.type === 'kh';
      return { t: l.t, min: ok ? Math.round((Math.min(c.end, lim) - c.start) / MIN) : 0, start: ok ? c.start : null, end: ok ? Math.min(c.end, lim) : null };
    });
    // hakulenkit: irtilaskusta tai Uusi hakulenkki -kirjauksesta kytkentään, löytöön, seuraavaan lenkkiin tai erän loppuun
    const lenkit = ev.filter(e => e.type === 'irti' || e.type === 'lenkki').map(ir => {
      const stop = ev.find(e => e.t > ir.t && ['kytk', 'loyto', 'irti', 'lenkki', 'era'].includes(e.type));
      const end = stop ? stop.t : now;
      return { start: ir.t, end, min: Math.round((end - ir.t) / MIN), loyto: !!(stop && stop.type === 'loyto'), open: !stop };
    });
    // seuraaminen ja uusintahaukut karkon jälkeen
    let seurMin = 0; const uusinta = [], seurIv = [];
    karkot.forEach((k, i) => {
      const c = chains.find(c => c.start >= k.t);
      const nextK = karkot[i + 1] ? karkot[i + 1].t : Infinity;
      const stop = Math.min(c ? c.start : workEnd, nextK, workEnd);
      seurMin += Math.max(0, stop - k.t);
      if (stop > k.t) seurIv.push({ start: k.t, end: stop });
      if (c && c.start < nextK) uusinta.push({ type: c.type === 'kh' ? 'KH' : 'UH', min: Math.round((Math.min(c.end, nextK) - c.start) / MIN) });
    });
    const r = x => Math.round(x / MIN);
    return {
      haku: irti ? Math.min(r((loyto1 ? loyto1.t : (era ? era.t : now)) - irti.t), 300) : 0,
      tyo: loyto1 ? Math.max(0, Math.min(r(workEnd - loyto1.t), 300)) : 0,
      kh: r(kh + gapKh), sh: r(sh), hauk: r(kh + sh + gapAll),
      karkot: karkot.length, amp, loydot: lhaukut, seurMin: r(seurMin), uusinta, lenkit, seurIv,
      live: segs.some(s => s.live), open: open ? open.type : null, openStart: open ? open.start : null,
      firstLoyto: loyto1 ? loyto1.t : null, workEnd, ended: !!era
    };
  }

  const api = { CATS, SCALE, haku, hakuLenkki, hakuNopeus, loyto, lh, lhOne, ht, seur, pys, PYS_ROWS, ha, HA_T, kuu, tih, tot, PRIZE, timeline };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HIRV = api;
})(this);
