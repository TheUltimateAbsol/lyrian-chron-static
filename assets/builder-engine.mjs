// Pure, deterministic rules engine. No DOM, network or storage dependency.
export const MAIN = ["Power", "Focus", "Agility", "Toughness"];
export const SUB = ["Fitness", "Cunning", "Reason", "Awareness", "Presence"];
export const SKILL_GROUPS = {
  Fitness: ["Athletics", "Riding"], Cunning: ["Deception", "Roguecraft", "Stealth"],
  Reason: ["Artifice", "Appraise", "Common Knowledge", "Expert Knowledge", "Flight", "History", "Linguistics", "Magic", "Medicine", "Religion"],
  Awareness: ["Animal Husbandry", "Insight", "Perception", "Survival"], Presence: ["Art", "Intimidation", "Negotiation"],
  Crafting: ["Alchemy", "Armorsmithing", "Artificing", "Blacksmithing", "Carpentry", "Culinary", "Farming", "Transmuter"],
  Gathering: ["Foraging", "Mining"],
};
export const NORMAL_SKILLS = Object.entries(SKILL_GROUPS).filter(([k]) => !["Crafting", "Gathering"].includes(k)).flatMap(([,v]) => v);
export const ALL_SKILLS = Object.values(SKILL_GROUPS).flat();
export const MELEE = ["Small Weapons", "Polearms", "Light Swords", "Longsword", "Dueling Weapons", "Axes", "Bludgeoning Weapons", "Katana", "Heavy Blades", "Twinblade"];
export const RANGED = ["Thrown", "Set of Missiles", "Bow", "Crossbow", "Musket", "Sling"];
export const COMMON = [...MELEE, ...RANGED];
export const SPECIAL = ["Pistol", "Shotgun", "Sniper Rifle", "Saboteur Thread Daggers", "Lance", "Whip", "Chainsaw", "Channeling Weapons"];
export const ARMOR = ["Light Armor", "Medium Armor", "Heavy Armor", "Shields", "Greatshields"];
export const ELEMENTS = ["Arcane", "Fire", "Water", "Wind", "Earth", "Lightning", "Frost", "Dark", "Holy"];
export function masteredElements(raw) {
  const body=text(raw);
  return [...ELEMENTS,"Physical","Astra"].filter(el=>new RegExp(`(?:Elemental\\s+)?mastery(?:\\s+in|:)?\\s+${el}\\b|\\b${el}(?:\\s+Elemental)?\\s+mastery\\b`,"i").test(body));
}
export const text = value => String(value || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g,"&").replace(/&[lr][sd]quo;/g,"'").replace(/\s+/g," ").trim();
const norm = x => text(x).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g," ").trim();
const number = x => Number(x) || 0;
const uid = () => globalThis.crypto?.randomUUID?.() || `build-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function startingWednesday(date=new Date()) {
  const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
  d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+4)%7));
  return d.toISOString().slice(0,10);
}
export function weekDate(build,week) {
  const d=new Date((build.startDate||build.startWednesday||calendarDate())+"T12:00:00Z");
  if(week>0)d.setUTCDate(d.getUTCDate()+((3-d.getUTCDay()+7)%7)+7*week);
  return d.toISOString().slice(0,10);
}
export function calendarDate(date=new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function acquisitionWarning(cls) {
  return `${cls.name}: new class needs 1 IP and a full Wednesday-to-Wednesday training week, postponing EXP progression by a week, unless ${cls.tier===3?'SF':'DSF or SF'} is obtained to skip the delay. EXP cost still applies. Timing is a warning, not an automatic delay in this plan.`;
}
const mentions = (s, names) => names.filter(n => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`,"i").test(s));

export function freshBuild() {
  return { version: 1, id: uid(), name: "New character", mirane: true, race: "human", ancestry: "", clan: "wi", secondClan: "lir", hybrid: false,
    main: {Power:5, Focus:4, Agility:4, Toughness:3}, sub: {Fitness:5,Cunning:4,Reason:3,Awareness:2,Presence:1},
    humanMain:"Power", humanSub:"Fitness", startDate:calendarDate(), allocations:{}, weeks:[{kind:"creation",events:[]}], cursor:0, creationDone:false, notes:"" };
}

export function parseSkillGrants(raw, prefix) {
  const s = text(raw), grants = [];
  const matches = [...s.matchAll(/(?:gain\s+(?:an additional\s+)?|and\s+)\+?(\d+)\s+(?:(?:skill|Transmuter)\s+(?:points?\s*)?|points?\s*|to\s+(?=[A-Z]))/gi)];
  for (let i=0;i<matches.length;i++) {
    const chunk = s.slice(matches[i].index, matches[i+1]?.index ?? s.length);
    let options = mentions(chunk, ALL_SKILLS);
    if (/any non.?crafting|any normal skill/i.test(chunk)) options = NORMAL_SKILLS.concat(/gathering/i.test(chunk) ? [] : SKILL_GROUPS.Gathering);
    for (const [group,names] of Object.entries(SKILL_GROUPS)) if (new RegExp(`\\b${group}\\b.*category|${group} disciplines?`,"i").test(chunk)) options.push(...names);
    if (/crafting disciplines/i.test(chunk)) options.push(...SKILL_GROUPS.Crafting);
    if (!options.length) continue;
    grants.push({id:`${prefix}:skills:${i}`,kind:"skills",count:number(matches[i][1]),options:[...new Set(options)],
      expertise: !/not doubled/i.test(chunk), expertiseOnly:/expertise/i.test(chunk)&&!/(?:exchange|skill points|or .*expertise)/i.test(chunk), text:chunk});
  }
  return grants;
}

