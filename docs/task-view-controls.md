# Taakweergave — collapse en prioriteit

Featurebranch task-view-controls, gebaseerd op stabiele v0.7. Geen nieuwe
persistente velden, geen schemawijziging en geen wijziging van de task-engine.

## Alles inklappen/uitklappen

De knop naast Taken past de bestaande collapsedTaskIds-Set toe op alle taken van
het huidige project die beschrijving, bronnen of children hebben. Dit omvat
verborgen/deep descendants. Zijn die allemaal ingeklapt, dan wordt de actie
Alles uitklappen; in een gemengde toestand blijft de actie Alles inklappen.
Individuele toggles blijven onafhankelijk werken en actualiseren de knoptekst.
Andere projecten worden niet gewijzigd; bij een lege/detailsloze lijst is de
knop disabled. Collapse blijft bestaande tijdelijke UI-state.

## Sorteerweergave

Handmatige volgorde is standaard. Prioriteit hoog → laag sorteert een verse
renderarray per project/parent volgens high, normal, low. Gelijke prioriteit
behoudt de handmatige siblingvolgorde door stable sort. Geen taskrecord,
parentrelatie, status, sortOrder of localStorage wordt geschreven.

Bij prioriteit zijn de sleephendels en Omhoog/Omlaag in het menu disabled.
Tooltip en een korte zichtbare uitleg wijzen naar Handmatige volgorde. De
UI-reorderwrapper en dragstart/drop hebben ook een guard; een actieve drag wordt
geannuleerd wanneer de weergave wisselt. reorderTask blijft ongewijzigd.

Terugschakelen toont direct de opgeslagen volgorde. Reload reset de sorteerkeuze
naar Handmatige volgorde. Deze keuze is alleen voor de projecttaakboom; Home,
de algemene open-takenlijst en export blijven de bestaande handmatige volgorde
gebruiken. Er is geen tweede persistent sorteersysteem.

## Verificatie — 7 oktober 2026

tests/task-view.cjs controleert recursive collapse, individuele/deep toggles,
high/normal/low, gelijke prioriteit na eerdere handmatige reorder, isolatie per
parent, onveranderde volledige state en localStorage, disabled reorder, exacte
terugkeer naar handmatige volgorde, nieuwe reorder en reload, lege lijst en
320/375/1280 px zonder horizontale overflow. Edge 154.0.4258.62/Playwright.

De bestaande 87 domeintests en vijf browserregressiesuites worden aanvullend
uitgevoerd, waaronder echte muis- en gesimuleerde touch-drag, taakstatusmatrix,
bronhistoriek en import/export. Geen echte gsm/cross-browserverificatie geclaimd.
