# Trends — grafieken en statistieken uitgelegd

Versie 13528F6-002, 10 november 2026

## Leeswijzer

Trends kent vier weergaven van dezelfde metingen; je wisselt ertussen door over de grafiek te vegen of op de stipjes onder de grafiek te tikken: x̄±σ (de basiskaart), mR (Range: de sprong van punt tot punt, de moving range), ŷ±σ (de trendkaart, Regressie) en ŷ→⊙ (Prognose: de trendlijn tot het doel). ŷ (y-dakje) is de waarde die de regressielijn voorspelt: x̄±σ zijn grenzen rond het gemiddelde, ŷ±σ grenzen rond de trendlijn; ⊙ staat voor het doel. Welke grenzen je ziet, kies je met twee lagen die elkaar uitsluiten: σ (de spreiding) of XmR (de sprong van punt tot punt). Met XmR worden x̄±σ en ŷ±σ de XmR-kaart (x̄±mR) en Regressie XmR (ŷ±mR); zonder grenzen heten ze x̄ en ŷ. De stipjes en de naam links onder de grafiek tonen de kaart en de grenzen. Rechts daarvan staan zes knoppen voor de lagen: σ en XmR (de grenzen), het doel, de run-regels, vorig jaar en de notities; σ, het doel en de notities staan standaard aan. Een turquoise knop staat aan. De namen zijn zo kort dat ze niet ingekort hoeven te worden; past de regel niet, dan gaan de laatste laagknoppen naar een menu achter ⋯ (zie Lagen). De naam verdwijnt nooit. Een tik op de grafiek opent het statistiekenvenster met de getallen achter de weergave. Op de y-as staan ronde getallen (stappen van 1, 2 of 5 maal een macht van tien, nooit fijner dan de decimalen van de bron); zijn er in de gekozen periode geen metingen, dan staat dat in de grafiek. Dit document beschrijft per weergave hoe hij berekend wordt en hoe je hem leest, en daarna elke regel van het venster. Het gaat over Trends versie 13528F6-002.

| Weergave | Kleur van de naam | Beschikbaar bij |
| --- | --- | --- |
| x̄±σ (basiskaart) | turquoise | elke groepering |
| … met de laag XmR: x̄±mR (XmR-kaart) | turquoise | elke groepering |
| mR (Range) | turquoise | elke groepering |
| ŷ±σ (Regressie) | oudroze | elke groepering |
| … met de laag XmR: ŷ±mR (Regressie XmR) | oudroze | elke groepering |
| ŷ→⊙ (Prognose) | oudroze | alleen als er een prognose te berekenen is |

### Wat is één punt?

- **Tijd**: elke meting is een eigen punt, op datum en tijdstip.
- **Dag**: alle metingen van één dag worden gemiddeld tot één punt.
- **Week, maand, kwartaal, jaar**: alle metingen in die groep worden gemiddeld tot één punt. Lege groepen nemen wel ruimte in op de as, maar tellen niet mee in de berekening.

Een dag met alleen een notitie, zonder meting, is geen punt: hij telt nergens in mee.

Alle berekeningen gaan over de punten in de gekozen periode, niet over alle metingen in het bestand. Een andere periode of groepering geeft dus andere getallen.

### Kleuren die steeds terugkomen

- **Turquoise lijn**: het gemiddelde (of m̄R in de Range-kaart).
- **Rode stippellijnen**: de regelgrenzen. Een rood punt ligt daarbuiten. Met de laag Grenzen te verbergen (zie Lagen).
- **Oranje stippellijnen**: de waarschuwingsgrenzen. Een oranje punt ligt tussen oranje en rood.
- **Lavendel**: het doel (lange streepjes) en, als je een bereik hebt ingesteld, de doelband (fijne stippen). Met de laag Doel te verbergen (zie Lagen).
- **Oudroze**: de regressielijn, en waar het om de lijn zelf gaat: de helling, het begin en het eind van de lijn, en de datum van de prognose. Andere getallen, zoals r² en de marge, zijn wit.
- **Lichtblauwe punten**: binnen de grenzen, niets bijzonders.
- **Geel**: de run-regels, als die laag aan staat (zie Lagen).
- **Lichte stippellijn**: vorig jaar, als die laag aan staat (zie Lagen).
- **Lichtgrijs verticaal lijntje met een driehoekje bovenaan**: een notitie, als die laag aan staat (zie Lagen).

## Basiskaart x̄±σ

De basiskaart laat zien waar je metingen omheen liggen en hoe ver ze daarvan afwijken, gemeten met de standaardafwijking van alle punten. In de kop staan n, x̄ en m̄R.

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

## x̄±mR (XmR-kaart)

De XmR-kaart (individuele waarden en bewegende range) zet de grenzen op basis van de sprong van punt tot punt, niet op basis van σ. Daardoor zijn de grenzen alleen gebaseerd op de korte-termijnvariatie, en vallen echte verschuivingen eerder op. Je kiest hem met de laag XmR onder de grafiek, bij elke groepering. Onder de grafiek heet hij dan x̄±mR.

### Berekening

De bewegende range (mR) is het absolute verschil tussen twee opeenvolgende punten. m̄R is daar het gemiddelde van:

```latex
\overline{mR} = \frac{1}{n-1}\sum_{i=2}^{n} |x_i - x_{i-1}|
```

| Lijn | Waarde | Stijl |
| --- | --- | --- |
| Gemiddelde | x̄ | turquoise |
| Waarschuwingsgrenzen | x̄ ± 1,77 × m̄R | oranje |
| Regelgrenzen | x̄ ± 2,66 × m̄R | rood |

De factoren komen uit de statistische procesbeheersing. Voor twee opeenvolgende punten geldt d₂ = 1,128: m̄R / 1,128 is een schatting van σ uit de korte-termijnvariatie. Dan is 3 / 1,128 = 2,66 en 2 / 1,128 = 1,77. De grenzen staan dus op 3 en 2 keer die geschatte σ.