export function parseStatGrants(raw, prefix) {
  const s = text(raw), options = mentions(s, [...MAIN,...SUB]);
  if (!options.length || !/gain\s+\+?\d/i.test(s)) return [];
  const count = number(s.match(/gain\s+\+?(\d+)/i)?.[1]);
  if (/\bor\b|choice|any/i.test(s)) return [{id:`${prefix}:stat`,kind:"stat",count,options,text:s}];
  return options.map((n,i)=>({id:`${prefix}:stat:${i}`,kind:"stat",count,options:[n],text:s}));
}

const PROF_ALIASES = { "longsword":"longswords?", "polearms":"polearms?", "dueling weapons":"dueling weapons?", "pistol":"pistols?", "bow":"bows?", "crossbow":"crossbows?", "sniper rifle":"sniper rifles?", "set of missiles":"sets? of missiles", "channeling weapons":"channeling weapons?", "shields":"(?:normal )?shields?", "greatshields":"greatshields?", "katana":"katanas?", "lance":"lances?", "light swords":"light (?:swords|blades)", "axes":"axes|axe" };
function profNames(s) {
  return [...COMMON,...SPECIAL,...ARMOR,"Wands","Staves","Pickaxe","Scythe","Sickle","Hori","Giant Scissors","Unarmed","Cannons","Aetherie Sensory Station","Artificer's Multitool","Alchemist's Alembic","Smith's Hammer"].filter(n => new RegExp(`\\b(?:${PROF_ALIASES[n.toLowerCase()]||n.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")})\\b`,"i").test(s));
}
export function parseProficiencies(raw,prefix) {
  const s=text(raw), grants=[];
  // The blanket Battlemaster benefit explicitly does not satisfy class gates.
  if (/does not count.*class requirements/i.test(s)) return grants;
  for(const [i,sentence] of s.split(/(?<=[.!])\s+/).entries()) {
    if (!/proficien|unarmed attack damage is treated/i.test(sentence)) continue;
    const named=profNames(sentence);
    const add=(opts,count=1)=>grants.push({id:`${prefix}:prof:${i}:${grants.length}`,kind:"proficiency",options:opts,count,text:sentence});
    if (/unarmed attack damage/i.test(sentence)) {add(["Unarmed"]);add(["Gauntlets"]);continue;}
    if (/\bor\b|your cho|one of/i.test(sentence)&&!/(?:another|one other)/i.test(sentence)) {add(named.length?named:ARMOR);continue;}
    const common=sentence.match(/(?:in|with)\s+(\d+|a|an|one|single|five)\s+(?:single\s+)?(?:common|basic|smithing)(?:\s+(melee|ranged))?\s+(?:group of |weapon)/i);
    if(common){const counts={a:1,an:1,one:1,single:1,five:5}; add(common[2]==="melee"?MELEE:common[2]==="ranged"?RANGED:COMMON,counts[common[1]]||number(common[1]));}
    else if(/common ranged weapon/i.test(sentence))add(RANGED);
    if(/common melee weapon/i.test(sentence)&&(!common||common[2]!=="melee"))add(MELEE);
    if(/another weapon|one other common|1 common and/i.test(sentence))add(/one other common/i.test(sentence)?COMMON:[...COMMON,...SPECIAL]);
    if(/specialized weapon|speciality weapon/i.test(sentence)&&!named.length) add(/common or specialized/i.test(sentence)?[...COMMON,...SPECIAL]:SPECIAL);
    if(/armor category|1 armor/i.test(sentence)&&!named.length)add(/greatshield/i.test(sentence)?ARMOR:ARMOR.slice(0,4));
    for(const n of named) add([n]);
  }
  return grants;
}

// Curated choice structures for prose that lists fixed grants and picks in a
// single sentence. Values are verified against the local complete key records.
const PROF_CHOICES = {
  adventurer:{fixed:[],picks:[COMMON,[...COMMON,...SPECIAL],ARMOR]},
  fighter:{fixed:["Light Armor","Medium Armor","Shields"],picks:[COMMON,COMMON,COMMON,COMMON,COMMON]},
  ranger:{fixed:["Light Armor","Medium Armor"],picks:[RANGED,MELEE]},
  acolyte:{fixed:["Light Armor","Shields"],picks:[[...COMMON,"Wands","Staves"]]},
  cultivator:{fixed:["Light Armor","Light Swords","Unarmed","Gauntlets"],picks:[[...COMMON,...SPECIAL]]},
  rogue:{fixed:["Light Armor"],picks:[["Small Weapons","Light Swords","Dueling Weapons","Set of Missiles"]]},
  cavalier:{fixed:["Polearms","Lance","Light Armor","Shields"],picks:[COMMON]},
  armorsmith:{fixed:["Light Armor","Medium Armor","Shields","Smith's Hammer"],picks:[MELEE]},
  mime:{fixed:[],picks:[COMMON,SPECIAL]},
  forager:{fixed:["Giant Scissors"],picks:[["Axes","Hori"]]},
  miner:{fixed:["Pickaxe"],picks:[ARMOR.slice(0,4)]},
  manifestor:{fixed:["Light Armor","Shields"],picks:[MELEE]},
};
export function prepareData(collections, version) {
  const c=collections, byAbility = new Map([...c.keyAbilities,...c.trueAbilities].map(x=>[x.indexId,x]));
  const abilities=Object.fromEntries([...byAbility].map(([id,a])=>[id,{...a,url:`/abilities/${a.abilityId?'key/':''}${a.abilityId||a.trueAbilityId}/`,body:text(a.description||[a.benefit1,a.benefit2,a.benefit3,a.benefit4].filter(Boolean).join(" "))}]));
  const classes=c.classes.map(cls=>{
    const key=byAbility.get(cls.keyAbility);
    const benefits=[key?.benefit1,key?.benefit2,key?.benefit3,key?.benefit4].filter(Boolean);
    const id=key?.indexId||cls.classId;
    let prof=benefits.flatMap((b,i)=>parseProficiencies(b,`${id}:${i}`));
    const override=PROF_CHOICES[cls.classId];
    if(override) prof=[...override.fixed.map(n=>[n]),...override.picks].map((opts,i)=>({id:`${id}:prof:${i}`,kind:"proficiency",options:opts,count:1,text:`${key.name}: weapon / armor proficiency`}));
  const grants=benefits.flatMap((b,i)=>parseSkillGrants(b,`${id}:${i}`)).concat(prof);
    for(const g of grants)g.label=`${cls.name} · ${g.kind==="skills"?"Key skill points":"Proficiency"}`;
    return {...cls,tier:number(cls.tier),url:`/classes/${cls.classId}/`,grants,
      levels:{3:parseSkillGrants(cls.skills,`${cls.classId}:3`).map(g=>({...g,label:`${cls.name} · L3 skill points`})),5:[...parseStatGrants(cls.heart,`${cls.classId}:5`),...parseProficiencies(cls.heart,`${cls.classId}:5`)].map(g=>({...g,label:`${cls.name} · L5 Heart`})),7:parseStatGrants(cls.soul,`${cls.classId}:7`).map(g=>({...g,label:`${cls.name} · L7 Soul`}))}};
  });
  return {version,classes,abilities,races:c.primaryRaces.map(r=>({...r,url:`/races/${r.primaryRaceId}/`,grants:parseSkillGrants(r.skills,`${r.primaryRaceId}:race`).map(g=>({...g,label:`${r.name} · Racial skill points`}))})),
    ancestries:c.ancestries.map(a=>({...a,url:`/races/${a.ancestryId}/`})),breakthroughs:c.breakthroughs.map(b=>({...b,url:`/breakthroughs/${b.breakthroughId}/`,body:text(b.description)})),
  };
}

