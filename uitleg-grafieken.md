# Trends — grafieken en statistieken uitgelegd

Versie 1352898-038, 24 oktober 2026

## Leeswijzer

Trends kent zes weergaven van dezelfde metingen; je wisselt ertussen door over de grafiek te vegen. Een tik op de grafiek opent het statistiekenvenster met de getallen achter de weergave. Dit document beschrijft per weergave hoe hij berekend wordt en hoe je hem leest, en daarna elke regel van het venster. Het gaat over Trends versie 1352898-038.

| Weergave | Kleur van de naam | Beschikbaar bij |
| --- | --- | --- |
| x̄±σ (basiskaart) | turquoise | elke groepering |
| XmR | turquoise | tijd en dag |
| Range | turquoise | elke groepering |
| Regressie | oudroze | elke groepering |
| Regressie XmR | oudroze | tijd en dag |
| Prognose | oudroze | alleen als er een prognose te berekenen is |

### Wat is één punt?

- **Tijd**: elke meting is een eigen punt, op datum en tijdstip.
- **Dag**: alle metingen van één dag worden gemiddeld tot één punt.
- **Week, maand, kwartaal, jaar**: alle metingen in die groep worden gemiddeld tot één punt. Lege groepen nemen wel ruimte in op de as, maar tellen niet mee in de berekening.

Alle berekeningen gaan over de punten in de gekozen periode, niet over alle metingen in het bestand. Een andere periode of groepering geeft dus andere getallen.

### Kleuren die steeds terugkomen

- **Turquoise lijn**: het gemiddelde (of r̄ in de Range-kaart).
- **Rode stippellijnen**: de regelgrenzen. Een rood punt ligt daarbuiten.
- **Oranje stippellijnen**: de waarschuwingsgrenzen. Een oranje punt ligt tussen oranje en rood.
- **Lavendel**: het doel (lange streepjes) en, als je een bereik hebt ingesteld, de doelband (fijne stippen).
- **Oudroze**: de regressielijn en alles wat daarbij hoort.
- **Lichtblauwe punten**: binnen de grenzen, niets bijzonders.

## Basiskaart x̄±σ

De basiskaart laat zien waar je metingen omheen liggen en hoe ver ze daarvan afwijken, gemeten met de standaardafwijking van alle punten. In de kop staan n, x̄ en r̄.

### Berekening

Het gemiddelde van de n punten:

```latex
\bar{x} = \frac{1}{n}\sum_{i=1}^{n} x_i
```

De standaardafwijking, met n−1 in de noemer (de steekproefvariant):

```latex
\sigma_{n-1} = \sqrt{\frac{1}{n-1}\sum_{i=1}^{n} (x_i - \bar{x})^2}
```

De lijnen in de grafiek:

| Lijn | Waarde | Stijl |
| --- | --- | --- |
| Gemiddelde | x̄ | turquoise, doorgetrokken |
| Waarschuwingsgrenzen | x̄ ± 2σ | oranje, gestreept |
| Regelgrenzen | x̄ ± 3σ | rood, gestreept |
| Doel | het ingestelde doel | lavendel, lange streepjes |

Een punt kleurt oranje als het verder dan 2σ van het gemiddelde ligt, en rood bij meer dan 3σ. De verticale schaal loopt minstens tot x̄ ± 3,4σ, zodat de grenzen altijd in beeld zijn.

### Interpretatie

- Bij een normale verdeling valt ongeveer 95% van de punten binnen 2σ en 99,7% binnen 3σ. Een rood punt is dus zeldzaam als er niets verandert: kijk wat er die dag anders was.
- Een oranje punt af en toe is normaal: bij 20 punten verwacht je er ongeveer één.
- **Let op:** σ rekent alle variatie mee, ook een trend of een sprong in het niveau. Loopt je gewicht gestaag omlaag, dan wordt σ groot en liggen de grenzen ruim. Echte veranderingen vallen dan zelden buiten de grenzen. Daarvoor zijn de XmR-kaart en de trendkaarten beter.
- De basiskaart is het meest geschikt voor een stabiele grootheid, waarbij je wilt zien hoe breed de normale spreiding is.

## XmR-kaart

De XmR-kaart (individuele waarden en bewegende range) zet de grenzen op basis van de sprong van punt tot punt, niet op basis van σ. Daardoor zijn de grenzen alleen gebaseerd op de korte-termijnvariatie, en vallen echte verschuivingen eerder op. Hij is er alleen bij de groepering tijd of dag.

