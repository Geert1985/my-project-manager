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