De kleuren werken als in de basiskaart: oranje voorbij 1,77 × m̄R, rood voorbij 2,66 × m̄R.

Per meting toont de XmR-kaart de daggemiddelden als punten, net als de Range-kaart, en staat de tabel per dag. m̄R komt uit de sprongen tussen die daggemiddelden. Losse metingen passen niet bij die grenzen: meet je 's ochtends en 's avonds met een vast verschil (bijvoorbeeld 0,8 kg), dan lagen ze er veel vaker buiten dan bij toeval, ook als er niets veranderd is.

### Interpretatie

- Een rood punt betekent: deze waarde past niet bij de gewone schommeling van dag tot dag. Er is iets gebeurd.
- Liggen veel punten aan één kant buiten de grenzen, dan is het niveau verschoven. In de basiskaart zou zo'n verschuiving σ opblazen en verborgen blijven.
- Liggen de mR-grenzen veel smaller dan die van de basiskaart, dan zit er een trend of een sprong in je data. Bij een stabiel proces liggen ze ongeveer even breed.
- Bij week of maand gaat het om de sprong tussen opeenvolgende groepsgemiddelden. Dat kan gewoon, zolang een groep geen seizoen of vaste cyclus bevat die de gemiddelden laat golven. Wisselt het aantal metingen per groep sterk (een week met één meting, een week met zeven), dan zijn de grenzen een benadering: een gemiddelde van weinig metingen schommelt meer.
- **Let op bij samenhang tussen dagen:** liggen opeenvolgende metingen dicht bij elkaar (na een zware dag volgt vaak nog een), dan zijn de sprongen klein en de grenzen te smal; bij een samenhang van 0,5 ongeveer 30% smaller. Er vallen dan vaker punten buiten de grenzen zonder dat er iets veranderd is. Kijk dan ook naar de σ-grenzen.

## mR (Range-kaart)

De Range-kaart (mR, moving range) toont de sprongen zelf: elk punt is het absolute verschil met het vorige punt. Zo zie je of de onrust van punt tot punt verandert, los van het niveau. In de kop staan n (het aantal sprongen, dus één minder dan het aantal punten) en m̄R. Per meting toont de Range-kaart de sprongen tussen de daggemiddelden, en de tabel staat dan per dag.

### Berekening

```latex
mR_i = |x_i - x_{i-1}| \qquad \overline{mR} = \frac{1}{n-1}\sum_{i=2}^{n} mR_i
```

| Lijn | Waarde | Stijl |
| --- | --- | --- |
| Middellijn | m̄R | turquoise |
| Bovengrens | 3,267 × m̄R | rood |
| Ondergrens | 0 | de onderkant van de grafiek |

De factor 3,267 (D₄ in de procesbeheersing, voor twee opeenvolgende punten) is 1 + 3 × 0,853 / 1,128: de bovengrens ligt drie keer de spreiding van de sprongen boven m̄R. Omdat sprongen scheef verdeeld zijn (veel kleine, een paar grote), is de kans op een rood punt zonder echte verandering ongeveer 0,9% per punt, meer dan de 0,3% bij x̄±σ. Een sprong kan niet negatief zijn, dus de ondergrens is 0. Er zijn geen oranje grenzen en er wordt geen doel getekend: het doel gaat over het niveau, niet over sprongen.

Een punt kleurt rood als de sprong groter is dan 3,267 × m̄R. De grenzen zet je met de XmR-knop aan of uit; de σ-knop is hier uitgegrijsd, want de Range-kaart heeft geen σ-grenzen.

### Interpretatie

- Een rood punt is een uitzonderlijk grote sprong. Vaak staat er in de XmR-kaart op dezelfde plek een punt ver van het gemiddelde, of een meetfout.
- Worden de sprongen over een periode structureel groter, dan is je proces onrustiger geworden, ook al blijft het gemiddelde gelijk.
- Bij week of maand gaat het om de sprong tussen opeenvolgende groepsgemiddelden.

## ŷ±σ (Regressie, trendkaart)

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

De app toetst of de helling meer is dan toeval (95%, zie **Marge** in het statistiekenvenster). Is de helling aantoonbaar, dan is de lijn doorgetrokken en de pijl kaal (↗ of ↘). Is ze niet aantoonbaar, dan is de lijn gestreept en staat er een vraagteken achter de pijl (↘?). Een vlakke pijl (→) betekent dat de helling afgerond nul is.

De marge houdt rekening met samenhang tussen opeenvolgende metingen: na een zware dag volgt vaak nog een. Een korte of onrustige reeks is daardoor minder snel aantoonbaar, en de Prognose verschijnt minder snel. Bij een schommeling zoals bij gewicht heet een vlakke reeks zo in ongeveer 10% van de gevallen toch aantoonbaar (15% bij twee weken); zonder deze correctie was dat een derde.

Per meting komt de lijn uit de daggemiddelden, zodat twee metingen op één dag niet als twee dagen tellen; de losse metingen blijven punten. Meet wel op vaste momenten: ontbreekt soms de avondmeting, dan trekt een verschil tussen ochtend en avond de lijn alsnog scheef. Metingen op 1 of 2 dagen zijn nooit aantoonbaar; zijn alle daggemiddelden gelijk, dan is de lijn vlak.

### Grenzen rond de lijn

Vanaf 5 punten lopen er grenzen evenwijdig aan de lijn, gebaseerd op de restspreiding s: de spreiding van de punten rond de lijn.

```latex
s = \sqrt{\frac{\sum (y_i - \hat{y}_i)^2}{n-2}}
```

