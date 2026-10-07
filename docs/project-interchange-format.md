# My Projects interchange — formatVersion 1

Dit publieke JSON-formaat staat los van localStorage/schemaVersion. Bestanden
gebruiken UTF-8 en extensie .json. Geen interne IDs of schemaVersion opnemen.

## Minimale checklist, direct door ChatGPT te genereren

```json
{
  "format": "my-projects",
  "formatVersion": 1,
  "project": {
    "name": "From Zero 2 Infinity – Fase 6",
    "tasks": [
      {"name": "Milestone 6.1", "children": [
        {"name": "Correctheid controleren"},
        {"name": "Volledigheid controleren"}
      ]}
    ]
  }
}
```

Verplicht: format, formatVersion, project.name, project.tasks, task.name.
De volgorde van tasks/children is de siblingvolgorde. Geen sortOrder of parentId
nodig: import bouwt deze op. Optionele children en sources zijn arrays (default []).
Alle onbekende velden worden geweigerd om versie-/typfouten zichtbaar te maken.

## Velden

Alle hieronder genoemde tekstvelden zijn strings. Timestamps zijn ISO UTC
strings (bijvoorbeeld 2026-10-07T12:00:00.000Z). createdAt/updatedAt ontbreken:
importtijd gebruiken. startedAt/completedAt mogen null zijn; default null.
exportedAt is optioneel op top-level en wordt door export ingevuld.

| Object | Verplicht | Optioneel/default |
|---|---|---|
| project | name, tasks | description/category="", status="active" (active/completed/archived), priority="normal" (low/normal/high), createdAt, updatedAt, sources=[] |
| task | name | ref, description="", status="not_started" (not_started/in_progress/completed), priority="normal", completionMode="manual" (manual/automatic), createdAt, completedAt, children=[], sources=[] |
| source | title | ref, type="document" (document/book/article/website/github/other), author/publisher/url/description="", createdAt, updatedAt, versions=[] |
| source version | version | ref, label/contentHash/fileName/filePath/url/notes="", createdAt |
| protocol | name, version, versions | ref, description="", active=true (boolean), createdAt, updatedAt |
| protocol version | version, items | ref, description="", status="active" (draft/active/retired), createdAt |
| protocol item | title | ref, description="", required=true (boolean), order=arraypositie+1 (positief geheel getal), createdAt, updatedAt |
| check | taskRef, sourceVersionRef, protocolRef, protocolVersionRef, results | ref, protocolVersion (default geselecteerde versie), status="not_started" (not_started/in_progress/passed/failed/blocked), summary="", startedAt, completedAt, createdAt, review |
| check result | itemRef | ref, status="not_checked" (not_checked/pass/fail/not_applicable), comment/evidence="", createdAt, updatedAt |
| review | reviewer | ref, status="pending" (pending/approved/rejected), comment="", createdAt |

Top-level mag naast format/formatVersion/exportedAt/project de arrays protocols en
checks bevatten (default []). Sources onder project zijn niet aan een taak
gekoppeld; sources onder een task behoren uitsluitend tot die task.
SourceVersions staan onder hun source. ProtocolVersions onder hun protocol;
ProtocolItems onder hun versie. Results en de optionele review staan onder de check.

ref is een niet-lege string, uniek per objecttype binnen het bestand. Voor een
object waarnaar verwezen wordt is ref verplicht; bij eenvoudige checklists is
ref overal overbodig. Verwijzingen worden nooit gekoppeld aan bestaande lokale
objecten. Gebruik bijvoorbeeld taak1, bron1, bronversie1, protocol1, pv1, item1.

## Historische relaties

Een check moet verwijzen naar een bronversie van dezelfde task en naar een
protocolversie van zijn protocol. Iedere check heeft exact één result voor ieder
item van zijn protocolversie, zonder dubbele/verkeerde itemRefs. Een review mag
alleen op passed/failed staan; failed+approved is ongeldig. Hoogstens één review
per check. Bronversienummers zijn uniek per source, protocolversienummers per
protocol. Een protocol heeft hoogstens één actieve versie. Item order is uniek
per versie. Import behoudt opgeslagen status en voert geen herberekening uit:
een historisch of expliciet handmatig voltooid object wordt niet opnieuw uitgevoerd.

