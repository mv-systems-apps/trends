# Trends — grafieken en statistieken uitgelegd

Versie 13528A4-026, 28 oktober 2026

## Leeswijzer

Trends kent vier weergaven van dezelfde metingen; je wisselt ertussen door over de grafiek te vegen. Met de schakelaar XmR, rechts onder de grafiek, krijgen x̄±σ en Regressie andere grenzen: dat zijn de XmR-kaart en Regressie XmR. De stipjes en de naam links onder de grafiek tonen altijd de kaart; of XmR aan staat, zie je aan de schakelaar (turquoise is aan). De keuze wordt per bron onthouden. Rechts daarvan staan vier knoppen voor de lagen: de grenzen en het doel (standaard aan, te verbergen) en de run-regels en vorig jaar (standaard uit, toe te voegen). Een turquoise knop staat aan. Als het scherm smal wordt, wordt de naam van de kaart korter: Regressie wordt Regr en dan R, Prognose Prog en dan P, Range Rng, x̄±σ x̄; past ook dat niet, dan staan er alleen de stipjes. Een tik op de grafiek opent het statistiekenvenster met de getallen achter de weergave. Dit document beschrijft per weergave hoe hij berekend wordt en hoe je hem leest, en daarna elke regel van het venster. Het gaat over Trends versie 13528A4-026.

| Weergave | Kleur van de naam | Beschikbaar bij |
| --- | --- | --- |
| x̄±σ (basiskaart) | turquoise | elke groepering |
| … met XmR aan: XmR | turquoise | tijd en dag |
| Range | turquoise | elke groepering |
| Regressie | oudroze | elke groepering |
| … met XmR aan: Regressie XmR | oudroze | tijd en dag |
| Prognose | oudroze | alleen als er een prognose te berekenen is |

### Wat is één punt?

- **Tijd**: elke meting is een eigen punt, op datum en tijdstip.
- **Dag**: alle metingen van één dag worden gemiddeld tot één punt.
- **Week, maand, kwartaal, jaar**: alle metingen in die groep worden gemiddeld tot één punt. Lege groepen nemen wel ruimte in op de as, maar tellen niet mee in de berekening.

Alle berekeningen gaan over de punten in de gekozen periode, niet over alle metingen in het bestand. Een andere periode of groepering geeft dus andere getallen.

### Kleuren die steeds terugkomen

- **Turquoise lijn**: het gemiddelde (of r̄ in de Range-kaart).
- **Rode stippellijnen**: de regelgrenzen. Een rood punt ligt daarbuiten. Met de laag Grenzen te verbergen (zie Lagen).
- **Oranje stippellijnen**: de waarschuwingsgrenzen. Een oranje punt ligt tussen oranje en rood.
- **Lavendel**: het doel (lange streepjes) en, als je een bereik hebt ingesteld, de doelband (fijne stippen). Met de laag Doel te verbergen (zie Lagen).
- **Oudroze**: de regressielijn, en waar het om de lijn zelf gaat: de helling, het begin en het eind van de lijn, en de datum van de prognose. Andere getallen, zoals r² en de marge, zijn wit.
- **Lichtblauwe punten**: binnen de grenzen, niets bijzonders.
- **Geel**: de run-regels, als die laag aan staat (zie Lagen).
- **Lichte stippellijn**: vorig jaar, als die laag aan staat (zie Lagen).

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

Een punt kleurt oranje als het verder dan 2σ van het gemiddelde ligt, en rood bij meer dan 3σ. De verticale schaal loopt minstens tot x̄ ± 3,4σ, zodat de grenzen altijd in beeld zijn; staat de laag Grenzen uit, dan bepalen alleen de metingen (en het doel) de schaal.

### Interpretatie

- Bij een normale verdeling valt ongeveer 95% van de punten binnen 2σ en 99,7% binnen 3σ. Een rood punt is dus zeldzaam als er niets verandert: kijk wat er die dag anders was.
- Een oranje punt af en toe is normaal: bij 20 punten verwacht je er ongeveer één.
- **Let op:** σ rekent alle variatie mee, ook een trend of een sprong in het niveau. Loopt je gewicht gestaag omlaag, dan wordt σ groot en liggen de grenzen ruim. Echte veranderingen vallen dan zelden buiten de grenzen. Daarvoor zijn de XmR-kaart en de trendkaarten beter.
- De basiskaart is het meest geschikt voor een stabiele grootheid, waarbij je wilt zien hoe breed de normale spreiding is.

