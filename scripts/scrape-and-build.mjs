#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA = path.join(ROOT, "data");
const SOURCE = "https://rpg.angelssword.com";
const API = "https://api.angelssword.com";
const CDN_LOGOS = [
  `${SOURCE}/images/lyrian-chronicals-logo-long.webp`,
  `${SOURCE}/images/lyrian-logo-black.webp`,
];
const AES_KEY = Buffer.from("CSRITDuXKJgTfpN20FthTQ", "base64url");
const sessionId = Buffer.from(crypto.randomUUID()).toString("base64");

const args = new Map(process.argv.slice(2).map((arg, i, all) => [arg, all[i + 1]]));
const requestedVersion = args.get("--version") || "latest";
const buildOnly = process.argv.includes("--build-only");

const endpointNames = [
  "classes", "true-abilities", "key-abilities", "ancestries", "primary-races",
  "items", "keywords", "breakthroughs", "monsters", "monsters-abilities",
  "monsters-abilities-lists", "monsters-active-actions",
  "monsters-active-actions-lists", "rulebook", "settings-guide", "patch-notes",
];

const basicActions = [
  {
    category: "combat", name: "Initiative", dice: "1d4",
    description: "Determine turn order at the start of battle. Base Initiative equals Agility.",
    formula: "1d4 + Agility + modifiers", stats: [["Agility", "agility", 1], ["Modifiers", "initiative-modifiers", 1]],
  },
  {
    category: "combat", name: "Light Attack", formula: "Accuracy: 1d20 + Focus · Damage: 2d4 + Power",
    description: "Make a basic Light Attack. Roll accuracy and damage together; damage applies if the accuracy meets or exceeds the target’s Evasion.",
    rolls: [
      { label: "Accuracy", dice: "1d20", formula: "1d20 + Focus", stats: [["Focus", "focus", 1], ["Modifiers", "accuracy-modifiers", 1]] },
      { label: "Damage", dice: "2d4", formula: "2d4 + Power", stats: [["Power", "power", 1], ["Modifiers", "damage-modifiers", 1]] },
    ],
  },
  {
    category: "combat", name: "Precise Attack", formula: "Accuracy: 1d20 + (Focus × 2) · Damage: 2d4 + Power",
    description: "Make a basic Precise Attack. Double Focus for accuracy, roll Light damage, and apply Pinpoint as described in the rulebook.",
    rolls: [
      { label: "Accuracy", dice: "1d20", formula: "1d20 + (Focus × 2)", stats: [["Focus", "focus", 2], ["Modifiers", "accuracy-modifiers", 1]] },
      { label: "Damage", dice: "2d4", formula: "2d4 + Power", stats: [["Power", "power", 1], ["Modifiers", "damage-modifiers", 1]] },
    ],
  },
  {
    category: "combat", name: "Heavy Attack", formula: "Accuracy: 1d20 + Focus · Damage: 4d6 + (Power × 2)",
    description: "Make a basic Heavy Attack with a standard weapon. Roll accuracy and damage together before the defender chooses a reaction.",
    rolls: [
      { label: "Accuracy", dice: "1d20", formula: "1d20 + Focus", stats: [["Focus", "focus", 1], ["Modifiers", "accuracy-modifiers", 1]] },
      { label: "Damage", dice: "4d6", formula: "4d6 + (Power × 2)", stats: [["Power", "power", 2], ["Modifiers", "damage-modifiers", 1]] },
    ],
  },
  {
    category: "combat", name: "Two-Handed Heavy Attack", formula: "Accuracy: 1d20 + Focus · Damage: 5d6 + (Power × 2)",
    description: "Make a melee Heavy Attack with a Two-Handed weapon, using its increased damage die pool.",
    rolls: [
      { label: "Accuracy", dice: "1d20", formula: "1d20 + Focus", stats: [["Focus", "focus", 1], ["Modifiers", "accuracy-modifiers", 1]] },
      { label: "Damage", dice: "5d6", formula: "5d6 + (Power × 2)", stats: [["Power", "power", 2], ["Modifiers", "damage-modifiers", 1]] },
    ],
  },
  {
    category: "combat", name: "Save", dice: "2d10",
    description: "Resist an effect by comparing this total against the source’s Potency.",
    formula: "2d10 + Toughness", stats: [["Toughness", "toughness", 1], ["Modifiers", "modifiers", 1]],
  },
  {
    category: "crafting", name: "Basic Craft", dice: "1d10",
    description: "Spend 1 Crafting Die and add the crafting check to the item’s crafting-points total. This action has Rapid.",
    formula: "1d10 + Crafting Skill + Expertise + modifiers",
    stats: [["Crafting Skill", "crafting-skill", 1], ["Expertise + modifiers", "modifiers", 1]],
  },
  {
    category: "crafting", name: "Beginner’s Luck", dice: "2d10kh1",
    description: "Spend 1 Crafting Die, roll two d10s, and keep the highest. Do not add your Crafting Skill.",
    formula: "2d10, keep highest + modifiers", stats: [["Modifiers", "modifiers", 1]],
  },
  {
    category: "gathering", name: "Basic Strike", dice: "1d10",
    description: "Spend 1 Strike Die and add a gathering check to the target node’s Node Points. This action has Rapid.",
    formula: "1d10 + Gathering Skill + modifiers",
    stats: [["Gathering Skill", "gathering-skill", 1], ["Modifiers", "modifiers", 1]],
  },
  {
    category: "gathering", name: "Lucky Strike", dice: "1d10",
    description: "Spend 1 Strike Die and 10 Node Points, then add the check to Lucky Points with a +10 bonus. This action has Rapid.",
    formula: "1d10 + Gathering Skill + modifiers + 10",
    stats: [["Gathering Skill", "gathering-skill", 1], ["Modifiers", "modifiers", 1]], fixed: 10,
  },
  {
    category: "gathering", name: "Novice’s Perseverance", dice: "2d10kh1",
    description: "Spend 1 Strike Die, roll two d10s, and keep the highest. Do not add your Gathering Skill; apply the result to Node or Lucky Points.",
    formula: "2d10, keep highest + modifiers", stats: [["Modifiers", "modifiers", 1]],
  },
  {
    category: "gathering", name: "Iron Focus", dice: "1d10",
    description: "Spend 1 Strike Die and 5 Lucky Points. Make a gathering check, then gain +5 to later gathering checks this session.",
    formula: "1d10 + Gathering Skill + modifiers",
    stats: [["Gathering Skill", "gathering-skill", 1], ["Modifiers", "modifiers", 1]],
  },
];

const basicActionSharedStats = [
  ["Power", "power"], ["Focus", "focus"], ["Agility", "agility"], ["Toughness", "toughness"],
  ["Fitness", "fitness"], ["Cunning", "cunning"], ["Reason", "reason"], ["Awareness", "awareness"], ["Presence", "presence"],
  ["Crafting Skill", "crafting-skill"], ["Gathering Skill", "gathering-skill"],
];

const basicActionProfileGroups = [
  ["Stats", "Core combat values", basicActionSharedStats.slice(0, 4)],
  ["Substats", "Shared by skill checks", basicActionSharedStats.slice(4, 9)],
  ["Skills", "Crafting and gathering bonuses", basicActionSharedStats.slice(9)],
];

const skillCheckGroups = [
  ["Fitness", "fitness", ["Athletics", "Riding"]],
  ["Cunning", "cunning", ["Deception", "Roguecraft", "Stealth"]],
  ["Reason", "reason", ["Artifice", "Appraise", "Common Knowledge", "Flight", "History", "Linguistics", "Magic", "Medicine", "Religion"]],
  ["Awareness", "awareness", ["Animal Husbandry", "Insight", "Perception", "Survival"]],
  ["Presence", "presence", ["Art", "Intimidation", "Negotiation"]],
  ["Crafting categories", "", ["Alchemy", "Armorsmithing", "Artificing", "Blacksmithing", "Carpentry", "Culinary", "Farming"], { dice: "1d10", kind: "crafting" }],
];

const gatheringSkillNames = ["Foraging", "Mining"];
const progressionSkillGroups = new Map([
  ...skillCheckGroups.map(([name, , skills]) => [name, skills]),
  ["Gathering categories", gatheringSkillNames],
]);
const progressionSkillNames = [...new Set([...progressionSkillGroups.values()].flat())];
const nonProductionSkillNames = skillCheckGroups
  .filter(([name]) => name !== "Crafting categories")
  .flatMap(([, , skills]) => skills);
const craftingSkillNames = progressionSkillGroups.get("Crafting categories");
const heartStatNames = ["Fitness", "Cunning", "Reason", "Awareness", "Presence"];
const soulStatNames = ["Focus", "Power", "Agility", "Toughness"];
const allStatNames = [...heartStatNames, ...soulStatNames];

function regexEscape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function namedMatches(text, names) {
  return names.filter(name => new RegExp(`\\b${regexEscape(name)}\\b`, "i").test(text));
}

function progressionSkillGrants(text = "") {
  const grants = new Set(namedMatches(text, progressionSkillNames));
  if (/any\s+Reason,\s*Awareness\s+or\s+Presence\s+category\s+skill/i.test(text)) {
    for (const group of ["Reason", "Awareness", "Presence"]) {
      for (const skill of progressionSkillGroups.get(group)) grants.add(skill);
    }
  }
  if (/any\s+non[- ]?crafting/i.test(text)) {
    const excludesGathering = /non[- ]?crafting(?:\s+and|\s+or)?\s+(?:non[- ]?)?gathering|non[- ]?crafting\s+or\s+gathering/i.test(text);
    for (const skill of nonProductionSkillNames) grants.add(skill);
    if (!excludesGathering) for (const skill of gatheringSkillNames) grants.add(skill);
  }
  if (/crafting disciplines?/i.test(text)) for (const skill of craftingSkillNames) grants.add(skill);
  if (/Expert Knowledge/i.test(text)) grants.add("Expert Knowledge");
  return [...grants].sort((a, b) => a.localeCompare(b));
}

function progressionStatGrants(text = "", names = allStatNames) {
  return namedMatches(text, names).sort((a, b) => a.localeCompare(b));
}

function grantedPointTotal(text = "") {
  let total = 0;
  for (const match of text.matchAll(/\+?(\d+)\s+(?:skill(?:\s+points?)?|Transmuter\s+points?)\b/gi)) total += Number(match[1]);
  for (const match of text.matchAll(/\bgain(?:\s+an\s+additional|\s+also)?\s+\+?(\d+)\s+points?\b/gi)) total += Number(match[1]);
  if (!total && /exchange any skill point/i.test(text)) {
    const implicit = text.match(/\bgain\s+\+?(\d+)(?:\s+skill)?\b/i);
    if (implicit) total = Number(implicit[1]);
  }
  return total;
}

function keyAbilityGrantInfo(item) {
  if (!item) return { skills: [], stats: [], skillPoints: 0, statPoints: 0 };
  const benefits = [item.benefit1, item.benefit2, item.benefit3, item.benefit4].filter(Boolean);
  const skillBenefits = benefits.filter(value => /\b(?:skill points?|expertise skill|exchange any skill point)\b/i.test(value) && /\bgain\b/i.test(value));
  const statCheckPattern = new RegExp(`\\b(?:${allStatNames.map(regexEscape).join("|")})\\s+checks?\\b`, "ig");
  const statBenefits = benefits.filter(value => {
    const withoutCheckBonuses = value.replace(statCheckPattern, "");
    return /\+\s*\d+/.test(value) && /\b(?:gain|gives?|bonus)\b/i.test(value) && namedMatches(withoutCheckBonuses, allStatNames).length;
  });
  const skillText = skillBenefits.join(" ");
  const statText = statBenefits.join(" ");
  return {
    skills: progressionSkillGrants(skillText),
    stats: progressionStatGrants(statText),
    skillPoints: grantedPointTotal(skillText),
    statPoints: [...statText.matchAll(/\+\s*(\d+)/g)].reduce((sum, match) => sum + Number(match[1]), 0),
  };
}

function browserHeaders() {
  const requestId = Buffer.from(String(Date.now())).toString("base64");
  const cipher = crypto.createCipheriv("aes-128-cbc", AES_KEY, Buffer.from(requestId.slice(0, 16)));
  const requestkey = Buffer.concat([cipher.update(sessionId), cipher.final()]).toString("base64");
  return {
    accept: "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    origin: SOURCE,
    referer: `${SOURCE}/`,
    requestid: requestId,
    requestkey,
    sessionid: sessionId,
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  };
}

