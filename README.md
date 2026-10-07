# My Projects

Een mobiele, generieke project- en checklistwebapp met controle- en reviewfunctionaliteit.

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

De releasekandidaat op `v0.6-ux` is **0.6**. De task-statusmatrix staat in `docs/task-status-matrix.md`.

## Toekomst

Voor v0.7 is handmatig wijzigen van de taakvolgorde voorzien. Een uitgebreidere projectmanager met planning en Gantt wordt een afzonderlijk project.

## Verwijderen en historische integriteit

Een bron met gekoppelde controles kan niet worden verwijderd. Een taakboom of project met controles kan evenmin worden verwijderd. De bescherming geldt ook voor nog niet gestarte controles en voor controles op onderliggende bronversies. Ongebruikte taken en projecten worden met hun bronnen en bronversies verwijderd. Checks, resultaten en reviews worden nooit door deze acties verwijderd.

## Tests

Met Node.js 22 of nieuwer: `node tests/release.cjs`.

De browserregressietest gebruikt Playwright en een geïnstalleerde Microsoft Edge: `node tests/browser.cjs`. Installeer Playwright in je testomgeving of zet `PLAYWRIGHT_MODULE` naar het beschikbare Playwright-modulepad. De test gebruikt een tijdelijk browserprofiel; bestaande browserdata worden niet gebruikt.

Zie `docs/v0.6-audit.md` voor de releasecontrole. Opslag blijft schemaVersion 4 onder de bestaande localStorage-key; wijzig die key niet bij een release.
