# perspective-helper

Spletno orodje za pomoč in planiranje pred risanjem ali slikanjem v perspektivi.
Postaviš preprosto 3D sceno (škatla, krogla, valj, stožec), kamero in luč; orodje
prikaže perspektivna vodila (horizont, bežišča, snope črt) ter tone v "mavčnem" videzu.

**Spletna različica: https://simondimc.github.io/perspective-helper/**

## Zagon

```bash
npm install
npm run dev      # razvojni strežnik (privzeto http://localhost:5173)
npm test         # test projekcijske funkcije
npm run build    # preverjanje tipov + produkcijska gradnja
```

## Uporaba

- **Urejevalnik** (orbit pogled): vrtenje (levi gumb / en prst), pomik (desni gumb / dva prsta), zoom (kolešček / ščipanje).
  Klik na objekt ga izbere; gizmo omogoča premik (W), rotacijo (E) in velikost (R).
  Klik na oranžno kamero izbere kompozicijsko kamero (premik položaja in višine oči).
- **Pogledi** (gumbi zgoraj, Tab): *Urejevalnik + kader* (privzeto, oba hkrati), samo urejevalnik ali samo kader.
- **Vlečenje v kadru**: povleci bežišče ali horizont in kamera se ustrezno nastavi. 2-točkovna: bežišči A in B
  določata yaw in goriščno razdaljo (x_A·x_B = −f²), navpični premik horizonta je lens shift; Alt ali
  »Vlečenje: zakleni gorišče« ohrani goriščno razdaljo. 3-točkovna: horizont → pitch, navpično bežišče → pitch + roll,
  bežišči X/Z → yaw. Velja za rektilinearno projekcijo.
- **Papir okoli kadra**: bežišča zunaj kadra so narisana na pravem mestu.
- **Projekcija**: rektilinearna, ribje oko (ekvidistantna, stereografska) in ekvirektangularna; vodila so tedaj
  veliki krogi, nasprotna bežišča sta označena z −.
- **Prikaz objektov**: mavec, samo robovi (brez ploskev; sence ostanejo) ali oboje. Z izvozom PNG brez vodil
  dobiš žični kader, v katerega lahko rišeš. »Rdeči okvirji« nariše okvir okoli vsakega objekta.
- **Oznake bežišč** X/Y/Z ali A/B/C (A = X, B = Z, C = Y), po želji z goriščno razdaljo.
- **Figura** je lutka s sklepi: klik na rumeno piko (sklep) in vrtenje z gizmom, ali drsniki in pripravljene poze v
  zavihku »Poza figure«. Sklepi imajo naravne omejitve kotov.
- **Premik objektov**: povlek objekta na tleh ga premika po tleh; Shift ali gumb ⇕ ga dvigne; objekt ne more pod tla.
  Dvoklik na objekt pogled urejevalnika približa nanj.
- **Vrstica Kamera** (spodaj, vedno vidna): yaw, pitch, roll, lens shift, višina oči, premik naprej/nazaj/levo/desno,
  vse tudi z vnosom vrednosti. Vsi drsniki imajo številčno polje.
- **Ambientna okluzija** (GTAO) za senčenje brez luči; ne deluje pri ribjem očesu.
- **Kader**: belo ozadje (papir), barva tal, debelina robov pri prikazu »samo robovi«.
- Bližnjice: `Tab` preklop pogleda, `Del` izbriši, `Ctrl/⌘+D` podvoji, `Ctrl/⌘+Z` razveljavi, `Ctrl/⌘+Y` ali `Ctrl/⌘+Shift+Z` ponovi, `H` samo pogled (brez izbire predmetov).
- Predloge kamere:
  - **1-točkovna**: yaw se pripne na večkratnik 90°, pitch in roll sta 0 (dovoljen je lens shift).
  - **2-točkovna**: pitch in roll sta 0, za kadriranje gor/dol služi *lens shift Y*, zato so navpičnice v kadru navpične.
  - **3-točkovna**: prosta kamera (yaw, pitch, roll).
- Vodila: horizont, bežišča X/Y/Z (rdeča/zelena/modra), snop črt iz bežišč, bežišča izbranega
  objekta (oranžna, iz njegovih lokalnih osi) in njegova vodila: robovi izbranega objekta, podaljšani do njegovih
  bežišč (vključi/izključi z »Vodila objekta«). Bežišče zunaj kadra je označeno s puščico na robu.
- Luč: azimut (0° = od spredaj), višina, razmerje glavna luč : okolica, izpostavitev.
- Datoteka: prenos/nalaganje JSON, shranjevanje v brskalnik (scena se samodejno shranjuje in
  obnovi ob zagonu), izvoz PNG kadra (z vodili ali brez, daljša stranica 2400 px).

## Zgradba

| Modul | Vsebina |
| --- | --- |
| `src/projection.ts` | Abstraktni `Projection` (smer ↔ točka v kadru), rektilinearna implementacija, bežišča |
| `src/camera.ts` | Parametri kompozicijske kamere, predloge (omejitve), Three.js kamera z lens shiftom |
| `src/objects.ts` | Parametrični objekti, generiranje meshev, lokalne osi, `ObjectStore` |
| `src/lighting.ts` | Glavna luč s sencami (senčna mapa se prilagodi sceni), okoljska luč |
| `src/guides.ts` | Risanje vodil in robov na 2D overlay canvas (ravne in ukrivljene črte) |
| `src/handles.ts` | Vlečenje bežišč/horizonta: iz položaja kazalca izračun parametrov kamere |
| `src/figure.ts` | Lutka s sklepi: geometrija iz poze, omejitve kotov, poze |
| `src/scene.ts` | Renderer, urejevalnik/kader, izbira, TransformControls, izvoz PNG |
| `src/ui.ts` | lastni vmesnik (orodna vrstica, stranski paneli, vrstica izbranega objekta), bližnjice |
| `src/io.ts` | JSON shranjevanje/nalaganje, localStorage |

Kamera je edini vir resnice: bežišča in horizont se vedno izračunajo iz parametrov kamere prek
modula `projection`. Predloge so le omejitve nad temi parametri.

## Koordinatni sistem

Y navzgor, enote v metrih. Kamera pri yaw=0 gleda v smeri −Z; pozitiven yaw obrne kamero v desno,
pozitiven pitch navzgor. Goriščna razdalja je 35 mm ekvivalent (daljša stranica kadra = 36 mm).

## Licence

- **Koda** (vse razen `src/data/`) je pod licenco MIT, glej [LICENSE](LICENSE).
- **Podatki primerov mest** v `src/data/*.json` so izpeljani iz podatkov © prispevkov OpenStreetMap (licenca ODbL; izpeljana zbirka ostane pod ODbL) in višin AWS Terrain Tiles. Podrobnosti in navedbe virov so v [src/data/README.md](src/data/README.md).

## Viri podatkov

Primeri mest (Ljubljana, Pariz, London, Tokio, New York, Rim, Benetke) so narejeni iz podatkov © prispevkov OpenStreetMap (licenca ODbL, https://www.openstreetmap.org/copyright). Višine terena so iz AWS Terrain Tiles (https://registry.opendata.aws/terrain-tiles/). Orodja za pripravo so v `tools/osm/`.