Export bevat alleen de gekozen projectboom, alle projectbronnen/versies en
checks/results/reviews op zijn taken. Protocollen zijn globaal; alleen protocollen
met projectchecks en exact de gebruikte protocolversies/items worden meegenomen.
Import maakt daarvan onafhankelijke lokale kopieën, met nieuwe IDs. Hun historische
status (ook retired) blijft behouden. Geen templates of andere projectdata worden
meegenomen.
Elke aangeleverde protocolversie moet door minstens één Check uit het bestand
gebruikt worden; losse templates worden geweigerd.
Een beschadigde relatie voorkomt export/import; niets wordt stilzwijgend
weggelaten of gerepareerd.

## Bronvoorbeeld

```json
{
  "format": "my-projects", "formatVersion": 1,
  "project": {"name": "Studie", "tasks": [
    {"name": "Lees hoofdstuk 1", "ref": "taak1", "sources": [
      {"title": "Handleiding", "ref": "bron1", "url": "https://example.com",
       "description": "Lees zorgvuldig.\nMaak aantekeningen.", "versions": [
         {"version": "1.0", "ref": "bronversie1", "notes": "Eerste versie"}
       ]}
    ]}
  ]}
}
```

## Grenzen en veiligheid

Een complete historische sectie kan er zo uitzien (alle overige velden krijgen
de gedocumenteerde defaults):

```json
{
  "format": "my-projects", "formatVersion": 1,
  "project": {"name": "Gecontroleerde checklist", "tasks": [
    {"name": "Taak", "ref": "taak1", "sources": [
      {"title": "Bron", "versions": [{"ref": "bv1", "version": "1"}]}
    ]}
  ]},
  "protocols": [{"ref": "p1", "name": "Kwaliteit", "version": "1", "versions": [
    {"ref": "pv1", "version": "1", "items": [{"ref": "i1", "title": "Correct?"}]}
  ]}],
  "checks": [{"taskRef": "taak1", "sourceVersionRef": "bv1",
    "protocolRef": "p1", "protocolVersionRef": "pv1", "status": "passed",
    "results": [{"itemRef": "i1", "status": "pass"}],
    "review": {"reviewer": "Geert", "status": "approved"}
  }]
}
```

Bestand maximaal 10 MiB; maximaal 5.000 domeinobjecten totaal, 50 taakniveaus,
100.000 tekens per tekstveld en 200 tekens per ref. Arrays/objecten/datatypes,
enums, timestamps, verwijzingen en dubbele refs worden gevalideerd.
__proto__/constructor/prototype-sleutels zijn verboden op ieder niveau. Tekst is
nooit HTML of code; bestaande UI-escaping en veilige URL-rendering blijven gelden.

Import bouwt eerst een volledige kandidaat in memory. Daarna één saveState;
bij opslagfout wordt de oude in-memory state hersteld. Er wordt niet samengevoegd
op naam of ref en er wordt niets overschreven. Tweemaal importeren maakt twee
onafhankelijke projecten. Een export is een back-up van één project, geen back-up
van de volledige applicatie. Extern opgeslagen bestanden kunnen gevoelige
projectinformatie bevatten; de app verzendt ze niet naar een dienst.

## Implementatie en verificatie

`js/interchange.js` valideert, reconstrueert en remapt naar dezelfde bestaande
collecties. Er worden geen createTask/createCheck-acties afgespeeld: die zouden
statuspropagatie en historische timestamps veranderen of retired versies weigeren.
De import bouwt daarom records volgens het bestaande model en bewaart statusvelden
zonder herberekening. `js/interchange-ui.js` doet uitsluitend bestandkeuze/download.
SchemaVersion blijft 5; er zijn geen nieuwe persistente velden.

7 oktober 2026: 33 interchange-domeintests, inclusief alle drie JSON-voorbeelden,
roundtrip met historische relaties, dubbele import, opslagrollback, corrupte
bestanden, limieten, refs en prototypevelden. De 54 bestaande status/reordertests
blijven slagen. Browsercontrole met Edge 154.0.4258.62/Playwright: chooser,
JSON-download, nieuwe onafhankelijke projecten, foutmeldingen, escaping, refresh
en schermbreedtes 320/375/600/1280 px. De bestaande task/menu/drag/source-tests
blijven onderdeel van de regressiecontrole.