Hier is ŷᵢ de waarde op de lijn bij punt i. Er staat n−2 in de noemer omdat de lijn twee getallen (a en b) uit de data haalt. De oranje grenzen liggen op lijn ± 2s, de rode op lijn ± 3s. Een punt kleurt naar zijn afstand tot de lijn: oranje voorbij 2s, rood voorbij 3s.

### Interpretatie

- **Pijl en helling**: de richting en de snelheid. ↘ −0.30/wk betekent gemiddeld 0.30 per week omlaag.
- **Doorgetrokken of gestreept**: alleen bij een doorgetrokken lijn kun je zeggen dat er echt een trend is.
- **r²** (determinatiecoëfficiënt): welk deel van de schommeling de lijn verklaart. Bij 0,63 komt 63% van de variatie door de trend; de rest is gewone dagelijkse schommeling.
- **Rode punten**: uitschieters ten opzichte van de trend. Een punt dat in de basiskaart normaal lijkt, kan hier opvallen als het niet bij de trend past.
- **Voorzichtig met doortrekken**: de lijn beschrijft de gekozen periode. Een trend van drie weken zegt weinig over volgend jaar.

## ŷ±mR (Regressie XmR)

ŷ±mR is dezelfde trendlijn als hierboven, maar met grenzen die worden berekend zoals bij de XmR-kaart: op basis van de sprong van punt tot punt rond de lijn. De kop is gelijk aan die van de trendkaart. Je kiest hem met de laag XmR bij ŷ±σ, bij elke groepering; per meting zijn de punten de daggemiddelden en gaat het om de sprongen daartussen rond de lijn.

### Berekening

Voor elk punt de afwijking tot de lijn, eᵢ = yᵢ − ŷᵢ. Daarna de gemiddelde sprong in die afwijking:

```latex
\overline{mR}_{\text{lijn}} = \frac{1}{n-1}\sum_{i=2}^{n} |e_i - e_{i-1}|
```

De oranje grenzen liggen op lijn ± 1,77 × m̄R, de rode op lijn ± 2,66 × m̄R: dezelfde factoren als bij de XmR-kaart. Ook hier pas vanaf 5 punten. De punten kleuren naar hun afstand tot de lijn.

### Interpretatie

- De σ-grenzen van de gewone trendkaart worden breder als de punten niet netjes langs een rechte lijn liggen, bijvoorbeeld bij een knik of een plotselinge sprong. De mR-grenzen kijken alleen naar de onrust van dag tot dag, en blijven daardoor smal.
- Zijn de grenzen hier duidelijk smaller dan in de gewone trendkaart, dan past een rechte lijn niet goed: er zit een bocht, een sprong of een periode met een ander tempo in.
- Rode punten hier zijn dagen die niet passen bij zowel de trend als de normale dagelijkse schommeling.

## ŷ→⊙ (Prognose)

De prognose trekt de trendlijn door tot het punt waar hij je doel raakt, en geeft die dag. Heeft de lijn het doel binnen de getoonde periode al gekruist, dan geeft hij de dag waarop dat gebeurde: volgens de trend heb je je doel dan al bereikt. De kop is gelijk aan die van de trendkaart. De datum staat in oudroze onder het ringetje; vlak bij de rand schuift hij naar binnen, zodat hij in beeld blijft. Een datum van de as die daarmee zou botsen, valt weg. Ligt het ringetje voorbij de as (het doel is ver weg), dan staat de datum rechts, met een pijl ervoor.

### Wanneer er een prognose is

De kaart verschijnt alleen als aan alle voorwaarden is voldaan:

1. Je hebt een doel ingesteld.
2. Er is een trendlijn (minstens 3 punten) en die is aantoonbaar.
3. De lijn raakt het doel: voorbij het laatste punt, of al binnen de getoonde periode (tussen het eerste en het laatste punt). Is het doel al vóór het eerste punt gehaald, dan is er geen prognose; kies dan een langere periode.
4. Ligt het doel voorbij het laatste punt, dan wordt het binnen tien jaar bereikt.
5. Ligt het doel voorbij het laatste punt, dan ligt de datum na vandaag (per meting: het moment ligt na nu, dus het kan nog vandaag zijn). Meet je een tijd niet, dan kan die dag al voorbij zijn zonder dat de lijn het weet; dan is er geen prognose.

Verdwijnt de prognose terwijl je hem bekijkt, bijvoorbeeld bij een andere periode, dan springt de app terug naar ŷ±σ. Gaat bij een prognose per meting het moment voorbij terwijl de app openstaat, dan gebeurt dat pas bij de volgende keer dat de grafiek getekend wordt.

### Berekening

De lijn y = a + b · x raakt het doel als y = doel:

```latex
x_{\text{doel}} = \frac{\text{doel} - a}{b}
```

Bij tijd en dag is x in dagen, dus x_doel is direct een datum. Bij groeperen telt de app groepen op de as (zo nodig door na vandaag), en zoekt de dag binnen de groep waarin de lijn het doel raakt. Per dag en per groep wordt de datum naar boven afgerond op een hele dag. Per meting hebben de punten een tijdstip; dan is het de dag waarop het snijpunt valt, en vooruit telt het alleen als dat moment na nu ligt (dus soms nog vandaag). De as loopt bij een prognose vooruit door tot net voorbij het moment waarop de lijn het doel raakt, maar hooguit tot drie keer de getoonde periode. Ligt het doel verder weg, dan loopt de stippellijn de grafiek uit; een brede waaier loopt ook de grafiek uit (de laatste dag staat bij … tot).

