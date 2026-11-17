# HIRV arvostelukortti (PWA)

Hirvenhaukkukokeen arvostelukortti: perustiedot, ajanotto maastossa ja pisteytys
Kennelliiton "Hirvenhaukkukokeen (HIRV) säännöt ja ohjeet" (voimassa 1.8.2023) mukaan.

## Asennus puhelimeen
1. Avaa https://hantta61.github.io/hirv-arvostelukortti/ puhelimella
2. → selaimen valikosta "Lisää aloitusnäytölle" / "Asenna sovellus".
3. Sovellus toimii sen jälkeen ilman verkkoyhteyttä; tiedot tallentuvat laitteeseen.

Tiedostot: index.html, rules.js (pisteytyssäännöt), sw.js (offline), manifest.webmanifest, ikonit.

## Reitit ja matkat
- **Ryhmän GPS-reitti:** Reitit-välilehdeltä *Aloita seuranta*. Pidä sovellus auki ja näyttö päällä.
- **Sijainti tapahtumiin:** jokaiseen ajanoton tapahtumaan tallentuu puhelimen sijainti (📍).
- **Koiran reitti:** vie jälki paikantimesta GPX- tai KML-tiedostona ja tuo se Reitit-välilehdellä.
- Sovellus laskee hakulenkkien pituudet ja suurimman etäisyyden ryhmästä, löytömatkan, suoran etäisyyden löytöön, seuraamismatkan ja löytöhaukun säteen. Arvot siirtyvät arvosteluun ehdotuksina.
- Reitit tallentuvat laitteeseen kokeen mukana (IndexedDB) ja kulkevat JSON-viennissä. *Vie reitit GPX* tallentaa molemmat reitit.
