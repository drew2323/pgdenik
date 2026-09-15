# PG Deník — zadání redesignu

**Status:** SPEC_READY
**Vlastník:** David Brázda
**Schváleno:** 2026-09-15 zadáním v této konverzaci

## Cíl

Nahradit současný pgdenik.cz čistým, rychlým a responzivním informačním webem pro osobní paraglidingový deník. Prioritou je pohodlné čtení a orientace v odborných poznámkách, nikoli marketingové efekty.

## Uživatelé

- Návštěvník čte obsah na mobilu i desktopu.
- David spravuje stránky, média a navigaci v administračním rozhraní.

## Obsah

- Počáteční obsah se znovu načte pouze z veřejně dostupného webu `https://www.pgdenik.cz`.
- Zachová se hierarchie veřejných obsahových stránek a jejich interní odkazy, pokud je lze z veřejného zdroje jednoznačně převést.
- Každá stránka podporuje text s nadpisy, seznamy a odkazy a obsahové segmenty:
  - obrázek,
  - vložené YouTube video,
  - vložený let XCvid z `xcvid.com`.
- Jiné typy příloh a embedů nejsou součástí scope.
- Nejednoznačný nebo nepodporovaný zdrojový obsah se nesmí tiše zahodit; bude označen v migračním reportu.

## Navigace

- Zachovat stromový princip současného menu.
- U každé stránky lze upravit název v menu, rodiče, pořadí mezi sourozenci a viditelnost v menu.
- Aktivní větev a aktuální stránka jsou zřetelné.
- Na mobilu se strom otevírá jako dobře ovladatelný panel a nezakrývá trvale obsah.

## Editace

- Každá stránka je editovatelná v CMS.
- Editor může vytvořit, upravit, publikovat/skrýt a seřadit stránky.
- Obrázky lze nahrát a vložit do obsahu.
- YouTube a XCvid segment přijímá pouze podporovanou URL a v administraci nabízí srozumitelný náhled nebo popis chyby.
- URL existující stránky se při migraci zachová nebo dostane ověřené přesměrování.

## Vizuální zadání

Podrobnosti určí Codex podle `DESIGN-BRIEF.md`. Výsledek má být lehký, funkční, klidný a soustředěný na informace; design nesmí soupeřit s obsahem.

## Mimo scope

- komentáře a veřejné registrace,
- přílohy mimo obrázky, YouTube a XCvid,
- sociální síť nebo letový tracker,
- ruční redesign či dopisování obsahu,
- automatické přepnutí DNS produkční domény bez kontroly preview.

## Akceptační kritéria

1. Veřejné stránky z aktuálního stromu pgdenik.cz jsou importovány z veřejného zdroje a počet importovaných, vynechaných a problematických stran je doložen reportem.
2. Stromové menu funguje na desktopu i mobilu a jeho struktura, pořadí, název a viditelnost jsou editovatelné v CMS.
3. Každou stránku lze v CMS upravit a publikovat; podporované bloky jsou rich text, obrázek, YouTube a XCvid.
4. Interní odkazy, obrázky a podporované embedy na reprezentativních importovaných stránkách fungují.
5. Nepodporovaný obsah je viditelně reportován, nikoli tiše ztracen.
6. Web projde lintem, typecheckem, testy, produkčním buildem a základním E2E ověřením desktop/mobile.
7. Coolify preview i nasazená Coolify verze odpovídají ověřenému commitu a mají zdravý `/api/health`.
8. Stávající pgdenik.cz zůstane během prototypování nedotčený; přepnutí domény je samostatné lidské schválení po kontrole preview.