export function lineagePool(build,data) {
  const chosen=build.weeks[0].events.filter(e=>e.type==="breakthrough").map(e=>data.breakthroughs.find(b=>b.indexId===e.id)?.name||"");
  if(chosen.some(n=>/Human-Chimera Hybrid/.test(n))&&build.race==="human")return "Chimera";
  if(chosen.some(n=>/Faerie-Chimera Hybrid/.test(n))){if(build.race==="fae")return "Chimera";if(build.race==="chimera")return "Fae";}
  return data.races.find(r=>r.primaryRaceId===build.race)?.name||"";
}
function abilityRefs(cls,level,data) {
  const refs=[cls.keyAbility];
  for(const [l,k] of [[2,"ability1"],[4,"ability2"],[6,"ability3"],[8,"ultimateAbility"]])if(level>=l)refs.push(cls[k]);
  for(const id of [...refs])if(data.abilities[id]?.associatedAbility)refs.push(data.abilities[id].associatedAbility);
  return refs.filter(Boolean);
}
function applyGrant(g,s,build) {
  if(s.grants.some(other=>other.id===g.id))return;
  s.grants.push(g);
  const allocation=build.allocations[g.id]||{};
  if(["stat","proficiency","element","choice"].includes(g.kind)) {
    const chosen=g.options.length===1?g.options[0]:allocation.choice;
    if(!g.options.includes(chosen)){s.pending.push(g);return;}
    if(g.kind==="stat")s.stats[chosen]+=g.count;
    else if(g.kind==="element")s.elements.add(chosen);
    else if(g.kind==="proficiency")s.proficiencies.add(chosen);
    return;
  }
  let spent=0;
  for(const [key,value] of Object.entries(allocation)){
    const [skill,ex]=key.split("|");
    if(!g.options.includes(skill)||!Number.isInteger(value)||value<0)continue;
    if(ex&&((!g.expertise&&!g.expertiseOnly)||!key.split("|")[2]?.trim()))continue;
    if(!ex&&g.expertiseOnly)continue;
    spent+=value;
    if(ex){const en=key.split("|")[2];s.expertise[`${skill}: ${en}`]=(s.expertise[`${skill}: ${en}`]||0)+value*(g.expertise?2:1);}
    else s.skills[skill]=(s.skills[skill]||0)+value;
  }
  if(spent>g.count)s.errors.push(`Overallocated ${g.text}: ${spent}/${g.count} points.`);
  if(spent<g.count)s.pending.push({...g,remaining:g.count-spent});
}

function classGrants(cls,level,s,build,data) {
  cls.grants.forEach(g=>applyGrant(g,s,build));
  for(const l of [3,5,7])if(level>=l)(cls.levels[l]||[]).forEach(g=>applyGrant(g,s,build));
  const key=data.abilities[cls.keyAbility];
  // Later level abilities can grant mastery too (e.g. Elemental Mastery: Fire).
  for(const id of abilityRefs(cls,level,data)) {
    const a=data.abilities[id];
    if(id!==cls.keyAbility)masteredElements(`${a?.name||''} ${a?.body||''}`).forEach(el=>s.elements.add(el));
  }
  const benefits=[key?.benefit1,key?.benefit2,key?.benefit3,key?.benefit4].filter(Boolean);
  for(const [i,b] of benefits.entries()) {
    const active=level<8?b.split(/upon master|upon mastering/i)[0]:b;
    masteredElements(active).forEach(el=>s.elements.add(el));
    if(/(?:upon master|mastering this class).*element of your choice/i.test(b)&&level===8)applyGrant({id:`${cls.classId}:mastery`,kind:"element",count:1,options:ELEMENTS,text:`${cls.name}: mastered element`},s,build);
    if(/chosen Divine.s element/i.test(b)&&level===8){
      const divine=s.breakthroughs.find(e=>data.breakthroughs.find(bt=>bt.indexId===e.id)?.name==="Divine's Chosen");
      const chosen=divine&&build.allocations[`${divine.id}:${divine.uid}:divine`]?.choice?.split(" · ")[1];
      if(chosen)s.elements.add(chosen);else if(build.race==="human"&&!divine)s.elements.add("Holy");
      else applyGrant({id:`${cls.classId}:divine`,kind:"element",count:1,options:[...ELEMENTS,"Physical","Astra"],text:"Divine's element"},s,build);
    }
  }
}