## XmR-kaart

De XmR-kaart (individuele waarden en bewegende range) zet de grenzen op basis van de sprong van punt tot punt, niet op basis van σ. Daardoor zijn de grenzen alleen gebaseerd op de korte-termijnvariatie, en vallen echte verschuivingen eerder op. Je zet hem aan met de schakelaar XmR onder de grafiek; dat kan alleen bij de groepering tijd of dag.

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

De marge houdt rekening met samenhang tussen opeenvolgende metingen: na een zware dag volgt vaak nog een. Een korte of onrustige reeks is daardoor minder snel aantoonbaar, en de Prognose verschijnt minder snel. Bij een schommeling zoals bij gewicht heet een vlakke reeks zo in ongeveer 10% van de gevallen toch aantoonbaar (15% bij twee weken); zonder deze correctie was dat een derde.

Per meting komt de lijn uit de daggemiddelden, zodat twee metingen op één dag niet als twee dagen tellen; de losse metingen blijven punten. Meet wel op vaste momenten: ontbreekt soms de avondmeting, dan trekt een verschil tussen ochtend en avond de lijn alsnog scheef. Metingen op 1 of 2 dagen zijn nooit aantoonbaar; zijn alle daggemiddelden gelijk, dan is de lijn vlak.

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

Regressie XmR is dezelfde trendlijn als hierboven, maar met grenzen die worden berekend zoals bij de XmR-kaart: op basis van de sprong van punt tot punt rond de lijn. De kop is gelijk aan die van de trendkaart. Je krijgt hem met de schakelaar XmR aan; dat kan alleen bij de groepering tijd of dag.

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

De prognose trekt de trendlijn door tot het punt waar hij je doel raakt, en geeft die dag. Heeft de lijn het doel binnen de getoonde periode al gekruist, dan geeft hij de dag waarop dat gebeurde: volgens de trend heb je je doel dan al bereikt. De kop is gelijk aan die van de trendkaart. De datum staat in oudroze onder het ringetje; vlak bij de rand schuift hij naar binnen, zodat hij in beeld blijft. Een datum van de as die daarmee zou botsen, valt weg. Ligt het ringetje voorbij de as (het doel is ver weg), dan staat de datum rechts, met een pijl ervoor.

### Wanneer er een prognose is

De kaart verschijnt alleen als aan alle voorwaarden is voldaan:

1. Je hebt een doel ingesteld.
2. Er is een trendlijn (minstens 3 punten) en die is aantoonbaar.
3. De lijn raakt het doel: voorbij het laatste punt, of al binnen de getoonde periode (tussen het eerste en het laatste punt). Is het doel al vóór het eerste punt gehaald, dan is er geen prognose; kies dan een langere periode.
4. Ligt het doel voorbij het laatste punt, dan wordt het binnen tien jaar bereikt.
5. Ligt het doel voorbij het laatste punt, dan ligt de datum na vandaag (per meting: het moment ligt na nu, dus het kan nog vandaag zijn). Meet je een tijd niet, dan kan die dag al voorbij zijn zonder dat de lijn het weet; dan is er geen prognose.

Verdwijnt de prognose terwijl je hem bekijkt, bijvoorbeeld bij een andere periode, dan springt de app terug naar Regressie. Gaat bij een prognose per meting het moment voorbij terwijl de app openstaat, dan gebeurt dat pas bij de volgende keer dat de grafiek getekend wordt.

### Berekening

De lijn y = a + b · x raakt het doel als y = doel:

```latex
x_{\text{doel}} = \frac{\text{doel} - a}{b}
```

Bij tijd en dag is x in dagen, dus x_doel is direct een datum. Bij groeperen telt de app groepen op de as (zo nodig door na vandaag), en zoekt de dag binnen de groep waarin de lijn het doel raakt. Per dag en per groep wordt de datum naar boven afgerond op een hele dag. Per meting hebben de punten een tijdstip; dan is het de dag waarop het snijpunt valt, en vooruit telt het alleen als dat moment na nu ligt (dus soms nog vandaag). De as loopt bij een prognose vooruit door tot net voorbij het moment waarop de lijn het doel raakt, maar hooguit tot drie keer de getoonde periode. Ligt het doel verder weg, dan loopt de stippellijn de grafiek uit.

In de grafiek zie je de lijn door de metingen, een stippellijn vanaf het laatste punt tot het doel, en een lavendel ringetje precies waar hij het doel raakt. Is het doel al bereikt, dan staat het ringetje op de lijn tussen de metingen en is er geen stippellijn. Er zijn hier geen grenzen en de punten krijgen geen kleur.