De waaier: het bereik van dagen waarop de trendlijn het doel raakt, met ongeveer 95% zekerheid (Fieller). Daarin zit de onzekerheid van de helling (de Marge in het statistiekenvenster) en die van het niveau van de lijn; die laatste telt vooral als het doel dichtbij ligt. Het bereik is scheef: na de verwachte dag ligt meer ruimte dan ervoor. Nooit vóór het laatste punt en nooit in het verleden: per dag vanaf morgen, per meting vanaf vandaag. Per meting uit de daggemiddelden, zoals de lijn zelf. Net als bij de Marge is het bij een sterke samenhang tussen dagen eerder 90% dan 95%. En het gaat over de trendlijn, als de trend recht doorloopt: je eerste meting op het doel komt door de dagelijkse schommeling vaak eerder, en een afvlakkende trend maakt het later. Die onzekerheid zit niet in de waaier.

In de grafiek zie je de lijn door de metingen, een stippellijn vanaf het laatste punt tot het doel, en een lavendel ringetje precies waar hij het doel raakt. Om de stippellijn ligt een lichte oudroze waaier met dunne randen: van het laatste punt op de lijn tot de vroegste en de laatste dag waarop de lijn het doel raakt (zie hieronder), met een oudroze streep op de doellijn tussen die twee dagen. Is het doel al bereikt, dan staat het ringetje op de lijn tussen de metingen en is er geen stippellijn en geen waaier. Er zijn hier geen grenzen en de punten krijgen geen kleur.

### Interpretatie

- De prognose geeft het antwoord op de vraag: wanneer bereik ik mijn doel als het precies zo doorgaat als in de gekozen periode?
- Staat het ringetje tussen de metingen, dan heb je het doel volgens de trend al gehaald, op die dag. Dat geldt ook als de lijn er daarna weer vanaf loopt: de app kijkt alleen of de lijn het doel heeft geraakt, niet in welke richting.
- De waaier en … vanaf / … tot laten zien hoe zeker de datum is. Een smalle waaier: de trend is duidelijk. Een brede: de datum kan flink schuiven. Hoe verder weg, hoe breder.
- Het tempo verandert bijna altijd: een dieet vlakt af, een auto rijdt in de vakantie meer. Gebruik de datum als richting, niet als belofte, en kijk na een paar weken opnieuw.
- Probeer verschillende periodes. Schuift de datum flink als je de periode verandert, dan is de trend niet stabiel.

## Lagen

Rechts onder de grafiek staan zes knoppen. Eerst de grenzen: σ (een klokvorm met twee stippellijnen, standaard aan) en XmR (een lage en een hoge streep met een pijl ertussen: de sprong, standaard uit). Ze sluiten elkaar uit: een tik op de ene zet de andere aan. Een tik op XmR als die aan staat zet σ terug; een tik op σ als die aan staat zet de grenzen uit (dan heten de kaarten x̄ en ŷ). Dan het doel (een roos, standaard aan). Dan wat je kunt toevoegen en standaard uit staat: de run-regels (vier losse puntjes boven een lijn) en vorig jaar (een kalender met −1). Als laatste de notities (een briefje), standaard aan. Een tik zet een laag aan of uit; turquoise is aan, grijs is uit. Zo zie je altijd hoe de lagen staan. Met het toetsenbord zitten de knoppen gewoon in de tabvolgorde; Enter of Spatie schakelt. Het tikbare vlak van elke knop is 44 px hoog, ook al ziet de knop er kleiner uit. Ook de stipjes met de naam zijn een knop: een tik gaat naar de volgende weergave. De grafiek zelf zit ook in de tabvolgorde: met ← en → wissel je van weergave, Enter opent het statistiekenvenster. Een laag die bij de kaart niet kan, is uitgegrijsd, en een tik erop zegt waarom (bijvoorbeeld ‘Deze bron heeft geen doel’); bij Prognose kan alleen de laag Notities (de knop Doel staat daar uitgegrijsd aan, want het doel is er altijd). XmR kan bij elke groepering; bij de Range-kaart zet de XmR-knop de grenzen van die kaart aan of uit (de schermlezer noemt hem daar ‘Grenzen van de Range-kaart’), en is σ uitgegrijsd. Elke laag wordt per bron en per kaart onthouden, ook XmR: x̄, Range en ŷ hebben elk hun eigen keuze. Bij een teller als de km-stand kun je zo de grenzen bij x̄±σ uitzetten en bij ŷ±σ laten staan. Verwijder je een bron, dan vervallen ook zijn keuzes voor de lagen. Wijkt de weergave af van die waarmee de bron opent (een andere periode of groepering, of de grafiek verborgen; een andere kaart telt niet, want daar veeg je zo naartoe), dan staat rechts naast de bronkeuze een knop met een pijl terug (een gebogen pijl naar links, anders dan Vernieuwen). Een tik zet de standaardperiode en -groepering van de bron terug en de kaart op x̄. De lagen, ook σ of XmR, blijven zoals je ze per kaart hebt gekozen, en ook de instellingen van de bron, de metingen en de notities blijven zoals ze zijn.

Op een smal scherm komt rechts een knop ⋯ en gaan de laatste laagknoppen naar een menu dat omhoog opent, met per laag of hij aan of uit staat; een keuze daarin werkt als een tik op de knop zelf, en een tik ernaast, Escape of de terugknop sluit het menu. De ⋯ is turquoise als een laag in het menu aan staat. Op een gewone telefoon (vanaf ongeveer 320 px breed) komt het menu niet voor.

### Grenzen

De rode en oranje regelgrenzen (bij x̄ en Range) en de grenzen rond de lijn (bij ŷ), volgens σ of volgens XmR. Zet je ze uit (een tik op de knop die aan staat), dan verdwijnen ook de rode en oranje kleur van de stippen en van de waarden in de tabel, en bepalen de metingen de schaal van de as (en het doel en vorig jaar, als die aan staan). De middellijn en de run-regels blijven. Niet bij Prognose, waar geen grenzen zijn; bij Range zet de XmR-knop de grenzen van Range aan of uit (σ is daar uitgegrijsd). In het statistiekenvenster blijven de σ-grenzen staan.

### Doel

