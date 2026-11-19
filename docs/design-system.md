# Ontwerpsysteem – Camping De Groene Weide

> **Overgenomen uit het C#-project** (branch `frontend-ontwerp`, 17-11-2026). De Sass-bestanden staan nu in `client/src/styles/` en zijn ongewijzigd, op twee Blazor-resten na (zie de kop van `main.scss`). De componenten heten nu `AppIcon.vue`, `AlertBox.vue`, `LoadingState.vue`, `EmptyState.vue`, `FieldSign.vue`, `ModalDialog.vue` (in `client/src/components/ui/`). Op 18-11-2026 is gemeten dat de voorpagina en de inlogpagina in Vue dezelfde maten, letters en kleuren hebben als in Blazor (1280 en 375 px). De metingen hieronder (Lighthouse, controle per scherm) gelden voor de C#-versie en worden na fase 5 en 6 opnieuw gedaan.

Alle tokens staan in `client/src/styles/_variables.scss`, de mixins in `_mixins.scss` en de gedeelde componenten in `client/src/styles/components/`. Gebruik in componenten alleen tokens: geen losse kleuren, geen `px` (behalve de 1px-techniek voor `visually-hidden`).

## Richting

- **Onderwerp:** een kleine boerencamping. Rustig, groen, overzichtelijk; voor oudere gasten, gezinnen en voor Bert en Anita, die slecht zien.
- **Herkenbaar element:** het *veldbord* (`.field-sign`, `FieldSign.vue`): de naam van een veld als geschilderd bord met een paaltje, zoals bij een weiland. Alleen voor de velden (Kampeerveld, Camperveld, Safariveld). De rest blijft rustig.
- **Bewust niet:** crème met terracotta, hoofdletterlabels boven koppen, pijltjes in knoppen, overal dezelfde kaart.

## Herontwerp voorpagina en beheer (19-11-2026)

Twee gezichten, één merk: dezelfde tokens (bosgroen, boterbloemgeel, Georgia-koppen, weidebeelden), maar een andere opbouw.

### Voorpagina (`HomePage.vue`, `_home.scss`)

Een eigen landingspagina, redactioneel en ruim, met banden over de volle breedte (hooi → wit → weide → hooi → bosgroen). Niets lijkt op het beheer: geen tegels, geen tabellen.

| Deel | Keuze | Waarom |
| :-- | :-- | :-- |
| Hero | Foto over de volle breedte; kop op een effen bosgroene plaat die uit de foto omhoog komt. Kop in Georgia normaal gewicht, groot (`$font-size-display`). Knop `btn--sun` (inkt op boterbloemgeel, 10,6 : 1) | Tekst staat nooit op de foto zelf (contrast). Eén beweging bij het laden: de plaat schuift 1,5em omhoog, zonder vervagen, zodat de tekst ook leesbaar is als de animatie niet loopt; uit bij `prefers-reduced-motion` |
| Inleiding | Eén zin in Georgia (`$font-size-statement`) met de echte cijfers (60 plekken, 3 velden) en een korte zin ernaast | Het verhaal van de camping in één oogopslag, zonder rij met grote getallen |
| Velden | Grote foto naast tekst, om en om links en rechts (vanaf `$bp-desktop`); daaronder gestapeld. Het veldbord is de kop (`h3`) en staat op de telefoon en tablet op de onderrand van de foto "geplant" | Het veldbord blijft het enige herkenbare element; feiten (personen, stroom, water) met icoon en tekst |
| Zo reserveer je | Genummerde stappen 1-2-3 met een gestippeld "gemaaid pad" ertussen | Het is echt een volgorde, dus nummers zijn hier op hun plaats |
| Goed om te weten | Seizoensstrook van 12 maanden uit de instellingen (open: groen vlak + vinkje; dicht: gestippelde rand), voorzieningen met icoon | Nooit alleen kleur: vorm, vinkje en een verborgen tekst "open"/"gesloten" per maand |
| Afsluiting | Bosgroene band met dezelfde knop "Reserveer een plek" en het telefoonnummer | Dezelfde actie heet overal hetzelfde |