### Interpretatie

- De prognose geeft het antwoord op de vraag: wanneer bereik ik mijn doel als het precies zo doorgaat als in de gekozen periode?
- Staat het ringetje tussen de metingen, dan heb je het doel volgens de trend al gehaald, op die dag. Dat geldt ook als de lijn er daarna weer vanaf loopt: de app kijkt alleen of de lijn het doel heeft geraakt, niet in welke richting.
- Het is een puntschatting zonder onzekerheidsmarge. Een helling met een grote marge geeft een onzekere datum. Hoe verder weg, hoe onzekerder.
- Het tempo verandert bijna altijd: een dieet vlakt af, een auto rijdt in de vakantie meer. Gebruik de datum als richting, niet als belofte, en kijk na een paar weken opnieuw.
- Probeer verschillende periodes. Schuift de datum flink als je de periode verandert, dan is de trend niet stabiel.

## Lagen

Rechts onder de grafiek, naast XmR, staan vier knoppen. Eerst wat je kunt verbergen en standaard aan staat: de grenzen (drie lijnen) en het doel (een roos). Dan wat je kunt toevoegen en standaard uit staat: de run-regels (puntjes boven een lijn) en vorig jaar (een kalender met −1). Een tik zet een laag aan of uit; turquoise is aan, grijs is uit. Zo zie je altijd hoe de lagen staan. Met het toetsenbord zitten de knoppen gewoon in de tabvolgorde; Enter of Spatie schakelt. Een laag die bij de kaart niet kan, is uitgegrijsd, en een tik erop zegt waarom (bijvoorbeeld ‘Deze bron heeft geen doel’); bij Prognose kan geen enkele laag (de knop Doel staat daar uitgegrijsd aan, want het doel is er altijd). Elke laag wordt per bron en per kaart onthouden: x̄±σ (met XmR), Range en Regressie (met XmR) hebben elk hun eigen keuze. Bij een teller als de km-stand kun je zo de grenzen bij x̄±σ uitzetten en bij Regressie laten staan. Verwijder je een bron, dan vervallen ook zijn keuzes voor de lagen en XmR.

### Grenzen

De rode en oranje regelgrenzen (bij x̄±σ, XmR en Range) en de grenzen rond de lijn (bij Regressie). Zet je ze uit, dan verdwijnen ook de rode en oranje kleur van de stippen en van de waarden in de tabel, en bepalen de metingen de schaal van de as (en het doel en vorig jaar, als die aan staan). De middellijn en de run-regels blijven. De XmR-schakelaar verandert alleen de grenzen en is dan grijs; een tik erop zegt ‘Zet grenzen aan’. XmR telt dan als uit, ook in de tabel en het statistiekenvenster; zet je de grenzen weer aan, dan staat XmR weer zoals je hem had. Niet bij Prognose, waar geen grenzen zijn. In het statistiekenvenster blijven de σ-grenzen staan.

### Doel

De doellijn, het doelbereik en het doelgetal op de as. Zolang de laag aan staat, reikt de as tot het doel, ook bij een doel zonder bereik. Zet je het uit, dan hoeft de as niet meer tot het doel te reiken en zoomt de grafiek in op je metingen. Alleen als de bron een doel heeft (haal je het doel weg, dan vervalt ook deze keuze); niet bij Range (daar is geen doel) en niet bij Prognose, waar de lijn naar het doel loopt en het doel dus altijd te zien is. In het statistiekenvenster blijven de getallen staan.

### Run-regels

Ook zonder punt buiten de grenzen kan er iets veranderd zijn. NHS *Making Data Count* noemt een reeks van zes à zeven punten als omslagpunt; Trends gebruikt:

- **Verschuiving**: 7 of meer punten op rij aan één kant van de middellijn.
- **Trend**: 6 of meer punten op rij die steeds hoger of steeds lager liggen.

Een punt precies op de lijn of twee gelijke punten breken de reeks (een eigen keuze). De middellijn is x̄, of bij Regressie de regressielijn: dan telt de afstand tot de lijn, en is een daling die de lijn volgt geen trend. Kan bij x̄±σ en Regressie, met of zonder XmR.

In de grafiek worden die punten geel (rood en oranje blijven), bij een verschuiving ook de middellijn met het aantal (*13 op rij*), bij een trend de lijn tussen de punten (*↘ 6 op rij*). Labels die elkaar raken vallen weg. In de tabel zijn dezelfde waarden geel.

