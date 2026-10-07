# Broninformatie — analyse en UX

## Bestaand model vóór deze wijziging

| Object | Velden | Dialoog en eerdere weergave |
|---|---|---|
| Source | id, projectId, taskId, type, title, author, publisher, url, description, createdAt, updatedAt | Dialoog vult type/titel/auteur/uitgever/URL/beschrijving. Taakkaart toonde alleen titel/type/auteur en versieaantal; beschrijving, uitgever en URL ontbraken daar. |
| SourceVersion | id, sourceId, version, label, contentHash, fileName, filePath, url, notes, createdAt | Dialoog vult versie/label/bestandsnaam/-pad/URL/notities. ContentHash bestaat in de domeinfunctie, zonder dialoogveld. Taakkaart toonde versie/label/controlestatus; notities/bestandsinformatie/URL/hash ontbraken. Versiepagina toonde bestandsinformatie en link, maar geen notities/hash. |

createSource en createSourceVersion maken nieuwe IDs; dubbele versienamen binnen
één bron worden geweigerd. Er was geen bron- of bronversie-updatefunctie.
Checks verwijzen naar concrete sourceVersionIds; resultaten en reviews naar checks.
Bronverwijdering wordt geblokkeerd als een versie door een check wordt gebruikt.

De versiepagina viel bij een lege versie-URL terug op Source.url. Daarom kan het
wijzigen van die logische Source-URL een historische link wijzigen, ook zonder
SourceVersion zelf aan te passen.

## Kleinste uitbreiding

- Uitgeklapte bronkaart toont bestaande uitgever/beschrijving/URL, met lege velden
  weggelaten. Ingeklapte summary blijft titel/type/versieaantal bevatten.
- Per versie worden bestaande bestandsnaam, bestandspad, notities, hash en URL
  getoond. Statusindicator en controleactie blijven bestaan; Bekijk versie opent
  de bestaande versiepagina. De versiepagina toont dezelfde versiegegevens.
- Tekst wordt escaped, behoudt regels en breekt lange woorden/URL's af.
- Alleen absolute http(s)-URL's worden klikbare Open link-acties, met target=_blank
  en rel=noopener noreferrer. Andere opgeslagen URL's blijven gewone tekst;
  er wordt geen website-inhoud opgehaald of geanalyseerd.
- Bron bewerken hergebruikt de bestaande brondialoog. updateSourceMetadata wijzigt
  uitsluitend titel/type/auteur/uitgever/beschrijving/URL en de bestaande updatedAt.
  Project/taak/IDs/versies/controles worden niet aangepast.

## Historische grens

Beschrijvende Source-metadata is actuele informatie over de logische bron, geen
snapshot van de gecontroleerde inhoud. De versiepagina labelt de bronbeschrijving
als bronmetadata. Titel/auteur/uitgever/type/beschrijving mogen gewijzigd worden.

Zodra enige versie door een check wordt gebruikt, is Source.url conservatief
vergrendeld, zowel in de dialoog als in de domein-updatefunctie. Dit behoudt ook
historische links die op die URL terugvallen. Een andere versie-URL wordt via een
nieuwe bronversie vastgelegd.

Er wordt geen bewerking van SourceVersions aangeboden, ook niet voor ongebruikte
versies. Versiegebonden URL, notities, hash en bestandsinformatie worden niet
stilzwijgend overschreven. De bestaande delete-guard is ongewijzigd.

## Verificatie

Schema blijft 5; er zijn geen nieuwe opgeslagen velden of migraties.

- tests/sources.cjs: aanmaken vanuit taakmenu met/zonder URL, lege metadata,
  echte linkclick naar nieuw tabblad met extern verkeer gemockt, noopener,
  escaping/regelafbrekingen, lange tekst/URL/bestandsinformatie, meerdere versies,
  bewerken, domein-URL-lock, verwijderen met/zonder Check, onveranderde
  SourceVersions/Check/CheckResult/Review, versie-URL versus Source-fallback,
  keyboardbediening en refresh/persistentie.
- Edge 154.0.4258.62, Playwright, tijdelijk browserprofiel. Bronkaart getest op
  320/375/600/1280 px; versiepagina op 320/1280 px.
- 34 status/historiek/migratietests en 20 reorder-domeintests blijven slagen.
- Bestaande browser-, menu- en muis/touch-dragtests blijven slagen, inclusief
  recursieve subtaken, veilige delete-guards en persistentie van taakvolgorde.

Geen documentviewer, uploads, cloudopslag, scraper of URL-preview toegevoegd.
