# Alert Powietrzny PL/UA

Cywilny dashboard alertów regionalnych dla Polski i zachodniej Ukrainy.

## Co działa
- mapa Polski/Ukrainy z regionalnymi znacznikami,
- kliknięcie znacznika -> szczegóły, źródło, strefa odległości od granicy,
- RCB z publicznych komunikatów gov.pl,
- opcjonalne alerty Ukrainy przez alerts.in.ua API,
- odświeżanie co 60 s,
- lokalna historia sesji i suwak czasu,
- powiadomienia przeglądarkowe, gdy strona jest otwarta.

## Bezpieczeństwo danych
Aplikacja celowo nie pokazuje dokładnych pozycji, wysokości, prędkości ani trajektorii aktywnych obiektów bojowych. Znaczniki UA oznaczają regiony objęte alertem.

## Vercel
Projekt nie wymaga procesu build. Wgraj katalog do Vercel lub podepnij repozytorium.

### Opcjonalne API Ukrainy
W Vercel ustaw zmienną środowiskową:

`ALERTS_IN_UA_TOKEN=<Twój token z alerts.in.ua>`

Tokenu nie umieszczaj w kodzie ani w przeglądarce.

Po ustawieniu zmiennej wykonaj redeploy.