Kopmenu: alleen op de voorpagina (vanaf `$bp-desktop`) links naar de drie delen; `meta.home` in de router zet ook de volle breedte aan (`.site-main--full`).

### Beheer (`AdminLayout.vue`, `_admin.scss`)

De richting blijft (rustig, groot, zwart op wit, geen sfeerbeelden). Verbeteringen voor Anita en Bert:

| Wat | Keuze |
| :-- | :-- |
| **Tekstgrootte** | Keuze in de kop, ook al op de inlogpagina: Kleiner (18px), **Standaard (20px, de standaard)**, Groot (23px), Extra groot (26px). Echte keuzerondjes (pijltjestoetsen werken), gekozen = wit vlak met vinkje. Onthouden per browser (`useTextSize.js`, `localStorage`). Alles in het beheer is in `em`, dus knoppen, tabellen en kalender groeien mee. Zoomen in de browser werkt daarbovenop |
| Menu | Huidige pagina als wit tabblad dat aansluit op de pagina, met gele balk erboven en onderstreept (niet alleen kleur). Op de telefoon twee kolommen met het icoon boven het woord |
| Dagoverzicht | De gekozen dag staat bovenaan, samen met de knoppen in één paneel; "Vandaag" als label naast de datum. Cijfers als tegel met icoon in een cirkel, getal en woord. Aankomsten en vertrekken als lijst met donkere kopbalk en het aantal; de plek als omlijnd label naast de naam. Geen kleine grijze tekst meer |
| Kalender in het beheer | Zwarte rand zoals de rest; aankomsten, vertrekken en bezetting per dag 0,9em (18px) in plaats van 0,75em (15px) |
| Vinkjes en rondjes | Waren 18,6px omdat formulierelementen in de browser hun eigen letter van 13px hebben; nu `font-size: inherit`, dus 1,4em = 28px |

### Controle (19-11-2026)

Gemeten in Chrome (headless, eigen script) op 375, 640 (= 1280 bij 200% zoom), 768 en 1280 px, met een tijdelijk testaccount in een kopie van de database:

- Geen horizontaal scrollen op enige pagina en breedte, ook niet bij Extra groot.
- Elke pagina: één `h1`, geen overgeslagen kopniveaus, alle knoppen en links minstens 44 px, alle velden met label, alle afbeeldingen met `alt`.
- Kleinste tekst in het beheer: 18px (bij Standaard). Kleinste tekst op de gastsite: 16,2px (labels "Impressie").
- Tekstgrootte met het toetsenbord: twee keer pijl-rechts vanaf Standaard geeft Extra groot (26px), wordt onthouden, focusring zichtbaar.

### Uitgangspunt: skill "Ui ux pro max"

Opdracht aan de skill: `campsite booking nature accessible senior`, met variatie, beweging en dichtheid alle drie op 2 (rustig).