De doellijn, het doelbereik en het doelgetal op de as. Zolang de laag aan staat, reikt de as tot het doel, ook bij een doel zonder bereik. Zet je het uit, dan hoeft de as niet meer tot het doel te reiken en zoomt de grafiek in op je metingen. Alleen als de bron een doel heeft (haal je het doel weg, dan vervalt ook deze keuze); niet bij Range (daar is geen doel) en niet bij Prognose, waar de lijn naar het doel loopt en het doel dus altijd te zien is. In het statistiekenvenster blijven de getallen staan.

### Run-regels

Ook zonder punt buiten de grenzen kan er iets veranderd zijn. NHS *Making Data Count* noemt een reeks van zes à zeven punten als omslagpunt; Trends gebruikt:

- **Verschuiving**: 7 of meer punten op rij aan één kant van de middellijn.
- **Trend**: 6 of meer punten op rij die steeds hoger of steeds lager liggen.
- **Twee van drie**: twee van drie opeenvolgende punten voorbij de oranje grens, aan dezelfde kant (een punt voorbij rood telt mee). De oranje grens is 2σ, bij XmR 1,77 × m̄R, en bij ŷ±σ en ŷ±mR de oranje grens rond de lijn (2s of 1,77 × m̄R). Zonder grenzen telt de 2σ-grens die je dan niet ziet. Overlappende drietallen aan dezelfde kant tellen één keer. Niet bij Range en Prognose, die geen oranje grens hebben. Hoe vaak hij zonder echte verandering verschijnt, hangt ervan af hoe goed σ bekend is: bij 50 punten, met σ uit diezelfde punten, ongeveer één keer op de 15 à 20 reeksen.

Een punt precies op de lijn telt niet mee en breekt de reeks niet (zoals Anhøj); een punt gelijk aan het vorige telt bij een trend ook niet mee (zoals IHI en NHS *Making Data Count*). Per meting rekenen de run-regels op de daggemiddelden, zoals de lijn: twee metingen op een dag zijn geen twee losse punten, en anders gaven ze veel te vaak een melding. De metingen van een dag in een reeks worden allebei geel, en de strepen en labels gaan over dagen. Zo houdt een afgeronde meting een reeks niet tegen. De middellijn is x̄, of bij ŷ±σ de regressielijn: dan telt de afstand tot de lijn, en is een daling die de lijn volgt geen trend. Kan bij x̄ en ŷ, met σ, met XmR of zonder grenzen.

In de grafiek worden die punten geel (rood en oranje blijven), bij een verschuiving ook de middellijn met het aantal en de kant (*7 < x̄*: zeven punten onder de middellijn, *9 > ŷ*: negen boven de trendlijn), bij een trend de lijn tussen de punten met de richting en het aantal (*↘ 6*). Het aantal is wat de regel telt: punten precies op de lijn en gelijke waarden tellen niet mee. Bij twee van drie staat er een gele haak over de punten die echt voorbij de oranje grens liggen, aan hun kant (die punten blijven oranje of rood), met het echte aantal: *2 van 3*, *3 van 3*, en als drietallen overlappen bijvoorbeeld *4 van 4* of *3 van 5* (zoveel punten voorbij oranje onder de haak, van zoveel punten). Labels die elkaar raken vallen weg. In de tabel zijn dezelfde waarden geel.

Een verschuiving wijst op een ander niveau (een nieuwe gewoonte, een ander meetmoment); ligt hij aan het eind, kies dan een kortere periode. Het is een aanwijzing, geen bewijs: met veel punten vind je bij toeval af en toe een reeks. In een simulatie met 50 punten zonder enige verandering gaf een verschuiving in ongeveer een kwart van de reeksen toch een melding, een trend in ongeveer 11% en twee van drie in ongeveer 6%; minstens één van de drie in ongeveer 1 op de 3 reeksen. Hangen opeenvolgende metingen samen, zoals bij gewicht, dan meestal wel: bij een samenhang van 0,5 gaf een verschuiving in ongeveer 80% van de reeksen een melding.

### Vorig jaar

Dezelfde periode een jaar eerder, als lichte stippellijn onder je metingen, gegroepeerd zoals nu (een week van vorig jaar valt in dezelfde week van nu). De schaal loopt mee, maar vorig jaar telt niet mee in de berekeningen; het venster toont het gemiddelde van vorig jaar met het aantal punten. Kan bij x̄ en ŷ (ook met XmR), bij een periode tot 1 jaar (een eigen periode tot ongeveer 13 maanden), niet per jaar. Bij Alles zou vorig jaar je hele reeks een jaar opgeschoven zijn, zonder iets om mee te vergelijken; daar is de knop uitgegrijsd. Per dag en per meting valt 29 februari weg; de lijn loopt daar gewoon door.

Bij ŷ±σ komt er ook de trendlijn van vorig jaar bij, als je in die periode vorig jaar minstens 10 keer hebt gemeten, verspreid over minstens ongeveer 3 maanden: een doorgetrokken lijn in dezelfde lichtblauwe kleur, berekend zoals de lijn van nu. Het label noemt de helling, bijvoorbeeld ‘vorig jaar −0.01/wk’, met ‘(?)’ als die helling niet aantoonbaar is. Zo vergelijk je de helling in de kop met die van dezelfde periode vorig jaar. Met minder metingen of over een kortere tijd zegt zo'n lijn te weinig en blijft alleen de stippellijn.

### Notities

