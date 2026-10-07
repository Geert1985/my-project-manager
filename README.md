# My Projects

Een mobiele, generieke project- en checklistwebapp met controle- en reviewfunctionaliteit.

## v0.7

- taken omhoog/omlaag verplaatsen binnen hetzelfde project en dezelfde parent
- slepen met muis of touch via de sleephendel; pijlen en slepen gebruiken dezelfde reorderfunctie
- een parent verplaatsen neemt de volledige subtaakboom mee
- nieuwe taken verschijnen achteraan binnen hun eigen niveau
- volgorde blijft bewaard na herladen
- migratie naar schemaVersion 5 bewaart de bestaande volgorde en historische gegevens
- compacte knoppen met toetsenbordbediening en begrenzing aan begin/einde
- slepen is de primaire reorderbediening; bron toevoegen, omhoog/omlaag en verwijderen staan in het ⋮-menu
- inline + uitsluitend voor de eerste subtaak; volgende subtaken via de knop onder de childlijst
- bronkaarten tonen beschrijving, links en versiegebonden bestandsinformatie/notities; veilig bronmetadata bewerken
- afzonderlijke projecten importeren/exporteren als stabiel JSON-formaat, inclusief optionele historische controles
- taak toevoegen onderaan de hoofdtakenlijst en subtaak toevoegen onderaan iedere bestaande childlijst

Zie `docs/v0.7-audit.md` voor de definitieve releasecontrole en testscope.

## v0.6

- inklapbare taken en subtaken met status en aantallen
- compacte taakacties en verbeterde mobiele hiërarchie
- behoud van inklapstatus en toetsenbordfocus bij taakacties
- veilige bronverwijdering; taken en projecten met controles zijn beschermd
- vier klikbare dashboardfilters met zichtbare selectie
- expliciet heropenen van een parent volgens de task-statusmatrix
- regressietests voor status, historische integriteit, migratie en browserinteracties

## v0.5

- inklapbare protocolkaarten met compacte samenvatting
- protocolversies nieuwste-eerst in de interface
- inklapbare bronkaarten binnen taken
- bronversies nieuwste-eerst in de interface
- expliciete taakstatusbadges en duidelijkere subtaakhiërarchie
- consistente dialogen, knoppen, focusstates en lege toestanden
- schaalbaarheids- en regressietests afgerond
- historische integriteit van v0.4 behouden

## v0.4

- versiebeheer voor controleprotocollen
- draft → active → retired lifecycle
- checks gekoppeld aan een concrete protocolversie
- immutable gebruikte protocolversies en controlepunten
- historische reproduceerbaarheid van controles en reviews

## v0.3

- controleprotocollen en controlepunten
- bronversies en reproduceerbare checks
- reviewworkflow
- controle- en reviewdashboard
- statusindicatoren en navigatie naar controlehistoriek

## v0.1

- projecten aanmaken
- taken en subtaken aanmaken
- taken afvinken
- automatische parent/subtask-statuslogica
- voortgang berekenen
- lokale opslag via localStorage
- responsive voor gsm en desktop

## Lokaal starten

Open `index.html` in een moderne browser.

Voor GitHub Pages kan de repository rechtstreeks als statische website gepubliceerd worden.

## Versie

De stabiele release is **0.7**, gemarkeerd met tag `v0.7`. De task-statusmatrix staat in `docs/task-status-matrix.md`.

## Toekomst

Na v0.7 beoordelen we of de checklistapp functioneel af is. Een uitgebreidere projectmanager met planning en Gantt wordt een afzonderlijk project.

## Verwijderen en historische integriteit

Een bron met gekoppelde controles kan niet worden verwijderd. Een taakboom of project met controles kan evenmin worden verwijderd. De bescherming geldt ook voor nog niet gestarte controles en voor controles op onderliggende bronversies. Ongebruikte taken en projecten worden met hun bronnen en bronversies verwijderd. Checks, resultaten en reviews worden nooit door deze acties verwijderd.

## Tests

Met Node.js 22 of nieuwer: `node tests/release.cjs`, `node tests/task-order.cjs` en `node tests/interchange.cjs`.

De browserregressietests gebruiken Playwright en een geïnstalleerde Microsoft Edge: `node tests/browser.cjs`, `node tests/drag.cjs`, `node tests/menu.cjs` en `node tests/sources.cjs`. Installeer Playwright in je testomgeving of zet `PLAYWRIGHT_MODULE` naar het beschikbare Playwright-modulepad. De tests gebruiken een tijdelijk browserprofiel; bestaande browserdata worden niet gebruikt.

Zie `docs/source-information.md` voor het bronmodel en de bewerkgrenzen. Beschrijvende bronmetadata kan worden bewerkt; de bron-URL is vergrendeld zodra een check naar een versie verwijst. Bestaande bronversies blijven ongewijzigd.

## Project importeren/exporteren

Gebruik **Project importeren** op Home om een JSON-bestand als nieuw project toe te voegen. Bij een project staat **Project exporteren** voor een download/back-up van uitsluitend dat project. Import maakt altijd nieuwe IDs, ook wanneer het origineel al bestaat. Een fout bestand of mislukte opslag wijzigt bestaande projecten niet.

Het publieke formaat en voorbeelden voor ChatGPT staan in `docs/project-interchange-format.md`. Geneste tasks/children bepalen hiërarchie en volgorde; simpele checklists hebben geen refs nodig. Checks/reviews kunnen als optionele historische secties worden meegenomen. Globale protocoltemplates buiten de gebruikte historische versies worden niet geëxporteerd.

Gebruik `node tests/interchange-browser.cjs` voor bestandskiezer/download/refresh-tests met Playwright en Edge.

Zie `docs/v0.6-audit.md` voor de v0.6-releasecontrole en `docs/v0.7-task-order.md` voor v0.7. Opslag migreert in v0.7 naar schemaVersion 5 onder de bestaande localStorage-key; wijzig die key niet bij een release.
