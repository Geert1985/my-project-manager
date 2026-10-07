# My Projects — task-statusmatrix

## Doel

Deze matrix definieert het verwachte gedrag van taken en subtaken. Iedere toekomstige wijziging aan de task-engine moet deze gevallen behouden.

## Statussen

| Status | Betekenis |
|---|---|
| `not_started` | Geen werk gestart |
| `in_progress` | Werk is bezig |
| `completed` | Werk voltooid |

Daarnaast heeft iedere task `completionMode`:
- `manual`
- `automatic`

## Acceptatietests

| # | Actie | Verwacht resultaat |
|---|---|---|
| 1 | Nieuwe taak maken | Taak = `not_started` |
| 2 | Parent met 2 open subtaken, eerste subtaak voltooien | Parent = `in_progress` |
| 3 | Laatste open subtaak voltooien | Parent = `completed`, automatisch |
| 4 | Automatisch voltooide parent: subtaak heropenen | Parent = `in_progress`, automatisch |
| 5 | Parent handmatig voltooien met open subtaken | Parent + alle descendants = `completed`, handmatig |
| 6 | Handmatig voltooide parent: bestaande subtaak wijzigen | Parent blijft `completed` |
| 7 | Handmatig voltooide parent zelf heropenen | Parent = `in_progress` als er voltooide subtaken zijn, anders `not_started` |
| 8 | Nieuwe subtaak toevoegen aan voltooide parent | Nieuwe subtaak = `not_started`; parent = `in_progress` |
| 9 | Subtaak verwijderen terwijl parent daardoor geen kinderen meer heeft | Parent behoudt zijn eigen expliciete status |
| 10 | Subtaak verwijderen waardoor alle resterende subtaken voltooid zijn | Parent = `completed` indien automatische voltooiing van toepassing is |
| 11 | Wijziging op diep niveau (A → B → C) | Alle relevante ancestors worden correct herberekend |
| 12 | Project bevat geen taken | Projectvoortgang = 0% |
| 13 | Alle taken in project voltooid | Projectvoortgang = 100% |
| 14 | Een project bevat zowel open als voltooide taken | Percentage wordt correct berekend |

## Belangrijke semantiek

### Handmatig voltooide parent

Een handmatig voltooide parent betekent: de gebruiker beschouwt het volledige werkpakket als afgerond. Daarom worden alle descendants voltooid.

Bestaande subtaken kunnen de parent daarna niet automatisch heropenen.

**Uitzondering:** wanneer een nieuwe subtaak wordt toegevoegd, ontstaat nieuw werk. De parent wordt dan opnieuw `in_progress`.

### Automatisch voltooide parent

Een automatisch voltooide parent is voltooid omdat alle directe subtaken voltooid zijn. Zodra één van die subtaken wordt heropend, wordt de parent opnieuw `in_progress`.

## Wijzigingsregel

Nieuwe functionaliteit die taken of subtaken beïnvloedt, moet vóór oplevering tegen deze matrix worden gecontroleerd.