### Berekening

De bewegende range is het absolute verschil tussen twee opeenvolgende punten. r̄ is daar het gemiddelde van:

```latex
\bar{r} = \frac{1}{n-1}\sum_{i=2}^{n} |x_i - x_{i-1}|
```

| Lijn | Waarde | Stijl |
| --- | --- | --- |
| Gemiddelde | x̄ | turquoise |
| Waarschuwingsgrenzen | x̄ ± 1,77 × r̄ | oranje |
| Regelgrenzen | x̄ ± 2,66 × r̄ | rood |

De factoren komen uit de statistische procesbeheersing. Voor twee opeenvolgende punten geldt d₂ = 1,128: r̄ / 1,128 is een schatting van σ uit de korte-termijnvariatie. Dan is 3 / 1,128 = 2,66 en 2 / 1,128 = 1,77. De grenzen staan dus op 3 en 2 keer die geschatte σ.

De kleuren werken als in de basiskaart: oranje voorbij 1,77 × r̄, rood voorbij 2,66 × r̄.

### Interpretatie

- Een rood punt betekent: deze waarde past niet bij de gewone schommeling van dag tot dag. Er is iets gebeurd.
- Liggen veel punten aan één kant buiten de grenzen, dan is het niveau verschoven. In de basiskaart zou zo'n verschuiving σ opblazen en verborgen blijven.
- Liggen de XmR-grenzen veel smaller dan die van de basiskaart, dan zit er een trend of een sprong in je data. Bij een stabiel proces liggen ze ongeveer even breed.
- Bij week of maand is XmR niet beschikbaar: gemiddelden van groepen schommelen anders, en een sprong tussen groepen is geen gewone korte-termijnvariatie meer.

## Range-kaart

De Range-kaart toont de sprongen zelf: elk punt is het absolute verschil met het vorige punt. Zo zie je of de onrust van punt tot punt verandert, los van het niveau. In de kop staan n (het aantal sprongen, dus één minder dan het aantal punten) en r̄.

### Berekening

```latex
mR_i = |x_i - x_{i-1}| \qquad \bar{r} = \frac{1}{n-1}\sum_{i=2}^{n} mR_i
```

| Lijn | Waarde | Stijl |
| --- | --- | --- |
| Middellijn | r̄ | turquoise |
| Bovengrens | 3,267 × r̄ | rood |
| Ondergrens | 0 | de onderkant van de grafiek |

De factor 3,267 (D₄ in de procesbeheersing, voor twee opeenvolgende punten) zet de bovengrens op ongeveer drie keer de spreiding van de sprongen zelf. Een sprong kan niet negatief zijn, dus de ondergrens is 0. Er zijn geen oranje grenzen en er wordt geen doel getekend: het doel gaat over het niveau, niet over sprongen.

Een punt kleurt rood als de sprong groter is dan 3,267 × r̄.

### Interpretatie

- Een rood punt is een uitzonderlijk grote sprong. Vaak staat er in de XmR-kaart op dezelfde plek een punt ver van het gemiddelde, of een meetfout.
- Worden de sprongen over een periode structureel groter, dan is je proces onrustiger geworden, ook al blijft het gemiddelde gelijk.
- Bij week of maand gaat het om de sprong tussen opeenvolgende groepsgemiddelden.

## Regressie (trendkaart)

De trendkaart trekt de best passende rechte lijn door de punten en meet de afwijkingen tot die lijn, in plaats van tot één vast gemiddelde. Zo zie je of er een richting in zit, hoe snel die gaat, en welke punten daar niet bij passen. In de kop staan n, een pijl met de helling per eenheid, en r².

### De lijn

De lijn is de kleinste-kwadratenlijn y = a + b · x: de lijn waarbij de som van de gekwadrateerde verticale afstanden zo klein mogelijk is.

```latex
b = \frac{\sum (x_i - \bar{x})(y_i - \bar{y})}{\sum (x_i - \bar{x})^2} \qquad a = \bar{y} - b\,\bar{x}
```

Wat x is, hangt af van de groepering:

| Groepering | x | Helling getoond per |
| --- | --- | --- |
| Tijd, dag | dagen sinds het eerste punt | week (× 7) |
| Week | volgnummer van de week op de as | week |
| Maand | volgnummer van de maand | maand |
| Kwartaal | volgnummer van het kwartaal | kwartaal |
| Jaar | volgnummer van het jaar | jaar |