| Advies van de skill | Wat we ermee deden |
| :-- | :-- |
| Stijl: minimalistisch, veel ruimte, hoog contrast | Overgenomen |
| Lettertype: Atkinson Hyperlegible | Overgenomen als **systeemlettertype** (eerste in `$font-body`); niet via Google Fonts, want geen externe CDN. Koppen in Georgia voor een warmer, eigen karakter (frontend-design) |
| Kleuren: blauw (#0369A1) met groen accent | **Niet** overgenomen: te veel "SaaS". Eigen palet "boerenweide" (bosgroen, weidegroen, hooi, boterbloemgeel), alle combinaties nagerekend op 4,5 : 1 |
| Beweging: subtiel, scroll-reveal met GSAP | Alleen korte overgangen (0,15–0,25 s), uit bij `prefers-reduced-motion`; geen GSAP, geen scroll-animaties |
| Checklist: geen emoji, SVG-iconen, zichtbare focus, 375/768 controleren | Overgenomen (`AppIcon.vue`, focus-ring met gele halo), gecontroleerd op 375, 768 en 1280 |

## Tokens

| Groep | Tokens | Gebruik |
| :-- | :-- | :-- |
| Basiskleur | `$color-forest` `#1b5e34`, `$color-forest-dark`, `$color-meadow`, `$color-meadow-soft`, `$color-hay` (achtergrond), `$color-buttercup` (accent), `$color-ink`, `$color-ink-soft`, `$color-white`, `$color-border`, `$color-border-soft` | Boterbloemgeel alleen als vlak achter inkt of als focus-halo, nooit als tekstkleur |
| Status (vast, BUILD.md) | `$status-free`, `-almost-full`, `-full`, `-deal`, `-closed`, `-held` | Kalender en plekkenoverzicht, altijd met icoon en tekst |
| Betekenis | `$color-error`, `-success`, `-warning`, `-info` + `-soft` | Meldingen |
| Beheer | `$admin-bg`, `$admin-text` (zwart), `$admin-header`, `$admin-border`, `$admin-stripe`, `$admin-font-base` (1.25em) | Rustiger, groter, extra hoog contrast |
| Letters | `$font-body` (systeemlettertype, Atkinson Hyperlegible als die is geïnstalleerd), `$font-heading` (Georgia); `$font-size-base` 1.125em; h1 2.25em, h2 1.6em, h3 1.25em; `$measure` 40em | Geen download, geen CDN |
| Ruimte | `$space-xs` 0.25em … `$space-xxl` 4em | |
| Maten | `$tap-target-min` 2.75em, `$content-max` 66em, `$step-max` 48em | Klikvlakken minimaal 2.75em |
| Afronding | `$radius-sm`, `$radius`, `$radius-lg`, `$radius-pill` | |
| Schaduw | `$shadow-low`, `$shadow-high` (licht groen getint), `$backdrop` | |
| Beweging | `$duration-fast` 0.15s, `$duration` 0.25s, `$easing` | Uit bij `prefers-reduced-motion` |
| Breekpunten | `$bp-tablet` 48em (768px), `$bp-desktop` 70em | |

### Contrast (WCAG AA, nagerekend)

| Combinatie | Contrast |
| :-- | :-- |
| wit op `$color-forest` | 7,8 : 1 |
| wit op statuskleuren | 4,7 – 7,4 : 1 (bijna vol is de laagste: 4,7) |
| `$color-ink-soft` op `$color-hay` | 8,4 : 1 |
| `$color-ink` op `$color-buttercup` | 10,6 : 1 |
| meldingskleur op eigen lichte achtergrond | 5,4 – 6,3 : 1 |
| `$color-border` op wit (rand van velden) | 5,1 : 1 |
| beheer: zwart op wit / op `$admin-stripe` | 21 : 1 / 18,8 : 1 |

## Componenten

| Component | Klassen / bestand | Varianten en toestanden | Toegankelijkheid |
| :-- | :-- | :-- | :-- |
| Knop | `.btn`, `_buttons.scss` | `--secondary`, `--danger`, `--sun` (op bosgroen), `--large`, `--small`, `--block`; hover, focus, disabled, `aria-busy="true"` (laden) | Altijd tekst; minimaal 2.75em; focus-ring met gele halo |
| Knoppenrij | `.btn-row`, `--split` | Terug links, Verder rechts | |
| Kaart | `.card`, `--meadow`; `_cards.scss` | | Alleen om iets af te bakenen |
| Feitenlijst | `.facts`, `__item` | dt/dd met icoon | |
| Formulierveld | `.field`, `__hint`, `.checkbox`; `_forms.scss` | fout: `.invalid` + `.validation-message` | Label boven het veld, nooit placeholder als label; fout staat onder het veld met "!" én tekst |
| Melding | `AlertBox.vue` → `.alert`, `--info/--success/--warning/--error` | | Fout = `role="alert"`, anders `role="status"`; icoon + tekst |
| Tabel | `.table`, `.table-scroll`, `__sort`, `__row--warning`, `__row--cancelled`; `.badge`, `.yes-no` | sorteren met `aria-sort` | Scrollgebied met `tabindex="0"` en label |
| Laden | `LoadingState.vue` → `.loading` | | `role="status"` en een zin die zegt wat er gebeurt |
| Leeg | `EmptyState.vue` → `.empty-state` | met of zonder illustratie | Titel + uitleg + wat je nu kunt doen |
| Veldbord | `FieldSign.vue` → `.field-sign`, `--small` | | Gewone tekst, geen afbeelding |
| Icoon | `AppIcon.vue` → `.icon` | lijn-iconen 24×24 | Standaard `aria-hidden`; zonder tekst ernaast: `Label` meegeven |
| Pop-up | `ModalDialog.vue` (SpotDialog volgt in fase 5) | | Native `<dialog>`: Esc, focus blijft binnen, focus terug naar de opener |

## Teksten (ux-copy)

- Knoppen beginnen met een werkwoord: "Reserveer een plek", "Kies andere datums", "Betaal € 75".
- Fout: wat er gebeurde + waarom + wat je kunt doen. Geen "Sorry", geen vage tekst.
- Leeg: wat dit is + waarom het leeg is + wat je nu kunt doen.
- Laden: zeg wat er gebeurt ("Even geduld, we zoeken de vrije plekken.").
- Overal dezelfde woorden: *plek*, *veld*, *aankomst*, *vertrek*, *nacht*, *reservering*.

## Beelden

Zie `docs/beeldprompts.md`. De sfeerbeelden zijn met Gemini gemaakt (vaste stijl: zacht ochtendlicht, lichte nevel, vlak Hollands boerenland, geen tekst of gezichten). Ze zijn tijdelijk; in de pop-up van een plek horen echte foto's (anders "Foto volgt").

## Controle per scherm (17-11-2026)

Volledige rapporten (toegankelijkheid en ontwerpkritiek per scherm): `docs/qa-per-scherm.md`.

Elk scherm doorlopen op 375, 768 en 1280 px breed, met een eigen scan in de browser (contrast van alle tekst, klikvlakken ≥ 2.75em, alt-teksten, kopvolgorde, knoppen zonder naam, horizontaal scrollen), daarna een ontwerpkritiek (skills design:accessibility-review en design:design-critique).

| Scherm | 375 / 768 / 1280 | Toestanden getest | Gevonden en opgelost |
| :-- | :-- | :-- | :-- |
| Voorpagina met hero | ✓ / ✓ / ✓ | – | – |
| Stap 2 en 3 (soort plek, kampeermiddel) | ✓ / ✓ / ✓ | knop "Verder" uit tot er een keuze is | – |
| Stap 4 kalender | ✓ / ✓ / ✓ | fout (volle dag, periode over volle dagen met 3 alternatieven) | Maandknoppen en "Wis keuze" waren op de telefoon 45 px hoog (kalendertekst is daar kleiner); nu 50 px. Dagen zijn op 375 px 45 px: boven de WCAG-grens van 44 px, zeven kolommen passen niet groter |
| Stap 5 plekkenlijst en pop-up | ✓ / ✓ / ✓ | leeg ("Geen plek meer vrij"), "Foto volgt", echte foto | Naam van de plekkaart begon niet met de zichtbare tekst en miste "m naar de wc" (WCAG 2.5.3); nu is de zichtbare tekst de naam. `div` in een `button` vervangen door `span` |
| Stap 6 overzicht en betalen | ✓ / ✓ / ✓ | fout (lege velden) | Focus ging na "Betaal" niet naar het eerste foute veld; nu wel, en elk veld is gekoppeld aan zijn foutmelding (`aria-describedby`) |
| Stap 7 bevestiging | ✓ / ✓ / ✓ | succes, aftellen stoppen | – |
| Beheer: dagoverzicht | ✓ / ✓ / ✓ | leeg ("Niemand komt…") | Kalendercijfers liepen door elkaar op de telefoon: daar alleen het percentage |
| Beheer: reserveringen | ✓ / ✓ / ✓ | leeg (geen zoekresultaat) | Verborgen hulptekst in een kolomkop maakte de hele pagina breder (1614 px op 1280); nu blijft alles in het scrollvak. Tabel compacter (1759 → 1544 px) en de kolom "Plek" blijft staan bij opzij scrollen |
| Beheer: plekken | ✓ / ✓ / ✓ | – | Knoppen "Zet uit"/"Zet aan": naam bevat nu de zichtbare tekst |
| Beheer: nieuwe reservering | ✓ / ✓ / ✓ | – | – |
| Beheer: foto's | ✓ / ✓ / ✓ | leeg, succes (toegevoegd/verwijderd) | Lege toestand zonder illustratie gebruikte maar de helft van de breedte; nu de volle breedte |

**Laden:** elke lijst en kalender heeft een `LoadingState` met `role="status"` en een zin die zegt wat er gebeurt. Lokaal is de database te snel om het te zien; met een tijdelijke vertraging van 4 s (niet gecommit) is de laadtoestand van de plekkenlijst in beeld gebracht en gecontroleerd.

**Foto vervangen:** getest met een tijdelijke foto bij T01 via `/admin/photos`: de gast zag hem direct in de lijst en de pop-up, "Foto volgt" was weg. Daarna weer verwijderd.

**Bekend en geaccepteerd:** de reserveringentabel heeft 10 kolommen (zo gevraagd) in grote letters en past op 1280 px niet helemaal; hij scrolt binnen een eigen vak met label, met het toetsenbord bereikbaar. Het bestandsveld bij foto's toont de knoptekst in de taal van de browser.

## Controle (Lighthouse, gepubliceerde versie, 17-11-2026)

Gemeten op `dotnet publish -c Release` in de productieomgeving, mobiel en desktop.

| Pagina | Accessibility | Best Practices |
| :-- | :-- | :-- |
| Voorpagina `/` | 100 | 96 |
| Inloggen `/account/login` | 100 | 100 |
| `/admin`, `/admin/reservations`, `/admin/spots`, `/admin/new-reservation`, `/admin/photos` | 100 | 96 |

Laatste meting na de controle per scherm (13 metingen, mobiel en desktop): Accessibility 100 overal, Best Practices 96 (inloggen 100). Eerder ook gemeten na de Gemini-beelden, op alle pagina's hierboven (beheer met een tijdelijk testaccount in een kopie van de database): dezelfde scores. Daarbij opgelost: knoppen "Zet uit" / "Zet aan" en de dagen in de beheerkalender hadden een toegankelijke naam die niet met de zichtbare tekst begon (WCAG 2.5.3, *label in name*). De voorpagina scoort Performance 91 (mobiel) en 100 (desktop); telefoons krijgen een hero van 800 px via `srcset`.

De 4 punten die op de interactieve pagina's ontbreken komen van Blazor zelf: `blazor.web.js` registreert een `unload`-gebeurtenis. Die zet de site uit met de header `Permissions-Policy: unload=()` (zie `Program.cs`), waarna Chrome een melding in de console zet. Zonder de header scoort Best Practices 79–81 (verouderde API).

Let op bij testen: start je de app in de productieomgeving direct vanuit de build (`dotnet run` met `ASPNETCORE_ENVIRONMENT=Production`), dan vindt hij de vooraf gecomprimeerde bestanden niet en blijven CSS en JavaScript leeg. Na `dotnet publish` werkt alles. In de ontwikkelomgeving speelt dit niet.
