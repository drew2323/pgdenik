# Development Handoff — PG Deník redesign

**Status:** APPROVED FOR DEVELOPMENT
**Owner:** David Brázda
**Approved scope source:** `SPEC.md`
**Infrastructure gate:** `PROJECT-INFRASTRUCTURE.md` — `INFRASTRUCTURE READY`

## Outcome

Dodat samostatně navržený, čistý, klidný, responzivní a informačně orientovaný redesign osobního paraglidingového deníku. Nekopírovat vzhled XWiki ani starší prototyp. Detailní vizuální systém rozhodne Codex podle `DESIGN-BRIEF.md`.

## Required product behavior

- Veřejný web zobrazuje pouze publikované stránky.
- Stromové menu zachová hierarchii obsahu; na desktopu je vlevo, na mobilu jako ovladatelný panel.
- Název v menu, rodič, pořadí a viditelnost stránky jsou editovatelné v Payload CMS.
- Každou stránku lze vytvořit, upravit, skrýt/publikovat a složit z rich textu, obrázku, YouTube a XCvid segmentu.
- YouTube a XCvid přijímají pouze validní podporované URL; žádné libovolné HTML nebo iframe z CMS.
- Obrázky se ukládají jako spravovaná média a vyžadují alt text.
- Strom odmítne cykly a neplatného rodiče.
- Existující veřejný obsah se jednorázově a opakovatelně importuje pouze z `https://www.pgdenik.cz`.
- Import zachová jednoznačně převoditelné interní odkazy a vytvoří strojově čitelný i lidsky čitelný report: importováno, přeskočeno, problém, důvod a zdrojová URL.
- Nepodporovaný nebo nejednoznačný obsah se nesmí tiše ztratit.

## Design authority

Codex vytvoří vlastní ucelené řešení typografie, barev, spacingu, stromu, aktivních stavů, mobilního panelu, obsahu a embedů. Design musí splnit `DESIGN-BRIEF.md`, WCAG-smysluplný kontrast, viditelný focus, klávesnicové ovládání a `prefers-reduced-motion`.

Rozhodnutí stručně zaznamenat do `DESIGN.md`. Reálné desktopové a mobilní screenshoty ukládat jako testovací artefakty, ne jako ručně vyráběný marketingový mockup.

## Delivery boundaries

- Pracovat na nové větvi z aktuálního `main`.
- Neměnit `Dockerfile`, healthcheck, Coolify, CI ani deployment skripty.
- Zachovat stávající runtime migration contract.
- Nevkládat secrets, admin credentials ani produkční data do Git.
- Původní `pgdenik.cz` a jeho DNS neměnit.
- Použít strict TDD po vertikálních řezech: nejprve failing behavior test, potom minimální implementace.

## Acceptance gates

1. Payload model, validace stromu, publikace a čtyři typy obsahových bloků mají automatické testy.
2. Importér má fixture testy pro hierarchii, interní odkazy, obrázek, YouTube, XCvid a nepodporovaný obsah.
3. Import proti živému veřejnému webu vytvoří doložený report s přesnými počty.
4. Lint, typecheck, integration tests, production build a E2E projdou.
5. E2E ověří desktop i mobil: strom, aktivní větev, otevření stránky, responzivní média, focus/keyboard a zavření mobilního menu.
6. Payload administrace umožní editorovi upravit stránku, navigaci a všechny podporované bloky.
7. Vytvořený PR má úspěšné CI a zdravé Coolify preview s oddělenou preview DB.
8. Výsledná implementace, migrace obsahu a preview budou před mergem nezávisle zkontrolovány.

## Required final report from Codex

- stručný popis designového rozhodnutí,
- seznam implementovaného scope,
- přesné výsledky testů a buildů,
- přesné výsledky importu,
- změněné migrace a rollback dopad,
- commit a PR,
- známé výjimky nebo blockery.