Lege groepen tellen mee in het volgnummer, zodat de lijn klopt met hoe de grafiek getekend is. Er is pas een lijn vanaf 3 punten. Liggen alle punten op dezelfde datum, of hebben ze allemaal dezelfde waarde, dan is er geen lijn.

### Aantoonbaar of toeval?

De app toetst of de helling meer is dan toeval (95%, zie **marge** in het statistiekenvenster). Is de helling aantoonbaar, dan is de lijn doorgetrokken en de pijl kaal (↗ of ↘). Is ze niet aantoonbaar, dan is de lijn gestreept en staat er een vraagteken achter de pijl (↘?). Een vlakke pijl (→) betekent dat de helling afgerond nul is.

### Grenzen rond de lijn

Vanaf 5 punten lopen er grenzen evenwijdig aan de lijn, gebaseerd op de restspreiding s: de spreiding van de punten rond de lijn.

```latex
s = \sqrt{\frac{\sum (y_i - \hat{y}_i)^2}{n-2}}
```

Hier is ŷᵢ de waarde op de lijn bij punt i. Er staat n−2 in de noemer omdat de lijn twee getallen (a en b) uit de data haalt. De oranje grenzen liggen op lijn ± 2s, de rode op lijn ± 3s. Een punt kleurt naar zijn afstand tot de lijn: oranje voorbij 2s, rood voorbij 3s.

### Interpretatie

- **Pijl en helling**: de richting en de snelheid. ↘ −0,30/wk betekent gemiddeld 0,30 per week omlaag.
- **Doorgetrokken of gestreept**: alleen bij een doorgetrokken lijn kun je zeggen dat er echt een trend is.
- **r²** (determinatiecoëfficiënt): welk deel van de schommeling de lijn verklaart. Bij 0,63 komt 63% van de variatie door de trend; de rest is gewone dagelijkse schommeling.
- **Rode punten**: uitschieters ten opzichte van de trend. Een punt dat in de basiskaart normaal lijkt, kan hier opvallen als het niet bij de trend past.
- **Voorzichtig met doortrekken**: de lijn beschrijft de gekozen periode. Een trend van drie weken zegt weinig over volgend jaar.

## Regressie XmR

Regressie XmR is dezelfde trendlijn als hierboven, maar met grenzen die worden berekend zoals bij de XmR-kaart: op basis van de sprong van punt tot punt rond de lijn. De kop is gelijk aan die van de trendkaart. Deze weergave is er alleen bij de groepering tijd of dag.

### Berekening

Voor elk punt de afwijking tot de lijn, eᵢ = yᵢ − ŷᵢ. Daarna de gemiddelde sprong in die afwijking:

```latex
\bar{r}_{\text{lijn}} = \frac{1}{n-1}\sum_{i=2}^{n} |e_i - e_{i-1}|
```

De oranje grenzen liggen op lijn ± 1,77 × r̄, de rode op lijn ± 2,66 × r̄: dezelfde factoren als bij de XmR-kaart. Ook hier pas vanaf 5 punten. De punten kleuren naar hun afstand tot de lijn.

### Interpretatie

- De σ-grenzen van de gewone trendkaart worden breder als de punten niet netjes langs een rechte lijn liggen, bijvoorbeeld bij een knik of een plotselinge sprong. De XmR-grenzen kijken alleen naar de onrust van dag tot dag, en blijven daardoor smal.
- Zijn de grenzen hier duidelijk smaller dan in de gewone trendkaart, dan past een rechte lijn niet goed: er zit een bocht, een sprong of een periode met een ander tempo in.
- Rode punten hier zijn dagen die niet passen bij zowel de trend als de normale dagelijkse schommeling.

## Prognose

De prognose trekt de trendlijn door tot het punt waar hij je doel raakt, en geeft die dag. De kop is gelijk aan die van de trendkaart. De datum staat in oudroze onder de grafiek, op de plek van de laatste datum.

### Wanneer er een prognose is

De kaart verschijnt alleen als aan alle voorwaarden is voldaan:

1. Je hebt een doel ingesteld.
2. Er is een trendlijn (minstens 3 punten) en die is aantoonbaar.
3. De lijn loopt naar het doel toe: het doel ligt voorbij het laatste punt.
4. Het doel wordt binnen tien jaar bereikt.
5. De datum ligt na vandaag.

Verdwijnt de prognose terwijl je hem bekijkt, bijvoorbeeld bij een andere periode, dan springt de app terug naar Regressie.

### Berekening

