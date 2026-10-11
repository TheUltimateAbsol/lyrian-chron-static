import {MAIN,SUB,COMMON,SPECIAL,ARMOR,text,freshBuild,calendarDate,weekDate,lineagePool,requirements,nextClassStep,breakthroughCost,evaluateBuild,addEvent,timeline,stampPlannedLevels} from "./builder-engine.mjs";
import {createRulesLoader} from './builder-rules.mjs';

const $=s=>document.querySelector(s), esc=s=>String(s??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE="lyrian-character-planner-v1", DATA_CACHE="lyrian-planner-rules-v1";
let data,store={version:1,selected:"",builds:[]},build,sheet,tab="classes",query="",lineageQuery="",tier="",availableOnly=true,gmApproved=false,revision=0,chartRevision=-1,points=[],foundationBuild="",foundationPhase="",catalogOpen=false;
const sorted=(items,q)=>items.filter(x=>(x.name+" "+text(x.requirements)+" "+text(x.description)).toLowerCase().includes(q.toLowerCase())).sort((a,b)=>Number(b.name.toLowerCase().includes(q.toLowerCase()))-Number(a.name.toLowerCase().includes(q.toLowerCase()))||a.name.localeCompare(b.name));
function save(){
  build.updatedAt=new Date().toISOString();store.selected=build.id;
  const index=store.builds.findIndex(x=>x.id===build.id);if(index<0)store.builds.push(build);else store.builds[index]=build;
  try{localStorage.setItem(STORAGE,JSON.stringify(store));$("#builder-save-status").textContent="Saved in this browser · export a backup to move devices. Rules "+data.version;}
  catch{$("#builder-save-status").textContent="Browser storage unavailable or full. Export this build to keep it.";}
}
function commit(next=build){build=next;revision++;$('#builder-notice').hidden=true;save();render();}
function notice(message){const el=$("#builder-notice");el.textContent=message;el.hidden=false;}
const option=(v,label,current)=>`<option value="${esc(v)}"${v===current?' selected':''}>${esc(label)}</option>`;
const link=x=>`<a${x.previewHtml?` class="ability-preview-link" data-ability-preview="${esc(x.previewHtml)}"`:''} href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>`;
const loadRules=createRulesLoader();
const inlineRules=(label,record,name,metadata)=>`<details class="builder-inline-rules" data-builder-rules-url="${esc(record.rulesUrl||'')}"><summary aria-label="${esc(name)}"><span class="builder-rule-meta">${metadata}</span><span class="builder-rule-toggle">${esc(label)}</span></summary><div class="builder-rules-body"><p role="status">${record.rulesUrl?'Loading rules…':'Reconnect and reload to get formatted rules, or open the summary from the name above.'}</p></div></details>`;
const grantAnchor=id=>'builder-grant-'+encodeURIComponent(id);
function renderUnallocated(){
  const el=$('#builder-unallocated'),pending=sheet.pending;
  el.hidden=!pending.length;
  el.innerHTML=pending.length?`<strong>${pending.length} benefit choice${pending.length===1?' is':'s are'} not allocated</strong><p>You can decide later and keep planning. Unassigned points and bonuses are not included in your stats or prerequisites.</p><a href="#builder-editor-content" data-allocate-grant="">Allocate now →</a><details><summary>See unallocated choices</summary><ul>${pending.map(g=>`<li><a href="#${grantAnchor(g.id)}" data-allocate-grant="${esc(g.id)}">${esc(g.label||g.text)}${g.kind==='skills'?` · ${g.remaining} point${g.remaining===1?'':'s'} left`:''} →</a></li>`).join('')}</ul></details>`:'';
}
function showAllocations(id=''){
  tab='skills';query='';render();
  const target=id&&document.getElementById(grantAnchor(id))||$('#builder-editor-content');
  target.scrollIntoView({block:'start',behavior:'instant'});
  if(id)target.classList.add('builder-allocation-target');
  target.querySelector('select,input')?.focus({preventScroll:true});
}
function render(){
  sheet=evaluateBuild(build,data);
  $("#builder-name").value=build.name;$("#builder-mirane").checked=build.mirane;
  $("#builder-start-date").value=build.startDate||build.startWednesday||calendarDate();
  const first=weekDate(build,1),start=new Date(first+"T12:00:00Z");start.setUTCDate(start.getUTCDate()-7);
  $("#builder-week-timing").textContent=`First full week: Wed ${start.toISOString().slice(0,10)} → Wed ${first}. First EXP / IP eligible on ${first}.`;
  $("#builder-saved").innerHTML=store.builds.map(b=>option(b.id,b.name,b.id===build.id?b.id:"" )).join("");
  $("#builder-week").max=build.weeks.length-1;$("#builder-week").value=build.cursor;$("#builder-week-number").value=build.cursor;
  $("#builder-week-title").textContent=(build.cursor===0?"Character creation · ":`Week ${build.cursor} · Wed `)+weekDate(build,build.cursor);
  $("#builder-week-description").textContent=build.cursor===0?`${sheet.earned} class EXP · 300 breakthrough EXP · 3 IP`:`${sheet.expSteps} × 100 EXP progression steps${sheet.breakthroughs.some(e=>data.breakthroughs.find(b=>b.indexId===e.id)?.name==="Slow Starter")?" · Slow Starter bonus applied":""} · ${sheet.sc} Spirit Core (SC)`;
  const finish=$('[data-builder-action="finish"]');finish.textContent="Finish character creation";$('.builder-creation-footer').hidden=build.cursor!==0||build.creationDone;
  $('[data-builder-action="next-week"]').hidden=!build.creationDone;
  $('[data-builder-tab="progression"]').hidden=build.cursor===0;
  if(build.cursor===0&&tab==='progression')tab='classes';
  const planning=build.creationDone||build.cursor>0;
  $('.builder-tabs').hidden=build.creationDone&&build.cursor===0&&tab!=='skills';
  const foundations=$('#builder-foundations'),phase=planning?'plan':'creation';
  if(foundationBuild!==build.id||foundationPhase!==phase){foundations.open=!planning;foundationBuild=build.id;foundationPhase=phase;}
  $('#builder-foundations-title').textContent=planning?'Starting character · review / edit':'Character creation · race & starting stats';
  $('#builder-workspace-title').textContent=planning?(build.cursor?`Plan Week ${build.cursor}`:'Creation saved · plan your next week'):'Choose starting classes';
  $('[data-builder-tab="classes"]').textContent=planning?'Level classes':'Starting classes';
  $('[data-builder-tab="breakthroughs"]').textContent=planning?'Add breakthrough':'Creation breakthroughs';
  $('[data-builder-tab="skills"]').textContent=`Allocate benefits${sheet.pending.length?' · '+sheet.pending.length:''}`;
  $("#builder-creation-status").textContent=build.creationDone?'Creation is complete. Reopen it to change foundations; dependent choices will be rechecked.':`${sheet.exp} class EXP remaining · ${sheet.btRemaining} breakthrough EXP remaining · ${sheet.pending.length} unallocated benefits`;
  $("#builder-budget").innerHTML=[["Spirit Core (SC)",sheet.sc],["Unspent EXP",sheet.exp],...(build.cursor===0?[["Breakthrough EXP",sheet.btRemaining],["IP left",sheet.ip]]:[["Progression steps",`${sheet.expSteps} × 100`]])].map(([label,value])=>`<div${typeof value==="number"&&value<0?' class="budget-invalid"':''}><span>${label}</span><strong>${value}</strong></div>`).join("");
  if(chartRevision!==revision){points=timeline(build,data);chartRevision=revision;}
  const max=Math.max(1100,...points.map(x=>x.sc));
  $("#builder-chart").innerHTML=points.map(p=>`<button class="builder-chart-point${p.week===build.cursor?' selected':''}${p.warnings.length?' acquisition-warning':''}${p.errors?' has-issues':''}" data-week="${p.week}" aria-label="${p.week?'Week '+p.week:'Creation'}, ${weekDate(build,p.week)}, ${p.sc} Spirit Core${p.warnings.length?', new class: IP or fuel required':''}${p.errors?', needs review':''}" aria-pressed="${p.week===build.cursor}"><span class="chart-value">${p.sc} SC</span><span class="chart-bar" style="height:${Math.max(8,60*p.sc/max)}px"></span><span>${p.week?'W'+p.week:'Start'}</span><small>${weekDate(build,p.week).slice(5)}</small>${p.warnings.length?'<small class="chart-warning-label">⚠ Class unlock</small>':''}${p.errors?'<small>Review</small>':''}</button>`).join("");
  $("#builder-chart-warnings").innerHTML=points.filter(p=>p.warnings.length).map(p=>`<details${p.week===build.cursor?' open':''}><summary>⚠ Week ${p.week} · new class acquisition</summary>${p.warnings.map(w=>`<p>${esc(w)}</p>`).join('')}</details>`).join('');
  const end=evaluateBuild(build,data,build.weeks.length-1),review=$('#builder-dependencies');review.hidden=!end.errors.length;
  review.innerHTML=`<details open><summary>Check dependencies &amp; budgets · ${end.errors.length} issue${end.errors.length===1?'':'s'}</summary><p>Earlier choices affect the entire plan. Purchases are kept for review; the sheet is provisional until these are resolved.</p><ul>${end.errors.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></details>`;
  document.querySelectorAll('[data-builder-tab]').forEach(b=>b.setAttribute("aria-selected",String(b.dataset.builderTab===tab)));
  renderFoundations();renderEditor();renderSheet();renderStartingChoices();renderUnallocated();
}
function field(label,html){return `<label>${label}${html}</label>`;}
const CLANS=['wi','lir','d','ar','lu','ni','un','vi','none'];
const clanName=k=>k==='d'?'D’':k[0].toUpperCase()+k.slice(1);
const expandedAbilities=ids=>[...new Set(ids.filter(Boolean).flatMap(id=>[id,data.abilities[id]?.associatedAbility].filter(Boolean)))];
function lineageTraits(r,primary){
  let ids=(primary?[r.ability1,r.ability2]:[r.trait1,r.trait2,r.trait3]).filter(Boolean);
  const base=data.races.find(x=>x.primaryRaceId===build.race),hybrid=lineagePool(build,data)!==base.name;
  if(hybrid&&primary&&r.primaryRaceId==='human'&&build.race==='human')ids=ids.filter(id=>data.abilities[id]?.name!=='Human Adaptability');
  if(hybrid&&!primary&&r.ancestryId==='high-fae')ids=ids.map(id=>/Faerie? Flash II/.test(data.abilities[id]?.name||'')?data.races.find(r=>r.name==='Fae').ability1:id);
  return ids;
}
function traitPreview(ids){return expandedAbilities(ids).map(id=>{const a=data.abilities[id];return a?`<div class="builder-trait-preview"><strong>${esc(a.name)}</strong><p>${esc(a.body.length>165?a.body.slice(0,162)+'…':a.body)}</p></div>`:'';}).join('');}
function lineageCards(races,primary){return `<div class="builder-race-grid" role="group" aria-label="${primary?'Primary races':'Sub-races'}">${races.map(r=>{
  const id=primary?r.primaryRaceId:r.ancestryId,selected=id===(primary?build.race:build.ancestry),ids=lineageTraits(r,primary);
  return `<article class="lineage-card lineage-${esc((primary?r.name:r.primaryRace).toLowerCase())} builder-race-card${selected?' selected':''}">${r.imageUrl?`<div class="lineage-art"><img class="entity-art" src="${esc(r.imageUrl)}" alt="" loading="lazy"></div>`:''}<div class="lineage-content"><div class="builder-race-heading"><div>${!primary?`<span class="lineage-name">${esc(r.primaryRace)}</span>`:''}<h3>${link(r)}</h3></div><button class="builder-card-action" data-pick-${primary?'race':'ancestry'}="${esc(id)}" aria-label="${selected?'Selected':'Choose'} ${esc(r.name)}" aria-pressed="${selected}">${selected?'<span>✓<span class="builder-choice-selected"> Selected</span></span>':'Choose'}</button></div>${primary?`<p class="builder-muted">${esc(text(r.attributes))}</p>`:''}<div class="lineage-abilities"><h4>Abilities</h4>${expandedAbilities(ids).map(abilityDetail).join('')||'<p>None listed</p>'}</div></div></article>`;
}).join('')}</div>`;}
function clanCards(race,second=false){const current=second?build.secondClan:build.clan;return `<div class="builder-clan-grid" role="group" aria-label="${second?'Second clan':'Demon clan'}">${CLANS.filter(k=>!second||k!==build.clan).map(k=>`<article class="builder-clan-card${current===k?' selected':''}"><button data-pick-${second?'second-clan':'clan'}="${k}" aria-pressed="${current===k}" aria-label="Choose ${clanName(k)}${second?' second clan':' clan'}">${clanName(k)}${current===k?' · Selected':''}</button><p>${esc(text(race[k]?.text))}</p>${traitPreview([race[k]?.ability])}${race[k]?.ability?abilityDetail(race[k].ability):''}</article>`).join('')}</div>`;}
function subraceChoices(subs,pool){
  const chosen=subs.find(r=>r.ancestryId===build.ancestry),list=subs.filter(r=>r!==chosen&&(r.name+' '+expandedAbilities([r.trait1,r.trait2,r.trait3]).map(id=>data.abilities[id]?.name+' '+data.abilities[id]?.body).join(' ')).toLowerCase().includes(lineageQuery.toLowerCase()));
  return `<h2 class="builder-subrace-heading">${esc(pool)} sub-race</h2>${chosen?lineageCards([chosen],false):''}<details class="builder-subrace-picker"${!chosen||lineageQuery?' open':''}><summary>${chosen?'Change / compare sub-races':'Choose a sub-race'}</summary>${field('Find a sub-race or ability',`<input type="search" id="builder-lineage-query" value="${esc(lineageQuery)}" placeholder="Name or ability…">`)}${lineageCards(list,false)}</details>`;
}
function lineage(){
  const race=data.races.find(r=>r.primaryRaceId===build.race),pool=lineagePool(build,data),subs=data.ancestries.filter(x=>x.primaryRace===pool);
  return `<section class="builder-section"><h2>Primary race</h2><p class="builder-muted">Race changes recheck all class requirements and refunds.</p>${lineageCards([race],true)}<details class="builder-race-picker"><summary>Change / compare primary races</summary>${lineageCards(data.races.filter(r=>r!==race),true)}</details><div class="builder-selected-race"><h3>${esc(race.name)} skill &amp; proficiency benefits</h3><p>${esc(text(race.skills))}</p><p>${esc(text(race.proficiencies))}</p></div>${pool!==race.name?`<p class="builder-info">Hybrid: ${esc(race.name)} base benefits + ${esc(pool)} sub-race traits. Selected through a creation breakthrough.</p>`:''}${subs.length?subraceChoices(subs,pool):`<p class="builder-info">${esc(race.name)} has no sub-race to choose.</p>`}${build.race==='demon'?`<h2>Demon clan</h2>${clanCards(race)}${sheet.breakthroughs.some(e=>data.breakthroughs.find(b=>b.indexId===e.id)?.name==='Mixed House (Demon)')?`<h2>Mixed House · second clan</h2>${clanCards(race,true)}`:''}`:''}</section>
  <section class="builder-section"><h2>Main stats <small>5, 4, 4, 3</small></h2><div class="builder-stat-inputs">${MAIN.map(n=>field(n,`<select data-stat="main:${n}">${[5,4,3].map(v=>option(String(v),v,String(build.main[n]))).join("")}</select>`)).join("")}</div><h2>Sub stats <small>5, 4, 3, 2, 1</small></h2><div class="builder-stat-inputs">${SUB.map(n=>field(n,`<select data-stat="sub:${n}">${[5,4,3,2,1].map(v=>option(String(v),v,String(build.sub[n]))).join("")}</select>`)).join("")}</div><p class="builder-muted">Selecting a value swaps it with another stat. Racial bonuses and later Heart / Soul choices are added on the sheet.</p>${build.race==="human"?`<div class="builder-fields">${field("Human +1 main stat",`<select data-config="humanMain">${MAIN.map(n=>option(n,n,build.humanMain)).join("")}</select>`)}${field("Human +1 sub stat",`<select data-config="humanSub">${SUB.map(n=>option(n,n,build.humanSub)).join("")}</select>`)}</div>`:""}</section><section class="builder-section"><h2>Build notes</h2><textarea data-config="notes" rows="3" placeholder="Concept, planned combos, GM rulings…">${esc(build.notes)}</textarea></section>`;
}
function catalogToolbar(kind){return `<div class="builder-catalog-toolbar">${field(`Search ${kind}`,`<input id="builder-catalog-query" type="search" placeholder="Name or requirements…" value="${esc(query)}">`)}${kind==="classes"?field("Tier",`<select id="builder-tier">${option("","All tiers",tier)}${[1,2,3].map(v=>option(String(v),"Tier "+v,tier)).join("")}</select>`):""}<label class="builder-check"><input type="checkbox" id="builder-available"${availableOnly?' checked':''}>Available now</label></div>`;}
function requirementMarkup(gate,fallback=''){
  const value=text(gate.text||fallback);
  if(gate.ok&&(!value||/^(?:-|none\.?|no (?:entry )?requirements\.?)$/i.test(value)))return '';
  return `<p class="builder-requirement${gate.ok?'':' unmet'}">${esc(value||'Entry requirement')}${gate.ok?'':' · '+(gate.unknown?'GM check needed':'not yet met')}</p>`;
}
function classRow(c,owned=false){
  const step=nextClassStep(c,sheet,data),gate=owned?{ok:true}:requirements(c,sheet,build,data),locked=!gate.ok;
  const benefit=step?.level===3?c.skills:step?.level===5?c.heart:step?.level===7?c.soul:data.abilities[step?.id]?.body;
  const disabled=!step||(locked&&!gmApproved)||step.cost>sheet.exp||(step.level===1&&build.cursor===0&&sheet.ip<=0);
  const actionLabel=step?`${owned?'Level up':'Unlock'} ${c.name} to level ${step.level} for ${step.cost} EXP`:`${c.name} mastered at level 8`;
  return `<article class="builder-catalog-row builder-class-card class-tier-${c.tier}${owned?' builder-owned-class':''}">
    <div class="builder-row-top">${c.imageUrl?`<a class="builder-class-thumbnail" href="${esc(c.url)}" target="_blank" rel="noopener" aria-label="${esc(c.name)} summary"><img src="${esc(c.imageUrl)}" alt="" loading="lazy"></a>`:''}<div><span class="builder-tier">T${c.tier}</span><h3>${link(c)}</h3></div>
    <button class="builder-card-action" data-add-class="${esc(c.classId)}" aria-label="${esc(actionLabel)}"${disabled?' disabled':''}><span>${step?owned?'Level up':'Unlock':'Mastered'}</span><small>${step?`L${step.level} · ${step.cost} EXP`:'L8'}</small></button></div>
    <div class="builder-entry-meta">${inlineRules('Progression',c,`${c.name}: full class progression`,owned?`Level ${sheet.classes[c.classId].level}${sheet.classes[c.classId].free?' · racial unlock':''}`:esc([c.role1,c.role2].filter(Boolean).join(' / ')))}</div>
    ${owned&&step?`<div class="builder-next-benefit">${step.id?abilityDetail(step.id,`Next · L${step.level}`):`<strong>Next · L${step.level} ${esc(step.name)}</strong><p>${esc(text(benefit))}</p>`}${step.cost>sheet.exp?`<small>Bank ${step.cost-sheet.exp} more EXP to take this level.</small>`:''}</div>`:''}
    ${step?.reason?`<p class="builder-refund">${esc(step.reason)} · ${step.refund} EXP returned</p>`:''}
    ${!owned?requirementMarkup(gate,c.requirements):''}
    </article>`;
}
function classes(){
  const owned=data.classes.filter(c=>sheet.classes[c.classId]).sort((a,b)=>Number(sheet.classes[a.classId].level===8)-Number(sheet.classes[b.classId].level===8)||a.name.localeCompare(b.name));
  const list=sorted(data.classes.filter(c=>!sheet.classes[c.classId]),query).filter(c=>!tier||String(c.tier)===tier).filter(c=>!availableOnly||requirements(c,sheet,build,data).ok);
  const current=sheet.ledger.filter(e=>e.week===build.cursor);
  return `<section class="builder-section"><h2>${build.cursor?'Level your classes':'Starting classes'}</h2><p class="builder-muted">${build.cursor?`Spend this week's ${sheet.exp} banked EXP on the next level below, or save it for a later week.`:'Unlock a class below, then use its Level up button to spend your starting EXP.'}</p><div class="builder-catalog">${owned.map(c=>classRow(c,true)).join('')||'<p>No classes yet. Choose your first class below.</p>'}</div></section><details class="builder-add-class"${catalogOpen||!owned.length||query?' open':''}><summary>Add a new class</summary>${catalogToolbar('classes')}<p class="builder-muted">${build.cursor===0?'Each purchased class uses 1 of your 3 creation IP. Racially granted classes are already unlocked.':'New class timing requirements appear as warnings on the chart; no delay is assumed.'}</p><label class="builder-check builder-gm"><input type="checkbox" id="builder-gm"${gmApproved?' checked':''}>GM-confirmed prerequisite override</label><div class="builder-catalog">${list.map(c=>classRow(c)).join('')||'<p>No classes match these filters.</p>'}</div></details>${build.cursor?`<details class="builder-week-purchases"${current.length?' open':''}><summary>This week's purchases · ${current.length}</summary>${ledgerRows(current)||'<p>Nothing spent yet. You can bank the EXP.</p>'}</details><button class="builder-primary builder-continue" data-builder-action="next-week">Continue → Week ${build.weeks.length} · +100 EXP</button>`:''}`;
}
function breakthroughs(){
  const rows=sorted(data.breakthroughs,query).map(b=>({b,gate:requirements(b,sheet,build,data),cost:breakthroughCost(b,sheet),owned:sheet.breakthroughs.filter(e=>e.id===b.indexId).length}))
    .filter(x=>!availableOnly||x.gate.ok&&(!x.owned||/multiple times|more than once/i.test(x.b.description)))
    .map(({b,gate,cost,owned})=>`<article class="builder-catalog-row"><div class="builder-row-top"><div><h3>${link(b)}</h3></div><button class="builder-card-action" data-add-bt="${b.indexId}" aria-label="Add ${esc(b.name)} for ${cost} EXP"${(!gate.ok&&!gmApproved)||(owned&&!/multiple times|more than once/i.test(b.description))||cost>(build.cursor===0?sheet.btRemaining:sheet.exp)?' disabled':''}>Add</button></div><div class="builder-entry-meta">${inlineRules('Rules',b,`${b.name}: full rules`,`${cost} EXP${owned?' · owned ×'+owned:''}`)}</div>${requirementMarkup(gate)}</article>`).join('');
  return `${catalogToolbar("breakthroughs")}<p class="builder-info">${build.cursor===0?"Creation: use the separate 300 breakthrough EXP pool. It does not add SC.":"Purchase at any time using banked EXP, just like a class level. The cost adds to SC. No IP, fuel, or training week is needed."}</p><label class="builder-check builder-gm"><input type="checkbox" id="builder-gm"${gmApproved?' checked':''}>GM-confirmed prerequisite override</label><div class="builder-catalog">${rows}</div>`;
}
function choices(){
  const unique=[...new Map(sheet.grants.map(g=>[g.id,g])).values()];
  const row=g=>{
    const a=build.allocations[g.id]||{},pending=sheet.pending.find(p=>p.id===g.id);
    if(g.kind!=="skills")return `<section class="builder-benefit-choice" id="${grantAnchor(g.id)}"><h3>${esc(g.label||g.text)}</h3>${g.options.length===1?`<span class="builder-benefit-value">${esc(g.kind==='element'?'Elemental Mastery: '+g.options[0]:g.options[0])}</span>`:field(g.kind==='element'?'Elemental mastery · choose element':g.kind==='stat'?'Stat':'Choose benefit',`<select data-choice="${esc(g.id)}">${option("","Decide later (unallocated)",a.choice||'')}${g.options.map(n=>option(n,g.kind==='element'?'Elemental Mastery: '+n:n,a.choice)).join("")}</select>`)}</section>`;
    const rows=Object.entries(a).map(([key,value])=>`<div class="builder-skill-allocation"><span>${esc(key.replace(/\|expertise\|/," · "))}</span><input type="number" min="0" max="${g.count}" value="${value}" data-allocation="${esc(g.id)}" data-key="${esc(key)}" aria-label="${esc(key)} allocated points"><button data-remove-allocation="${esc(g.id)}" data-key="${esc(key)}" aria-label="Remove ${esc(key)}">×</button></div>`).join("");
    return `<section class="builder-skill-pool" id="${grantAnchor(g.id)}"><h3>${esc(g.label||g.text)} <small>${pending?.remaining??0} / ${g.count} left</small></h3>${g.label?`<details><summary>Allocation rules</summary><p>${esc(g.text)}</p></details>`:""}${rows}<form data-pool="${esc(g.id)}" class="builder-pool-form"><select name="skill" required aria-label="Skill for ${esc(g.label||g.text)}">${option('','Choose a skill…','')}${g.options.map(n=>option(n,n,"")).join("")}</select>${g.expertise||g.expertiseOnly?`<input name="expertise" placeholder="Expertise name (optional)" aria-label="Specific expertise name">`:""}<input type="number" name="points" min="1" max="${pending?.remaining||g.count}" value="1" aria-label="Points to allocate"><button disabled>Allocate</button></form></section>`;
  };
  const groups=items=>[['skills','Skill points & expertise'],['stat','Stat bonuses'],['proficiency','Weapon & armor proficiencies'],['element','Elemental mastery'],['choice','Other choices']].map(([kind,title])=>{const list=items.filter(g=>g.kind===kind);return list.length?`<section class="builder-benefit-group"><h2>${title}</h2>${list.map(row).join('')}</section>`:'';}).join('');
  const pending=unique.filter(g=>sheet.pending.some(p=>p.id===g.id)),done=unique.filter(g=>!sheet.pending.some(p=>p.id===g.id));
  return `<section class="builder-section"><h2>Choose newly unlocked benefits</h2><p class="builder-muted">New skill pools, Heart / Soul bonuses and proficiencies appear here as you level. You can leave any choice undecided and come back later; partial skill allocations keep the remaining points available.</p><button data-builder-action="defer-choices">Decide later · return to class planning</button>${groups(pending)||'<p class="builder-info">All available benefits are allocated.</p>'}${done.length?`<details class="builder-completed-benefits"><summary>Allocated benefits · review / change (${done.length})</summary>${groups(done)}</details>`:''}</section>`;
}
function ledgerRows(entries){return entries.map(e=>`<div class="builder-ledger-entry${e.invalid?' invalid':''}"><span>${e.week?'Week '+e.week:'Creation'}</span><div><strong>${esc(e.label)}</strong><p>${e.cost} EXP${e.creationBT?' · breakthrough pool':` · ${e.sc} SC`}${e.refund?' · '+e.refund+' EXP refunded':''}</p>${e.warning?`<p class="builder-training-note">${esc(e.warning)}</p>`:''}${e.reason?`<p class="builder-refund">${esc(e.reason)}</p>`:''}</div><button data-remove-event="${e.eventId}" aria-label="Remove ${esc(e.label)}"${build.creationDone&&build.cursor===0?' disabled':''}>×</button></div>`).join('');}
function renderStartingChoices(){const el=$('#builder-creation-choices');el.hidden=build.cursor!==0;el.innerHTML=build.cursor===0&&sheet.ledger.length?`<details><summary>Starting choices · ${sheet.ledger.length}</summary>${ledgerRows(sheet.ledger)}</details>`:'';}
function progression(){return `<section class="builder-section"><h2>Progression ledger</h2><p class="builder-muted">The ledger stops at the selected week. Removing earlier purchases rechecks future dependencies without deleting them.</p>${ledgerRows(sheet.ledger)||'<p>No purchases yet.</p>'}<button data-builder-action="remove-week">Remove this week (and its purchases)</button></section>`;}
function renderEditor(){
  const el=$("#builder-editor-content");
  if(build.creationDone&&build.cursor===0&&tab!=='skills'){el.innerHTML=`<section class="builder-ready"><h3>Your starting character is saved</h3><p>Plan weekly EXP below: level an existing class first, unlock another class, or buy a breakthrough.</p><button class="builder-primary" data-builder-action="${build.weeks.length>1?'resume-plan':'next-week'}">${build.weeks.length>1?'Resume weekly plan':'Plan Week 1 · +100 EXP'}</button><button data-builder-action="edit-creation">Edit starting character</button></section>`;return;}
  el.innerHTML=({classes,breakthroughs,skills:choices,progression})[tab]();
}
function renderFoundations(){
  const el=$('#builder-foundation-content');
  if(build.creationDone||build.cursor>0){
    const race=data.races.find(r=>r.primaryRaceId===build.race),sub=data.ancestries.find(a=>a.ancestryId===build.ancestry);
    el.innerHTML=`<p><strong>${esc(race?.name)}${sub?' · '+esc(sub.name):''}${build.race==='demon'?' · '+clanName(build.clan)+' clan':''}</strong></p><p class="builder-muted">Race, starting stats and creation purchases are saved. Reopening them checks all later dependencies.</p><button data-builder-action="edit-creation">Edit character creation</button>`;
  }else el.innerHTML=lineage()+'<button class="builder-primary" data-builder-action="confirm-foundations">Use these starting choices</button>';
}
function proficiencySummary(){
  const profs=[...sheet.proficiencies].filter(n=>n!=='Clan skill points').sort();
  const weapons=profs.filter(n=>[...COMMON,...SPECIAL,'Unarmed','Gauntlets','Wands','Staves'].includes(n)),armor=profs.filter(n=>ARMOR.includes(n)),other=profs.filter(n=>!weapons.includes(n)&&!armor.includes(n));
  const group=(title,items)=>items.length?`<section class="builder-capability-group"><h4>${title}</h4><ul>${items.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></section>`:'';
  return group('Weapons',weapons)+group('Armor & shields',armor)+group('Tools & other proficiencies',other)+group('Elemental mastery',[...sheet.elements].sort().map(n=>'Elemental Mastery: '+n))||'<p class="builder-muted">None yet</p>';
}
function abilityDetail(id,prefix){const a=data.abilities[id];if(!a)return "";return `<div class="builder-ability-detail builder-entry-meta">${inlineRules('Rules',a,`${a.name}: ability rules`,`${typeof prefix==='string'&&prefix?`<small class="builder-next-level">${esc(prefix)}</small> `:''}${link(a)}`)}</div>`;}
function renderSheet(){
  const race=data.races.find(r=>r.primaryRaceId===build.race),ancestry=data.ancestries.find(r=>r.ancestryId===build.ancestry);
  $("#builder-sheet-content").innerHTML=`<p class="builder-sheet-identity"><strong>${esc(build.name)}</strong><span>${esc(race?.name)}${ancestry?' · '+esc(ancestry.name):''} · ${build.cursor?'Week '+build.cursor:'Creation'}</span></p><div class="builder-sheet-stats">${Object.entries(sheet.derived).map(([n,v])=>`<div><span>${n}</span><b>${v}${n==='Speed'?' ft':''}</b></div>`).join("")}</div><div class="builder-sheet-attributes">${[MAIN,SUB].map(group=>`<dl>${group.map(n=>`<div><dt>${n}</dt><dd>${sheet.stats[n]}</dd></div>`).join("")}</dl>`).join("")}</div>
  ${sheet.errors.length?`<details class="builder-validation" open><summary>${sheet.errors.length} rule / budget issue${sheet.errors.length===1?'':'s'}</summary><ul>${sheet.errors.map(e=>`<li>${esc(e)}</li>`).join("")}</ul></details>`:""}${sheet.pending.length?`<button class="builder-pending" data-builder-tab="skills">${sheet.pending.length} unallocated benefit${sheet.pending.length===1?'':'s'} →</button>`:""}
  <section><h3>Classes</h3>${Object.entries(sheet.classes).map(([id,c])=>`<p>${link(data.classes.find(x=>x.classId===id))}<b>L${c.level}${c.level===8?' · Mastered':''}</b></p>`).join("")||'<p class="builder-muted">None yet</p>'}</section>
  <details open><summary>Skills &amp; expertise</summary><dl class="builder-skill-summary">${Object.entries(sheet.skills).filter(([,v])=>v).map(([n,v])=>`<div><dt>${esc(n)}</dt><dd>+${v}</dd></div>`).join("")}${Object.entries(sheet.expertise).filter(([,v])=>v).map(([n,v])=>`<div><dt>${esc(n)} <small>Expertise</small></dt><dd>+${v}</dd></div>`).join("")}</dl></details>
  <details><summary>Proficiencies &amp; elements</summary>${proficiencySummary()}<section class="builder-capability-group"><h4>Languages</h4><p>${esc(text(race?.proficiencies).split(/You also|You gain proficiency/i)[0])}</p></section></details>
  <details><summary>Abilities · ${sheet.abilities.size}</summary>${[...sheet.abilities].map(abilityDetail).join("")}</details><details><summary>Breakthroughs · ${sheet.breakthroughs.length}</summary>${sheet.breakthroughs.map(e=>{const b=data.breakthroughs.find(b=>b.indexId===e.id);return `<div class="builder-bt-owned">${link(b)}<p>${esc(b.body)}</p></div>`;}).join("")}</details>
  <p class="builder-muted">Size: ${esc(sheet.size)} · Base stats only; equipment and conditional effects are not included.</p><button class="builder-back-choices" data-builder-action="view-choices">Back to choices</button>
  ${sheet.warnings.length?`<details class="builder-warnings" open><summary>Planning notes</summary><ul>${sheet.warnings.map(w=>`<li>${esc(w)}</li>`).join("")}</ul></details>`:""}`;
}
function attempt(event){
  try{const next=addEvent(build,{...event,gmApproved}),end=evaluateBuild(next,data,next.weeks.length-1);
    const currentErrors=evaluateBuild(build,data,build.weeks.length-1).errors;
    const added=end.errors.filter(e=>!currentErrors.includes(e));
    if(added.length){notice(added.join(" "));return;}
    if(event.type==='class'){catalogOpen=false;query='';}
    commit(next);$("#builder-notice").hidden=true;
    if(sheet.pending.length)notice(`Added to ${build.cursor?'Week '+build.cursor:'creation'}. ${sheet.pending.length} benefit choices remain in Allocate benefits.`);
  }catch(e){notice(e.message);}
}
function sheetText(){return [`${build.name} — ${build.cursor?'Week '+build.cursor:'Creation'}`,`${sheet.sc} Spirit Core (SC) · ${sheet.exp} EXP banked`,...Object.entries(sheet.stats).map(([k,v])=>`${k}: ${v}`),...Object.entries(sheet.derived).map(([k,v])=>`${k}: ${v}`),"Classes:",...Object.entries(sheet.classes).map(([id,c])=>`${data.classes.find(x=>x.classId===id).name} L${c.level}`),"Skills:",...Object.entries(sheet.skills).map(([k,v])=>`${k}: +${v}`),"Expertise:",...Object.entries(sheet.expertise).map(([k,v])=>`${k}: +${v}`),"Proficiencies: "+[...sheet.proficiencies].join(", "),"Elements: "+[...sheet.elements].join(", "),"Abilities:",...[...sheet.abilities].map(id=>data.abilities[id]?.name).filter(Boolean),"Base stats only; equipment excluded.","Notes: "+build.notes].join("\n");}
document.addEventListener("click",async e=>{
  const retry=e.target.closest('[data-retry-builder-rules]');
  if(retry){await loadRules(retry.closest('.builder-inline-rules'));return;}
  const allocationLink=e.target.closest('[data-allocate-grant]');
  if(allocationLink){e.preventDefault();showAllocations(allocationLink.dataset.allocateGrant);return;}
  const b=e.target.closest("button");if(!b)return;
  for(const [key,field] of [['pickRace','race'],['pickAncestry','ancestry'],['pickClan','clan'],['pickSecondClan','secondClan']])if(b.dataset[key]){
    build[field]=b.dataset[key];if(field==='race'){build.ancestry='';lineageQuery='';}if(field==='ancestry')lineageQuery='';if(field==='clan'&&build.secondClan===build.clan)build.secondClan=CLANS.find(k=>k!==build.clan);commit();return;
  }
  if(b.dataset.builderTab){if(b.dataset.builderTab==='skills'){showAllocations();return;}tab=b.dataset.builderTab;query="";render();$('.builder-editor').scrollIntoView({block:'start',behavior:'instant'});return;}
  if(b.dataset.week!==undefined){build.cursor=Number(b.dataset.week);save();render();return;}
  if(b.dataset.addClass){const c=data.classes.find(x=>x.classId===b.dataset.addClass);attempt({type:"class",id:c.classId,level:nextClassStep(c,sheet,data).level});return;}
  if(b.dataset.addBt){attempt({type:"breakthrough",id:b.dataset.addBt});return;}
  if(b.dataset.removeEvent){for(const week of build.weeks)week.events=week.events.filter(x=>x.uid!==b.dataset.removeEvent);commit();return;}
  if(b.dataset.removeAllocation){delete build.allocations[b.dataset.removeAllocation][b.dataset.key];commit();return;}
  const action=b.dataset.builderAction;
  if(action==='defer-choices'){tab='classes';render();notice(sheet.pending.length?`${sheet.pending.length} benefit choices left unallocated. Use the Allocate now reminder whenever you're ready.`:'All benefits are allocated.');$('#builder-workspace-title').scrollIntoView({block:'start',behavior:'instant'});return;}
  if(action==='import'){$('#builder-import').click();return;}
  if(action==='confirm-foundations'){$('#builder-foundations').open=false;$('#builder-workspace-title').scrollIntoView({block:'start',behavior:'instant'});return;}
  if(action==="view-sheet"){$('.builder-sheet').scrollIntoView({block:'start',behavior:'instant'});return;}
  if(action==="view-choices"){$('.builder-editor').scrollIntoView({block:'start',behavior:'instant'});return;}
  if(action==='edit-creation'){build.cursor=0;build.creationDone=false;tab='classes';commit();$('#builder-foundations').open=true;$('#builder-foundations').scrollIntoView({block:'start',behavior:'instant'});notice('Editing starting choices rechecks every later purchase.');return;}
  if(action==='resume-plan'){build.cursor=build.weeks.length-1;tab='classes';commit();return;}
  if(action==="new"){build=freshBuild();query="";tab="classes";catalogOpen=false;commit();}
  if(action==="duplicate"){const copy=structuredClone(build);copy.id=freshBuild().id;copy.name+=' (copy)';commit(copy);}
  if(action==="finish"){
    if(build.creationDone){build.creationDone=false;tab='classes';commit();return;}
    const start=evaluateBuild(build,data,0),end=evaluateBuild(build,data,build.weeks.length-1);if(end.errors.length||start.exp>start.refunds){notice(`Review the build before finishing. ${start.exp>start.refunds?'Spend the remaining '+start.exp+' class EXP. ':''}${end.errors.join(' ')}`);return;}
    build.creationDone=true;tab='classes';commit();if(start.pending.length||start.exp)notice(`Creation saved.${start.pending.length?' '+start.pending.length+' benefit choices remain; allocate them in the weekly workspace.':''}${start.exp?' '+start.exp+' refunded EXP remains banked.':''}`);
  }
  if(action==="next-week"){build.weeks.push({kind:"earn",events:[]});build.cursor=build.weeks.length-1;tab='classes';query='';catalogOpen=false;commit();}
  if(action==="remove-week"){build.weeks.splice(build.cursor,1);build.cursor=Math.max(0,build.cursor-1);commit();}
  if(action==="export"){const url=URL.createObjectURL(new Blob([JSON.stringify(build,null,2)],{type:"application/json"}));const a=document.createElement('a');a.href=url;a.download=build.name.replace(/[^a-z0-9-]/gi,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  if(action==="copy-sheet"){try{await navigator.clipboard.writeText(sheetText());b.textContent='Copied';setTimeout(()=>b.textContent='Copy sheet',1200);}catch{notice('Clipboard permission unavailable. Use Export for a saved copy.');}}
});
document.addEventListener("change",e=>{
  const el=e.target;
  if(el.name==='skill'&&el.closest('[data-pool]')){const form=el.closest('[data-pool]');form.querySelector('button').disabled=!el.value||!sheet.pending.some(g=>g.id===form.dataset.pool);return;}
  if(el.id==="builder-mirane"){build.mirane=el.checked;commit();}
  if(el.id==="builder-start-date"&&el.value){build.startDate=el.value;commit();}
  if(el.id==="builder-name"){build.name=el.value;commit();}
  if(el.id==="builder-saved"){build=stampPlannedLevels(store.builds.find(b=>b.id===el.value),data);query="";tab='classes';catalogOpen=false;commit();}
  if(el.id==="builder-week"){build.cursor=Number(el.value);save();render();}
  if(el.id==="builder-gm")gmApproved=el.checked;
  if(el.id==="builder-tier"){tier=el.value;renderEditor();}
  if(el.id==="builder-available"){availableOnly=el.checked;renderEditor();}
  if(el.dataset.config){build[el.dataset.config]=el.value;if(el.dataset.config==="race")build.ancestry="";commit();}
  if(el.dataset.stat){const [group,key]=el.dataset.stat.split(":"),old=build[group][key],v=Number(el.value);const other=Object.keys(build[group]).find(k=>k!==key&&build[group][k]===v);if(other)build[group][other]=old;build[group][key]=v;commit();}
  if(el.dataset.choice){build.allocations[el.dataset.choice]={choice:el.value};commit();}
  if(el.dataset.allocation){build.allocations[el.dataset.allocation][el.dataset.key]=Math.max(0,Math.floor(Number(el.value)));commit();}
  if(el.id==="builder-gm")renderEditor();
});
document.addEventListener("input",e=>{
  if(e.target.id==='builder-lineage-query'){lineageQuery=e.target.value;const caret=e.target.selectionStart;renderFoundations();const input=$('#builder-lineage-query');input.focus();try{input.setSelectionRange(caret,caret);}catch{}return;}
  if(e.target.id==="builder-name"){build.name=e.target.value;save();return;}
  if(e.target.id==="builder-catalog-query"){
    query=e.target.value;const caret=e.target.selectionStart;renderEditor();const input=$("#builder-catalog-query");input.focus();try{input.setSelectionRange(caret,caret);}catch{}
  }
});
document.addEventListener('toggle',e=>{
  if(!e.target.isConnected)return;
  if(e.target.matches('.builder-add-class'))catalogOpen=e.target.open;
  if(e.target.matches('.builder-inline-rules'))void loadRules(e.target);
},true);
document.addEventListener("submit",e=>{
  const form=e.target;if(!form.dataset.pool)return;e.preventDefault();
  const g=sheet.grants.find(x=>x.id===form.dataset.pool),values=new FormData(form),skill=values.get('skill'),ex=String(values.get('expertise')||'').trim(),value=Number(values.get('points'));
  if(!g?.options.includes(skill)){notice('Choose a skill to allocate points, or leave this pool undecided for later.');return;}
  const a=build.allocations[g.id]||{},used=Object.values(a).reduce((n,v)=>n+Number(v),0);
  if(!Number.isInteger(value)||value<1||value>g.count-used){notice('Allocate only the remaining points in this pool.');return;}
  if(g.expertiseOnly&&!ex){notice('Give this expertise a specific name.');return;}
  const key=skill+(ex?'|expertise|'+ex:'');a[key]=(a[key]||0)+value;build.allocations[g.id]=a;commit();
});
$("#builder-import").addEventListener("change",async e=>{
  try{const file=e.target.files[0];if(!file)return;if(file.size>2e6)throw Error('Build file is too large.');const b=JSON.parse(await file.text());
    if(b.version!==1||!Array.isArray(b.weeks)||!b.main||!b.sub||!b.allocations||b.weeks.length>1000)throw Error('Not a supported planner build.');
    b.id=freshBuild().id;b.cursor=Math.min(Math.max(0,Number(b.cursor)||0),b.weeks.length-1);stampPlannedLevels(b,data);commit(b);
  }catch(err){notice('Import failed: '+err.message);}e.target.value='';
});
async function boot(){
  // HTTP cache + Cache API keep the immutable rules bundle reusable; never
  // cache generated sheets, chat data, or arbitrary pages.
  try{const response=await fetch('/assets/builder-data.json',{cache:'no-cache'});if(!response.ok)throw Error('Rules download failed');data=await response.json();try{const cache=await caches.open(DATA_CACHE);await cache.put('/assets/builder-data.json',new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}}));}catch{}}
  catch(err){try{const cached=await (await caches.open(DATA_CACHE)).match('/assets/builder-data.json');if(!cached)throw err;data=await cached.json();}catch{ $("#builder-save-status").textContent='Could not load rules. Reload when online.';return;}}
  try{const saved=JSON.parse(localStorage.getItem(STORAGE));if(saved?.version===1&&Array.isArray(saved.builds)&&saved.builds.length)store=saved;}catch{}
  build=stampPlannedLevels(store.builds.find(b=>b.id===store.selected)||store.builds[0]||freshBuild(),data);save();render();
}
boot().catch(err=>{$("#builder-save-status").textContent='The saved build could not be opened. Exported backups can be imported into a new build.';console.error(err);});
