# Podatki primerov mest

Datoteke `*.json` v tej mapi (Ljubljana, Pariz, London, Tokio, New York, Rim, Benetke) so scene, ustvarjene iz podatkov tretjih oseb z orodji v `tools/osm/`. **Za te datoteke ne velja licenca MIT iz korena repozitorija.**

## Stavbe, ceste, vode, drevesa — OpenStreetMap (ODbL)

© prispevki OpenStreetMap (https://www.openstreetmap.org/copyright).

Podatki so izpeljani iz zbirke OpenStreetMap in so na voljo pod licenco **Open Database License (ODbL) 1.0** (https://opendatacommons.org/licenses/odbl/1-0/). To pomeni:

- pri uporabi je treba navesti vir »© prispevki OpenStreetMap« in licenco ODbL (aplikacija to navede v stranski vrstici, repozitorij v README),
- izpeljana zbirka podatkov (te datoteke) ostane pod licenco ODbL (share-alike): kdor jo razširja ali spreminja, jo mora ponuditi pod isto licenco in z isto navedbo.

V datotekah so le geometrija (poenostavljeni tlorisi in višine stavb, poti, vode) in javna imena objektov iz OSM. Stavbe so poenostavljene na pravokotnike ali preproste oblike.

## Višine terena — AWS Terrain Tiles

Višine so iz AWS Terrain Tiles (https://registry.opendata.aws/terrain-tiles/), ki jih sestavljajo več virov (med drugim SRTM, USGS NED in drugi). Navedbe virov so zbrane na https://github.com/tilezen/joerd/blob/master/docs/attribution.md in jih je treba ohraniti pri nadaljnji uporabi.

## Ponovni prenos

Navodila za ponovno ustvarjanje datotek so v `tools/osm/osm2scene.py`.