De lijn y = a + b · x raakt het doel als y = doel:

```latex
x_{\text{doel}} = \frac{\text{doel} - a}{b}
```

Bij tijd en dag is x in dagen, dus x_doel is direct een datum. Bij groeperen telt de app groepen op de as door na vandaag, en zoekt de dag binnen de groep waarin de lijn het doel raakt. De datum wordt naar boven afgerond op een hele dag. De as loopt door tot net voorbij die dag, maar hooguit tot drie keer de getoonde periode. Ligt het doel verder weg, dan loopt de stippellijn de grafiek uit.

In de grafiek zie je de lijn door de metingen, een stippellijn vanaf het laatste punt tot het doel, en een lavendel ringetje waar hij het doel raakt. Er zijn hier geen grenzen en de punten krijgen geen kleur.

### Interpretatie

- De prognose geeft het antwoord op de vraag: wanneer bereik ik mijn doel als het precies zo doorgaat als in de gekozen periode?
- Het is een puntschatting zonder onzekerheidsmarge. Een helling met een grote marge geeft een onzekere datum. Hoe verder weg, hoe onzekerder.
- Het tempo verandert bijna altijd: een dieet vlakt af, een auto rijdt in de vakantie meer. Gebruik de datum als richting, niet als belofte, en kijk na een paar weken opnieuw.
- Probeer verschillende periodes. Schuift de datum flink als je de periode verandert, dan is de trend niet stabiel.

## Statistiekenvenster

Het venster opent na een tik op de grafiek. In de kop staan de naam van de weergave, in de kleur van de kaart, en rechts het totale aantal metingen in het bestand (los van periode en groepering). Bij x̄±σ, XmR en Range zie je de tabs Statistieken en Kaart; bij de drie trendweergaven alleen de tab Regressie. Een streepje (–) betekent: niet te berekenen met deze punten.

### Tab Statistieken

Alles gaat over de punten in de gekozen periode en groepering. In de Range-kaart gaat het over de sprongen in plaats van de punten.

| Regel | Berekening | Interpretatie |
| --- | --- | --- |
| n | punten met een waarde / plekken in de periode | Bij dag: 18 / 30 betekent 18 van de 30 dagen gemeten. Bij week of maand gaat het om groepen; bij tijd zijn beide getallen gelijk. In de Range-kaart staat er steeds één minder, omdat het om sprongen gaat. |
| x̄ (in de Range-kaart: r̄) | gemiddelde van de punten (of de sprongen) | Het niveau waarop je zit; de turquoise lijn. |
| σₙ₋₁ | standaardafwijking met n−1 in de noemer | Hoe ver de punten gemiddeld van x̄ liggen, met grote afwijkingen zwaarder gewogen. Bevat ook een eventuele trend. |
| r̄ | gemiddelde sprong \|xᵢ − xᵢ₋₁\| | De onrust van punt tot punt. r̄ / 1,128 is een schatting van σ zonder de trend: is die veel kleiner dan σₙ₋₁, dan zit er een trend of een sprong in. Staat er niet bij Range, want daar is r̄ al de tweede regel. |
| \|x − x̄\| | gemiddelde absolute afwijking: (1/n) Σ \|xᵢ − x̄\| | De gemiddelde afstand tot het gemiddelde, in gewone eenheden. Minder gevoelig voor uitschieters dan σ; bij een normale verdeling ongeveer 0,8 × σ. |
| Σ | som van de punten | Zinvol bij optelbare grootheden, zoals kilometers per dag. Bij gewicht zegt het weinig. |
| min | kleinste punt | De laagste waarde in de periode (bij groeperen het laagste groepsgemiddelde). |
| max | grootste punt | De hoogste waarde in de periode. |

### Tab Kaart

De grenzen en het doel, met tussen haakjes de formule die bij deze weergave hoort.

| Regel | x̄±σ | XmR | Range | Interpretatie |
| --- | --- | --- | --- | --- |
| UCL (bovenste regelgrens) | x̄ + 3σ | x̄ + 2,66 × r̄ | 3,267 × r̄ | De rode lijn boven. Een punt daarboven is een signaal. |
| UWL (bovenste waarschuwingsgrens) | x̄ + 2σ | x̄ + 1,77 × r̄ | – | De oranje lijn boven. Punten daarboven: opletten. |
| LWL (onderste waarschuwingsgrens) | x̄ − 2σ | x̄ − 1,77 × r̄ | – | De oranje lijn onder. |
| LCL (onderste regelgrens) | x̄ − 3σ | x̄ − 2,66 × r̄ | 0 | De rode lijn onder. Kan negatief zijn; dat is een rekengrens, geen echte waarde. |
| Doel | het ingestelde doel | idem | – | De lavendel streeplijn: waar je naartoe wilt. |
| Doel·bereik | het ingestelde bereik | idem | – | De totale breedte van de doelband. |
| Doel·max | doel + bereik / 2 | idem | – | De bovenkant van de doelband. |
| Doel·min | doel − bereik / 2 | idem | – | De onderkant van de doelband. |