Elk moment met een notitie krijgt een dun lichtgrijs stippellijntje van boven naar beneden, met een driehoekje bovenaan. Zo zie je waar iets gebeurde, bijvoorbeeld een vakantie of een nieuwe weegschaal, en of de metingen daarna anders liggen. Het lijntje staat op de echte datum, ook als de punten per week of maand gegroepeerd zijn (een notitie midden in een week staat dus tussen twee weekpunten); per meting ook op het tijdstip. Twee notities op hetzelfde moment geven één lijntje. De notitie zelf lees je in de tabel onder de grafiek: een rij met een notitie heeft een lichtgrijs hoekje linksboven, in de kleur van de driehoekjes, en als je de rij kiest, staat de notitie eronder. Bij week, maand, kwartaal of jaar krijgt een rij het hoekje als er in die periode een notitie valt; gekozen staan alle notities van die periode eronder, elk met de datum ervoor. Bij Tijd staat een tijdstip met alleen een notitie als eigen rij, met een streepje. Bij de periode Alles lopen de tabel en de grafiek met de laag aan door tot en met een notitie vóór de eerste of na de laatste meting. Een dag (of week, maand) met alleen een notitie valt net als andere lege dagen in een samengevouwen reeks ‘⋯ 3 dagen ⋯’; die regel krijgt dan het hoekje, en uitgevouwen staat de dag er met zijn eigen hoekje. Staat de laag uit, dan zijn ook de hoekjes, de regel onder een gekozen rij en de rijen voor een tijdstip met alleen een notitie weg, net zoals de tabel de laag Grenzen volgt. De notitie blijft gewoon te lezen en te bewerken in het meting-venster. Wissen gaat in dat venster: het kruisje (Geen notitie) maakt het notitieveld leeg, het streepje (Geen meting) haalt de waarde weg, het pijltje ernaast zet het veld terug zoals het bij het openen was, en pas Opslaan voert het uit. Een tik op de grafiek opent zoals altijd het statistiekenvenster. Notities tellen nergens in mee. Kan bij elke kaart, ook Range en Prognose: een notitie is een moment in de tijd, geen waarde.

## Statistiekenvenster

Het venster opent na een tik op de grafiek. In de kop staan de naam van de weergave, in de kleur van de kaart, en rechts het totale aantal metingen in het bestand (los van periode en groepering). Past het venster niet op het scherm, dan blijven de kop, de tabs en Sluiten staan en scrolt alleen de tabel ertussen; zolang er nog regels onder staan, vervaagt de onderrand. Het venster is voor elke tab even hoog. Bij x̄±σ, x̄±mR en Range zie je de tabs Statistieken en Kaart; bij de drie trendweergaven de tabs Statistieken en Regressie, en dan staat Regressie open. Bij x̄±σ en x̄±mR komen daar de tabs Week en Jaar bij; een tab die niet kan, is grijs, en een tik erop toont kort waarom. Een streepje (–) betekent: niet te berekenen met deze punten. De waarden en grenzen in het venster hebben hooguit zeven cijfers: bij grote waarden, zoals een teller rond 1.234.567, toont het venster minder decimalen dan de bron (rond 123.456 één minder, vanaf een miljoen geen). Het grootste getal dat in het venster staat bepaalt dat, voor al die waarden gelijk; waarden onder 1 houden de decimalen van de bron. De helling, r en de som (Σ) hebben eigen decimalen; de som kan langer zijn. Een waarde heeft de kleur van de lijn waar hij bij hoort in de grafiek; een streepje is altijd wit.

### Tab Statistieken

Alles gaat over de punten in de gekozen periode en groepering. In de Range-kaart gaat het over de sprongen in plaats van de punten.

| Regel | Berekening | Interpretatie |
| --- | --- | --- |
| n | punten met een waarde / plekken in de periode | Bij dag: 18 / 30 betekent 18 van de 30 dagen gemeten. Bij week of maand gaat het om groepen; bij tijd zijn beide getallen gelijk. In de Range-kaart staat er steeds één minder, omdat het om sprongen gaat. |
| x̄ (in de Range-kaart: m̄R) | gemiddelde van de punten (of de sprongen) | Het niveau waarop je zit; de turquoise lijn. In de trendweergaven staat die lijn er niet, en is x̄ wit. |
| σₙ₋₁ | standaardafwijking met n−1 in de noemer | Hoe ver de punten gemiddeld van x̄ liggen, met grote afwijkingen zwaarder gewogen. Bevat ook een eventuele trend. |
| m̄R | gemiddelde sprong \|xᵢ − xᵢ₋₁\|; per meting tussen de daggemiddelden | De onrust van punt tot punt. m̄R / 1,128 is een schatting van σ zonder de trend: is die veel kleiner dan σₙ₋₁, dan zit er een trend of een sprong in. Staat er niet bij Range, want daar is m̄R al de tweede regel. |
| \|x − x̄\| | gemiddelde absolute afwijking: (1/n) Σ \|xᵢ − x̄\| | De gemiddelde afstand tot het gemiddelde, in gewone eenheden. Minder gevoelig voor uitschieters dan σ; bij een normale verdeling ongeveer 0,8 × σ. |
| Σ | som van de punten | Zinvol bij optelbare grootheden, zoals kilometers per dag. Bij gewicht zegt het weinig. |
| Min | kleinste punt | De laagste waarde in de periode (bij groeperen het laagste groepsgemiddelde). |
| Max | grootste punt | De hoogste waarde in de periode. |
| x̄ vorig jaar | gemiddelde van dezelfde periode een jaar eerder, met tussen haakjes het aantal punten | Alleen met de laag vorig jaar aan. Vergelijk met x̄. |

### Tab Kaart

De grenzen en het doel, met tussen haakjes de formule die bij deze weergave hoort.