Een verschuiving wijst op een ander niveau (een nieuwe gewoonte, een ander meetmoment); ligt hij aan het eind, kies dan een kortere periode. Het is een aanwijzing, geen bewijs: met veel punten vind je bij toeval af en toe een reeks van 7.

### Vorig jaar

Dezelfde periode een jaar eerder, als lichte stippellijn onder je metingen, gegroepeerd zoals nu (een week van vorig jaar valt in dezelfde week van nu). De schaal loopt mee, maar vorig jaar telt niet mee in de berekeningen; het venster toont het gemiddelde van vorig jaar met het aantal punten. Kan bij x̄±σ en Regressie, bij een periode tot 1 jaar (een eigen periode tot ongeveer 13 maanden), niet per jaar. Bij Alles zou vorig jaar je hele reeks een jaar opgeschoven zijn, zonder iets om mee te vergelijken; daar is de knop uitgegrijsd. Per dag en per meting valt 29 februari weg; de lijn loopt daar gewoon door.

Bij Regressie komt er ook de trendlijn van vorig jaar bij, als je in die periode vorig jaar minstens 10 keer hebt gemeten, verspreid over minstens ongeveer 3 maanden: een doorgetrokken lijn in dezelfde lichtblauwe kleur, berekend zoals de lijn van nu. Het label noemt de helling, bijvoorbeeld ‘vorig jaar −0.01/wk’, met ‘(?)’ als die helling niet aantoonbaar is. Zo vergelijk je de helling in de kop met die van dezelfde periode vorig jaar. Met minder metingen of over een kortere tijd zegt zo'n lijn te weinig en blijft alleen de stippellijn.

## Statistiekenvenster

Het venster opent na een tik op de grafiek. In de kop staan de naam van de weergave, in de kleur van de kaart, en rechts het totale aantal metingen in het bestand (los van periode en groepering). Bij x̄±σ, XmR en Range zie je de tabs Statistieken en Kaart; bij de drie trendweergaven de tabs Statistieken en Regressie, en dan staat Regressie open. Bij x̄±σ en XmR komen daar de tabs Week en Jaar bij; een tab die niet kan, is grijs, en een tik erop toont kort waarom. Een streepje (–) betekent: niet te berekenen met deze punten. De waarden en grenzen in het venster hebben hooguit zeven cijfers: bij grote waarden, zoals een teller rond 1.234.567, toont het venster minder decimalen dan de bron (rond 123.456 één minder, vanaf een miljoen geen). Het grootste getal dat in het venster staat bepaalt dat, voor al die waarden gelijk; waarden onder 1 houden de decimalen van de bron. De helling, r en de som (Σ) hebben eigen decimalen; de som kan langer zijn. Een waarde heeft de kleur van de lijn waar hij bij hoort in de grafiek; een streepje is altijd wit.

### Tab Statistieken

Alles gaat over de punten in de gekozen periode en groepering. In de Range-kaart gaat het over de sprongen in plaats van de punten.

| Regel | Berekening | Interpretatie |
| --- | --- | --- |
| n | punten met een waarde / plekken in de periode | Bij dag: 18 / 30 betekent 18 van de 30 dagen gemeten. Bij week of maand gaat het om groepen; bij tijd zijn beide getallen gelijk. In de Range-kaart staat er steeds één minder, omdat het om sprongen gaat. |
| x̄ (in de Range-kaart: r̄) | gemiddelde van de punten (of de sprongen) | Het niveau waarop je zit; de turquoise lijn. In de trendweergaven staat die lijn er niet, en is x̄ wit. |
| σₙ₋₁ | standaardafwijking met n−1 in de noemer | Hoe ver de punten gemiddeld van x̄ liggen, met grote afwijkingen zwaarder gewogen. Bevat ook een eventuele trend. |
| r̄ | gemiddelde sprong \|xᵢ − xᵢ₋₁\| | De onrust van punt tot punt. r̄ / 1,128 is een schatting van σ zonder de trend: is die veel kleiner dan σₙ₋₁, dan zit er een trend of een sprong in. Staat er niet bij Range, want daar is r̄ al de tweede regel. |
| \|x − x̄\| | gemiddelde absolute afwijking: (1/n) Σ \|xᵢ − x̄\| | De gemiddelde afstand tot het gemiddelde, in gewone eenheden. Minder gevoelig voor uitschieters dan σ; bij een normale verdeling ongeveer 0,8 × σ. |
| Σ | som van de punten | Zinvol bij optelbare grootheden, zoals kilometers per dag. Bij gewicht zegt het weinig. |
| min | kleinste punt | De laagste waarde in de periode (bij groeperen het laagste groepsgemiddelde). |
| max | grootste punt | De hoogste waarde in de periode. |
| x̄ vorig jaar | gemiddelde van dezelfde periode een jaar eerder, met tussen haakjes het aantal punten | Alleen met de laag vorig jaar aan. Vergelijk met x̄. |

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
| ≥7 één kant | aantal verschuivingen | idem | – | Alleen met de run-regels aan. Geel als er een is. |
| ≥6 op rij ↗↘ | aantal trends | idem | – | Alleen met de run-regels aan. Geel als er een is. |

