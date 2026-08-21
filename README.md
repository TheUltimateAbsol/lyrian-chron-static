# Lyrian Chronicles static manual

This project creates a fully static, cross-linked edition of the Angel's Sword RPG online manual. Every class, race, sub-race, ability, item, monster, monster ability, monster action, keyword, and breakthrough has its own generated `index.html`. The ability index contains complete rules with keyword and unlock-source filtering, while race pages embed the full rules for their unlocked abilities. The site also includes a static Basic Actions reference with a locally saved shared-stat profile, synchronized inline stat editors, live possible-total ranges, a selector-driven tool for all skill checks, local dice tests, and copy-ready Avrae command generation; attacks combine accuracy and damage in one message.

The deployable site is generated in `public/`. Its HTML contains the complete page content; JavaScript is only progressive enhancement for filtering, sorting, search, responsive navigation, remembering index controls, local dice tests, and Avrae command copying. No record content is fetched or rendered at runtime. The generator replaces `public/` on every build, so edit `src/` or the generator rather than generated files.

## Refresh and build

Use Node.js 20 or newer:

```sh
node scripts/scrape-and-build.mjs
```

To scrape a historical version:

```sh
node scripts/scrape-and-build.mjs --version 0.13.0
```

To rebuild from the checked-in `data/latest.json` snapshot without touching the network:

```sh
node scripts/scrape-and-build.mjs --build-only
```

To preview locally:

```sh
python3 -m http.server 4173 --directory public
```

Then open `http://localhost:4173/`.

For static hosting, use the project’s build command and publish directory:

- Build command: `npm run build`
- Publish/output directory: `public`

The generated routes use directory indexes such as `public/races/demon/index.html`, and all runtime assets are local to `public/assets/`. No application server or server-side rendering is required.

See [SCRAPING.md](SCRAPING.md) for the discovery notes, API details, data transformations, relationship rules, and refresh checklist.
