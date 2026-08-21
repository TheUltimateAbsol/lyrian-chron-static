# Scraping and regeneration notes

## Scope

The source is `https://rpg.angelssword.com/game/online-manual` (the trailing period in the original request is punctuation, not part of the working route). The current manual redirects `latest` routes to a concrete semantic version such as `0.13.1`.

The scraper intentionally captures one complete game version at a time. `data/latest.json` is the reproducible source snapshot used for offline rebuilds. The API's version list is also kept in the snapshot so a later run can detect a new release.

## Browser discovery (2026-08-21)

The site is an Angular application. Browser inspection established the following behavior before API scraping was implemented:

- The manual landing page exposes routes for latest update, settings guide, rulebook, breakthroughs, keywords, races, classes, abilities, items, monsters, and monster abilities.
- The races index uses JavaScript tabs named “Races” and “Sub-Races,” but records have stable routes under `/game/{version}/races/primary/{id}` and `/game/{version}/races/secondary/{id}`.
- The indexes render content after API responses. The initial HTML is only an app shell.
- The site logo is loaded from `/images/lyrian-chronicals-logo-long.webp`; a square black logo is at `/images/lyrian-logo-black.webp`.
- Record artwork is hosted on `https://cdn.angelssword.com/ttrpg/assets/`.

The deployed JavaScript route manifest and service chunks were then inspected to find the canonical API endpoints and field-decoding behavior. This avoids brittle click automation and preserves structured IDs needed for reverse lookup.

## API request scheme

The API base is `https://api.angelssword.com`. Requests use three headers:

- `sessionId`: Base64 of a UUID.
- `requestId`: Base64 of the current Unix time in milliseconds, expressed as a decimal string.
- `requestkey`: AES-128-CBC encryption of the `sessionId`, Base64 encoded. The IV is the first 16 UTF-8 characters of `requestId`. The public client key is the base64url JWK value used by the source application's production bundle.

The API also rejects a generic script request even with those headers. The generator sends the same ordinary CORS metadata and browser-style `Accept`, `Origin`, `Referer`, and user-agent headers as the public web client. No login, private token, cookie, or user data is used.

If the source deploys a new bundle and requests begin returning HTTP 400, inspect the current production service chunk for `apiUrl`, `aesKey`, and `setHeaders()`, then update the constants and header construction near the top of `scripts/scrape-and-build.mjs`.

## Endpoints

The generator requests:

- `ttrpg/version/list`
- `ttrpg/{version}/classes`
- `ttrpg/{version}/class/{classId}` for every class
- `ttrpg/{version}/true-abilities`
- `ttrpg/{version}/key-abilities`
- `ttrpg/{version}/ancestries`
- `ttrpg/{version}/ancestry/{ancestryId}` for every sub-race
- `ttrpg/{version}/primary-races`
- `ttrpg/{version}/primary-race/{primaryRaceId}` for every primary race
- `ttrpg/{version}/items`
- `ttrpg/{version}/item/{itemId}` for every item
- `ttrpg/{version}/keywords`
- `ttrpg/{version}/breakthroughs`
- `ttrpg/{version}/monsters`
- `ttrpg/{version}/monster/{monsterId}` for every monster
- `ttrpg/{version}/monsters-abilities`
- `ttrpg/{version}/monsters-abilities-lists`
- `ttrpg/{version}/monsters-active-actions`
- `ttrpg/{version}/monsters-active-actions-lists`
- `ttrpg/{version}/rulebook`
- `ttrpg/{version}/settings-guide`
- `ttrpg/{version}/patch-notes`

## Decoding and relationships

Several rich-text fields are Base64-encoded UTF-8 HTML. The generator decodes exactly the fields decoded by the public client services: descriptions, requirements, class guides, monster lore/strategy/running notes, and the three long-form documents.

Reverse relationships are ID-based, not text guesses:

- Class `keyAbility`, `ability1`–`ability3`, and `ultimateAbility` point to key/true ability `indexId` values.
- Sub-race `trait1`–`trait3` point to true ability `indexId` values.
- Primary-race ability fields and optional regional ability objects point to true ability `indexId` values.
- Breakthrough `ability` points to a true ability `indexId` when present.
- Monster `abilities` points to a monster-ability-list record; its six slots point to monster-ability `indexId` values.
- Monster `activeActions` points to a monster-action-list record; its six slots point to monster-action `indexId` values.

Player ability pages keep monster matches in a separate “Monsters” section. The two systems do not share IDs, so that section uses exact normalized names only and then resolves the matching monster record through its list IDs. Monster-ability and monster-action pages always use exact ID reverse lookup.