Vergelijk de grenzen met de doelband. Ligt de band ruim binnen UWL en LWL, dan valt een flink deel van je metingen erbuiten door gewone schommeling, ook als het gemiddelde op het doel ligt. Ligt de band om de grenzen heen, dan blijf je er bij normale schommeling vrijwel altijd binnen.

### Tab Regressie

Alleen bij Regressie, Regressie XmR en Prognose.

| Regel | Berekening | Interpretatie |
| --- | --- | --- |
| n | als in de tab Statistieken | Het aantal punten waar de lijn doorheen gaat. |
| helling | b, omgerekend naar per week (tijd, dag) of per groep | Het tempo: +0,25 / wk is gemiddeld een kwart per week omhoog. Bij een aantoonbare maar kleine helling krijgt het getal extra decimalen, zodat er geen 0,0 staat. |
| marge | ± t × de standaardfout van de helling; die standaardfout is s / √Σ(xᵢ − x̄)² × √((1 + ρ) / (1 − ρ)), en t hoort bij 95% en n−2 vrijheidsgraden. ρ is de samenhang tussen opeenvolgende afwijkingen van de lijn, met een correctie omdat hij bij weinig punten te laag uitvalt (ρ + (2 + 3ρ)/n, tussen 0 en 0,95; bij 3 of 4 punten 0). Per meting: berekend op de daggemiddelden; liggen de metingen op 1 of 2 dagen of zijn alle daggemiddelden gelijk, dan een streepje | De echte helling ligt met ongeveer 95% zekerheid tussen helling − marge en helling + marge: het 95%-betrouwbaarheidsinterval. Bij sterke samenhang tussen dagen is dat in de simulatie eerder 90% (bij een maand dagmetingen) tot 85% (bij één à twee weken). Valt nul daarbinnen, dan is de trend niet aantoonbaar (gestreepte lijn, vraagteken). Meer punten, een langere periode en minder schommeling maken de marge kleiner. |
| Δ | lijn eind − lijn begin | De totale verandering volgens de trend over de periode, zonder de toevallige eerste en laatste meting. |
| lijn begin | de waarde op de lijn bij het eerste punt | Waar je volgens de trend begon. |
| lijn eind | de waarde op de lijn bij het laatste punt | Waar je volgens de trend nu staat; vaak betrouwbaarder dan de laatste losse meting. |
| r / r² | r = correlatiecoëfficiënt: Σ(xᵢ−x̄)(yᵢ−ȳ) / √(Σ(xᵢ−x̄)² · Σ(yᵢ−ȳ)²); r² = r × r (determinatiecoëfficiënt). Per meting over de daggemiddelden: dan kan r² hoog zijn terwijl de losse punten ruim spreiden | Twee waarden op één regel, bijvoorbeeld −0.80 / 0.63. r loopt van −1 tot +1: het teken is de richting, de grootte hoe strak de punten langs de lijn liggen; rond 0 is er geen rechte-lijnverband. r² is het deel van de schommeling dat de lijn verklaart: bij 0,80 bepaalt de trend het beeld, bij 0,10 overheerst de dagelijkse schommeling, ook als de trend wel aantoonbaar is. |
| σ rond lijn (Regressie) | s = √(Σ(yᵢ − ŷᵢ)² / (n−2)); per meting de losse metingen rond de lijn uit de daggemiddelden | De normale afwijking van de trend, in gewone eenheden. |
| lijn ± 3σ (Regressie) | ± 3s | De afstand van de rode grenzen tot de lijn. |
| lijn ± 2σ (Regressie) | ± 2s | De afstand van de oranje grenzen tot de lijn. |
| r̄ rond lijn (Regressie XmR) | gemiddelde sprong in de afwijking tot de lijn | De onrust van dag tot dag rond de trend. |
| lijn ± 2,66r̄ (Regressie XmR) | ± 2,66 × r̄ | De afstand van de rode grenzen tot de lijn. |
| lijn ± 1,77r̄ (Regressie XmR) | ± 1,77 × r̄ | De afstand van de oranje grenzen tot de lijn. |
| vorig jaar | de helling van de trendlijn van vorig jaar, met ‘(?)’ als hij niet aantoonbaar is | Alleen met de laag vorig jaar aan; een streepje als vorig jaar minder dan 10 metingen heeft, als die samen minder dan ongeveer 3 maanden beslaan, of als alle waarden van vorig jaar gelijk zijn. |
| ≥7 één kant | aantal verschuivingen rond de lijn | Alleen met de run-regels aan, en niet in de Prognose. Geel als er een is. |
| ≥6 op rij ↗↘ | aantal trends in de afstand tot de lijn | Idem. |
| Doel | het ingestelde doel | Ter vergelijking met lijn eind. |
| doel bereikt | de dag waarop de lijn het doel raakt | Staat er alleen als er een prognose is (zie Prognose); anders een streepje. Staat het ringetje tussen je metingen, dan heb je het doel volgens de trend al gehaald, op die dag. Staat het voorbij je laatste meting, dan is het een verwachting, ook als die dag vandaag is. Het is een schatting, geen belofte. |

