# Trends

Controlekaarten voor eigen metingen, zoals gewicht of kilometerstand, met de bronnen in
`trends.json` in de werkmap. Hobbyproject, gebouwd voor eigen gebruik. Hoe de grafieken
werken staat in `uitleg-grafieken.md`; de afspraken die voor alle apps gelden, in de repo
apps-basis (`conventies.md`).

**Openen:** https://mv-systems-apps.github.io/trends/

## Snelkoppelingen

Lang drukken op het icoon van de app toont deze opdrachten, als de app echt is
geïnstalleerd. Op Android is dat een installatie via Chrome: de app staat dan ook in de
lijst met apps. Edge op Android maakt een snelkoppeling naar de pagina (een icoon met het
Edge-logo) en toont de opdrachten dan niet; dat ligt aan Edge, niet aan de app.
Trends en Events werken het best in Edge.

Werkt lang drukken niet, maak dan per opdracht een eigen icoon met het adres, bijvoorbeeld
met MacroDroid (een macro die de website opent, met een snelkoppeling op het beginscherm)
of in Niagara:

| Opdracht | Adres |
|---|---|
| Meting toevoegen | `https://mv-systems-apps.github.io/trends/trends.html?snel=meting` |

Zo'n adres kan in het losse venster van de app openen of in een gewoon browsertabblad; de
opdracht werkt in beide, met dezelfde gegevens. De app haalt `?snel=…` na het uitvoeren uit
het adres, zodat herladen de opdracht niet herhaalt.

## Tests

- `node trends-tests.cjs`: de rekenregels en de opslag.
- `node trends-browser.cjs`: de app in Chromium op telefoonformaat.
- `node trends-ijk.cjs`: de ijkmeting van grafiek, getallen en tabel in 40 vaste weergaven,
  met verzonnen gegevens op een vaste datum. Herschikken van code mag daar niets aan
  veranderen. Na een bedoelde wijziging opnieuw vastleggen met `--vastleggen`.