export function startingEXP(build,data) {
  const creation=build.weeks[0].events;
  const names=creation.filter(e=>e.type==="breakthrough").map(e=>data.breakthroughs.find(b=>b.indexId===e.id)?.name||"");
  return 1000+(build.race==="human"&&!names.some(n=>/Human-Chimera Hybrid/.test(n))?100:0)-(names.includes("Slow Starter")?200:0);
}
function applyDemonClan(clan,s,build,data) {
  if(build.race!=="demon")return;
  const feature=data.races.find(r=>r.primaryRaceId==="demon")?.[clan];
  if(!feature)return;
  if(feature.ability)s.abilities.add(feature.ability);
  const free=feature.text.match(/(?:the )(.+?) class unlocked/i)?.[1]?.replace(/^.*You start with the /i,"");
  const cls=data.classes.find(x=>norm(x.name)===norm(free));
  if(cls){
    if(!s.classes[cls.classId])s.classes[cls.classId]={level:1,free:true};
    abilityRefs(cls,s.classes[cls.classId].level,data).forEach(id=>s.abilities.add(id));
  }
  if(clan==="wi")s.proficiencies.add("Saboteur Thread Daggers");
}
function initialSheet(build,data) {
  const s={stats:{...build.main,...build.sub},classes:{},abilities:new Set(),proficiencies:new Set(),elements:new Set(),skills:{},expertise:{},breakthroughs:[],grants:[],pending:[],errors:[],warnings:[],ledger:[],sc:0,spent:0,refunds:0,btSpent:0,ip:3,earned:startingEXP(build,data),week:0,expSteps:0};
  for(const [keys,array] of [[MAIN,[3,4,4,5]],[SUB,[1,2,3,4,5]]])if(keys.map(k=>s.stats[k]).sort((a,b)=>a-b).join()!==array.join())s.errors.push(`Assign the complete ${keys===MAIN?"main":"sub"} stat array.`);
  const race=data.races.find(x=>x.primaryRaceId===build.race);
  if(!race){s.errors.push("Choose a primary race.");return s;}
  if(build.race==="human"){
    if(MAIN.includes(build.humanMain))s.stats[build.humanMain]++;
    if(SUB.includes(build.humanSub))s.stats[build.humanSub]++;
    applyGrant({id:"human:weapon",kind:"proficiency",count:1,options:COMMON,text:"Human: one common weapon group"},s,build);
  } else for(const stat of [...MAIN,...SUB])if(new RegExp(`\\+1 (?:in |to )?${stat}`,"i").test(race.attributes))s.stats[stat]++;
  const pool=lineagePool(build,data);
  const ancestry=data.ancestries.find(x=>x.ancestryId===build.ancestry&&x.primaryRace===pool);
  if(!["human","demon"].includes(build.race)||pool==="Chimera"&&build.race==="human"){
    if(!ancestry)s.errors.push(`Choose a ${pool} sub-race.`);
  }
  const isHybrid=pool!==race.name;
  const traitIds=[race.ability1,race.ability2,...(ancestry?[ancestry.trait1,ancestry.trait2,ancestry.trait3]:[])].filter(Boolean);
  if(isHybrid&&build.race==="human")for(let i=traitIds.length-1;i>=0;i--)if(/Human Adaptability/.test(data.abilities[traitIds[i]]?.name))traitIds.splice(i,1);
  if(isHybrid&&ancestry?.ancestryId==="high-fae")for(let i=0;i<traitIds.length;i++)if(/Faerie? Flash II/.test(data.abilities[traitIds[i]]?.name))traitIds[i]=data.races.find(r=>r.name==="Fae").ability1;
  const clans=[build.clan];
  if(build.weeks[0].events.some(e=>data.breakthroughs.find(b=>b.indexId===e.id)?.name==="Mixed House (Demon)"))clans.push(build.secondClan);
  if(build.race==="demon") {
    for(const clan of new Set(clans))applyDemonClan(clan,s,build,data);
    applyGrant({id:"demon:proficiency",kind:"proficiency",count:1,options:[...COMMON,"Clan skill points"],text:"Demon: common weapon or 5 clan-related skill points"},s,build);
    if(build.allocations["demon:proficiency"]?.choice==="Clan skill points")applyGrant({id:"demon:clan-skills",kind:"skills",count:5,options:NORMAL_SKILLS,expertise:true,text:"Demon: 5 clan-related skill points (choose skills related to your clan)"},s,build);
    if(clans.includes("wi"))s.proficiencies.add("Saboteur Thread Daggers");
  }
  traitIds.forEach(id=>{if(id){s.abilities.add(id);const a=data.abilities[id];masteredElements(`${a?.name||''} ${a?.body||''}`).forEach(el=>s.elements.add(el));}});
  for(const id of traitIds){
    const body=data.abilities[id]?.body||'',match=body.match(/start with the (.+?) class unlocked and at level (\d+)/i);
    if(!match)continue;
    const cls=data.classes.find(c=>norm(c.name)===norm(match[1]));
    if(cls){s.classes[cls.classId]={level:number(match[2]),free:true};abilityRefs(cls,number(match[2]),data).forEach(id=>s.abilities.add(id));}
  }
  if(ancestry?.ancestryId==="pixie"){s.stats.Toughness-=2;s.stats.Agility+=2;}
  race.grants.forEach(g=>applyGrant(g,s,build));
  applyGrant({id:"creation:skills",kind:"skills",count:10,options:NORMAL_SKILLS,expertise:true,text:"Starting skill points"},s,build);
  return s;
}

