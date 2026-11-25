# Snap Mockup

En liten webbapp för mobilen där du gör mockup-bilder som ser ut som en mottagen snap: en bild i helskärm, textband över hela bredden, avsändarens namn och profilbild överst, och svarsfältet nederst.

## Funktioner

- **Bild:** ladda upp valfri bild. Dra med **ett finger** för att flytta den, och **nyp med två fingrar** för att zooma och rotera. Det finns också knappar för *Fyll skärmen*, *Visa hela*, rotera 90° och *Räta upp*.
- **Textrad:** lägg till så många textband du vill. Dra dem upp och ner direkt i bilden och tryck på ett band för att redigera texten. Textstorleken går att ändra.
- **Stickers:** lägg till emoji (från listan eller ditt eget från tangentbordet) och fritt flytande text-stickers. Dra med ett finger, nyp med två för att ändra storlek och rotera. Text-stickers kan få typsnitt (8 st), stil (vanlig, kontur, etikett) och valfri färg.
- **Profil:** namn, "tid sedan" (t.ex. *2 min*), profilbild eller en färgad cirkel med initial, klockslag och batteri i statusfältet. Varje del av gränssnittet kan visas eller döljas.
- **Spara:** bilden blir en PNG i full upplösning (Pixel 9a: 1080 × 2424, eller klassisk 1080 × 1920) utan hjälplinjer. På iPhone väljer du *Dela / spara till Bilder* och sedan *Spara bild*.
- **Dölj meny:** när menyn är nere ser du bilden större. Gesterna fungerar bara när menyn är uppe, så du kan titta utan att råka flytta något.
- Dina inställningar (texter, namn, profilbild) sparas i webbläsaren till nästa gång. Själva bilden sparas inte.

## Publicera på GitHub Pages (första gången)

1. Gå till ditt repo på github.com.
2. Klicka på **Settings** (kugghjulet) och sedan **Pages** i vänstermenyn.
3. Under **Build and deployment** väljer du **Source: Deploy from a branch**.
4. Under **Branch** väljer du den gren där filerna ligger (t.ex. `main`), mappen `/ (root)`, och klickar **Save**.
5. Vänta en minut eller två och ladda om sidan. Överst står adressen, ungefär `https://ditt-namn.github.io/Snap-mockup/`.

> Om filerna bara finns på en annan gren än `main` kan du antingen välja den grenen i steg 4, eller först slå ihop den till `main` (en *pull request*).

## Installera på mobilen

**iPhone (Safari):** öppna adressen, tryck på dela-knappen (fyrkanten med pilen uppåt) och välj **Lägg till på hemskärmen**.

**Android (Chrome):** öppna adressen, tryck på menyn ⋮ och välj **Installera app** eller **Lägg till på startskärmen**.

**Tips på Android:** du kan också öppna en bild i Google Foto, trycka **Dela** och välja **Snap Mockup**. Det fungerar när appen är installerad. Om bildväljaren någon gång är tom, starta om telefonen.

**Android-app (APK):** det finns också en färdig APK under [Releases](../../releases).

Efter det öppnas appen i helskärm som en vanlig app och fungerar även utan internet.

## Filerna

| Fil | Vad den gör |
| --- | --- |
| `index.html` | Sidans uppbyggnad: knappar, flikar och fält |
| `style.css` | Utseendet på appen |
| `app.js` | All logik: ritar bilden, hanterar gester och sparar |
| `manifest.webmanifest`, `sw.js`, `icons/` | Gör att appen går att installera och fungerar offline |
| `.nojekyll` | Talar om för GitHub Pages att filerna ska visas som de är |

## Ändra något själv

- **Standardnamn och standardtext:** sök på `defaults` i `app.js`.
- **Färger på appens meny:** de står överst i `style.css` (t.ex. `--accent` för den gula färgen).
- **Textbandets genomskinlighet:** sök på `rgba(0,0,0,0.58)` i `app.js`. Siffran 0.58 är hur mörkt bandet är (0 = osynligt, 1 = helt svart).

Har du installerat appen på mobilen och ändrat något kan det behövas två omstarter av appen innan ändringen syns.

## Tänk på

Appen gör mockups, alltså låtsasbilder för film, skämt, design eller presentationer. Använd den inte för att lura någon eller utge dig för att vara någon annan. Gränssnittet är en egen tolkning och använder inga logotyper eller grafik från något företag.

Typsnitten i mappen `fonts/` kommer från Google Fonts och har den fria licensen SIL Open Font License.