async function apiGet(endpoint, attempt = 0) {
  const response = await fetch(`${API}/${endpoint}`, { headers: browserHeaders() });
  if (!response.ok) {
    if (attempt < 4 && [400, 429, 500, 502, 503, 504].includes(response.status)) {
      await new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt));
      return apiGet(endpoint, attempt + 1);
    }
    throw new Error(`${endpoint}: HTTP ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function mapLimit(values, limit, fn) {
  const output = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      output[index] = await fn(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return output;
}

function decode(value) {
  if (!value || typeof value !== "string") return value || "";
  try { return Buffer.from(value, "base64").toString("utf8"); }
  catch { return value; }
}

function decodeFields(record, fields) {
  const copy = { ...record };
  for (const field of fields) if (copy[field]) copy[field] = decode(copy[field]);
  return copy;
}

async function scrape() {
  const versions = await apiGet("ttrpg/version/list");
  const version = requestedVersion === "latest" ? versions[0].versionNumber : requestedVersion;
  if (!versions.some(item => item.versionNumber === version)) throw new Error(`Unknown version ${version}`);

  const values = await mapLimit(endpointNames, 5, async name => [name, await apiGet(`ttrpg/${version}/${name}`)]);
  const raw = Object.fromEntries(values);

  const classDetails = await mapLimit(raw.classes, 7, item => apiGet(`ttrpg/${version}/class/${item.classId}`));
  const ancestryDetails = await mapLimit(raw.ancestries, 7, item => apiGet(`ttrpg/${version}/ancestry/${item.ancestryId}`));
  const primaryRaceDetails = await mapLimit(raw["primary-races"], 5, item => apiGet(`ttrpg/${version}/primary-race/${item.primaryRaceId}`));
  const itemDetails = await mapLimit(raw.items, 7, item => apiGet(`ttrpg/${version}/item/${item.itemId}`));
  const monsterDetails = await mapLimit(raw.monsters, 7, item => apiGet(`ttrpg/${version}/monster/${item.monsterId}`));

  const snapshot = {
    metadata: {
      source: `${SOURCE}/game/online-manual`,
      api: API,
      scrapedAt: new Date().toISOString(),
      version,
      availableVersions: versions,
    },
    collections: {
      classes: classDetails.map(item => decodeFields(item, ["description", "requirements", "guide"])),
      trueAbilities: raw["true-abilities"].map(item => decodeFields(item, ["description", "requirement"])),
      keyAbilities: raw["key-abilities"],
      ancestries: ancestryDetails.map(item => decodeFields(item, ["description"])),
      primaryRaces: primaryRaceDetails.map(item => decodeFields(item, ["description"])),
      items: itemDetails.map(item => decodeFields(item, ["description"])),
      keywords: raw.keywords.map(item => decodeFields(item, ["description"])),
      breakthroughs: raw.breakthroughs.map(item => decodeFields(item, ["description"])),
      monsters: monsterDetails.map(item => decodeFields(item, ["lore", "strategy", "runningMonster"])),
      monsterAbilities: raw["monsters-abilities"].map(item => decodeFields(item, ["description"])),
      monsterAbilityLists: raw["monsters-abilities-lists"],
      monsterActions: raw["monsters-active-actions"].map(item => decodeFields(item, ["descriptions", "requirements"])),
      monsterActionLists: raw["monsters-active-actions-lists"],
      rulebook: decodeFields(raw.rulebook, ["content"]),
      settingsGuide: decodeFields(raw["settings-guide"], ["content"]),
      patchNotes: decodeFields(raw["patch-notes"], ["content"]),
    },
  };
  await fs.mkdir(DATA, { recursive: true });
  const snapshotPath = path.join(DATA, `manual-${version}.json`);
  await fs.writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  await fs.writeFile(path.join(DATA, "latest.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
  return snapshot;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function slug(value) {
  return String(value ?? "item").toLowerCase().normalize("NFKD").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

function stripTags(value) {
  return String(value ?? "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function textExcerpt(value, maxLength = 420) {
  const named = { quot: '"', apos: "'", lt: "<", gt: ">", amp: "&" };
  const text = stripTags(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&(quot|apos|lt|gt|amp);/gi, (_, entity) => named[entity.toLowerCase()]);
  if (text.length <= maxLength) return text;
  const clipped = text.slice(0, maxLength + 1).replace(/\s+\S*$/, "").trim();
  return `${clipped || text.slice(0, maxLength).trim()}…`;
}

function htmlHeadings(value) {
  return [...String(value || "").matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map(match => ({
    start: match.index,
    end: match.index + match[0].length,
    level: Number(match[1]),
    text: stripTags(match[2]).replace(/:$/, "").trim(),
  }));
}

function headingSection(value, name, level) {
  const html = String(value || "");
  const headings = htmlHeadings(html);
  const index = headings.findIndex(heading => heading.level === level && heading.text.toLowerCase() === name.toLowerCase());
  if (index < 0) return "";
  const start = headings[index];
  const end = headings.slice(index + 1).find(heading => heading.level <= start.level);
  return html.slice(start.end, end?.start ?? html.length);
}

function collapseRulebookExamples(value, context) {
  let html = String(value || "");
  const examples = htmlHeadings(html).map((heading, index, headings) => ({
    ...heading,
    next: headings.slice(index + 1).find(candidate => candidate.level <= heading.level),
  })).filter(heading => /^example(?: node)?$/i.test(heading.text));
  for (const example of examples.reverse()) {
    const end = example.next?.start ?? html.length;
    const label = /node/i.test(example.text) ? "Show example node" : `Show ${context} example`;
    const body = html.slice(example.end, end);
    html = `${html.slice(0, example.start)}<details class="rulebook-example"><summary>${esc(label)}</summary><div class="rulebook-example-body">${body}</div></details>${html.slice(end)}`;
  }
  return html;
}

function combatActionCards(value, format = html => html) {
  const actionSection = headingSection(value, "Actions in combat", 3);
  const firstSubheading = htmlHeadings(actionSection)[0];
  const basicActionsOnly = actionSection.slice(0, firstSubheading?.start ?? actionSection.length);
  const actions = [...basicActionsOnly.matchAll(/<p>([\s\S]*?)<\/p>/gi)].map(match => {
    const contents = match[1];
    const title = contents.match(/^\s*<strong>([\s\S]*?)<\/strong>/i);
    if (!title) return null;
    const name = stripTags(title[1]).replace(/[:\s]+$/, "");
    if (!name) return null;
    const description = contents.slice(title[0].length).replace(/^\s*:\s*/, "");
    return { name, description };
  }).filter(Boolean);
  const unique = [...new Map(actions.map(action => [action.name.toLowerCase(), action])).values()];
  const cards = unique.map(action => `<article class="ability-row basic-combat-action-card"><header class="ability-row-head"><div><p class="card-kind">Basic combat action</p><h3>${esc(action.name)}</h3></div><span class="basic-action-card-type">Rulebook action</span></header><div class="ability-row-body"><div class="ability-full-text"><div class="prose ability-description"><p>${format(action.description)}</p></div></div></div></article>`).join("");
  return `<details class="combat-action-cards"><summary><span><span class="eyebrow">Rulebook reference</span><strong>Basic combat actions</strong></span><small>${unique.length} actions</small><span class="combat-action-cards-state" aria-hidden="true"></span></summary><div class="combat-action-cards-body"><p>Every standard combat action is expanded below. Downed, non-heroic, Encounter Start, Encounter Conclusion, and custom actions remain in their own rulebook subsections.</p><div class="ability-list">${cards}</div></div></details>`;
}

function rich(value, version) {
  return String(value || "")
    .replace(/\[\[([a-z\-/]+)\]\]/gi, (_, route) => `/game/${version}/${route}`)
    .replace(/href=(["'])(classes|keywords|breakthroughs|monsters)\1/gi, (_, quote, route) => `href=${quote}/${route.toLowerCase()}/${quote}`);
}

function imageFilename(url) {
  const parsed = new URL(url);
  const ext = path.extname(parsed.pathname) || ".webp";
  const base = decodeURIComponent(path.basename(parsed.pathname, ext)).replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 72) || "image";
  return `${base}-${crypto.createHash("sha1").update(url).digest("hex").slice(0, 10)}${ext.toLowerCase()}`;
}

function collectImageUrls(value, set = new Set()) {
  if (typeof value === "string" && /^https:\/\//.test(value) && /\.(webp|png|jpe?g|gif|svg)(\?|$)/i.test(value)) set.add(value);
  else if (Array.isArray(value)) for (const item of value) collectImageUrls(item, set);
  else if (value && typeof value === "object") for (const item of Object.values(value)) collectImageUrls(item, set);
  return set;
}

async function downloadImages(snapshot) {
  const imageDir = path.join(PUBLIC_DIR, "assets", "images");
  await fs.mkdir(imageDir, { recursive: true });
  const urls = [...collectImageUrls(snapshot), ...CDN_LOGOS];
  const map = {};
  await mapLimit(urls, 8, async url => {
    const filename = imageFilename(url);
    const destination = path.join(imageDir, filename);
    map[url] = `/assets/images/${encodeURIComponent(filename)}`;
    try { await fs.access(destination); return; } catch {}
    const response = await fetch(url, { headers: { referer: `${SOURCE}/`, "user-agent": browserHeaders()["user-agent"] } });
    if (!response.ok) { console.warn(`Image skipped (${response.status}): ${url}`); return; }
    await fs.writeFile(destination, Buffer.from(await response.arrayBuffer()));
  });
  return map;
}

function relationMap() {
  const map = new Map();
  return {
    add(id, value) { if (!id) return; if (!map.has(id)) map.set(id, []); map.get(id).push(value); },
    get(id) { return map.get(id) || []; },
  };
}

function makeRelations(c) {
  const abilities = relationMap(), keyAbilities = relationMap(), monsterAbilities = relationMap(), monsterActions = relationMap();
  for (const item of c.classes) {
    const source = { name: item.name, url: `/classes/${item.classId}/`, type: "Class", tier: item.tier };
    keyAbilities.add(item.keyAbility, source);
    for (const field of ["ability1", "ability2", "ability3", "ultimateAbility"]) abilities.add(item[field], source);
  }
  // Key abilities often grant a separately indexed true ability. Carry the
  // class source through that association so the true-ability page answers
  // “which class unlocks this?” even when the unlock is indirect.
  for (const keyAbility of c.keyAbilities) {
    for (const source of keyAbilities.get(keyAbility.indexId)) {
      abilities.add(keyAbility.associatedAbility, { ...source, type: `${source.type} via key ability` });
    }
  }
  for (const item of c.ancestries) {
    const source = { name: item.name, url: `/races/${item.ancestryId}/`, type: "Sub-race" };
    for (const field of ["trait1", "trait2", "trait3"]) abilities.add(item[field], source);
  }
  for (const item of c.primaryRaces) {
    const source = { name: item.name, url: `/races/${item.primaryRaceId}/`, type: "Race" };
    for (const field of ["ability1", "ability2"]) abilities.add(item[field], source);
    for (const field of ["wi", "lir", "d", "ar", "lu", "ni", "un", "vi", "none"]) abilities.add(item[field]?.ability, source);
  }
  for (const item of c.breakthroughs) abilities.add(item.ability, { name: item.name, url: `/breakthroughs/${item.breakthroughId || slug(item.name)}/`, type: "Breakthrough" });

  const abilityListById = new Map(c.monsterAbilityLists.map(item => [item.indexId, item]));
  const actionListById = new Map(c.monsterActionLists.map(item => [item.indexId, item]));
  for (const monster of c.monsters) {
    const source = { name: monster.name, url: `/monsters/${monster.monsterId}/`, type: "Monster" };
    const abilityList = abilityListById.get(monster.abilities);
    const actionList = actionListById.get(monster.activeActions);
    for (let i = 1; i <= 6; i++) monsterAbilities.add(abilityList?.[`ability${i}`], source);
    for (let i = 1; i <= 6; i++) monsterActions.add(actionList?.[`action${i}`], source);
  }
  return { abilities, keyAbilities, monsterAbilities, monsterActions };
}

function keyworder(keywords) {
  // These are ordinary English words that appear frequently in rules prose.
  // Their official capitalized spelling is still annotated, but lowercase
  // uses stay plain to avoid turning whole paragraphs into tooltip fields.
  const lowercaseDenylist = new Set([
    "active", "aid", "broken", "burning", "challenge", "charm",
    "concentration", "crushing", "divine", "domain", "expose", "fire",
    "hiding", "instant", "isolated", "miracle", "pass", "persist", "quick",
    "rage", "rapid", "root", "safe", "scatter", "setup", "shaken", "slow",
    "song", "sound", "spell", "stacking", "stance", "static", "stealth",
    "summon", "teleport", "transformation", "type", "upkeep",
  ]);
  const entries = keywords.map(item => ({
    name: item.name,
    lower: item.name.toLowerCase(),
    url: `/keywords/${item.keywordId || slug(item.name)}/`,
    tooltip: stripTags(item.description).slice(0, 260),
  })).sort((a, b) => b.name.length - a.name.length);
  const pattern = new RegExp(`\\b(${entries.map(item => item.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "gi");
  const byName = new Map(entries.map(item => [item.lower, item]));
  return html => {
    let inLink = false;
    return String(html || "").split(/(<[^>]+>)/g).map(part => {
      if (part.startsWith("<")) {
        if (/^<a\b/i.test(part)) inLink = true;
        if (/^<\/a/i.test(part)) inLink = false;
        return part;
      }
      if (inLink) return part;
      return part.replace(pattern, match => {
        const item = byName.get(match.toLowerCase());
        if (match !== item.name && lowercaseDenylist.has(item.lower)) return match;
        return `<a class="keyword" href="${item.url}" data-tooltip="${esc(item.tooltip)}">${match}</a>`;
      });
    }).join("");
  };
}

function uniqueRelations(values) {
  const seen = new Set();
  return values.filter(item => item && !seen.has(item.url) && seen.add(item.url));
}

function relationSection(title, values, className = "") {
  const items = uniqueRelations(values);
  if (!items.length) return `<section class="related ${className}"><h2>${esc(title)}</h2><p class="muted">No direct matches in this version.</p></section>`;
  return `<section class="related ${className}"><h2>${esc(title)}</h2><div class="relation-list">${items.map(item => `<a href="${item.url}"><span>${esc(item.type)}</span>${esc(item.name)}</a>`).join("")}</div></section>`;
}

function nav(section = "") {
  const current = url => url === `/${section}/` ? ` aria-current="page"` : "";
  const link = ([label, url]) => `<a href="${url}"${current(url)}>${esc(label)}</a>`;
  const groups = [
    ["Player reference", [["Races", "/races/"], ["Classes", "/classes/"], ["Abilities", "/abilities/"], ["Items", "/items/"]]],
    ["Encounters", [["Monsters", "/monsters/"]]],
    ["Manual", [["Settings guide", "/settings-guide/"], ["Keywords", "/keywords/"]]],
  ];
  const sidebarGroups = groups.map(([title, links]) => `<section class="sidebar-nav-group"><h2>${esc(title)}</h2>${links.map(link).join("")}</section>`).join("");
  return `<header class="site-header"><a class="brand" href="/"><img src="/assets/images/${encodeURIComponent(imageFilename(CDN_LOGOS[0]))}" alt="Lyrian Chronicles"></a><form class="global-search" action="/search/" method="get"><label class="sr-only" for="global-q">Search manual</label><input id="global-q" name="q" type="search" placeholder="Search this version…"><button>Search</button></form><button class="nav-toggle" type="button" aria-controls="site-sidebar" aria-expanded="false">Browse</button></header><aside class="site-sidebar" id="site-sidebar" aria-label="Manual sections"><button class="sidebar-close" type="button" aria-label="Close navigation">Close</button><nav><div class="sidebar-featured"><a class="sidebar-rulebook" href="/rulebook/"${current("/rulebook/")}><span>Core reference</span><strong>Rulebook</strong></a><a class="sidebar-actions" href="/basic-actions/"${current("/basic-actions/")}><span>At-table tools</span><strong>Basic Actions</strong></a></div>${sidebarGroups}</nav></aside><button class="sidebar-scrim" type="button" tabindex="-1" aria-label="Close navigation" hidden></button>`;
}

function layout({ title, description = "", body, version, section = "" }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | Lyrian Chronicles Static Manual</title><meta name="description" content="${esc(stripTags(description).slice(0, 155))}"><link rel="icon" href="/assets/images/${encodeURIComponent(imageFilename(CDN_LOGOS[1]))}" type="image/webp"><link rel="stylesheet" href="/assets/styles.css"><script src="/assets/app.js" defer></script></head><body data-section="${esc(section)}">${nav(section)}<main>${body}</main><footer><p>Static edition of Lyrian Chronicles ${esc(version)}. Content and artwork sourced from <a href="${SOURCE}/game/online-manual">Angel’s Sword Studios</a>.</p></footer></body></html>`;
}

function imageMarkup(item, images, size = "lg") {
  const source = size === "lg" ? item.imageLgUrl || item.imageSmUrl : item.imageSmUrl || item.imageLgUrl;
  if (!source || !images[source]) return "";
  return `<img class="entity-art" src="${images[source]}" alt="${esc(item.name)}" loading="lazy">`;
}

function fieldTable(item, omit = []) {
  const hidden = new Set(["id", "indexId", "imageSmUrl", "imageLgUrl", "imageAlignment", "description", "lore", "guide", "strategy", "runningMonster", "requirements", "requirement", "descriptions", ...omit]);
  const rows = Object.entries(item).filter(([key, value]) => !hidden.has(key) && value !== "" && value != null && typeof value !== "object");
  if (!rows.length) return "";
  return `<dl class="stat-grid">${rows.map(([key, value]) => `<div><dt>${esc(key.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase()))}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>`;
}

function cardsPage({ title, intro, section, records, filters = [], sortOptions = [], version, kw }) {
  const controls = `<form class="index-controls" data-index-controls data-section-key="${section}"><label>Find<input name="filter" type="search" placeholder="Filter ${esc(title.toLowerCase())}"></label>${filters.map(filter => `<label>${esc(filter.label)}<select name="${esc(filter.name)}"><option value="">All</option>${filter.values.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}</select></label>`).join("")}<label>Sort<select name="sort">${sortOptions.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label><button type="button" data-clear>Clear</button><output data-result-count>${records.length} results</output></form>`;
  const body = `<div class="page-title"><p class="eyebrow">Reference index</p><h1>${esc(title)}</h1><p>${esc(intro)}</p></div>${controls}<div class="card-grid" data-index-grid>${records.map(record => `<article class="entity-card${record.cardClass ? ` ${esc(record.cardClass)}` : ""}" data-card data-name="${esc(record.name.toLowerCase())}" data-search="${esc(record.search || "")}" data-type="${esc(record.type || "")}" data-role="${esc(record.role || "")}" data-tier="${esc(record.tier || "")}" data-danger="${esc(record.danger || "")}" data-cost="${esc(record.cost || "")}">${record.image || ""}<div><p class="card-kind">${esc(record.kind || title.replace(/s$/, ""))}</p><h2><a href="${record.url}">${esc(record.name)}</a></h2>${record.meta ? `<p class="card-meta">${esc(record.meta)}</p>` : ""}<div class="card-summary">${kw(record.summary || "")}</div>${record.actionLabel ? `<a class="card-action" href="${record.url}">${esc(record.actionLabel)} <span aria-hidden="true">→</span></a>` : ""}</div></article>`).join("")}</div>`;
  return layout({ title, description: intro, body, version, section });
}

function basicActionCard(action, kw) {
  const id = slug(action.name);
  const sharedKeys = new Set(basicActionSharedStats.map(([, key]) => key));
  const rolls = action.rolls || [{ label: "Roll", dice: action.dice, formula: action.formula, stats: action.stats, fixed: action.fixed }];
  const headerFormulas = rolls.length > 1
    ? rolls.map(roll => `<code><b>${esc(roll.label)}:</b> ${esc(roll.formula)}</code>`).join("")
    : `<code>${esc(action.formula)}</code>`;
  const rollMarkup = rolls.map(roll => {
    const shared = roll.stats.filter(([, key]) => sharedKeys.has(key));
    const local = roll.stats.filter(([, key]) => !sharedKeys.has(key));
    const fixed = roll.fixed ?? action.fixed ?? 0;
    const inputs = [
      ...shared.map(([label, key, multiplier]) => `<label>${esc(label)}<input type="number" inputmode="numeric" value="0" data-shared-term data-inline-shared-stat="${esc(key)}" data-term-label="${esc(label)}" data-term-key="${esc(key)}" data-multiplier="${multiplier}" aria-label="${esc(`${label} for ${action.name} ${roll.label}`)}"></label>`),
      ...local.map(([label, key, multiplier]) => `<label>${esc(label)}<input type="number" inputmode="numeric" value="0" data-roll-term data-term-label="${esc(label)}" data-term-key="${esc(key)}" data-multiplier="${multiplier}"></label>`),
    ].join("");
    return `<section class="roll-spec" data-roll-spec data-roll-label="${esc(roll.label)}" data-dice="${esc(roll.dice)}" data-fixed="${esc(fixed)}"><div class="roll-spec-heading"><h4>${esc(roll.label)}</h4>${rolls.length > 1 ? `<code>${esc(roll.formula)}</code>` : ""}</div><div class="required-stats"><b>Calculation:</b>${shared.map(([label, , multiplier]) => `<span>${esc(label)}${multiplier !== 1 ? ` × ${multiplier}` : ""}</span>`).join("")}${local.map(([label]) => `<span>${esc(label)}</span>`).join("")}${fixed ? `<span>Fixed +${fixed}</span>` : ""}</div><div class="roll-inputs">${inputs}</div><output class="roll-range" data-roll-range>Possible total: calculating…</output></section>`;
  }).join("");
  const initialMessage = rolls.length > 1 ? "Set modifiers, then roll both checks." : "Set modifiers, then test or generate.";
  return `<article class="roll-card${rolls.length > 1 ? " attack-roll-card" : ""}" id="${id}" data-roll-card data-action-name="${esc(action.name)}"><div class="roll-card-head"><p class="card-kind">${esc(action.category)}</p><h3>${esc(action.name)}</h3><div class="roll-card-formulas">${headerFormulas}</div></div><div class="roll-card-body"><p>${kw(esc(action.description))}</p><div class="roll-specs">${rollMarkup}</div><div class="roll-buttons"><button type="button" data-test-roll>Test roll</button><button type="button" data-generate-roll>Generate Avrae</button><button type="button" data-copy-roll disabled>Copy</button></div><output class="roll-result" data-roll-result aria-live="polite">${initialMessage}</output><div class="avrae-command"><span>Avrae syntax</span><code data-avrae-output>—</code></div></div></article>`;
}

function skillCheckTool() {
  const options = skillCheckGroups.map(([groupLabel, substatKey, skills, config = {}]) => `<optgroup label="${esc(groupLabel)}">${skills.map(skill => `<option value="${slug(skill)}" data-skill-name="${esc(skill)}" data-substat-key="${esc(substatKey)}" data-substat-label="${esc(groupLabel)}" data-roll-kind="${esc(config.kind || "main")}" data-dice="${esc(config.dice || "1d20")}">${esc(skill)}</option>`).join("")}</optgroup>`).join("");
  return `<article class="skill-check-tool" data-skill-check><header class="skill-check-head"><div><p class="card-kind">Universal check</p><h3>Skill Check</h3><p>Choose a skill; its roll formula is selected automatically.</p></div><code data-skill-formula>1d20 + Sub-stat + Skill + Expertise + modifiers</code></header><div class="skill-check-body"><div class="skill-selector-panel"><label>Skill<select data-skill-select>${options}</select></label><label class="selected-substat" data-skill-substat-field><span>Sub-stat: <b data-selected-substat-label>Fitness</b></span><input type="number" inputmode="numeric" value="0" data-skill-substat aria-label="Selected skill sub-stat"></label></div><div class="skill-check-inputs"><label><span class="skill-input-label"><span data-selected-skill-label>Athletics</span> Bonus</span><input type="number" inputmode="numeric" value="0" data-skill-bonus></label><label><span class="skill-input-label">Expertise + modifiers</span><input type="number" inputmode="numeric" value="0" data-skill-modifiers></label></div><output class="roll-range skill-roll-range" data-skill-range>Possible total: calculating…</output><p class="skill-cache-note">Shared sub-stats and each selected Skill bonus are saved. Expertise and modifiers share this unsaved field.</p><div class="roll-buttons"><button type="button" data-test-skill>Test roll</button><button type="button" data-generate-skill>Generate Avrae</button><button type="button" data-copy-skill disabled>Copy</button></div><output class="roll-result" data-skill-result aria-live="polite">Choose a skill, set bonuses, then test or generate.</output><div class="avrae-command"><span>Avrae syntax</span><code data-skill-output>—</code></div></div></article>`;
}

function abilityCosts(item) {
  return [
    ["AP", item.apCost, "ap"],
    ["RP", item.rpCost, "rp"],
    ["MP", item.manaCost, "mp"],
    ["Other", item.otherCosts, "other"],
  ].filter(([, value]) => value !== "" && value != null);
}

function abilityCostMarkup(item) {
  const costs = abilityCosts(item);
  return costs.length
    ? `<div class="ability-costs" aria-label="Ability costs">${costs.map(([name, value, kind]) => `<span class="ability-cost cost-${kind}"><b>${esc(value)}</b> ${name}</span>`).join("")}</div>`
    : `<div class="ability-costs"><span class="ability-cost cost-passive">No listed cost</span></div>`;
}

function abilityGrantMarkup(info, className = "") {
  if (!info || (!info.skills.length && !info.stats.length)) return "";
  const skillLabel = info.skills.length
    ? `<span class="ability-grant grant-skill"><b>${info.skillPoints ? `+${esc(info.skillPoints)} skill point${info.skillPoints === 1 ? "" : "s"}` : "Skill grant"}</b><span>${esc(info.skills.join(", "))}</span></span>`
    : "";
  const statLabel = info.stats.length
    ? `<span class="ability-grant grant-stat"><b>${info.statPoints ? `+${esc(info.statPoints)} stat point${info.statPoints === 1 ? "" : "s"}` : "Stat grant"}</b><span>${esc(info.stats.join(", "))}</span></span>`
    : "";
  return `<div class="ability-grant-tags${className ? ` ${esc(className)}` : ""}" aria-label="Granted skill or stat points"><strong>Grants</strong>${skillLabel}${statLabel}</div>`;
}

function breakthroughCostMarkup(item) {
  const value = item.cost !== "" && item.cost != null ? item.cost : "—";
  return `<div class="ability-costs" aria-label="Breakthrough cost"><span class="ability-cost cost-breakthrough"><b>${esc(value)}</b> EXP</span></div>`;
}

function abilityPreviewMarkup(item, { label = "", passiveLabel = "" } = {}) {
  const isKey = [item.benefit1, item.benefit2, item.benefit3, item.benefit4].some(Boolean);
  const previewLabel = label || (isKey ? "Key ability" : "Ability");
  const costs = isKey
    ? `<div class="ability-costs"><span class="ability-cost cost-key">Class feature</span></div>`
    : (passiveLabel ? `<div class="ability-costs"><span class="ability-cost cost-passive">${esc(passiveLabel)}</span></div>` : abilityCostMarkup(item));
  const facts = [
    item.range && `<div><dt>Range</dt><dd>${esc(item.range)}</dd></div>`,
    item.keywords && item.keywords !== "-" && `<div><dt>Keywords</dt><dd>${esc(item.keywords)}</dd></div>`,
  ].filter(Boolean).join("");
  const description = isKey
    ? [item.benefit1, item.benefit2, item.benefit3, item.benefit4].filter(Boolean).map((value, index) => `<section><h4>Benefit ${index + 1}</h4><p>${esc(value)}</p></section>`).join("")
    : (item.description || `<p class="muted">No description is listed in this version.</p>`);
  const grantMarkup = isKey ? abilityGrantMarkup(keyAbilityGrantInfo(item), "ability-tooltip-grants") : "";
  return `<div class="ability-tooltip-head"><p>${esc(previewLabel)}</p><h3>${esc(item.name)}</h3></div>${costs}${grantMarkup}${facts ? `<dl class="ability-tooltip-facts">${facts}</dl>` : ""}<div class="ability-tooltip-description prose">${description}</div>${item.requirement ? `<section class="ability-tooltip-requirement"><h4>Requirements</h4><div class="prose">${item.requirement}</div></section>` : ""}`;
}

function abilityLinkMarkup(item, { url = "", label = "", passiveLabel = "" } = {}) {
  const isKey = [item.benefit1, item.benefit2, item.benefit3, item.benefit4].some(Boolean);
  const resolvedUrl = url || (isKey ? `/abilities/key/${item.abilityId || slug(item.name)}/` : `/abilities/${item.trueAbilityId || slug(item.name)}/`);
  return `<a class="ability-preview-link" href="${resolvedUrl}" data-ability-preview="${esc(abilityPreviewMarkup(item, { label, passiveLabel }))}">${esc(item.name)}</a>`;
}

function namedAbilityList(abilities) {
  const unique = [...new Map(abilities.filter(Boolean).map(ability => [ability.indexId, ability])).values()];
  return `<section class="lineage-abilities"><h4>Abilities</h4>${unique.length ? `<ul>${unique.map(ability => `<li>${abilityLinkMarkup(ability)}</li>`).join("")}</ul>` : `<p>None listed</p>`}</section>`;
}

function fullAbilityCard(item, kw, { url, label = "Ability", heading = 2, sourceLabels = [], sourceMarkup = "", sourceFacets = [], indexCard = false } = {}) {
  const isKey = label === "Key ability";
  const isBreakthrough = label === "Breakthrough";
  const benefits = isKey
    ? [item.benefit1, item.benefit2, item.benefit3, item.benefit4].filter(Boolean).map((value, index) => `<section><h4>Benefit ${index + 1}</h4><p>${kw(esc(value))}</p></section>`).join("")
    : (item.description ? `<div class="prose ability-description">${kw(item.description)}</div>` : `<p class="muted">No description is listed in this version.</p>`);
  const facts = [
    item.range && ["Range", kw(esc(item.range))],
    item.keywords && item.keywords !== "-" && ["Keywords", kw(esc(item.keywords))],
  ].filter(Boolean);
  const sortCost = isBreakthrough
    ? (parseFloat(String(item.cost).replace(/[^0-9.]/g, "")) || 0)
    : Math.min(...abilityCosts(item).filter(([, value, kind]) => (kind === "ap" || kind === "rp") && Number.isFinite(Number(value))).map(([, value]) => Number(value)), 999);
  const attributes = indexCard
    ? ` data-card data-name="${esc(item.name.toLowerCase())}" data-search="${esc(`${stripTags(item.description || "")} ${[item.benefit1, item.benefit2, item.benefit3, item.benefit4].filter(Boolean).join(" ")} ${stripTags(item.requirement || item.requirements || "")} ${item.keywords || ""}`.toLowerCase())}" data-type="${esc(label)}" data-source="${esc(sourceFacets.join("|"))}" data-keyword="${esc(String(item.keywords || "").split(",").map(value => value.trim().toLowerCase()).filter(value => value && value !== "-").join("|"))}" data-cost="${esc(sortCost)}"`
    : "";
  const headerCosts = isKey
    ? `<div class="ability-costs"><span class="ability-cost cost-key">Class feature</span></div>`
    : (isBreakthrough ? breakthroughCostMarkup(item) : (label === "Monster ability" ? `<div class="ability-costs"><span class="ability-cost cost-passive">Passive trait</span></div>` : abilityCostMarkup(item)));
  const grantMarkup = isKey ? abilityGrantMarkup(keyAbilityGrantInfo(item)) : "";
  return `<article class="ability-row${indexCard ? " ability-index-row" : " embedded-ability"}"${attributes}><header class="ability-row-head"><div><p class="card-kind">${esc(label)}</p><h${heading}><a href="${url}">${esc(item.name)}</a></h${heading}></div>${headerCosts}</header>${grantMarkup}${sourceMarkup || (sourceLabels.length ? `<div class="ability-sources"><div class="player-ability-sources"><b>Sources</b>${sourceLabels.map(value => `<span class="source-label">${esc(value)}</span>`).join("")}</div></div>` : "")}<div class="ability-row-body">${facts.length ? `<dl class="ability-facts">${facts.map(([name, value]) => `<div><dt>${name}</dt><dd>${value}</dd></div>`).join("")}</dl>` : ""}<div class="ability-full-text">${benefits}${item.requirement ? `<section class="ability-requirement"><h4>Requirements</h4><div class="prose">${kw(item.requirement)}</div></section>` : ""}</div></div></article>`;
}

function abilityBody(item, label, kw) {
  return `<p class="eyebrow">${esc(label)}</p><h1>${esc(item.name)}</h1>${abilityCostMarkup(item)}${item.range ? `<p><b>Range:</b> ${kw(esc(item.range))}</p>` : ""}${item.keywords ? `<p><b>Keywords:</b> ${kw(esc(item.keywords))}</p>` : ""}${item.description ? `<div class="prose">${kw(item.description)}</div>` : ""}${item.requirement ? `<section><h2>Requirements</h2><div class="prose">${kw(item.requirement)}</div></section>` : ""}`;
}

async function writePage(relative, html) {
  const destination = path.join(PUBLIC_DIR, relative, "index.html");
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, html);
}

async function build(snapshot) {
  const { metadata, collections: c } = snapshot;
  await fs.rm(PUBLIC_DIR, { recursive: true, force: true });
  await fs.mkdir(path.join(PUBLIC_DIR, "assets"), { recursive: true });
  await Promise.all([
    fs.copyFile(path.join(ROOT, "src", "styles.css"), path.join(PUBLIC_DIR, "assets", "styles.css")),
    fs.copyFile(path.join(ROOT, "src", "app.js"), path.join(PUBLIC_DIR, "assets", "app.js")),
  ]);
  const images = await downloadImages(snapshot);
  const kw = keyworder(c.keywords);
  const relations = makeRelations(c);
  const trueById = new Map(c.trueAbilities.map(item => [item.indexId, item]));
  const keyById = new Map(c.keyAbilities.map(item => [item.indexId, item]));
  const primaryRaceByName = new Map(c.primaryRaces.map(item => [item.name, item]));
  const level1GrantByAbilityId = new Map(c.keyAbilities.map(item => [item.indexId, keyAbilityGrantInfo(item)]));
  const classSkillUnlockById = new Map(c.classes.map(item => {
    const level3Skills = progressionSkillGrants(item.skills);
    const level5Stats = progressionStatGrants(item.heart, heartStatNames);
    const level7Stats = progressionStatGrants(item.soul, soulStatNames);
    const level1 = level1GrantByAbilityId.get(item.keyAbility) || { skills: [], stats: [], skillPoints: 0, statPoints: 0 };
    return [item.classId, {
      level1,
      level1Facets: [
        ...level1.skills.map(value => `skill:${value}`),
        ...level1.stats.map(value => `stat:${value}`),
      ],
      level3Skills,
      level3Points: grantedPointTotal(item.skills),
      level5Stats,
      level7Stats,
    }];
  }));
  const monsterAbilityById = new Map(c.monsterAbilities.map(item => [item.indexId, item]));
  const monsterActionById = new Map(c.monsterActions.map(item => [item.indexId, item]));
  const monsterAbilityListById = new Map(c.monsterAbilityLists.map(item => [item.indexId, item]));
  const monsterActionListById = new Map(c.monsterActionLists.map(item => [item.indexId, item]));
  const monsterPowersByName = new Map();
  for (const item of c.monsterAbilities) {
    const key = item.name.toLowerCase();
    if (!monsterPowersByName.has(key)) monsterPowersByName.set(key, []);
    monsterPowersByName.get(key).push({ item, kind: "ability" });
  }
  for (const item of c.monsterActions) {
    const key = item.name.toLowerCase();
    if (!monsterPowersByName.has(key)) monsterPowersByName.set(key, []);
    monsterPowersByName.get(key).push({ item, kind: "action" });
  }
  const monsterSourcesFor = item => uniqueRelations((monsterPowersByName.get(item.name.toLowerCase()) || []).flatMap(match => match.kind === "ability" ? relations.monsterAbilities.get(match.item.indexId) : relations.monsterActions.get(match.item.indexId)));
  const searchRecords = [];

  function register(kind, item, url, summary) {
    searchRecords.push({ kind, name: item.name, url, summary: stripTags(summary), search: `${item.name} ${stripTags(summary)} ${kind}`.toLowerCase() });
  }
  function detailLayout(kind, item, url, content, extra = "", section = "", detailClass = "") {
    register(kind, item, url, item.description || item.lore || item.descriptions || item.guide || "");
    return layout({ title: item.name, description: item.description || item.lore || item.descriptions || "", version: metadata.version, section, body: `<a class="back-link" data-return-section="${section}" href="/${section}/">← Back to ${esc(section.replace(/-/g, " "))}</a><article class="detail${detailClass ? ` ${esc(detailClass)}` : ""}"><div class="detail-main">${content}</div>${imageMarkup(item, images)}</article>${extra}` });
  }

  const primaryRaceNames = [...new Set(c.ancestries.map(item => item.primaryRace).filter(Boolean))].sort();
  const roles = [...new Set(c.classes.flatMap(item => [item.role1, item.role2]).filter(Boolean))].sort();
  const itemTypes = [...new Set(c.items.map(item => item.type).filter(Boolean))].sort();
  const monsterTypes = [...new Set(c.monsters.map(item => String(item.type || "").trim()).filter(Boolean))].sort();

  const classTiers = [...new Set(c.classes.map(item => item.tier).filter(Boolean))].sort();
  const level3SkillOptions = [...new Set([...classSkillUnlockById.values()].flatMap(info => info.level3Skills))].sort((a, b) => a.localeCompare(b));
  const level1SkillOptions = [...new Set([...classSkillUnlockById.values()].flatMap(info => info.level1Facets))].sort((a, b) => a.localeCompare(b));
  const classSkillFilters = `<details class="class-skill-filters" data-filter-disclosure><summary><span>Skill unlocks</span><small>Levels 1, 3, 5 &amp; 7</small></summary><div><label>Level 1 skill/stat<select name="l1Grant"><option value="">All level 1 unlocks</option>${level1SkillOptions.map(value => `<option value="${esc(value)}">${esc(value.split(":").slice(1).join(":"))}</option>`).join("")}</select></label><label>Level 3 skill/category<select name="l3Skill"><option value="">All level 3 skills</option>${level3SkillOptions.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}</select></label><label>Level 5 Heart stat<select name="l5Stat"><option value="">All Heart stats</option>${heartStatNames.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}</select></label><label>Level 7 Soul stat<select name="l7Stat"><option value="">All Soul stats</option>${soulStatNames.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}</select></label></div></details>`;
  const classControls = `<form class="index-controls class-controls" data-index-controls data-section-key="classes"><label>Find<input name="filter" type="search" placeholder="Filter classes"></label><label>Role<select name="role"><option value="">All</option>${roles.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}</select></label><label>Tier<select name="tier"><option value="">All</option>${classTiers.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}</select></label><label>Sort<select name="sort"><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="tier-asc">Tier low–high</option><option value="l1skill-desc">Level 1 skill points high–low</option><option value="l1stat-desc">Level 1 stat points high–low</option><option value="l3points-desc">Level 3 points high–low</option><option value="l3count-desc">Level 3 choices most–least</option><option value="l5count-desc">Level 5 choices most–least</option><option value="l7count-desc">Level 7 choices most–least</option></select></label><button type="button" data-clear>Clear</button><output data-result-count>${c.classes.length} results</output>${classSkillFilters}</form>`;
  const classCards = c.classes.map(item => {
    const abilities = [item.keyAbility, item.ability1, item.ability2, item.ability3, item.ultimateAbility].map(id => keyById.get(id) || trueById.get(id)).filter(Boolean);
    const abilityNames = abilities.map(ability => ability.name).join(" ");
    const rolesText = [item.role1, item.role2].filter(Boolean).join(" · ");
    const unlocks = classSkillUnlockById.get(item.classId);
    const unlockSearch = [...unlocks.level1.skills, ...unlocks.level1.stats, ...unlocks.level3Skills, ...unlocks.level5Stats, ...unlocks.level7Stats].join(" ");
    return `<article class="lineage-card class-card class-tier-${esc(item.tier || "unknown")}" data-card data-name="${esc(item.name.toLowerCase())}" data-search="${esc(`${stripTags(item.description)} ${abilityNames} ${unlockSearch}`.toLowerCase())}" data-role="${esc(`${item.role1 || ""} ${item.role2 || ""}`.trim())}" data-tier="${esc(item.tier || "")}" data-l1-grant="${esc(unlocks.level1Facets.join("|"))}" data-l3-skill="${esc(unlocks.level3Skills.join("|"))}" data-l5-stat="${esc(unlocks.level5Stats.join("|"))}" data-l7-stat="${esc(unlocks.level7Stats.join("|"))}" data-l1skill="${esc(unlocks.level1.skillPoints)}" data-l1stat="${esc(unlocks.level1.statPoints)}" data-l3points="${esc(unlocks.level3Points)}" data-l3count="${esc(unlocks.level3Skills.length)}" data-l5count="${esc(unlocks.level5Stats.length)}" data-l7count="${esc(unlocks.level7Stats.length)}"><a class="lineage-art" href="/classes/${item.classId}/">${imageMarkup(item, images, "sm")}</a><div class="lineage-content"><p class="lineage-name">Tier ${esc(item.tier || "—")}</p><h3><a href="/classes/${item.classId}/">${esc(item.name)}</a></h3>${rolesText ? `<p class="class-roles">${esc(rolesText)}</p>` : ""}<div class="lineage-summary">${kw(item.description)}</div>${namedAbilityList(abilities)}<a class="lineage-more" href="/classes/${item.classId}/">Open ${esc(item.name)} →</a></div></article>`;
  }).join("");
  await writePage("classes", layout({ title: "Classes", description: "Compare class roles, tiers, abilities, and skill or stat unlocks at levels 1, 3, 5, and 7.", version: metadata.version, section: "classes", body: `<div class="page-title class-page-title"><p class="eyebrow">Paths of expertise</p><h1>Classes</h1><p>Compare roles, tiers, abilities, and skill or stat unlocks at levels 1, 3, 5, and 7. Filters and sorting persist when you leave and return.</p></div>${classControls}<div class="lineage-grid class-lineage-grid" data-index-grid>${classCards}</div>` }));

  for (const item of c.classes) {
    const abilities = [...new Map([item.keyAbility, item.ability1, item.ability2, item.ability3, item.ultimateAbility]
      .map(id => keyById.get(id) || trueById.get(id))
      .filter(Boolean)
      .map(ability => [ability.indexId, ability])).values()];
    const progressionAbility = (id, label) => {
      const ability = keyById.get(id) || trueById.get(id);
      if (!ability) return `<span class="muted">No ${esc(label.toLowerCase())} is listed.</span>`;
      const url = keyById.has(ability.indexId)
        ? `/abilities/key/${ability.abilityId || slug(ability.name)}/`
        : `/abilities/${ability.trueAbilityId || slug(ability.name)}/`;
      return abilityLinkMarkup(ability, { url, label });
    };
    const progression = [
      ["Unlock", "Key ability", progressionAbility(item.keyAbility, "Key ability"), "ability"],
      ["Level 2", "Ability 1", progressionAbility(item.ability1, "Ability"), "ability"],
      ["Level 3", "Skills", kw(esc(item.skills)), "growth"],
      ["Level 4", "Ability 2", progressionAbility(item.ability2, "Ability"), "ability"],
      ["Level 5", "Heart", kw(esc(item.heart)), "growth"],
      ["Level 6", "Ability 3", progressionAbility(item.ability3, "Ability"), "ability"],
      ["Level 7", "Soul", kw(esc(item.soul)), "growth"],
      ["Level 8", "Ultimate ability", progressionAbility(item.ultimateAbility, "Ability"), "ultimate"],
    ];
    const progressionMarkup = `<ol class="class-progression-list">${progression.map(([level, label, value, kind]) => `<li class="class-progression-item progression-${kind}"><span class="class-progression-level">${esc(level)}</span><span class="class-progression-label">${esc(label)}</span><div class="class-progression-value">${value}</div></li>`).join("")}</ol>`;
    const roles = [item.role1, item.role2].filter(Boolean);
    const profile = `<dl class="class-profile-grid"><div><dt>Tier</dt><dd>${esc(item.tier || "—")}</dd></div><div><dt>Difficulty</dt><dd>${esc(item.difficulty || "—")} / 5</dd></div><div><dt>Main role</dt><dd>${esc(item.role1 || "—")}</dd></div><div><dt>Secondary role</dt><dd>${esc(item.role2 || "—")}</dd></div></dl>`;
    const content = `<header class="class-detail-heading"><p class="eyebrow">Class record</p><h1>${esc(item.name)}</h1><p class="lede">${esc(roles.join(" / ") || "No combat role listed")}</p>${profile}</header><section class="class-mechanics-panel"><div class="class-mechanics-heading"><p class="eyebrow">Rules reference</p><h2>Class mechanics</h2><p>Entry requirements and the complete level-by-level advancement path.</p></div><div class="class-mechanics-grid"><section class="class-requirements-card"><p class="eyebrow">Entry</p><h3>Requirements</h3><div class="prose">${kw(item.requirements || "None listed.")}</div></section><section class="class-progression-card"><p class="eyebrow">Advancement</p><h3>Progression</h3>${progressionMarkup}</section></div></section><section class="class-flavor-section"><p class="eyebrow">Identity &amp; lore</p><h2>Class overview</h2><div class="prose">${kw(item.description)}</div></section><section class="class-guide-section"><p class="eyebrow">Tactical guidance</p><h2>Playing ${esc(item.name)}</h2><div class="prose">${kw(item.guide)}</div></section>`;
    const abilityCards = abilities.map(ability => {
      const isKey = keyById.has(ability.indexId);
      const url = isKey
        ? `/abilities/key/${ability.abilityId || slug(ability.name)}/`
        : `/abilities/${ability.trueAbilityId || slug(ability.name)}/`;
      return fullAbilityCard(ability, kw, { url, label: isKey ? "Key ability" : "Ability", heading: 3 });
    }).join("");
    const extra = `<section class="embedded-abilities-section class-detail-abilities"><div class="section-heading"><p class="eyebrow">Class features</p><h2>Abilities unlocked</h2><p>Complete rules for every ability granted by ${esc(item.name)}.</p></div>${abilityCards ? `<div class="ability-list">${abilityCards}</div>` : `<p class="muted">No directly unlocked abilities are listed in this version.</p>`}</section>`;
    await writePage(`classes/${item.classId}`, detailLayout("Class", item, `/classes/${item.classId}/`, content, extra, "classes", "class-detail"));
  }

  const lineageCard = (item, isPrimary) => {
    const lineage = isPrimary ? item.name : item.primaryRace;
    const id = isPrimary ? item.primaryRaceId : item.ancestryId;
    const abilityIds = isPrimary
      ? [item.ability1, item.ability2, ...["wi", "lir", "d", "ar", "lu", "ni", "un", "vi", "none"].map(key => item[key]?.ability)]
      : [item.trait1, item.trait2, item.trait3];
    const abilities = [...new Map(abilityIds.map(value => trueById.get(value)).filter(Boolean).map(ability => [ability.indexId, ability])).values()];
    const abilityNames = abilities.map(ability => ability.name).join(" ");
    const abilityList = namedAbilityList(abilities);
    const densityClass = isPrimary && abilities.length > 6 ? " lineage-ability-heavy" : "";
    return `<article class="lineage-card lineage-${slug(lineage)}${densityClass}" ${isPrimary ? "" : `data-card data-name="${esc(item.name.toLowerCase())}" data-search="${esc(`${stripTags(item.description)} ${abilityNames}`.toLowerCase())}" data-type="${esc(lineage)}"`}><a class="lineage-art" href="/races/${id}/">${imageMarkup(item, images, "sm")}</a><div class="lineage-content"><p class="lineage-name">${esc(lineage)}</p><h3><a href="/races/${id}/">${esc(item.name)}</a></h3><div class="lineage-summary">${kw(item.description)}</div>${abilityList}<a class="lineage-more" href="/races/${id}/">Open ${esc(item.name)} →</a></div></article>`;
  };
  const raceControls = `<form class="index-controls race-controls" data-index-controls data-section-key="races"><label>Find<input name="filter" type="search" placeholder="Filter sub-races"></label><label>Primary race<select name="type"><option value="">All lineages</option>${primaryRaceNames.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}</select></label><label>Sort<select name="sort"><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option></select></label><button type="button" data-clear>Clear</button><output data-result-count>${c.ancestries.length} results</output></form>`;
  await writePage("races", layout({ title: "Races & sub-races", description: "Primary races and their color-coded sub-races, separated into clear sections.", version: metadata.version, section: "races", body: `<div class="page-title race-page-title"><p class="eyebrow">Lineages of Lyr</p><h1>Races & sub-races</h1><p>Choose a primary race, then explore its color-coded sub-races. Every lineage retains its own permanent page.</p></div><section class="race-section primary-race-section" id="primary-races"><div class="section-heading"><p class="eyebrow">Foundation</p><h2>Primary races</h2><p>Primary races establish attributes, proficiencies, skills, and the lineage available to a character.</p></div><div class="lineage-grid primary-lineage-grid">${c.primaryRaces.map(item => lineageCard(item, true)).join("")}</div></section><section class="race-section subrace-section" id="sub-races"><div class="section-heading"><p class="eyebrow">Specialized lineages</p><h2>Sub-races</h2><p>Each sub-race is labeled and colored by its primary race.</p></div>${raceControls}<div class="lineage-grid subrace-lineage-grid" data-index-grid>${c.ancestries.map(item => lineageCard(item, false)).join("")}</div></section>` }));

  for (const item of [...c.primaryRaces, ...c.ancestries]) {
    const isPrimary = "primaryRaceId" in item;
    const id = isPrimary ? item.primaryRaceId : item.ancestryId;
    const lineage = isPrimary ? item.name : item.primaryRace;
    const foundation = isPrimary ? item : primaryRaceByName.get(item.primaryRace);
    const rawDescription = String(item.description || "");
    const sizeMatch = stripTags(rawDescription).match(/\bSize\s*:\s*(Tiny|Small|Medium|Large|Huge|Gargantuan|M)\b(\s*\([^)]*\))?/i);
    const size = sizeMatch ? `${sizeMatch[1].toLowerCase() === "m" ? "Medium" : sizeMatch[1]}${sizeMatch[2] || ""}` : "Not listed";
    const lore = rawDescription.replace(/<p>([\s\S]*?)<\/p>/gi, (paragraph, inner) => {
      const plain = stripTags(inner).replace(/&nbsp;/gi, " ").trim();
      if (!/\bSize\s*:/i.test(plain)) return paragraph;
      const remainder = plain.replace(/\bSize\s*:\s*(?:Tiny|Small|Medium|Large|Huge|Gargantuan|M)\b(?:\s*\([^)]*\))?/i, "").trim();
      return remainder ? paragraph : "";
    });
    const abilityIds = isPrimary ? [item.ability1, item.ability2, ...["wi", "lir", "d", "ar", "lu", "ni", "un", "vi", "none"].map(key => item[key]?.ability)] : [item.trait1, item.trait2, item.trait3];
    const unlocked = [...new Map(abilityIds.map(value => trueById.get(value)).filter(Boolean).map(ability => [ability.indexId, ability])).values()];
    const subraceCount = isPrimary ? c.ancestries.filter(ancestry => ancestry.primaryRace === item.name).length : 0;
    const profileRows = isPrimary
      ? [["Record", "Primary race"], ["Size", esc(size)], ["Listed features", String(unlocked.length)], ["Sub-races", String(subraceCount)]]
      : [["Record", "Sub-race"], ["Primary race", foundation ? `<a href="/races/${foundation.primaryRaceId}/">${esc(foundation.name)}</a>` : esc(item.primaryRace || "Not listed")], ["Size", esc(size)], ["Traits", String(unlocked.length)]];
    const profile = `<dl class="race-profile-grid">${profileRows.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>`).join("")}</dl>`;
    const ruleCards = foundation
      ? [
          ["Attributes", foundation.attributes],
          ["Proficiencies", foundation.proficiencies],
          ["Skills", foundation.skills],
          ["Ambition", foundation.ambition],
        ].filter(([, value]) => value).map(([label, value]) => `<section class="race-rule-card"><p class="eyebrow">${isPrimary ? "Core benefit" : `Inherited from ${esc(foundation.name)}`}</p><h3>${esc(label)}</h3><div class="prose"><p>${kw(esc(value))}</p></div></section>`).join("")
      : `<section class="race-rule-card"><p class="eyebrow">Core benefits</p><h3>Not listed</h3><p class="muted">The primary-race record could not be matched in this version.</p></section>`;
    const lineageChoices = isPrimary
      ? ["wi", "lir", "d", "ar", "lu", "ni", "un", "vi", "none"].map(key => item[key]).filter(choice => choice?.text || choice?.ability)
      : [];
    const lineageChoiceMarkup = lineageChoices.length
      ? `<section class="race-rule-card race-lineage-choice-card"><p class="eyebrow">Character choice</p><h3>Lineage paths</h3><p>Choose the path that matches your family or upbringing. Each path grants the linked ability.</p><ul class="race-option-list">${lineageChoices.map(choice => {
          const [choiceName, ...details] = String(choice.text || "Lineage path").split(/\s+-\s+/);
          const ability = trueById.get(choice.ability);
          return `<li><div class="race-option-copy"><strong>${esc(choiceName)}</strong>${details.length ? `<p>${kw(esc(details.join(" - ")))}</p>` : ""}</div>${ability ? abilityLinkMarkup(ability, { label: "Lineage ability" }) : `<span class="muted">No ability listed</span>`}</li>`;
        }).join("")}</ul></section>`
      : "";
    const mechanicsIntro = isPrimary
      ? "Apply these attribute, proficiency, language, and skill benefits during character creation."
      : foundation
        ? `${esc(item.name)} uses the core creation benefits of <a href="/races/${foundation.primaryRaceId}/">${esc(foundation.name)}</a>; its unique traits are listed in full below.`
        : "Core creation benefits come from this sub-race’s primary race; its unique traits are listed in full below.";
    const content = `<header class="race-detail-heading"><p class="eyebrow">${isPrimary ? "Primary race record" : `Sub-race · ${esc(item.primaryRace)}`}</p><h1>${esc(item.name)}</h1><p class="lede">${isPrimary ? `${esc(item.name)} establishes the character’s core lineage benefits.` : `${esc(item.name)} is a specialized ${esc(item.primaryRace)} lineage.`}</p>${profile}</header><section class="race-mechanics-panel"><div class="race-mechanics-heading"><p class="eyebrow">Rules reference</p><h2>Character creation</h2><p>${mechanicsIntro}</p></div><div class="race-mechanics-grid">${ruleCards}${lineageChoiceMarkup}</div></section><section class="race-flavor-section"><p class="eyebrow">Identity &amp; lore</p><h2>Lineage overview</h2><div class="prose">${kw(lore)}</div></section>`;
    const extra = `<section class="embedded-abilities-section race-detail-abilities"><div class="section-heading"><p class="eyebrow">Lineage features</p><h2>Abilities unlocked</h2><p>Complete rules for every ability granted by this ${isPrimary ? "primary race" : "sub-race"}.</p></div>${unlocked.length ? `<div class="ability-list">${unlocked.map(a => fullAbilityCard(a, kw, { url: `/abilities/${a.trueAbilityId || slug(a.name)}/`, heading: 3 })).join("")}</div>` : `<p class="muted">No directly unlocked abilities are listed in this version.</p>`}</section>`;
    await writePage(`races/${id}`, detailLayout(isPrimary ? "Race" : "Sub-race", item, `/races/${id}/`, content, extra, "races", `race-detail lineage-${slug(lineage)}`));
  }

  const monsterPowerRecords = [
    ...c.monsterAbilities.map(item => ({ ...item, type: "Monster ability", url: `/monster-abilities/${item.monsterAbilityId || slug(item.name)}/` })),
    ...c.monsterActions.map(item => ({ ...item, type: "Monster action", url: `/monster-actions/${item.monsterActiveActionsId || slug(item.name)}/`, description: item.descriptions, requirement: item.requirements })),
  ];
  const allAbilities = [
    ...c.trueAbilities.map(item => ({ ...item, type: "Ability", url: `/abilities/${item.trueAbilityId || slug(item.name)}/` })),
    ...c.keyAbilities.map(item => ({ ...item, type: "Key ability", url: `/abilities/key/${item.abilityId || slug(item.name)}/`, description: [item.benefit1, item.benefit2, item.benefit3, item.benefit4].filter(Boolean).join(" ") })),
    ...c.breakthroughs.map(item => ({ ...item, type: "Breakthrough", url: `/breakthroughs/${item.breakthroughId || slug(item.name)}/`, requirement: item.requirements })),
    ...monsterPowerRecords,
  ];
  const abilityKeywordOptions = [...new Map(allAbilities.flatMap(item => String(item.keywords || "").split(",")).map(value => value.trim()).filter(value => value && value !== "-").map(value => [value.toLowerCase(), value])).values()].sort((a, b) => a.localeCompare(b));
  const abilitySourceInfo = item => {
    const isBreakthrough = item.type === "Breakthrough";
    const isMonsterAbility = item.type === "Monster ability";
    const isMonsterAction = item.type === "Monster action";
    const isMonsterRecord = isMonsterAbility || isMonsterAction;
    const sources = isBreakthrough
      ? []
      : isMonsterAbility
        ? uniqueRelations(relations.monsterAbilities.get(item.indexId))
        : isMonsterAction
          ? uniqueRelations(relations.monsterActions.get(item.indexId))
          : uniqueRelations(item.type === "Key ability" ? relations.keyAbilities.get(item.indexId) : relations.abilities.get(item.indexId));
    const classTiers = [...new Set(sources.filter(source => source.type.startsWith("Class") && source.tier).map(source => String(source.tier)))].sort();
    const hasRace = sources.some(source => source.type === "Race" || source.type === "Sub-race");
    const sourceFacets = isMonsterRecord ? ["monster"] : classTiers.map(tier => `tier-${tier}`);
    if (hasRace && classTiers.length === 0) sourceFacets.push("race-only");
    if (isBreakthrough || sources.some(source => source.type === "Breakthrough")) sourceFacets.push("breakthrough");
    const monsters = isMonsterRecord ? [] : monsterSourcesFor(item);
    const sourceType = source => source.type.startsWith("Class") ? "Class" : source.type;
    const playerMarkup = sources.length
      ? sources.map(source => `<a class="player-source-link" href="${source.url}" title="${esc(source.type)}"><span>${esc(sourceType(source))}</span>${esc(source.name)}</a>`).join("")
      : `<span class="source-none">No player source listed</span>`;
    const monsterMarkup = monsters.length
      ? `<details class="monster-ability-sources"><summary><span>Monster use</span><b>${monsters.length}</b><small>exact-name match</small></summary><div>${monsters.map(source => `<a href="${source.url}">${esc(source.name)}</a>`).join("")}</div></details>`
      : "";
    const linkedAbility = isBreakthrough ? trueById.get(item.ability) : null;
    const breakthroughMarkup = isMonsterRecord
      ? `<div class="player-ability-sources"><b>Used by</b>${sources.length ? sources.map(source => `<a class="player-source-link monster-source-link" href="${source.url}"><span>Monster</span>${esc(source.name)}</a>`).join("") : `<span class="source-none">No monster source listed</span>`}</div>`
      : isBreakthrough
      ? `<div class="player-ability-sources"><b>Source</b><span class="source-label source-breakthrough">Breakthrough</span>${linkedAbility ? `<span class="source-divider">Grants</span>${abilityLinkMarkup(linkedAbility)}` : ""}</div>`
      : `<div class="player-ability-sources"><b>Sources</b>${playerMarkup}</div>`;
    const sourceMarkup = `<div class="ability-sources">${breakthroughMarkup}${monsterMarkup}</div>`;
    return { sourceFacets, sourceMarkup, sources, monsters };
  };
  const abilityControls = `<form class="index-controls ability-controls" data-index-controls data-section-key="abilities"><label>Find<input name="filter" type="search" placeholder="Name or rules text"></label><label>Ability type<select name="type"><option value="">All types</option><option value="Ability">Ability</option><option value="Key ability">Key ability</option><option value="Breakthrough">Breakthrough</option><option value="Monster ability">Monster ability</option><option value="Monster action">Monster action</option></select></label><label>Keyword<select name="keyword"><option value="">All keywords</option>${abilityKeywordOptions.map(value => `<option value="${esc(value.toLowerCase())}">${esc(value)}</option>`).join("")}</select></label><label>Unlock source<select name="source"><option value="">All sources</option><option value="tier-1">Tier 1 class</option><option value="tier-2">Tier 2 class</option><option value="tier-3">Tier 3 class</option><option value="race-only">Race only</option><option value="breakthrough">Breakthrough</option><option value="monster">Monster</option></select></label><label>Sort<select name="sort"><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="cost-asc">Ability/EXP cost low–high</option></select></label><button type="button" data-clear>Clear</button><output data-result-count>${allAbilities.length} results</output></form>`;
  const abilityRows = allAbilities.map(item => {
    const source = abilitySourceInfo(item);
    return fullAbilityCard(item, kw, { url: item.url, label: item.type, sourceMarkup: source.sourceMarkup, sourceFacets: source.sourceFacets, indexCard: true });
  }).join("");
  await writePage("abilities", layout({ title: "Abilities", description: "Every player, breakthrough, and monster power in one complete, filterable rules reference.", version: metadata.version, section: "abilities", body: `<div class="page-title ability-page-title"><p class="eyebrow">Complete ability reference</p><h1>Abilities</h1><p>Every player ability, breakthrough, monster trait, and monster action lives here. Filter by record type, keyword, class tier, race-only unlock, breakthrough, or monster source.</p></div>${abilityControls}<div class="ability-list ability-index-list" data-index-grid>${abilityRows}</div>` }));

  for (const item of c.trueAbilities) {
    const people = relations.abilities.get(item.indexId).filter(source => source.type.startsWith("Class") || source.type.includes("race"));
    const other = relations.abilities.get(item.indexId).filter(source => source.type === "Breakthrough");
    const monsterMatches = monsterSourcesFor(item);
    const extra = relationSection("Unlocked by classes & races", people) + relationSection("Other unlock sources", other) + relationSection("Monsters", monsterMatches, "monster-related");
    await writePage(`abilities/${item.trueAbilityId || slug(item.name)}`, detailLayout("Ability", item, `/abilities/${item.trueAbilityId || slug(item.name)}/`, abilityBody(item, "Ability", kw), extra, "abilities"));
  }
  for (const item of c.keyAbilities) {
    const benefits = [item.benefit1, item.benefit2, item.benefit3, item.benefit4].filter(Boolean).map((value, index) => `<section><h2>Benefit ${index + 1}</h2><p>${kw(esc(value))}</p></section>`).join("");
    const associated = trueById.get(item.associatedAbility);
    const extra = relationSection("Unlocked by classes", relations.keyAbilities.get(item.indexId)) + (associated ? relationSection("Associated ability", [{ name: associated.name, type: "Ability", url: `/abilities/${associated.trueAbilityId || slug(associated.name)}/` }]) : "");
    await writePage(`abilities/key/${item.abilityId || slug(item.name)}`, detailLayout("Key ability", item, `/abilities/key/${item.abilityId || slug(item.name)}/`, `<p class="eyebrow">Key ability</p><h1>${esc(item.name)}</h1>${abilityGrantMarkup(level1GrantByAbilityId.get(item.indexId))}${benefits}`, extra, "abilities"));
  }

  await writePage("items", cardsPage({ title: "Items", intro: "All equipment and crafting records with corrected, persistent type filters.", section: "items", version: metadata.version, kw, filters: [{ name: "type", label: "Type", values: itemTypes }], sortOptions: [["name-asc", "Name A–Z"], ["name-desc", "Name Z–A"], ["cost-asc", "Cost low–high"]], records: c.items.map(item => ({ name: item.name, url: `/items/${item.itemId || slug(item.name)}/`, kind: item.subType || "Item", type: item.type, cost: parseFloat(String(item.cost).replace(/[^0-9.]/g, "")) || 0, meta: [item.type, item.cost && `Cost ${item.cost}`].filter(Boolean).join(" · "), summary: `<p>${esc(textExcerpt(item.description))}</p>`, search: stripTags(item.description).toLowerCase(), image: imageMarkup(item, images, "sm"), cardClass: "item-card", actionLabel: "View item" })) }));
  for (const item of c.items) await writePage(`items/${item.itemId || slug(item.name)}`, detailLayout("Item", item, `/items/${item.itemId || slug(item.name)}/`, `<p class="eyebrow">${esc([item.type, item.subType].filter(Boolean).join(" · "))}</p><h1>${esc(item.name)}</h1><div class="prose">${kw(item.description)}</div>${fieldTable(item, ["itemId"])}`, "", "items"));

  const monsterPowersFor = monster => {
    const abilityList = monsterAbilityListById.get(monster.abilities);
    const actionList = monsterActionListById.get(monster.activeActions);
    return {
      abilities: Array.from({ length: 6 }, (_, index) => monsterAbilityById.get(abilityList?.[`ability${index + 1}`])).filter(Boolean),
      actions: Array.from({ length: 6 }, (_, index) => monsterActionById.get(actionList?.[`action${index + 1}`])).filter(Boolean),
    };
  };
  const monsterCardPowerList = (title, powers, kind) => `<section class="lineage-abilities monster-card-powers"><h4>${esc(title)}</h4>${powers.length ? `<ul>${powers.map(power => {
    const isAction = kind === "action";
    const normalized = isAction ? { ...power, description: power.descriptions, requirement: power.requirements } : power;
    const url = isAction ? `/monster-actions/${power.monsterActiveActionsId || slug(power.name)}/` : `/monster-abilities/${power.monsterAbilityId || slug(power.name)}/`;
    return `<li>${abilityLinkMarkup(normalized, { url, label: isAction ? "Monster active action" : "Monster ability", passiveLabel: isAction ? "" : "Passive trait" })}</li>`;
  }).join("")}</ul>` : `<p>None listed</p>`}</section>`;
  const dangerLevels = [...new Set(c.monsters.map(item => item.dangerLevel).filter(Boolean))].sort();
  const monsterControls = `<form class="index-controls monster-controls" data-index-controls data-section-key="monsters"><label>Find<input name="filter" type="search" placeholder="Name, lore, or power"></label><label>Type<select name="type"><option value="">All</option>${monsterTypes.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}</select></label><label>Danger<select name="danger"><option value="">All</option>${dangerLevels.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}</select></label><label>Sort<select name="sort"><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="danger-asc">Danger level</option></select></label><button type="button" data-clear>Clear</button><output data-result-count>${c.monsters.length} results</output></form>`;
  const monsterCards = c.monsters.map(item => {
    const powers = monsterPowersFor(item);
    const allPowers = [...powers.abilities, ...powers.actions];
    const powerNames = allPowers.map(power => power.name).join(" ");
    const densityClass = allPowers.length >= 10 ? " monster-power-heavy monster-power-packed" : allPowers.length >= 7 ? " monster-power-heavy" : "";
    return `<article class="lineage-card monster-card${densityClass}" data-card data-name="${esc(item.name.toLowerCase())}" data-search="${esc(`${stripTags(item.lore)} ${powerNames}`.toLowerCase())}" data-type="${esc(String(item.type || "").trim())}" data-danger="${esc(item.dangerLevel || "")}" data-power-count="${allPowers.length}"><a class="lineage-art" href="/monsters/${item.monsterId}/">${imageMarkup(item, images, "sm")}</a><div class="lineage-content"><p class="lineage-name">Danger ${esc(item.dangerLevel || "—")}</p><h3><a href="/monsters/${item.monsterId}/">${esc(item.name)}</a></h3>${item.type ? `<p class="class-roles">${esc(String(item.type).trim())}</p>` : ""}<div class="lineage-summary">${kw(item.lore)}</div>${monsterCardPowerList("Traits", powers.abilities, "ability")}${monsterCardPowerList("Actions", powers.actions, "action")}<a class="lineage-more" href="/monsters/${item.monsterId}/">Open ${esc(item.name)} →</a></div></article>`;
  }).join("");
  await writePage("monsters", layout({ title: "Monsters", description: "Portrait-led monster cards with linked traits, actions, danger levels, and persistent filters.", version: metadata.version, section: "monsters", body: `<div class="page-title monster-page-title"><p class="eyebrow">Encounter bestiary</p><h1>Monsters</h1><p>Compare danger, type, lore, passive traits, and active actions. Hover a power name for its complete rules, or open any permanent record.</p></div>${monsterControls}<div class="lineage-grid monster-lineage-grid" data-index-grid>${monsterCards}</div>` }));
  for (const item of c.monsters) {
    const { abilities, actions } = monsterPowersFor(item);
    const content = `<p class="eyebrow">Monster · ${esc(item.type || "Unknown type")}</p><h1>${esc(item.name)}</h1><div class="prose">${kw(item.lore)}</div>${fieldTable(item, ["monsterId", "abilities", "activeActions"])}${item.strategy ? `<section><h2>Strategy</h2><div class="prose">${kw(item.strategy)}</div></section>` : ""}${item.runningMonster ? `<section><h2>Running this monster</h2><div class="prose">${kw(item.runningMonster)}</div></section>` : ""}`;
    const extra = relationSection("Monster abilities", abilities.map(a => ({ name: a.name, type: "Monster ability", url: `/monster-abilities/${a.monsterAbilityId || slug(a.name)}/` }))) + relationSection("Active actions", actions.map(a => ({ name: a.name, type: "Monster action", url: `/monster-actions/${a.monsterActiveActionsId || slug(a.name)}/` })), "monster-related");
    await writePage(`monsters/${item.monsterId}`, detailLayout("Monster", item, `/monsters/${item.monsterId}/`, content, extra, "monsters"));
  }

  const monsterPowerCards = monsterPowerRecords.map(item => ({ ...item, kind: item.type === "Monster ability" ? "Monster ability" : "Active action" }));
  const monsterKeywordOptions = [...new Map(c.monsterActions.flatMap(item => String(item.keywords || "").split(",")).map(value => value.trim()).filter(Boolean).map(value => [value.toLowerCase(), value])).values()].sort((a, b) => a.localeCompare(b));
  const monsterAbilityControls = `<form class="index-controls ability-controls" data-index-controls data-section-key="monster-abilities"><label>Find<input name="filter" type="search" placeholder="Name or rules text"></label><label>Record type<select name="type"><option value="">All types</option><option value="Monster ability">Monster ability</option><option value="Active action">Active action</option></select></label><label>Keyword<select name="keyword"><option value="">All keywords</option>${monsterKeywordOptions.map(value => `<option value="${esc(value.toLowerCase())}">${esc(value)}</option>`).join("")}</select></label><label>Sort<select name="sort"><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="cost-asc">AP/RP cost low–high</option></select></label><button type="button" data-clear>Clear</button><output data-result-count>${monsterPowerCards.length} results</output></form>`;
  const monsterPowerRows = monsterPowerCards.map(item => {
    const usedBy = uniqueRelations(item.kind === "Monster ability" ? relations.monsterAbilities.get(item.indexId) : relations.monsterActions.get(item.indexId));
    const sourceMarkup = `<div class="ability-sources monster-power-source-strip"><div class="player-ability-sources"><b>Used by</b>${usedBy.length ? usedBy.map(source => `<a class="player-source-link monster-source-link" href="${source.url}"><span>Monster</span>${esc(source.name)}</a>`).join("") : `<span class="source-none">No monster source listed</span>`}</div></div>`;
    return fullAbilityCard(item, kw, { url: item.url, label: item.kind, sourceMarkup, indexCard: true });
  }).join("");
  await writePage("monster-abilities", layout({ title: "Monster abilities", description: "Complete monster trait and active-action rules with costs, keywords, requirements, and linked monster usage.", version: metadata.version, section: "monster-abilities", body: `<div class="page-title ability-page-title"><p class="eyebrow">Complete encounter-power reference</p><h1>Monster abilities</h1><p>Every row contains the complete trait or active-action rules. Filter by record type or keyword, and follow the compact source links to every monster that uses it.</p></div>${monsterAbilityControls}<div class="ability-list ability-index-list monster-ability-index-list" data-index-grid>${monsterPowerRows}</div>` }));
  for (const item of c.monsterAbilities) await writePage(`monster-abilities/${item.monsterAbilityId || slug(item.name)}`, detailLayout("Monster ability", item, `/monster-abilities/${item.monsterAbilityId || slug(item.name)}/`, `<p class="eyebrow">Monster ability</p><h1>${esc(item.name)}</h1><div class="prose">${kw(item.description)}</div>`, relationSection("Used by monsters", relations.monsterAbilities.get(item.indexId), "monster-related"), "abilities"));
  for (const item of c.monsterActions) await writePage(`monster-actions/${item.monsterActiveActionsId || slug(item.name)}`, detailLayout("Monster action", item, `/monster-actions/${item.monsterActiveActionsId || slug(item.name)}/`, abilityBody({ ...item, description: item.descriptions, requirement: item.requirements }, "Monster active action", kw), relationSection("Used by monsters", relations.monsterActions.get(item.indexId), "monster-related"), "abilities"));

  const breakthroughControls = `<form class="index-controls breakthrough-controls" data-index-controls data-section-key="breakthroughs"><label>Find<input name="filter" type="search" placeholder="Name, rules, or requirements"></label><label>Sort<select name="sort"><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="cost-asc">EXP cost low–high</option></select></label><button type="button" data-clear>Clear</button><output data-result-count>${c.breakthroughs.length} results</output></form>`;
  const breakthroughRows = c.breakthroughs.map(item => {
    const normalized = { ...item, type: "Breakthrough", url: `/breakthroughs/${item.breakthroughId || slug(item.name)}/`, requirement: item.requirements };
    const source = abilitySourceInfo(normalized);
    return fullAbilityCard(normalized, kw, { url: normalized.url, label: "Breakthrough", sourceMarkup: source.sourceMarkup, sourceFacets: ["breakthrough"], indexCard: true });
  }).join("");
  await writePage("breakthroughs", layout({ title: "Breakthroughs", description: "Complete breakthrough effects presented as first-class ability records with EXP costs, requirements, and granted abilities.", version: metadata.version, section: "breakthroughs", body: `<div class="page-title ability-page-title breakthrough-page-title"><p class="eyebrow">Character-defining abilities</p><h1>Breakthroughs</h1><p>Every breakthrough is a complete, permanent ability record. Compare EXP costs and requirements, or follow linked abilities granted by a breakthrough.</p></div>${breakthroughControls}<div class="ability-list ability-index-list breakthrough-index-list" data-index-grid>${breakthroughRows}</div>` }));
  for (const item of c.breakthroughs) {
    const linked = trueById.get(item.ability);
    const content = `<p class="eyebrow">Breakthrough</p><h1>${esc(item.name)}</h1>${breakthroughCostMarkup(item)}<div class="prose">${kw(item.description)}</div>${item.requirements ? `<section><h2>Requirements</h2><div class="prose">${kw(item.requirements)}</div></section>` : ""}`;
    await writePage(`breakthroughs/${item.breakthroughId || slug(item.name)}`, detailLayout("Breakthrough", item, `/breakthroughs/${item.breakthroughId || slug(item.name)}/`, content, linked ? relationSection("Ability granted", [{ name: linked.name, type: "Ability", url: `/abilities/${linked.trueAbilityId || slug(linked.name)}/` }]) : "", "abilities"));
  }

  const keywordUsage = new Map(c.keywords.map(item => [item.name.toLowerCase(), { player: [], monster: [] }]));
  for (const item of c.trueAbilities) for (const token of String(item.keywords || "").split(",")) keywordUsage.get(token.trim().toLowerCase())?.player.push({ name: item.name, type: "Ability", url: `/abilities/${item.trueAbilityId || slug(item.name)}/` });
  for (const item of c.monsterActions) for (const token of String(item.keywords || "").split(",")) keywordUsage.get(token.trim().toLowerCase())?.monster.push({ name: item.name, type: "Monster action", url: `/monster-actions/${item.monsterActiveActionsId || slug(item.name)}/` });
  await writePage("keywords", cardsPage({ title: "Keywords", intro: "Every keyword is highlighted throughout the manual; hover or focus it for a definition, or open its dedicated reverse-index page.", section: "keywords", version: metadata.version, kw, sortOptions: [["name-asc", "Name A–Z"], ["name-desc", "Name Z–A"]], records: c.keywords.map(item => ({ name: item.name, url: `/keywords/${item.keywordId || slug(item.name)}/`, kind: "Keyword", summary: item.description, search: stripTags(item.description).toLowerCase() })) }));
  for (const item of c.keywords) {
    const usage = keywordUsage.get(item.name.toLowerCase()) || { player: [], monster: [] };
    await writePage(`keywords/${item.keywordId || slug(item.name)}`, detailLayout("Keyword", item, `/keywords/${item.keywordId || slug(item.name)}/`, `<p class="eyebrow">Keyword</p><h1>${esc(item.name)}</h1><div class="prose">${item.description}</div>`, relationSection("Player abilities", usage.player) + relationSection("Monster content", usage.monster, "monster-related"), "keywords"));
  }

  for (const action of basicActions) register("Basic action", action, `/basic-actions/#${slug(action.name)}`, `${action.description} ${action.formula}`);
  register("Basic action", { name: "Skill Checks" }, "/basic-actions/#skill-checks", "Roll any main skill with its sub-stat, Skill bonus, Expertise, and modifiers.");
  const unsortedCombatActions = basicActions.filter(action => action.category === "combat");
  const combatActions = [
    unsortedCombatActions.find(action => action.name === "Initiative"),
    unsortedCombatActions.find(action => action.name === "Save"),
    ...unsortedCombatActions.filter(action => action.name !== "Initiative" && action.name !== "Save"),
  ].filter(Boolean);
  const craftingActions = basicActions.filter(action => action.category === "crafting");
  const gatheringActions = basicActions.filter(action => action.category === "gathering");
  const combatInstructions = kw(rich(collapseRulebookExamples(headingSection(c.rulebook.content, "Combat", 2), "combat"), metadata.version));
  const combatDirectory = combatActionCards(c.rulebook.content, fragment => kw(rich(fragment, metadata.version)));
  const craftingInstructions = kw(rich(collapseRulebookExamples(headingSection(c.rulebook.content, "Crafting", 3), "crafting"), metadata.version));
  const gatheringInstructions = kw(rich(collapseRulebookExamples(headingSection(c.rulebook.content, "Gathering", 3), "gathering"), metadata.version));
  const profileGroups = basicActionProfileGroups.map(([name, description, fields]) => `<section class="stat-profile-group stat-profile-${slug(name)}"><header><h3>${esc(name)}</h3><p>${esc(description)}</p></header><div class="action-stat-grid">${fields.map(([label, key]) => `<label>${esc(label)}<input type="number" inputmode="numeric" value="0" name="${esc(key)}" data-shared-stat="${esc(key)}"></label>`).join("")}</div></section>`).join("");
  const actionStatProfile = `<section class="action-stat-profile" data-action-stats><div class="stat-profile-heading"><div><p class="eyebrow">Shared character profile</p><h2>Your stats</h2><p>Enter each value once. Every action on this page uses the same locally saved profile.</p></div><button type="button" data-reset-action-stats>Reset stats</button></div><div class="action-stat-groups">${profileGroups}</div><p class="stat-storage-note" data-stat-storage-status>Saved only in this browser. These values are never transmitted.</p></section>`;
  await writePage("basic-actions", layout({
    title: "Basic Actions",
    description: "Test common Lyrian Chronicles rolls or generate fully annotated Avrae Discord bot syntax.",
    version: metadata.version,
    section: "basic-actions",
    body: `<div class="page-title actions-title"><p class="eyebrow">At-table roll tools</p><h1>Basic Actions</h1><p>Save your character stats once, test rolls locally, or generate annotated Avrae-ready syntax. Attack cards roll accuracy and damage together by default.</p></div>${actionStatProfile}<aside class="actions-note"><strong>Rulebook formulas</strong><span>Initiative uses Agility as its base bonus. Attack output starts with Avrae’s <code>!multiline</code> command and contains separate <code>!r</code> commands for accuracy and damage, so the complete block can be pasted into Discord without enabling inline rolls. Situational abilities, equipment, and GM rulings may add further modifiers.</span></aside><section class="action-section combat-actions"><div class="section-heading"><p class="eyebrow">Encounter tools</p><h2>Combat</h2><p>Initiative, complete attack rolls, and saves available without a class-specific ability. Open the instructions, then expand Basic combat actions for full rulebook action cards.</p></div><div class="roll-grid">${combatActions.map(action => basicActionCard(action, kw)).join("")}</div><details class="production-rules combat-rules prose" id="combat-instructions"><summary><span class="eyebrow">From the rulebook</span><strong>Combat instructions &amp; basic actions</strong><span class="production-rules-state" aria-hidden="true"></span></summary><div class="production-rules-body">${combatDirectory}${combatInstructions}</div></details></section><section class="action-section skill-actions" id="skill-checks"><div class="section-heading"><p class="eyebrow">Universal challenge tool</p><h2>Skill checks</h2><p>All main skills and crafting categories live in one selector. The tool automatically chooses the correct formula and remembers separate bonuses for each skill.</p></div>${skillCheckTool()}</section><section class="action-section production-actions"><div class="section-heading"><p class="eyebrow">Interlude tools</p><h2>Crafting & gathering</h2><p>Checks that spend Crafting Dice or Strike Dice. Complete instructions below are copied from this version’s rulebook; open either instruction section when needed, then expand individual examples inside it.</p></div><div class="action-subsection"><h3>Crafting</h3><div class="roll-grid">${craftingActions.map(action => basicActionCard(action, kw)).join("")}</div><details class="production-rules prose" id="crafting-instructions"><summary><span class="eyebrow">From the rulebook</span><strong>Crafting instructions</strong><span class="production-rules-state" aria-hidden="true"></span></summary><div class="production-rules-body">${craftingInstructions}</div></details></div><div class="action-subsection"><h3>Gathering</h3><div class="roll-grid">${gatheringActions.map(action => basicActionCard(action, kw)).join("")}</div><details class="production-rules prose" id="gathering-instructions"><summary><span class="eyebrow">From the rulebook</span><strong>Gathering instructions</strong><span class="production-rules-state" aria-hidden="true"></span></summary><div class="production-rules-body">${gatheringInstructions}</div></details></div></section>`,
  }));

  const docPages = [["rulebook", "Rulebook", c.rulebook], ["settings-guide", "Settings guide", c.settingsGuide], ["latest-update", "Latest update", c.patchNotes]];
  for (const [url, title, doc] of docPages) {
    const item = { name: title, description: doc.content };
    register("Guide", item, `/${url}/`, doc.content);
    await writePage(url, layout({ title, description: doc.content, version: metadata.version, section: url, body: `<article class="document prose"><p class="eyebrow">Version ${esc(metadata.version)}</p><h1>${title}</h1>${kw(rich(doc.content, metadata.version))}</article>` }));
  }

  const homeCards = [
    ["Races", c.primaryRaces.length + c.ancestries.length, "/races/"], ["Classes", c.classes.length, "/classes/"],
    ["Abilities", c.trueAbilities.length + c.keyAbilities.length + c.breakthroughs.length, "/abilities/"], ["Items", c.items.length, "/items/"],
    ["Monsters", c.monsters.length, "/monsters/"], ["Keywords", c.keywords.length, "/keywords/"],
  ];
  await writePage("", layout({ title: "Online Manual", description: "A fully static, cross-linked edition of the Lyrian Chronicles online manual.", version: metadata.version, body: `<section class="home-hero"><img src="/assets/images/${encodeURIComponent(imageFilename(CDN_LOGOS[1]))}" alt="Lyrian Chronicles"><p class="eyebrow">Static reference · version ${esc(metadata.version)}</p><h1>Everything is connected.</h1><p>Browse the complete manual without hidden tabs or dynamically rendered records. Abilities point back to the classes and races that unlock them; monster relationships live in their own clearly marked section.</p><form class="hero-search" action="/search/" method="get"><input name="q" type="search" placeholder="Search ${searchRecords.length.toLocaleString()} records"><button>Search the manual</button></form></section><section class="home-grid">${homeCards.map(([name, count, url]) => `<a href="${url}"><strong>${count.toLocaleString()}</strong><span>${name}</span></a>`).join("")}</section><section class="home-guides"><a href="/rulebook/">Rulebook</a><a href="/basic-actions/">Basic Actions</a><a href="/settings-guide/">Settings guide</a><a href="/latest-update/">Latest update</a></section>` }));

  await writePage("search", layout({ title: "Search", description: "Search every record in the static manual.", version: metadata.version, section: "search", body: `<div class="page-title"><p class="eyebrow">Site-wide index</p><h1>Search the manual</h1><form class="search-page-form" action="/search/" method="get"><input data-search-query name="q" type="search" placeholder="Name, rule, keyword…" autofocus><button>Search</button></form><p><output data-search-count>${searchRecords.length} records</output></p></div><div class="search-results" data-search-results>${searchRecords.sort((a, b) => a.name.localeCompare(b.name)).map(item => `<article data-search-card data-search="${esc(item.search)}"><p>${esc(item.kind)}</p><h2><a href="${item.url}">${esc(item.name)}</a></h2><p>${esc(item.summary.slice(0, 260))}</p></article>`).join("")}</div>` }));

  const urls = searchRecords.map(item => item.url).concat(["/", "/search/"]);
  await fs.writeFile(path.join(PUBLIC_DIR, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url => `<url><loc>${esc(`https://example.invalid${url}`)}</loc></url>`).join("")}</urlset>`);
  await fs.writeFile(path.join(PUBLIC_DIR, "build-meta.json"), `${JSON.stringify({ version: metadata.version, scrapedAt: metadata.scrapedAt, pages: urls.length, records: searchRecords.length, images: Object.keys(images).length }, null, 2)}\n`);
  console.log(`Built ${urls.length} static pages and indexed ${searchRecords.length} records for ${metadata.version}.`);
}

let snapshot;
if (buildOnly) snapshot = JSON.parse(await fs.readFile(path.join(DATA, "latest.json"), "utf8"));
else snapshot = await scrape();
await build(snapshot);