function requirementResult(raw,s,build,data,isCreation) {
  const input=text(raw);
  if(!input||/^(none\.?|-)$/.test(input.toLowerCase()))return {ok:true,unknown:false,text:input};
  let unknown=false;
  // Recognize named classes/abilities first so embedded words (Fae Knight,
  // Flight, Authority, etc.) cannot accidentally become race/skill gates.
  let expr=norm(input.replace(/[.;]/g," clausebreakz ").replace(/,/g," listcommaz ")).replace(/iaido style/g,"iai style").replace(/wide circuits breakthrough/g,"wide circuits i breakthrough").replace(/medium or heavy armor/g,"medium armor or heavy armor").replace(/dueling weapon\b/g,"dueling weapons").replace(/katanas\b/g,"katana");
  expr=expr.replace(/clausebreakz alternatively/g,"or");
  const checks=[];
  const token=value=>{const id=`gate${checks.length}z`;checks.push(value);return id;};
  const replace=(pattern,fn)=>{expr=expr.replace(pattern,(...args)=>token(fn(...args)));};
  const names=[...data.classes].sort((a,b)=>b.name.length-a.name.length);
  const classPattern=names.map(c=>norm(c.name).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|");
  replace(new RegExp(`\\b((?:${classPattern})(?:(?: listcommaz | or )(?:${classPattern}))+)(?: mastered|maxed)\\b`,"g"),(_,list)=>list.split(/ listcommaz | or /).some(n=>{
    const cls=names.find(c=>norm(c.name)===n);return number(s.classes[cls?.classId]?.level)>=8;
  }));
  for(const cls of names){const name=norm(cls.name).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");replace(new RegExp(`\\b${name}\\b(?: mastered|maxed)?`,"g"),match=> /any points in/.test(expr)?number(s.classes[cls.classId]?.level)>0:number(s.classes[cls.classId]?.level)>=8);}
  replace(/(?:at least )?(?:1|one|any)(?: tier (\d))? class(?:es)? (?:mastered|maxed)/g,(_,tier)=>Object.entries(s.classes).some(([id,v])=>v.level>=8&&(!tier||data.classes.find(c=>c.classId===id)?.tier===number(tier))));
  replace(/any tier (\d) mastered/g,(_,tier)=>Object.entries(s.classes).some(([id,v])=>v.level>=8&&data.classes.find(c=>c.classId===id)?.tier===number(tier)));
  replace(/two classes mastered/g,()=>Object.values(s.classes).filter(v=>v.level>=8).length>=2);
  replace(/(?:have )?one element mastered/g,()=>s.elements.size>0);
  for(const el of ELEMENTS)replace(new RegExp(`\\b${el.toLowerCase()} (?:element )?(?:mastery|mastered)\\b`,"g"),()=>s.elements.has(el));
  for(const ability of Object.values(data.abilities).sort((a,b)=>b.name.length-a.name.length)){
    const n=norm(ability.name);if(!n||n.length<4||!expr.includes(n))continue;
    replace(new RegExp(`\\b${n}\\b(?: ability)?`,"g"),()=>s.abilities.has(ability.indexId));
  }
  for(const b of [...data.breakthroughs].sort((a,b)=>b.name.length-a.name.length)){
    const n=norm(b.name.replace(/\s*\([^)]*\)$/,""));if(!expr.includes(n))continue;
    replace(new RegExp(`\\b${n}\\b(?: breakthrough)?`,"g"),()=>s.breakthroughs.some(x=>x.id===b.indexId));
  }
  replace(/(?:must be (?:taken|chosen) at|(?:taken|chosen) at|only at) character creation/g,()=>isCreation);
  replace(/(\d+) spirit core/g,(_,n)=>s.sc>=number(n));
  replace(/(?:must have|must possess|possess|have) at least (?:1|one) spell(?: that deals damage)?/g,match=>[...s.abilities].some(id=>/\bSpell\b/.test(data.abilities[id]?.keywords||"")&&(!/deals damage/.test(match)||/damage/i.test(data.abilities[id]?.body||""))));
  replace(/(?:must have|have)? ?at least (?:1|one) mystic eye slot open/g,()=>{
    const eyeTypes=new Set();
    for(const id of s.abilities){const match=data.abilities[id]?.body?.match(/one of your eyes becomes? (?:an?|the) (.+?) eye\b/i);if(match)eyeTypes.add(norm(match[1]));}
    const max=s.breakthroughs.some(e=>data.breakthroughs.find(b=>b.indexId===e.id)?.name==="Third Eye")?3:2;
    return eyeTypes.size<max;
  });
  replace(/(?:be |are |must be )?proficien(?:t|cy) (?:in|with) (?:at least )?(?:1|one|any) (?:two handed )?melee weapon/g,()=>[...s.proficiencies].some(p=>MELEE.includes(p)||["Unarmed","Lance","Whip"].includes(p)));
  replace(/(?:be |are |must be )?proficien(?:t|cy) (?:in|with) (?:at least )?(?:1|one|a) weapon/g,()=>[...s.proficiencies].some(p=>COMMON.concat(SPECIAL).includes(p)));
  for(const p of [...COMMON,...SPECIAL,...ARMOR].sort((a,b)=>b.length-a.length)){
    const n=norm(p),alias=p==="Thrown"?"throwing weapons":n;
    replace(new RegExp(`\\b(?:${n}|${alias})\\b`,"g"),()=>s.proficiencies.has(p));
  }
  const raceNames=[...data.races.map(x=>x.name),...data.ancestries.map(x=>x.name)].sort((a,b)=>b.length-a.length);
  for(const race of raceNames){const n=norm(race);replace(new RegExp(`\\b${n}\\b`,"g"),()=>norm(data.races.find(r=>r.primaryRaceId===build.race)?.name)===n||norm(data.ancestries.find(r=>r.ancestryId===build.ancestry)?.name)===n||(n==="human"&&s.breakthroughs.some(x=>/The Unknown Paladin/.test(data.breakthroughs.find(b=>b.indexId===x.id)?.name))));}
  // Point thresholds, including named expertise. Unknown narrative conditions
  // remain explicit GM checks, never silently treated as satisfied.
  replace(/(?:at least )?(\d+) (?:skill )?points? in (?:the )?([a-z ]+?)(?: expertise(?: skill)?| skill|(?= clausebreakz)|$)/g,(_,n,skill)=>{
    const key=NORMAL_SKILLS.find(x=>norm(x)===skill.trim());
    if(key)return number(s.skills[key])>=number(n);
    return Object.entries(s.expertise).some(([k,v])=>norm(k).includes(skill.trim())&&v>=number(n));
  });
  expr=expr.replace(/(?:must |have |be |the |only |learned|breakthrough|of which |1 must be a |at least |one of |class |classes |mastered|maxed|proficient with |proficient in |proficiency in |and possess |in addition to |alternatively |either |you )/g," ").trim();
  // AND binds more tightly than OR, matching the prose's alternate routes.
  const evalClause=part=>{
    const gates=[...part.matchAll(/gate(\d+)z/g)].map(m=>checks[number(m[1])]);
    const rest=part.replace(/gate\d+z|\band\b|\bplus\b|\bwith\b|\bin\b/g,"").trim();
    if(rest){unknown=true;return false;}
    return gates.length>0&&gates.every(Boolean);
  };
  expr=expr.split(/clausebreakz/).map(part=>/or/.test(part)&&!(/\band\b/.test(part))&&/^\s*gate\d+z/.test(part)?part.replace(/listcommaz/g,"or"):part).join(" clausebreakz ");
  const clauses=expr.split(/clausebreakz|listcommaz/).map(x=>x.trim()).filter(Boolean);
  const ok=clauses.length>0&&clauses.every(clause=>clause.split(/\bor\b/).some(evalClause));
  return {ok,unknown,text:input};
}
export function requirements(record,s,build,data,isCreation=build.cursor===0) {
  if(build.mirane&&/angelblooded|shinigami|vampire/i.test(record.classId||record.breakthroughId||record.name))return {ok:false,restricted:true,text:"Mirane: restricted creation / GM-controlled unlock. Not a normal purchase."};
  if(record.classId==='aetherie'&&[...s.abilities].some(id=>data.abilities[id]?.name==='Highly Sensitive to Magic'))return {ok:true,unknown:false,text:'Highly Sensitive to Magic: ignores Aetherie entry requirements; 100 EXP unlock discount.'};
  if(record.classId==="bard")return {ok:number(s.classes.idol?.level)>=8||Object.entries(s.expertise).some(([k,v])=>/^Art: (?:Singing|Idol|.*(?:flute|guitar|piano|violin|lute|harp|drum|instrument|trumpet|cello|clarinet|saxophone|bass|ukulele))$/i.test(k)&&v>=5),unknown:false,text:text(record.requirements)};
  if(record.classId==="mist-veil-elegy")return {ok:number(s.classes.idol?.level)>=8||number(s.classes.bard?.level)>=8||(number(s.expertise["Art: Flute"])>=10&&Object.values(s.classes).some(x=>x.level>=8)),unknown:false,text:text(record.requirements)};
  if(record.classId==="executor")return {ok:Object.values(s.classes).some(x=>x.level>=8)&&number(s.classes.acolyte?.level)>0,unknown:false,text:text(record.requirements)};
  if(record.classId==="trickster")return {ok:Object.values(s.classes).filter(x=>x.level>=8).length>=2&&Object.entries(s.classes).some(([id,x])=>x.level>=8&&data.classes.find(c=>c.classId===id)?.tier===2),unknown:false,text:text(record.requirements)};
  if(record.classId==="shield-paladin")return {ok:(build.race==="human"||s.breakthroughs.some(e=>data.breakthroughs.find(b=>b.indexId===e.id)?.name==="The Unknown Paladin"))&&s.proficiencies.has("Shields")&&(s.proficiencies.has("Medium Armor")||s.proficiencies.has("Heavy Armor")),unknown:false,text:text(record.requirements)};
  return requirementResult(record.requirements,s,build,data,isCreation);
}
export function nextClassStep(cls,s,data) {
  const level=number(s.classes[cls.classId]?.level)+1;
  if(level>8)return null;
  const id=level===1?cls.keyAbility:({2:cls.ability1,4:cls.ability2,6:cls.ability3,8:cls.ultimateAbility})[level];
  const a=data.abilities[id];
  let gross=level===1?cls.tier*100:100,refund=0,reason="";
  const discount=level===1&&cls.classId==='aetherie'&&[...s.abilities].some(id=>data.abilities[id]?.name==='Highly Sensitive to Magic')?100:0;
  gross=Math.max(0,gross-discount);
  if(id&&s.abilities.has(id)){refund=gross;reason=`Full refund: ${a?.name} already known`;}
  else if(level===1&&a?.associatedAbility&&s.abilities.has(a.associatedAbility)){refund=Math.floor(gross/2);reason=`Partial refund: ${data.abilities[a.associatedAbility]?.name} already known`;}
  else if(a?.name==="Living Lightning"&&/centaur|arachne/i.test(s.ancestryName||"")){refund=gross;reason="Full refund: Living Lightning cannot be used by this lineage";}
  if(discount)reason=`Lineage discount: ${discount} EXP${reason?'; '+reason:''}`;
  return {level,id,gross,discount,refund,cost:gross-refund,reason,name:a?.name||({3:"Skills",5:"Heart",7:"Soul"})[level]};
}
export function breakthroughCost(bt,s) {
  if(bt.name==="Primary Stat Training")return Math.min(700,400+100*s.breakthroughs.filter(b=>b.id===bt.indexId).length);
  return number(bt.cost);
}
function btGrants(bt,s,build,event) {
  const id=`${bt.indexId}:${event.uid}`,body=text(bt.description),n=bt.name;
  parseSkillGrants(body,id).forEach(g=>applyGrant(g,s,build));
  if(n==="Skill Training")applyGrant({id:`${id}:skill`,kind:"skills",count:1,options:NORMAL_SKILLS,expertise:true,text:n},s,build);
  for(const [name,options] of [["Primary Stat Training",MAIN],["Secondary Stat Training",SUB]])if(n===name)applyGrant({id:`${id}:stat`,kind:"stat",count:1,options,text:n},s,build);
  if(n==="Universal Training"){for(const [tag,options] of [["main",MAIN],["sub",SUB]])applyGrant({id:`${id}:${s.breakthroughs.filter(x=>x.id===id).length}:${tag}`,kind:"stat",count:1,options,text:n},s,build);}
  if(/^(Weapon|Speciality Weapon) Training$/.test(n))applyGrant({id:`${id}:${s.breakthroughs.filter(x=>x.id===id).length}:prof`,kind:"proficiency",count:1,options:n.startsWith("Weapon")?COMMON:SPECIAL,text:n},s,build);
  else parseProficiencies(body,`${id}:${s.breakthroughs.filter(x=>x.id===id).length}`).forEach(g=>applyGrant(g,s,build));
  if(/Elemental Affinity/.test(n))applyGrant({id:`${id}:element`,kind:"element",count:1,options:ELEMENTS,text:n},s,build);
  if(n==="Divine's Chosen")applyGrant({id:`${id}:divine`,kind:"choice",count:1,options:["Kari · Holy","Heira · Astra","Pandora · Arcane","Makai · Water","Ayuzi Kirara · Fire","Eisen · Physical","Athena · Lightning","Clio · Arcane","Yggdrasil · Earth"],text:"Chosen Divine"},s,build);
}
export function evaluateBuild(build,data,until=build.cursor) {
  const s=initialSheet(build,data);
  const ancestry=data.ancestries.find(x=>x.ancestryId===build.ancestry);s.ancestryName=ancestry?.name||"";
  for(const [id,owned] of Object.entries(s.classes)){const cls=data.classes.find(c=>c.classId===id);abilityRefs(cls,owned.level,data).forEach(id=>s.abilities.add(id));classGrants(cls,owned.level,s,build,data);}
  // Regenerate class grants once after the ledger to avoid applying one grant
  // again at every purchased level. Prerequisites see allocations as we go.
  const refreshClassState=()=>{
    const b=initialSheet(build,data);s.stats=b.stats;s.skills=b.skills;s.expertise=b.expertise;s.proficiencies=b.proficiencies;s.elements=b.elements;s.grants=b.grants;s.pending=b.pending;
    if(s.breakthroughs.some(e=>data.breakthroughs.find(bt=>bt.indexId===e.id)?.name==="Mixed House (Demon)"))applyDemonClan(build.secondClan,s,build,data);
    for(const [id,v] of Object.entries(s.classes))classGrants(data.classes.find(c=>c.classId===id),v.level,s,build,data);
    for(const e of s.breakthroughs){const bt=data.breakthroughs.find(b=>b.indexId===e.id);btGrants(bt,s,build,e);}
  };
  for(let w=0;w<=Math.min(until,build.weeks.length-1);w++) {
    const week=build.weeks[w];s.week=w;
    if(w>0){
      const slow=s.breakthroughs.some(e=>data.breakthroughs.find(b=>b.indexId===e.id)?.name==="Slow Starter");
      s.earned+=slow&&s.expSteps<5?200:100;s.expSteps++;
    }
    for(const e of week.events){
      const before=s.errors.length;
      if(e.type==="class"){
        const cls=data.classes.find(c=>c.classId===e.id);if(!cls){s.errors.push("Class removed from this rules snapshot.");continue;}
        const step=nextClassStep(cls,s,data);if(!step){s.errors.push(`${cls.name} is already mastered.`);continue;}
        if(e.level&&e.level!==step.level){
          const issue=`${cls.name}: planned L${e.level} needs L${e.level-1} first; lineage or earlier class choices changed.`;
          s.errors.push(issue);s.ledger.push({week:w,eventId:e.uid,classId:cls.classId,level:e.level,label:`${cls.name} · L${e.level}`,cost:0,reason:issue,invalid:true,sc:s.sc});continue;
        }
        if(step.level===1){
          const gate=requirements(cls,s,build,data,w===0);
          if(!gate.ok&&!e.gmApproved)s.errors.push(`${cls.name}: ${gate.text}`);
          if(e.gmApproved)s.warnings.push(`${cls.name}: GM override — ${gate.text}`);
          if(w===0)s.ip--;
          else if(build.mirane){
            s.warnings.push(acquisitionWarning(cls));
          }
        }
        s.classes[cls.classId]={level:step.level,free:s.classes[cls.classId]?.free||false};
        s.spent+=step.cost;s.sc+=step.cost;s.refunds+=step.refund;
        abilityRefs(cls,step.level,data).forEach(id=>s.abilities.add(id));
        refreshClassState();
        s.ledger.push({week:w,eventId:e.uid,classId:cls.classId,level:step.level,label:`${cls.name} · L${step.level} ${step.name}`,cost:step.cost,refund:step.refund,reason:step.reason,method:step.level===1&&w===0?"Creation IP":"",warning:step.level===1&&w>0&&build.mirane?acquisitionWarning(cls):"",sc:s.sc});
      }else if(e.type==="breakthrough"){
        const bt=data.breakthroughs.find(b=>b.indexId===e.id);if(!bt){s.errors.push("Unknown breakthrough.");continue;}
        const gate=requirements(bt,s,build,data,w===0);
        if(!gate.ok&&!e.gmApproved)s.errors.push(`${bt.name}: ${gate.text}`);
        if(s.breakthroughs.some(x=>x.id===bt.indexId)&&!/multiple times|more than once/i.test(bt.description))s.errors.push(`${bt.name} cannot be taken again.`);
        const cost=breakthroughCost(bt,s);
        if(w===0)s.btSpent+=cost;else{s.spent+=cost;s.sc+=cost;}
        s.breakthroughs.push(e);if(bt.ability)s.abilities.add(bt.ability);
        btGrants(bt,s,build,e);refreshClassState();
        s.ledger.push({week:w,eventId:e.uid,label:bt.name,cost,creationBT:w===0,sc:s.sc});
      }
      if(s.spent>s.earned)s.errors.push(`Week ${w}: ${s.spent-s.earned} EXP over budget.`);
      if(s.btSpent>300)s.errors.push("Creation breakthroughs exceed 300 EXP.");
      if(s.ip<0)s.errors.push("Character creation has only 3 IP.");
      if(s.errors.length>before)s.ledger[s.ledger.length-1] && (s.ledger[s.ledger.length-1].invalid=true);
    }
    if(w===0&&build.creationDone&&s.earned-s.spent>s.refunds)s.errors.push("Creation class EXP was left unspent: reopen creation to finish the starting purchases.");
  }
  const stats=s.stats;
  let hp=0,mana=0,initiative=0,speed=20,extraBurden=0;
  const passiveSeen=new Set();
  for(const id of s.abilities){
    const a=data.abilities[id];if(!a||passiveSeen.has(a.name))continue;passiveSeen.add(a.name);
    const b=a.body;
    hp+=number(b.match(/(?:You gain|gives)\s*\+(\d+)\s*(?:maximum |max )?HP\b/i)?.[1]);
    mana+=number(b.match(/(?:You gain|gives)\s*\+(\d+)\s*(?:maximum |max )?mana\b/i)?.[1]);
    initiative+=number(b.match(/You gain\s*\+(\d+)\s*Gunslinger bonus to Initiative/i)?.[1]);
    if(a.name==="Fast Runner")speed=25;
    if(a.name==="Peddler of Wares")extraBurden++;
  }
  for(const e of s.breakthroughs){const bt=data.breakthroughs.find(b=>b.indexId===e.id);if(/Wide Circuits/.test(bt.name))mana++;if(bt.name==="On the draw")initiative++;if(/Organized Inventory/.test(bt.name))extraBurden++;if(/Fast Movement/.test(bt.name))speed+=5;}
  s.derived={HP:20+10*stats.Toughness+hp,Mana:6+stats.Power+mana,AP:4,RP:2+stats.Agility,Evasion:7+stats.Agility,Guard:stats.Toughness,Potency:11+stats.Focus,Initiative:stats.Agility+initiative,"Save bonus":stats.Toughness,Speed:speed,"Burden capacity":10+extraBurden};
  s.size=text(ancestry?.description).match(/\bSize\s*:\s*(Tiny|Small|Medium|Large|Huge)/i)?.[1]||"Medium";
  for(const e of s.breakthroughs){const n=data.breakthroughs.find(b=>b.indexId===e.id)?.name||"";if(n.startsWith("Large Specimen"))s.size="Large";if(n.startsWith("Small Specimen"))s.size="Small";}
  s.exp=s.earned-s.spent;s.btRemaining=300-s.btSpent;
  const cap=s.sc>=10000?Infinity:s.sc>=5000?20:15;
  for(const [k,v] of Object.entries({...s.skills,...s.expertise}))if(v>cap)s.errors.push(`${k}: ${v} exceeds the ${cap}-point skill/expertise cap.`);
  s.errors=[...new Set(s.errors)];s.warnings=[...new Set(s.warnings)];
  return s;
}
export function addEvent(build,event) {
  const next=structuredClone(build);
  if(next.cursor===0&&next.creationDone)throw new Error("Select a later week to plan new purchases, or reopen creation.");
  next.weeks[next.cursor].events.push({...event,uid:uid()});
  return next;
}
export function timeline(build,data) {
  return build.weeks.map((week,i)=>{const s=evaluateBuild(build,data,i);return {week:i,sc:s.sc,earned:s.earned,exp:s.exp,steps:s.expSteps,errors:s.errors.length,warnings:s.ledger.filter(e=>e.week===i&&e.warning).map(e=>e.warning)};});
}
export function stampPlannedLevels(build,data) {
  const ledger=evaluateBuild(build,data,build.weeks.length-1).ledger;
  for(const week of build.weeks)for(const e of week.events)if(e.type==='class'&&!e.level){const entry=ledger.find(x=>x.eventId===e.uid);if(entry?.level)e.level=entry.level;}
  return build;
}