Vergelijk de grenzen met de doelband. Ligt de band ruim binnen UWL en LWL, dan valt een flink deel van je metingen erbuiten door gewone schommeling, ook als het gemiddelde op het doel ligt. Ligt de band om de grenzen heen, dan blijf je er bij normale schommeling vrijwel altijd binnen.

### Tab Regressie

Alleen bij Regressie, Regressie XmR en Prognose.

| Regel | Berekening | Interpretatie |
| --- | --- | --- |
| n | als in de tab Statistieken | Het aantal punten waar de lijn doorheen gaat. |
| helling | b, omgerekend naar per week (tijd, dag) of per groep | Het tempo: +0,25 / wk is gemiddeld een kwart per week omhoog. Bij een aantoonbare maar kleine helling krijgt het getal extra decimalen, zodat er geen 0,0 staat. |
| marge | ± t × de standaardfout van de helling; die standaardfout is s / √Σ(xᵢ − x̄)², en t hoort bij 95% en n−2 vrijheidsgraden | De echte helling ligt met 95% zekerheid tussen helling − marge en helling + marge: het 95%-betrouwbaarheidsinterval. Valt nul daarbinnen, dan is de trend niet aantoonbaar (gestreepte lijn, vraagteken). Meer punten, een langere periode en minder schommeling maken de marge kleiner. |
| Δ | lijn eind − lijn begin | De totale verandering volgens de trend over de periode, zonder de toevallige eerste en laatste meting. |
| lijn begin | de waarde op de lijn bij het eerste punt | Waar je volgens de trend begon. |
| lijn eind | de waarde op de lijn bij het laatste punt | Waar je volgens de trend nu staat; vaak betrouwbaarder dan de laatste losse meting. |
| r / r² | r = correlatiecoëfficiënt: Σ(xᵢ−x̄)(yᵢ−ȳ) / √(Σ(xᵢ−x̄)² · Σ(yᵢ−ȳ)²); r² = r × r (determinatiecoëfficiënt) | Twee waarden op één regel, bijvoorbeeld −0.80 / 0.63. r loopt van −1 tot +1: het teken is de richting, de grootte hoe strak de punten langs de lijn liggen; rond 0 is er geen rechte-lijnverband. r² is het deel van de schommeling dat de lijn verklaart: bij 0,80 bepaalt de trend het beeld, bij 0,10 overheerst de dagelijkse schommeling, ook als de trend wel aantoonbaar is. |
| σ rond lijn (Regressie) | s = √(Σ(yᵢ − ŷᵢ)² / (n−2)) | De normale afwijking van de trend, in gewone eenheden. |
| lijn ± 3σ (Regressie) | ± 3s | De afstand van de rode grenzen tot de lijn. |
| lijn ± 2σ (Regressie) | ± 2s | De afstand van de oranje grenzen tot de lijn. |
| r̄ rond lijn (Regressie XmR) | gemiddelde sprong in de afwijking tot de lijn | De onrust van dag tot dag rond de trend. |
| lijn ± 2,66r̄ (Regressie XmR) | ± 2,66 × r̄ | De afstand van de rode grenzen tot de lijn. |
| lijn ± 1,77r̄ (Regressie XmR) | ± 1,77 × r̄ | De afstand van de oranje grenzen tot de lijn. |
| Doel | het ingestelde doel | Ter vergelijking met lijn eind. |
| doel bereikt | de dag waarop de lijn het doel raakt | Staat er alleen als er een prognose is (zie Prognose); anders een streepje. Het is een schatting, geen belofte. |

In de Prognose staan de regels over grenzen niet, omdat daar geen grenzen worden getekend.

**Een voorbeeld.** Helling −0,30 / wk, marge ± 0,12, r² = 0,55: je daalt aantoonbaar, ergens tussen 0,18 en 0,42 per week. Ruim de helft van de schommeling komt door die daling, de rest is gewone variatie van dag tot dag.