The Abilities index is the single query surface for true abilities, key abilities, breakthroughs, monster traits, and monster actions. It derives unlock-source facets from the same relationships: `Tier 1`, `Tier 2`, or `Tier 3` is added whenever a player ability is reachable from a class of that tier, including a true ability reached through a class key ability. `Race only` is deliberately strict: the ability must be granted by a primary race or sub-race and have no class source. `Breakthrough` is both a record-type filter for all breakthrough effects and a source facet for the true abilities explicitly granted by breakthrough `ability` IDs. Monster records instead receive the exact `Monster` source facet and their source strip lists the monsters using the record through list-ID relationships. Every row displays complete static rules and its linked sources; the former Breakthroughs and Monster Abilities index routes remain for direct/bookmarked links but are not navigation tabs.

Ability costs are independent source fields rather than a single action-cost value. Generated cards test `apCost`, `rpCost`, `manaCost`, and `otherCosts` separately, including explicit zero values. They render as differently colored AP, RP, MP, and Other badges. Full descriptions, ranges, keywords, and requirements are emitted in every abilities-index row and in the embedded ability rows on race and sub-race detail pages.

Race-index cards resolve their displayed ability names from the same ID relationships used by detail pages: primary races include `ability1`, `ability2`, and every populated regional ability object, while sub-races include `trait1`–`trait3`. Names are deduplicated by ability `indexId`, linked to their static ability pages, and included in sub-race search text. Both card types render their downloaded portraits at a fixed 2:3 aspect ratio.

Class-index cards use `keyAbility`, `ability1`–`ability3`, and `ultimateAbility` to resolve and display all five unlock names. Ability names are included in class search text and link to the correct standard- or key-ability route. Race, sub-race, and class-index ability chips also carry a complete static preview fragment containing the ability type, separately colored costs, range, keywords, rich description or key-ability benefits, and requirements. `src/app.js` reveals this fragment in a fixed, viewport-constrained tooltip after a 550 ms intentional-hover delay; keyboard focus reveals the same preview immediately. Each individual class page reconstructs the original progression order rather than flattening raw fields: Key Ability at unlock; Ability 1, Skills, Ability 2, Heart, Ability 3, Soul, and Ultimate Ability at levels 2–8. The progression uses permanent, preview-enabled ability links, while a separate full-card section below retains complete costs, facts, rules text, benefits, and requirements for every unlocked ability. Class profile data and entry requirements are isolated in a mechanics panel; flavor description and tactical guide are emitted as separately labeled narrative sections.

Class skill-unlock facets are rebuilt from rules text on every scrape. Level 1 is parsed from each class's key-ability benefit, while `skills`, `heart`, and `soul` become the level 3, 5, and 7 filter sets. The level 1 selector exposes the actual skill or stat granted by the ability—never the ability's name. Named skills and stats are matched against the canonical Basic Actions groups; generic grants such as “any non-crafting skill,” category-wide Reason/Awareness/Presence choices, Expert Knowledge, and Transmuter crafting disciplines are deliberately expanded before writing card attributes. Key-ability benefits are inspected for sentences that grant skill points, expertise-skill points, or a numeric stat bonus. Level 1 facets are attached to class-card data for filtering, while visible grant tags remain on key-ability rows, dedicated key-ability pages, and hover previews; class index cards do not show a separate Grants panel. Point totals and eligible-choice counts are emitted as numeric sort fields, while the actual grant names use pipe-delimited exact-match facets so `Art` cannot accidentally match `Artifice`. Future scrapes should audit any class whose level 3 grant resolves to zero named choices, and any key benefit containing `gain`, a numeric `+`, or `points` that is not classified by these rules.

Monster-index cards resolve their passive traits through the monster `abilities` list and their active actions through `activeActions`, reading all six possible slots from each list. Both groups are named and linked separately on each 2:3 portrait card, included in search text, and carry the same rich delayed previews as player abilities. The unified Abilities index emits full-width static rows for all monster traits and active actions alongside player records: traits are explicitly labeled passive, while actions retain separately colored AP/RP/MP/Other costs, range, keywords, descriptions, and requirements. Every row deduplicates and links its `Used by` monster sources through the exact list-ID relationships.

Breakthroughs are emitted in the unified Abilities index rather than a navigation tab. All 89 records include their EXP cost, complete description, requirements, and permanent detail route. The five records with a populated `ability` ID also render a linked, preview-enabled `Grants` ability in their source strip; that same breakthrough name is reverse-linked as a proper source on the granted ability row and detail page.

Keyword pages reverse-index comma-separated keyword names on player abilities and monster actions. During page generation, visible text nodes are keyword-highlighted and receive a focus/hover tooltip containing the keyword definition. Officially capitalized keyword spellings are always annotated. Lowercase forms are also annotated for distinctive game terms such as “prone,” while a documented generator denylist suppresses noisy ordinary words such as “active,” “type,” “safe,” and “fire.” Existing anchors are left intact to avoid nested links.

