import {MAIN,SUB,SKILL_GROUPS,NORMAL_SKILLS,text,freshBuild,startingWednesday,weekDate,lineagePool,requirements,nextClassStep,breakthroughCost,evaluateBuild,addEvent,timeline} from "./builder-engine.mjs";

const $=s=>document.querySelector(s), esc=s=>String(s??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE="lyrian-character-planner-v1", DATA_CACHE="lyrian-planner-rules-v1";
let data,store={version:1,selected:"",builds:[]},build,sheet,tab="lineage",query="",tier="",availableOnly=true,method="IP",gmApproved=false,revision=0,chartRevision=-1,points=[];
const sorted=(items,q)=>items.filter(x=>(x.name+" "+text(x.requirements)+" "+text(x.description)).toLowerCase().includes(q.toLowerCase())).sort((a,b)=>Number(b.name.toLowerCase().includes(q.toLowerCase()))-Number(a.name.toLowerCase().includes(q.toLowerCase()))||a.name.localeCompare(b.name));
function save(){
  build.updatedAt=new Date().toISOString();store.selected=build.id;
  const index=store.builds.findIndex(x=>x.id===build.id);if(index<0)store.builds.push(build);else store.builds[index]=build;
  try{localStorage.setItem(STORAGE,JSON.stringify(store));$("#builder-save-status").textContent="Saved in this browser · export a backup to move devices. Rules "+data.version;}
  catch{$("#builder-save-status").textContent="Browser storage unavailable or full. Export this build to keep it.";}
}
function commit(next=build){build=next;revision++;save();render();}
function notice(message){const el=$("#builder-notice");el.textContent=message;el.hidden=false;}
const option=(v,label,current)=>`<option value="${esc(v)}"${v===current?' selected':''}>${esc(label)}</option>`;
const link=x=>`<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)} ↗</a>`;
function render(){
  sheet=evaluateBuild(build,data);
  $("#builder-name").value=build.name;$("#builder-mirane").checked=build.mirane;
  $("#builder-start-date").value=build.startWednesday||startingWednesday();
  $("#builder-saved").innerHTML=store.builds.map(b=>option(b.id,b.name,b.id===build.id?b.id:"" )).join("");
  $("#builder-week").max=build.weeks.length-1;$("#builder-week").value=build.cursor;$("#builder-week-number").value=build.cursor;
  $("#builder-week-title").textContent=(build.cursor===0?"Character creation":`Week ${build.cursor}${build.weeks[build.cursor].kind==="training"?" · IP training":""}`)+" · Wed "+weekDate(build,build.cursor);
  $("#builder-week-description").textContent=build.cursor===0?`${sheet.earned} class EXP · 300 breakthrough EXP · 3 IP`:`${sheet.expSteps} × 100 EXP progression steps${sheet.breakthroughs.some(e=>data.breakthroughs.find(b=>b.indexId===e.id)?.name==="Slow Starter")?" · Slow Starter bonus applied":""} · ${sheet.sc} Spirit Core (SC)`;
  const finish=$('[data-builder-action="finish"]');finish.textContent=build.creationDone?"Reopen creation":"Finish creation";finish.hidden=build.cursor!==0;
  $('[data-builder-action="next-week"]').disabled=!build.creationDone;
  $("#builder-budget").innerHTML=[["Spirit Core (SC)",sheet.sc],["Unspent EXP",sheet.exp],[build.cursor===0?"Breakthrough EXP left":"Creation breakthrough EXP",build.cursor===0?sheet.btRemaining:"expired"],[build.cursor===0?"IP left":"Progression steps",build.cursor===0?sheet.ip:`${sheet.expSteps} × 100`],["Clim left",sheet.climRemaining]].map(([label,value])=>`<div${typeof value==="number"&&value<0?' class="budget-invalid"':''}><span>${label}</span><strong>${value}</strong></div>`).join("");
  if(chartRevision!==revision){points=timeline(build,data);chartRevision=revision;}
  const max=Math.max(1100,...points.map(x=>x.sc));
  $("#builder-chart").innerHTML=points.map(p=>`<button class="builder-chart-point${p.week===build.cursor?' selected':''}${p.kind==="training"?' training':''}" data-week="${p.week}" aria-label="${p.week?'Week '+p.week:'Creation'}, Wednesday ${weekDate(build,p.week)}, ${p.sc} Spirit Core, ${p.steps} times 100 EXP${p.kind==='training'?', IP training week':''}" aria-pressed="${p.week===build.cursor}"><span class="chart-value">${p.sc} SC</span><span class="chart-bar" style="height:${Math.max(8,60*p.sc/max)}px"></span><span>${p.week?'W'+p.week:'Start'}</span><small>${weekDate(build,p.week).slice(5)}</small><small>${p.kind==="training"?'IP':p.steps+' × 100'}</small></button>`).join("");
  document.querySelectorAll('[data-builder-tab]').forEach(b=>b.setAttribute("aria-selected",String(b.dataset.builderTab===tab)));
  renderEditor();renderSheet();
}
function field(label,html){return `<label>${label}${html}</label>`;}
function lineage(){
  const race=data.races.find(r=>r.primaryRaceId===build.race),pool=lineagePool(build,data),subs=data.ancestries.filter(x=>x.primaryRace===pool);
  return `<section class="builder-section"><h2>Lineage</h2><div class="builder-fields">${field("Primary race",`<select data-config="race">${data.races.map(r=>option(r.primaryRaceId,r.name,build.race)).join("")}</select>`)}${subs.length?field("Sub-race",`<select data-config="ancestry">${option("","Choose a sub-race",build.ancestry)}${subs.map(r=>option(r.ancestryId,r.name,build.ancestry)).join("")}</select>`):""}${build.race==="demon"?field("Demon clan",`<select data-config="clan">${["wi","lir","d","ar","lu","ni","un","vi","none"].map(k=>option(k,(k==="d"?'D’':k[0].toUpperCase()+k.slice(1))+" · "+text(race[k]?.text),build.clan)).join("")}</select>`):""}${build.race==="demon"&&sheet.breakthroughs.some(e=>data.breakthroughs.find(b=>b.indexId===e.id)?.name==="Mixed House (Demon)")?field("Second clan",`<select data-config="secondClan">${["wi","lir","d","ar","lu","ni","un","vi","none"].filter(k=>k!==build.clan).map(k=>option(k,k.toUpperCase(),build.secondClan)).join("")}</select>`):""}</div><p class="builder-muted">${link(race)} · ${esc(text(race.attributes))}</p><p class="builder-muted">${esc(text(race.proficiencies))}</p>${pool!==race.name?`<p class="builder-info">Hybrid: ${esc(race.name)} base benefits + ${esc(pool)} sub-race traits. Selected through a creation breakthrough.</p>`:""}</section>
  <section class="builder-section"><h2>Main stats <small>5, 4, 4, 3</small></h2><div class="builder-stat-inputs">${MAIN.map(n=>field(n,`<select data-stat="main:${n}">${[5,4,3].map(v=>option(String(v),v,String(build.main[n]))).join("")}</select>`)).join("")}</div><h2>Sub stats <small>5, 4, 3, 2, 1</small></h2><div class="builder-stat-inputs">${SUB.map(n=>field(n,`<select data-stat="sub:${n}">${[5,4,3,2,1].map(v=>option(String(v),v,String(build.sub[n]))).join("")}</select>`)).join("")}</div><p class="builder-muted">Selecting a value swaps it with another stat. Racial bonuses and later Heart / Soul choices are added on the sheet.</p>${build.race==="human"?`<div class="builder-fields">${field("Human +1 main stat",`<select data-config="humanMain">${MAIN.map(n=>option(n,n,build.humanMain)).join("")}</select>`)}${field("Human +1 sub stat",`<select data-config="humanSub">${SUB.map(n=>option(n,n,build.humanSub)).join("")}</select>`)}</div>`:""}</section><section class="builder-section"><h2>Build notes</h2><textarea data-config="notes" rows="3" placeholder="Concept, planned combos, GM rulings…">${esc(build.notes)}</textarea></section>`;
}
function catalogToolbar(kind){return `<div class="builder-catalog-toolbar">${field(`Search ${kind}`,`<input id="builder-catalog-query" type="search" placeholder="Name or requirements…" value="${esc(query)}">`)}${kind==="classes"?field("Tier",`<select id="builder-tier">${option("","All tiers",tier)}${[1,2,3].map(v=>option(String(v),"Tier "+v,tier)).join("")}</select>`):""}<label class="builder-check"><input type="checkbox" id="builder-available"${availableOnly?' checked':''}>Available now</label></div>`;}
function classes(){
  const list=sorted(data.classes,query).filter(c=>!tier||String(c.tier)===tier).map(c=>({c,step:nextClassStep(c,sheet,data),gate:sheet.classes[c.classId]?{ok:true}:requirements(c,sheet,build,data)})).filter(x=>!availableOnly||x.step&&x.gate.ok);
  return `${catalogToolbar("classes")}<div class="builder-entry-method">${field("New class acquisition",`<select id="builder-method">${["IP","DSF","SF"].map(m=>option(m,m==="IP"?"IP · inserts a training week":m==="DSF"?"DSF · tier 1 / 2 fuel":"SF · any tier fuel",method)).join("")}</select>`)}<p>${build.cursor===0?"Creation uses 1 of your 3 IP per purchased class. Racially granted classes are already unlocked.":"New class: 1 IP and a training week, or fuel instead. EXP is still paid. Fuel must be obtained in play."}</p></div><label class="builder-check builder-gm"><input type="checkbox" id="builder-gm"${gmApproved?' checked':''}>GM-confirmed prerequisite override (recorded on the progression sheet)</label><div class="builder-catalog">${list.map(({c,step,gate})=>{
    const key=data.abilities[c.keyAbility];const locked=!gate.ok;
    return `<article class="builder-catalog-row"><div class="builder-row-top"><div><span class="builder-tier">T${c.tier}</span><h3>${link(c)}</h3><p>${esc([c.role1,c.role2].filter(Boolean).join(" / "))}${sheet.classes[c.classId]?` · Level ${sheet.classes[c.classId].level}${sheet.classes[c.classId].free?' · racial unlock':''}`:""}</p></div><button data-add-class="${esc(c.classId)}"${!step||(locked&&!gmApproved)||step.cost>sheet.exp||(step.level===1&&build.cursor===0&&sheet.ip<=0)||(step.level===1&&c.tier===3&&method==="DSF"&&build.cursor>0)?' disabled':''}>${step?`${step.level===1?'Unlock':'L'+step.level} · ${step.cost} EXP`:"Mastered"}</button></div>${step?.reason?`<p class="builder-refund">${esc(step.reason)} · ${step.refund} EXP returned</p>`:""}<p class="builder-requirement${locked?' unmet':''}">${esc(gate.text||text(c.requirements)||"No entry requirements")}${locked?gate.unknown?" · needs a GM check":" · not yet met":""}</p><details><summary>${esc(key?.name||"Class progression")} &amp; progression</summary><p>${esc(key?.body)}</p>${key?.associatedAbility?abilityDetail(key.associatedAbility):""}<ol class="builder-class-path">${[[1,key?.name],[2,data.abilities[c.ability1]?.name],[3,c.skills],[4,data.abilities[c.ability2]?.name],[5,c.heart],[6,data.abilities[c.ability3]?.name],[7,c.soul],[8,data.abilities[c.ultimateAbility]?.name]].map(([l,n])=>`<li><b>L${l}</b><span>${esc(text(n))}</span></li>`).join("")}</ol></details></article>`;
  }).join("")||'<p class="builder-muted">No classes match these filters.</p>'}</div>`;
}
function breakthroughs(){
  return `${catalogToolbar("breakthroughs")}<p class="builder-info">${build.cursor===0?"Creation: use the separate 300 breakthrough EXP pool. It does not add SC.":"Purchase at any time using banked EXP, just like a class level. The cost adds to SC. No IP, fuel, or training week is needed."}</p><label class="builder-check builder-gm"><input type="checkbox" id="builder-gm"${gmApproved?' checked':''}>GM-confirmed prerequisite override</label><div class="builder-catalog">${sorted(data.breakthroughs,query).map(b=>({b,gate:requirements(b,sheet,build,data),cost:breakthroughCost(b,sheet),owned:sheet.breakthroughs.filter(e=>e.id===b.indexId).length})).filter(x=>!availableOnly||x.gate.ok&&(!x.owned||/multiple times|more than once/i.test(x.b.description))).map(({b,gate,cost,owned})=>`<article class="builder-catalog-row"><div class="builder-row-top"><div><h3>${link(b)}</h3><p>${cost} EXP${owned?' · owned ×'+owned:''}</p></div><button data-add-bt="${b.indexId}"${(!gate.ok&&!gmApproved)||(owned&&!/multiple times|more than once/i.test(b.description))||cost>(build.cursor===0?sheet.btRemaining:sheet.exp)?' disabled':''}>Add</button></div><p class="builder-requirement${gate.ok?'':' unmet'}">${esc(gate.text||"No requirements")}${!gate.ok?' · '+(gate.unknown?'GM check needed':'not yet met'):''}</p><details><summary>Full rules</summary><p>${esc(b.body)}</p></details></article>`).join("")}</div>`;
}
function choices(){
  const unique=[...new Map(sheet.grants.map(g=>[g.id,g])).values()];
  return `<section class="builder-section"><h2>Allocate unlocked benefits</h2><p class="builder-muted">Only choices available at this week are shown. Each pool retains its own permitted skills. A point assigned to named expertise usually grants +2; permanent flat bonuses are separate.</p>${unique.map(g=>{
    const a=build.allocations[g.id]||{},pending=sheet.pending.find(p=>p.id===g.id);
    if(g.kind!=="skills")return `<div class="builder-choice-row">${field(esc(g.label||g.text),`<select data-choice="${esc(g.id)}">${g.options.length>1?option("","Choose…",a.choice):""}${g.options.map(n=>option(n,n,a.choice|| (g.options.length===1?n:""))).join("")}</select>`)}</div>`;
    const rows=Object.entries(a).map(([key,value])=>`<div class="builder-skill-allocation"><span>${esc(key.replace(/\|expertise\|/," · "))}</span><input type="number" min="0" max="${g.count}" value="${value}" data-allocation="${esc(g.id)}" data-key="${esc(key)}" aria-label="${esc(key)} allocated points"><button data-remove-allocation="${esc(g.id)}" data-key="${esc(key)}" aria-label="Remove ${esc(key)}">×</button></div>`).join("");
    return `<section class="builder-skill-pool"><h3>${esc(g.label||g.text)} <small>${pending?.remaining??0} / ${g.count} left</small></h3>${g.label?`<details><summary>Allocation rules</summary><p>${esc(g.text)}</p></details>`:""}${rows}<form data-pool="${esc(g.id)}" class="builder-pool-form"><select name="skill" aria-label="Skill for ${esc(g.label||g.text)}">${g.options.map(n=>option(n,n,"")).join("")}</select>${g.expertise||g.expertiseOnly?`<input name="expertise" placeholder="Expertise name (optional)" aria-label="Specific expertise name">`:""}<input type="number" name="points" min="1" max="${pending?.remaining||g.count}" value="1" aria-label="Points to allocate"><button${!pending?' disabled':''}>Allocate</button></form></section>`;
  }).join("")}</section>`;
}
function equipment(){
  return `${catalogToolbar("equipment")}<p class="builder-muted">Plan purchases at the selected week. Only carried items count toward burden; equipped armor contributes its listed guard / evasion penalty. Mirane arrival includes a free Adventurer’s Kit. No future loot income is assumed.</p><div class="builder-catalog">${sorted(data.items,query).filter(i=>!availableOnly||Number(String(i.cost).match(/[\d.]+/)?.[0])<=sheet.climRemaining).map(i=>`<article class="builder-catalog-row"><div class="builder-row-top"><div><h3>${link(i)}</h3><p>${esc(i.subType)} · ${esc(i.cost||"variable cost")} · Burden ${esc(i.burden||"0")}</p></div><button data-add-item="${i.indexId}">Plan item</button></div><details><summary>Full item rules</summary><p>${esc(text(i.description))}</p></details></article>`).join("")}</div>`;
}
function progression(){return `<section class="builder-section"><h2>Progression ledger</h2><p class="builder-muted">The sheet and ledger stop at the selected week. Removing an earlier purchase can invalidate later prerequisites; those are flagged rather than silently rewritten.</p>${sheet.ledger.map(e=>`<div class="builder-ledger-entry${e.invalid?' invalid':''}"><span>${e.week?'Week '+e.week:'Creation'}</span><div><strong>${esc(e.label)}</strong><p>${e.clim!==undefined?e.clim+' Clim':e.cost+' EXP'+(e.creationBT?' · creation breakthrough pool':' · '+e.sc+' SC')}${e.refund?' · '+e.refund+' EXP refunded':''}</p>${e.method?`<p class="builder-training-note">${esc(e.method)}${e.method==='IP'?' required · training week; progression postponed by one week':e.method==='Creation IP'?' · 1 of 3 creation IP':e.method==='DSF'?' required · tier 1 / 2':' required · Spirit Fuel'}</p>`:""}${e.reason?`<p class="builder-refund">${esc(e.reason)}</p>`:""}</div><button data-remove-event="${e.eventId}" aria-label="Remove ${esc(e.label)}">×</button></div>`).join("")||'<p class="builder-muted">No purchases yet.</p>'}${build.cursor>0?'<button data-builder-action="remove-week">Remove this week (and its purchases)</button>':''}</section>`;}
function renderEditor(){
  const el=$("#builder-editor-content");el.innerHTML=({lineage,classes,breakthroughs,skills:choices,equipment,progression})[tab]();
  if(build.creationDone&&build.cursor===0){el.querySelectorAll("input,select,textarea,button").forEach(e=>e.disabled=true);el.insertAdjacentHTML("afterbegin",'<p class="builder-info">Creation is complete. Reopen it to edit starting choices, or select a later week.</p>');}
  if(build.cursor>0&&tab==="lineage"){el.querySelectorAll("[data-config]:not([data-config=notes]):not([data-config=secondClan]),[data-stat]").forEach(e=>e.disabled=true);}
}
function abilityDetail(id){const a=data.abilities[id];if(!a)return "";const cost=(label,value)=>value!==''&&value!=null?`${label} ${+value<0?'Variable':value}`:'';return `<details class="builder-ability-detail"><summary>${link(a)}</summary><p>${[cost('AP',a.apCost),cost('RP',a.rpCost),cost('MP',a.manaCost),a.range&&`Range ${a.range}`].filter(Boolean).map(esc).join(" · ")}</p>${a.otherCosts?`<p>Other cost: ${esc(text(a.otherCosts))}</p>`:''}${a.requirement?`<p>Requirement: ${esc(text(a.requirement))}</p>`:''}<p>${esc(a.keywords||"")}</p><p>${esc(a.body)}</p></details>`;}
function renderSheet(){
  const race=data.races.find(r=>r.primaryRaceId===build.race),ancestry=data.ancestries.find(r=>r.ancestryId===build.ancestry);
  $("#builder-sheet-content").innerHTML=`<p class="builder-sheet-identity"><strong>${esc(build.name)}</strong><span>${esc(race?.name)}${ancestry?' · '+esc(ancestry.name):''} · ${build.cursor?'Week '+build.cursor:'Creation'}</span></p><div class="builder-sheet-stats">${Object.entries(sheet.derived).map(([n,v])=>`<div><span>${n}</span><b>${v}${n==='Speed'?' ft':''}</b></div>`).join("")}</div><div class="builder-sheet-attributes">${[MAIN,SUB].map(group=>`<dl>${group.map(n=>`<div><dt>${n}</dt><dd>${sheet.stats[n]}</dd></div>`).join("")}</dl>`).join("")}</div>
  ${sheet.errors.length?`<details class="builder-validation" open><summary>${sheet.errors.length} rule / budget issue${sheet.errors.length===1?'':'s'}</summary><ul>${sheet.errors.map(e=>`<li>${esc(e)}</li>`).join("")}</ul></details>`:""}${sheet.pending.length?`<button class="builder-pending" data-builder-tab="skills">${sheet.pending.length} unallocated benefit${sheet.pending.length===1?'':'s'} →</button>`:""}
  <section><h3>Classes</h3>${Object.entries(sheet.classes).map(([id,c])=>`<p>${link(data.classes.find(x=>x.classId===id))}<b>L${c.level}${c.level===8?' · Mastered':''}</b></p>`).join("")||'<p class="builder-muted">None yet</p>'}</section>
  <details open><summary>Skills &amp; expertise</summary><dl class="builder-skill-summary">${Object.entries(sheet.skills).filter(([,v])=>v).map(([n,v])=>`<div><dt>${esc(n)}</dt><dd>+${v}</dd></div>`).join("")}${Object.entries(sheet.expertise).filter(([,v])=>v).map(([n,v])=>`<div><dt>${esc(n)} <small>Expertise</small></dt><dd>+${v}</dd></div>`).join("")}</dl></details>
  <details><summary>Proficiencies &amp; elements</summary><div class="builder-badges">${[...sheet.proficiencies].sort().map(n=>`<span>${esc(n)}</span>`).join("")}</div><h4>Elemental mastery</h4><div class="builder-badges">${[...sheet.elements].sort().map(n=>`<span>${esc(n)}</span>`).join("")}</div><p class="builder-muted">Languages: ${esc(text(race?.proficiencies).split(/You also|You gain proficiency/i)[0])}</p></details>
  <details><summary>Abilities · ${sheet.abilities.size}</summary>${[...sheet.abilities].map(abilityDetail).join("")}</details><details><summary>Breakthroughs · ${sheet.breakthroughs.length}</summary>${sheet.breakthroughs.map(e=>{const b=data.breakthroughs.find(b=>b.indexId===e.id);return `<div class="builder-bt-owned">${link(b)}<p>${esc(b.body)}</p></div>`;}).join("")}</details>
  <details open><summary>Equipment · ${sheet.burden} / ${sheet.derived['Burden capacity']} burden</summary>${sheet.equipment.map(i=>`<div class="builder-equipped-item"><strong>${link(i)}</strong>${i.freeArrival?`<p>Free Mirane arrival kit · stored unless marked carried.</p><label class="builder-check"><input type="checkbox" data-arrival-kit="true"${i.carried?' checked':''}>Carried</label>`:`<div>${field('Quantity',`<input data-item-quantity="${i.eventId}" type="number" min="1" max="9999" value="${i.quantity}">`)}<label class="builder-check"><input type="checkbox" data-item-carried="${i.eventId}"${i.carried?' checked':''}>Carried</label><label class="builder-check"><input type="checkbox" data-item-equipped="${i.eventId}"${i.equipped?' checked':''}>Equipped</label><button data-remove-event="${i.eventId}" aria-label="Remove ${esc(i.name)}">×</button></div>`}</div>`).join("")||'<p class="builder-muted">No equipment planned</p>'}</details><button class="builder-back-choices" data-builder-action="view-choices">Back to choices</button>
  ${sheet.warnings.length?`<details class="builder-warnings" open><summary>Planning notes</summary><ul>${sheet.warnings.map(w=>`<li>${esc(w)}</li>`).join("")}</ul></details>`:""}`;
}
function attempt(event){
  try{const next=addEvent(build,{...event,gmApproved},method),end=evaluateBuild(next,data,next.weeks.length-1);
    // Permit planned equipment deficits, but never silently spend unavailable EXP.
    const currentErrors=evaluateBuild(build,data,build.weeks.length-1).errors;
    const added=end.errors.filter(e=>!currentErrors.includes(e));
    if(added.length&&event.type!=="item"){notice(added.join(" "));return;}
    commit(next);$("#builder-notice").hidden=true;
  }catch(e){notice(e.message);}
}
function sheetText(){return [`${build.name} — ${build.cursor?'Week '+build.cursor:'Creation'}`,`${sheet.sc} Spirit Core (SC) · ${sheet.exp} EXP banked`,...Object.entries(sheet.stats).map(([k,v])=>`${k}: ${v}`),...Object.entries(sheet.derived).map(([k,v])=>`${k}: ${v}`),"Classes:",...Object.entries(sheet.classes).map(([id,c])=>`${data.classes.find(x=>x.classId===id).name} L${c.level}`),"Skills:",...Object.entries(sheet.skills).map(([k,v])=>`${k}: +${v}`),"Expertise:",...Object.entries(sheet.expertise).map(([k,v])=>`${k}: +${v}`),"Proficiencies: "+[...sheet.proficiencies].join(", "),"Elements: "+[...sheet.elements].join(", "),"Abilities:",...[...sheet.abilities].map(id=>data.abilities[id]?.name).filter(Boolean),"Equipment:",...sheet.equipment.map(x=>`${x.name} ×${x.quantity}`),"Notes: "+build.notes].join("\n");}
document.addEventListener("click",async e=>{
  const b=e.target.closest("button");if(!b)return;
  if(b.dataset.builderTab){tab=b.dataset.builderTab;query="";renderEditor();document.querySelectorAll('[data-builder-tab]').forEach(x=>x.setAttribute('aria-selected',String(x.dataset.builderTab===tab)));return;}
  if(b.dataset.week!==undefined){build.cursor=Number(b.dataset.week);save();render();return;}
  if(b.dataset.addClass){const c=data.classes.find(x=>x.classId===b.dataset.addClass);attempt({type:"class",id:c.classId,isUnlock:!sheet.classes[c.classId]});return;}
  if(b.dataset.addBt){attempt({type:"breakthrough",id:b.dataset.addBt});return;}
  if(b.dataset.addItem){attempt({type:"item",id:b.dataset.addItem,quantity:1,carried:true});return;}
  if(b.dataset.removeEvent){for(const week of build.weeks)week.events=week.events.filter(x=>x.uid!==b.dataset.removeEvent);commit();return;}
  if(b.dataset.removeAllocation){delete build.allocations[b.dataset.removeAllocation][b.dataset.key];commit();return;}
  const action=b.dataset.builderAction;
  if(action==="view-sheet"){$('.builder-sheet').scrollIntoView({block:'start',behavior:'instant'});return;}
  if(action==="view-choices"){$('.builder-editor').scrollIntoView({block:'start',behavior:'instant'});return;}
  if(action==="new"){build=freshBuild();query="";tab="lineage";commit();}
  if(action==="duplicate"){const copy=structuredClone(build);copy.id=freshBuild().id;copy.name+=' (copy)';commit(copy);}
  if(action==="finish"){
    if(build.creationDone){build.creationDone=false;commit();return;}
    const start=evaluateBuild(build,data,0);if(start.errors.length||start.exp>start.refunds){notice(`Finish the starting purchases first. ${start.exp>start.refunds?'Spend the remaining '+start.exp+' class EXP. ':''}${start.errors.join(' ')}`);return;}
    build.creationDone=true;commit();if(start.pending.length||start.exp)notice(`Creation saved.${start.pending.length?' '+start.pending.length+' unallocated benefits remain; use Skills & choices to resolve them.':''}${start.exp?' '+start.exp+' refunded EXP remains banked.':''}`);
  }
  if(action==="next-week"){build.weeks.push({kind:"earn",events:[]});build.cursor=build.weeks.length-1;commit();}
  if(action==="remove-week"){build.weeks.splice(build.cursor,1);build.cursor=Math.max(0,build.cursor-1);commit();}
  if(action==="export"){const url=URL.createObjectURL(new Blob([JSON.stringify(build,null,2)],{type:"application/json"}));const a=document.createElement('a');a.href=url;a.download=build.name.replace(/[^a-z0-9-]/gi,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  if(action==="copy-sheet"){try{await navigator.clipboard.writeText(sheetText());b.textContent='Copied';setTimeout(()=>b.textContent='Copy sheet',1200);}catch{notice('Clipboard permission unavailable. Use Export for a saved copy.');}}
});
document.addEventListener("change",e=>{
  const el=e.target;
  if(el.id==="builder-mirane"){build.mirane=el.checked;commit();}
  if(el.id==="builder-start-date"&&el.value){const d=new Date(el.value+"T12:00:00");build.startWednesday=startingWednesday(d);commit();if(d.getDay()!==3)notice('Aligned the starting date to Wednesday of that week.');}
  if(el.id==="builder-name"){build.name=el.value;commit();}
  if(el.dataset.arrivalKit){build.arrivalKitCarried=el.checked;commit();}
  if(el.id==="builder-saved"){build=store.builds.find(b=>b.id===el.value);query="";commit();}
  if(el.id==="builder-week"){build.cursor=Number(el.value);save();render();}
  if(el.id==="builder-method")method=el.value;
  if(el.id==="builder-gm")gmApproved=el.checked;
  if(el.id==="builder-tier"){tier=el.value;renderEditor();}
  if(el.id==="builder-available"){availableOnly=el.checked;renderEditor();}
  if(el.dataset.config){build[el.dataset.config]=el.value;if(el.dataset.config==="race")build.ancestry="";commit();}
  if(el.dataset.stat){const [group,key]=el.dataset.stat.split(":"),old=build[group][key],v=Number(el.value);const other=Object.keys(build[group]).find(k=>k!==key&&build[group][k]===v);if(other)build[group][other]=old;build[group][key]=v;commit();}
  if(el.dataset.choice){build.allocations[el.dataset.choice]={choice:el.value};commit();}
  if(el.dataset.allocation){build.allocations[el.dataset.allocation][el.dataset.key]=Math.max(0,Math.floor(Number(el.value)));commit();}
  for(const key of ["Quantity","Carried","Equipped"]){const id=el.dataset['item'+key];if(id){for(const w of build.weeks)for(const ev of w.events)if(ev.uid===id)ev[key.toLowerCase()]=key==="Quantity"?Math.max(1,Number(el.value)):el.checked;commit();}}
  if(["builder-method","builder-gm"].includes(el.id))renderEditor();
});
document.addEventListener("input",e=>{
  if(e.target.id==="builder-name"){build.name=e.target.value;save();return;}
  if(e.target.id==="builder-catalog-query"){
    query=e.target.value;const caret=e.target.selectionStart;renderEditor();const input=$("#builder-catalog-query");input.focus();try{input.setSelectionRange(caret,caret);}catch{}
  }
});
document.addEventListener("submit",e=>{
  const form=e.target;if(!form.dataset.pool)return;e.preventDefault();
  const g=sheet.grants.find(x=>x.id===form.dataset.pool),values=new FormData(form),skill=values.get('skill'),ex=String(values.get('expertise')||'').trim(),value=Number(values.get('points'));
  const a=build.allocations[g.id]||{},used=Object.values(a).reduce((n,v)=>n+Number(v),0);
  if(!Number.isInteger(value)||value<1||value>g.count-used){notice('Allocate only the remaining points in this pool.');return;}
  if(g.expertiseOnly&&!ex){notice('Give this expertise a specific name.');return;}
  const key=skill+(ex?'|expertise|'+ex:'');a[key]=(a[key]||0)+value;build.allocations[g.id]=a;commit();
});
$("#builder-import").addEventListener("change",async e=>{
  try{const file=e.target.files[0];if(!file)return;if(file.size>2e6)throw Error('Build file is too large.');const b=JSON.parse(await file.text());
    if(b.version!==1||!Array.isArray(b.weeks)||!b.main||!b.sub||!b.allocations||b.weeks.length>1000)throw Error('Not a supported planner build.');
    b.id=freshBuild().id;b.cursor=Math.min(Math.max(0,Number(b.cursor)||0),b.weeks.length-1);evaluateBuild(b,data);commit(b);
  }catch(err){notice('Import failed: '+err.message);}e.target.value='';
});
async function boot(){
  // HTTP cache + Cache API keep the immutable rules bundle reusable; never
  // cache generated sheets, chat data, or arbitrary pages.
  try{const response=await fetch('/assets/builder-data.json');if(!response.ok)throw Error('Rules download failed');data=await response.json();try{const cache=await caches.open(DATA_CACHE);await cache.put('/assets/builder-data.json',new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}}));}catch{}}
  catch(err){try{const cached=await (await caches.open(DATA_CACHE)).match('/assets/builder-data.json');if(!cached)throw err;data=await cached.json();}catch{ $("#builder-save-status").textContent='Could not load rules. Reload when online.';return;}}
  try{const saved=JSON.parse(localStorage.getItem(STORAGE));if(saved?.version===1&&Array.isArray(saved.builds)&&saved.builds.length)store=saved;}catch{}
  build=store.builds.find(b=>b.id===store.selected)||store.builds[0]||freshBuild();save();render();
}
boot().catch(err=>{$("#builder-save-status").textContent='The saved build could not be opened. Exported backups can be imported into a new build.';console.error(err);});