In de Prognose staan de regels over grenzen niet, omdat daar geen grenzen worden getekend.

**Een voorbeeld.** Helling −0,30 / wk, marge ± 0,12, r² = 0,55: je daalt aantoonbaar, ergens tussen 0,18 en 0,42 per week. Ruim de helft van de schommeling komt door die daling, de rest is gewone variatie van dag tot dag.

### Tabs Week en Jaar

Zit je op sommige weekdagen (Week) of in sommige maanden (Jaar) structureel hoger of lager? Alleen bij x̄±σ en XmR; de uitkomst hangt niet af van de weergave. Week kan per dag en per meting, vanaf 14 dagen met metingen. Jaar kan als elke maand minstens twee keer heel in de periode ligt, met metingen: in de praktijk iets meer dan twee jaar (periode Alles of een eigen periode), want met minder zijn seizoen en trend niet uit elkaar te halen. Kan een tab niet, dan is hij grijs; een tik erop toont kort waarom. Per meting eerst per dag gemiddeld. Bij Jaar tellen alleen hele maanden mee, elke maand van elk jaar één keer; bij één meting per maand vallen de eerste en de laatste maand dus weg. Afwijkingen met de decimalen van de bron.

Per rij een balkje en de afwijking, in twee stappen. Stap 1: per weekdag (of maand) hoeveel je gemiddeld boven of onder de trendlijn door de daggemiddelden zit, zodat een daling of stijging niet meetelt (te weinig dagen voor een lijn: van x̄). Stap 2: alle afwijkingen worden verschoven zodat de middelste van de zeven (of twaalf) op 0 komt. De tabel zegt dus hoeveel zwaarder of lichter je bent dan op een gewone weekdag (of in een gewone maand); welke dag op 0 staat, is de middelste en verschilt per periode. Waarom: is alleen het weekend 0,3 zwaarder, dan ligt de trendlijn, die ook door de weekenden loopt, ongeveer 0,1 te hoog voor een gewone dag (2/7 × 0,3). Zonder stap 2 staan maandag tot en met vrijdag dan op −0,1 en kunnen ze ten onrechte kleuren, en lijkt het weekend maar +0,2. Met stap 2 staan maandag tot en met vrijdag op 0 en het weekend op +0,3. De verschillen tussen de dagen blijven gelijk.

Een gekleurd balkje (kleur van de kaart) valt buiten de gewone schommeling, een grijs balkje erbinnen. De grens is t × s / √m, met s de spreiding binnen de weekdagen of maanden (hoe verschillend bijvoorbeeld de januari's onderling zijn) en m het kleinste aantal keren dat er een voorkomt. Omdat 7 of 12 rijen tegelijk getoetst worden, is t strenger dan bij 95%: bij alleen toeval kleurt er in ongeveer 1 op de 20 tabellen een rij. Komt een weekdag minder dan twee keer voor (of nooit, zoals nooit op zondag gemeten), dan is er geen grens en is alles grijs.