The abilities keyword filter is generated from the exact comma-separated keyword tokens in the current snapshot. Filtering compares normalized whole tokens, so selecting `Fire` does not accidentally match a longer keyword containing the same letters.

## Static-site guarantees

- All record content is present in generated HTML.
- There are no client API calls and no runtime templates/components.
- JavaScript only enhances already-rendered content: it filters and orders cards, manages search and responsive navigation, persists index state, rolls local dice, and formats/copies annotated Avrae commands.
- Index state is encoded in the current URL and in `localStorage`. Browser Back therefore restores it naturally, while detail-page “Back” links are enhanced with the last state for that section.
- Search results are pre-rendered into `search/index.html`; typing only filters them.
- Basic Action cards and their rulebook formulas are emitted into `basic-actions/index.html`; the calculator never contacts a server. Shared Power, Focus, Agility, Toughness, Fitness, Cunning, Reason, Awareness, Presence, Crafting Skill, and Gathering Skill values are stored under `lyrian-manual:basic-action-stats` in browser `localStorage` so one profile works across every card and later sessions. Expertise remains explicit in displayed formulas, but it is not treated as a shared skill stat or given its own input; players include the applicable Expertise total in the combined Expertise/temporary-modifiers field. Every shared value is editable both in the profile and inline on each card that uses it; all mirrors update together. Situational per-card modifiers are intentionally not retained. Each roll specification also calculates its current minimum and maximum total from its dice, shared stats, multipliers, fixed bonuses, and local modifiers.
- Base Initiative is derived from Agility, matching the rulebook’s derived-stat definition. Light, Precise, Heavy, and Two-Handed Heavy cards each display separate full accuracy and damage formulas. Attack output is a paste-ready three-line block: `!multiline`, followed by one annotated `!r` command for accuracy and one for damage. Accuracy annotations begin with `🎯` and damage annotations with `⚔️`, making the results distinguishable if Discord displays them out of order. Avrae’s built-in `multiline` command executes every prefixed line as a separate command, so attacks do not depend on server-enabled inline rolling. Single rolls continue to use `!r <expression> <plain comment>`. This follows the rulebook recommendation to roll damage immediately with the accuracy check.
- Skill checks use one grouped selector rather than one card per skill. The five rulebook affiliations and all 21 main skills are declared in `skillCheckGroups`; selecting a main skill chooses its affiliated shared sub-stat automatically, and that sub-stat can be edited directly in the skill tool. The same selector includes the seven artisan crafting categories—Alchemy, Armorsmithing, Artificing, Blacksmithing, Carpentry, Culinary, and Farming—and switches those entries to the crafting-specific `1d10 + Skill + Expertise + modifiers` formula without a sub-stat. Per-skill and per-crafting-category bonuses plus the last selection are retained under `lyrian-manual:skill-check-profile`. Expertise and other situational adjustments share one temporary bonuses/modifiers field and are not saved.
- The Basic Actions page copies its combat, crafting, and gathering instruction sections directly from the scraped rulebook HTML on every build. `headingSection` locates Combat at level two and the two production sections at level three by normalized heading text, so refreshed rulebook wording, tables, and lists flow into the tools page automatically. `combatActionCards` extracts each leading `<strong>Action name</strong>` paragraph from the `Actions in combat` subsection and turns it into a full ability-style card, preserving its cost and rules text. Those cards live in their own closed native `<details>` element inside the closed combat-instructions block; both levels remain fully present in static HTML. Inside the instruction blocks, `collapseRulebookExamples` converts each `Example` or `Example Node` subsection into an independently expandable nested `<details>` element.
- Global navigation is emitted once per page as a compact sticky header plus a persistent desktop sidebar. Rulebook and Basic Actions are the featured sidebar destinations; the remaining links are grouped by player reference, encounters, and manual pages. Below 900px the same static sidebar becomes an off-canvas drawer with a close control, backdrop, Escape-key handling, and no duplicated navigation markup.
- Downloaded artwork is stored under `public/assets/images/` and all generated pages reference local copies. `public/` is a generated deployment artifact and is replaced at the start of every build.

## Refresh checklist

1. Run `node scripts/scrape-and-build.mjs`.
2. Confirm the summary reports a non-zero page, record, and image count.
3. Serve `public/` over HTTP and test the home page, one detail page per record type, ability reverse lookup, keyword tooltip, search, and index persistence.
4. Compare API collection counts in `data/latest.json` with `public/build-meta.json` and spot-check empty relationships before publication.
5. If the deployment base URL is known, replace `https://example.invalid` in the generated sitemap logic with that origin before publishing.
6. Keep the previous versioned snapshot in `data/`; `latest.json` may move forward while historical snapshots remain reproducible.