| Regel | x̄±σ | x̄±mR | Range | Interpretatie |
| --- | --- | --- | --- | --- |
| UCL (bovenste regelgrens) | x̄ + 3σ | x̄ + 2,66 × m̄R | 3,267 × m̄R | De rode lijn boven. Een punt daarboven is een signaal. |
| UWL (bovenste waarschuwingsgrens) | x̄ + 2σ | x̄ + 1,77 × m̄R | – | De oranje lijn boven. Punten daarboven: opletten. |
| LWL (onderste waarschuwingsgrens) | x̄ − 2σ | x̄ − 1,77 × m̄R | – | De oranje lijn onder. |
| LCL (onderste regelgrens) | x̄ − 3σ | x̄ − 2,66 × m̄R | 0 | De rode lijn onder. Kan negatief zijn; dat is een rekengrens, geen echte waarde. |
| Doel | het ingestelde doel | idem | – | De lavendel streeplijn: waar je naartoe wilt. |
| Doel·bereik | het ingestelde bereik | idem | – | De totale breedte van de doelband. |
| Doel·max | doel + bereik / 2 | idem | – | De bovenkant van de doelband. |
| Doel·min | doel − bereik / 2 | idem | – | De onderkant van de doelband. |
| ≥7 < of > x̄ | aantal verschuivingen (7 of meer punten onder of boven x̄) | idem | – | Alleen met de run-regels aan. Geel als er een is. |
| ≥6 ↗ of ↘ | aantal trends (6 of meer punten steeds hoger of lager) | idem | – | Alleen met de run-regels aan. Geel als er een is. |
| 2 van 3 oranje | aantal keer twee van drie voorbij de oranje grens | idem | – | Alleen met de run-regels aan. Geel als er een is. |

Vergelijk de grenzen met de doelband. Ligt de band ruim binnen UWL en LWL, dan valt een flink deel van je metingen erbuiten door gewone schommeling, ook als het gemiddelde op het doel ligt. Ligt de band om de grenzen heen, dan blijf je er bij normale schommeling vrijwel altijd binnen.

### Tab Regressie

Alleen bij ŷ±σ, ŷ±mR en Prognose.

| Regel | Berekening | Interpretatie |
| --- | --- | --- |
| n | als in de tab Statistieken | Het aantal punten waar de lijn doorheen gaat. |
| Helling | b, omgerekend naar per week (tijd, dag) of per groep | Het tempo: +0,25 / wk is gemiddeld een kwart per week omhoog. Bij een aantoonbare maar kleine helling krijgt het getal extra decimalen, zodat er geen 0,0 staat. |
| Marge | ± t × de standaardfout van de helling; die standaardfout is s / √Σ(xᵢ − x̄)² × √((1 + ρ) / (1 − ρ)), en t hoort bij 95% en n−2 vrijheidsgraden. ρ is de samenhang tussen opeenvolgende afwijkingen van de lijn, met een correctie omdat hij bij weinig punten te laag uitvalt (ρ + (2 + 3ρ)/n, tussen 0 en 0,95; bij 3 of 4 punten 0). Per meting: berekend op de daggemiddelden; liggen de metingen op 1 of 2 dagen of zijn alle daggemiddelden gelijk, dan een streepje | De echte helling ligt met ongeveer 95% zekerheid tussen helling − marge en helling + marge: het 95%-betrouwbaarheidsinterval. Bij sterke samenhang tussen dagen is dat in de simulatie eerder 90% (bij een maand dagmetingen) tot 85% (bij één à twee weken). Valt nul daarbinnen, dan is de trend niet aantoonbaar (gestreepte lijn, vraagteken). Meer punten, een langere periode en minder schommeling maken de marge kleiner. |
| Δ | lijn eind − lijn begin | De totale verandering volgens de trend over de periode, zonder de toevallige eerste en laatste meting. |
| Lijn begin | de waarde op de lijn bij het eerste punt | Waar je volgens de trend begon. |
| Lijn eind | de waarde op de lijn bij het laatste punt | Waar je volgens de trend nu staat; vaak betrouwbaarder dan de laatste losse meting. |
| r en r² | r = correlatiecoëfficiënt: Σ(xᵢ−x̄)(yᵢ−ȳ) / √(Σ(xᵢ−x̄)² · Σ(yᵢ−ȳ)²); r² = r × r (determinatiecoëfficiënt). Per meting over de daggemiddelden: dan kan r² hoog zijn terwijl de losse punten ruim spreiden | Elk op een eigen regel, bijvoorbeeld r −0.80 en r² 0.63. r loopt van −1 tot +1: het teken is de richting, de grootte hoe strak de punten langs de lijn liggen; rond 0 is er geen rechte-lijnverband. r² is het deel van de schommeling dat de lijn verklaart: bij 0,80 bepaalt de trend het beeld, bij 0,10 overheerst de dagelijkse schommeling, ook als de trend wel aantoonbaar is. |
| σ rond lijn (ŷ±σ) | s = √(Σ(yᵢ − ŷᵢ)² / (n−2)); per meting de losse metingen rond de lijn uit de daggemiddelden | De normale afwijking van de trend, in gewone eenheden. |
| Lijn ± 3σ (ŷ±σ) | ± 3s | De afstand van de rode grenzen tot de lijn. |
| Lijn ± 2σ (ŷ±σ) | ± 2s | De afstand van de oranje grenzen tot de lijn. |
| m̄R rond lijn (ŷ±mR) | gemiddelde sprong in de afwijking tot de lijn | De onrust van dag tot dag rond de trend. |
| Lijn ± 2,66m̄R (ŷ±mR) | ± 2,66 × m̄R | De afstand van de rode grenzen tot de lijn. |
| Lijn ± 1,77m̄R (ŷ±mR) | ± 1,77 × m̄R | De afstand van de oranje grenzen tot de lijn. |
| Vorig jaar | de helling van de trendlijn van vorig jaar, met ‘(?)’ als hij niet aantoonbaar is | Alleen met de laag vorig jaar aan; een streepje als vorig jaar minder dan 10 metingen heeft, als die samen minder dan ongeveer 3 maanden beslaan, of als alle waarden van vorig jaar gelijk zijn. |
| ≥7 < of > ŷ | aantal verschuivingen rond de lijn | Alleen met de run-regels aan, en niet in de Prognose. Geel als er een is. |
| ≥6 ↗ of ↘ | aantal trends in de afstand tot de lijn | Idem. |
| 2 van 3 oranje | aantal keer twee van drie voorbij de oranje grens rond de lijn | Idem. |
| Doel | het ingestelde doel | Ter vergelijking met lijn eind. |
| … bereikt | de dag waarop de lijn het doel raakt | Staat er alleen als er een prognose is (zie Prognose); anders een streepje. Staat het ringetje tussen je metingen, dan heb je het doel volgens de trend al gehaald, op die dag. Staat het voorbij je laatste meting, dan is het een verwachting, ook als die dag vandaag is. Het is een schatting, geen belofte. |
| … vanaf | de vroegste dag van de waaier (ongeveer 95%) | Alleen bij een prognose die nog moet komen; anders een streepje. |
| … tot | de laatste dag van de waaier; verder dan tien jaar: > 10 jaar | Idem. |

