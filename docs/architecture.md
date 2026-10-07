# My Projects — architectuur

## Versie 0.1

De eerste versie is een client-side webapplicatie.

### Kern
- HTML
- CSS
- JavaScript
- localStorage

### Datamodel
- Project
- Task
- Status
- Priority

### Geplande uitbreidingen
- Sources
- SourceVersion
- Protocol
- ProtocolItem
- Review
- Notes
- Tags
- Search
- Import/export
- Cloud synchronization

## Belangrijk ontwerpprincipe

Tasks gebruiken `parentId`. Daardoor zijn taken en subtaken hetzelfde objecttype en kan de hiërarchie onbeperkt diep worden.

## Taakstatus en voortgang

Tasks gebruiken de volgende statussen:
- `not_started` — Niet gestart
- `in_progress` — Bezig
- `completed` — Voltooid

Elke task bevat daarnaast `completionMode`:
- `manual` — de gebruiker heeft de taak handmatig voltooid
- `automatic` — de taak werd voltooid doordat alle directe subtaken voltooid zijn

### Regel voor taken met subtaken

1. Een task zonder subtaken kan handmatig voltooid of heropend worden.
2. Als een task subtaken heeft en niet alle subtaken voltooid zijn, kan de task `in_progress` zijn wanneer er voortgang is.
3. Zodra alle directe subtaken `completed` zijn, wordt de parent-task automatisch `completed` met `completionMode: "automatic"`.
4. Wanneer een automatisch voltooide parent-task een subtask krijgt die opnieuw wordt geopend, wordt de parent automatisch `in_progress` (of `not_started` wanneer geen enkele subtask voltooid is).
5. Een gebruiker kan een parent-task handmatig voltooien terwijl subtaken nog openstaan. Die parent krijgt `completionMode: "manual"`.
6. Een handmatig voltooide parent-task wordt door wijzigingen aan subtaken niet automatisch heropend.
7. Wanneer de gebruiker een handmatig voltooide parent-task zelf opnieuw opent, wordt de status `in_progress` wanneer er voltooide subtaken zijn, anders `not_started`.
8. Wijzigingen aan een subtask moeten de status van alle relevante ancestors opnieuw evalueren.
9. Projectvoortgang wordt berekend op basis van tasks met status `completed`.

Deze regels vormen een onderdeel van de architectuur en moeten bij latere uitbreidingen behouden blijven.