In de Prognose staan de regels over grenzen niet, omdat daar geen grenzen worden getekend.

**Een voorbeeld.** Helling −0.30 / wk, marge ± 0.12, r² = 0.55: je daalt aantoonbaar, ergens tussen 0.18 en 0.42 per week. Ruim de helft van de schommeling komt door die daling, de rest is gewone variatie van dag tot dag.

### Tabs Week en Jaar

Zit je op sommige weekdagen (Week) of in sommige maanden (Jaar) structureel hoger of lager? Alleen bij x̄±σ en x̄±mR; de uitkomst hangt niet af van de weergave. Week kan per dag en per meting, vanaf 14 dagen met metingen. Jaar kan als elke maand minstens twee keer heel in de periode ligt, met metingen: in de praktijk iets meer dan twee jaar (periode Alles of een eigen periode), want met minder zijn seizoen en trend niet uit elkaar te halen. Kan een tab niet, dan is hij grijs; een tik erop toont kort waarom. Per meting eerst per dag gemiddeld. Bij Jaar tellen alleen hele maanden mee, elke maand van elk jaar één keer; bij één meting per maand vallen de eerste en de laatste maand dus weg. Afwijkingen met de decimalen van de bron.

Per rij een balkje en de afwijking, in twee stappen. Stap 1: per weekdag (of maand) hoeveel je gemiddeld boven of onder de trendlijn door de daggemiddelden zit, zodat een daling of stijging niet meetelt (te weinig dagen voor een lijn: van x̄). Stap 2: alle afwijkingen worden verschoven zodat de middelste van de zeven (of twaalf) op 0 komt. De tabel zegt dus hoeveel zwaarder of lichter je bent dan op een gewone weekdag (of in een gewone maand); welke dag op 0 staat, is de middelste en verschilt per periode. Waarom: is alleen het weekend 0,3 zwaarder, dan ligt de trendlijn, die ook door de weekenden loopt, ongeveer 0,1 te hoog voor een gewone dag (2/7 × 0,3). Zonder stap 2 staan maandag tot en met vrijdag dan op −0,1 en kunnen ze ten onrechte kleuren, en lijkt het weekend maar +0,2. Met stap 2 staan maandag tot en met vrijdag op 0 en het weekend op +0,3. De verschillen tussen de dagen blijven gelijk.

Een gekleurd balkje (kleur van de kaart) valt buiten de gewone schommeling, een grijs balkje erbinnen. De grens is t × s / √m, met s de spreiding binnen de weekdagen of maanden (hoe verschillend bijvoorbeeld de januari's onderling zijn) en m het kleinste aantal keren dat er een voorkomt. Omdat 7 of 12 rijen tegelijk getoetst worden, is t strenger dan bij 95%: bij alleen toeval kleurt er in ongeveer 1 op de 20 tabellen een rij. Komt een weekdag minder dan twee keer voor (of nooit, zoals nooit op zondag gemeten), dan is er geen grens en is alles grijs.

## Een meting invoeren

Dit hoofdstuk gaat niet over de grafieken, maar over twee getallen die Trends voor je uitrekent als je een meting toevoegt of bewerkt.

### De voorgestelde waarde

Bij een nieuwe meting staat er al een waarde in het veld, met de cursor erachter: de waarde van die dag als die er al is (bij meer metingen per dag het daggemiddelde, zoals in de tabel), anders de laatste losse meting vóór die dag. Zo pas je met een paar keer backspace alleen de laatste cijfers aan. Is er nog geen enkele meting, dan is het veld leeg. Met het kruisje rechts in het veld haal je de waarde in één tik weg; het streepje boven het veld betekent iets anders: bewust geen meting.

### De vraag "Klopt dit?"

Wijkt een waarde veel af van de vorige meting, dan vraagt Trends of het klopt voordat hij opslaat. Zo vang je een tikfout als 8.2 in plaats van 82.4. De grens is 5 × m̄R: vijf keer het gemiddelde verschil tussen opeenvolgende losse metingen, berekend zoals m̄R bij de XmR-kaart, maar over de laatste 30 verschillen vóór het nieuwe tijdstip. Zo telt alleen de recente onrust, los van de periode die de grafiek toont. De meting die je bewerkt telt niet mee, en de vorige meting is de laatste meting vóór het nieuwe tijdstip.

Voorbeeld: bij gewicht met een m̄R van 0,4 kg ligt de grens op 2 kg. Van 82.4 naar 8.2 wordt gevraagd, van 82.4 naar 81.9 niet. Bij een kilometerstand ligt de grens veel hoger, maar na een lange rit kun je de vraag krijgen; dan tik je op Toch opslaan. Staan er minder dan 5 metingen vóór het nieuwe tijdstip, of zijn die allemaal gelijk (m̄R = 0), dan vraagt Trends niets. Een waarde die je al eens met Toch opslaan bewaarde, wordt bij het bewerken van alleen de notitie niet opnieuw gevraagd.
