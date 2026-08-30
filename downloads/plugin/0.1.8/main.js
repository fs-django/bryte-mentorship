const {Plugin,Modal,PluginSettingTab,Setting,Notice,TFile,requestUrl,normalizePath}=require('obsidian');
const ROOT='Bryte Mentorship';
const DEFAULT={settings:{assignmentBaseUrl:'https://raw.githubusercontent.com/fs-django/bryte-mentorship/main/assignments',autoPullOnLoad:false,studyDays:[1,2,4,6],sessionMinutes:45,completionBufferDays:2,github:{owner:'',repo:'',branch:'main',token:'',pathPrefix:ROOT}},installedUnits:{},assignmentStates:{},schedules:{},meetingOverrides:{},flashcardReviews:{}};
const clone=x=>JSON.parse(JSON.stringify(x));
const today=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`};
const dateOf=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,12)};
const addDays=(d,n)=>{d=new Date(d);d.setDate(d.getDate()+n);return d};
const dateKey=d=>{const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`};
const passage=a=>a.endChapter&&a.endChapter!==a.startChapter?`${a.book} ${a.startChapter}–${a.endChapter}`:`${a.book} ${a.startChapter}`;
const slug=s=>s.toLowerCase().replace(/[–—]/g,'-').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const studyPath=(u,a)=>normalizePath(`${ROOT}/Studies/Unit ${u.unitNumber}/${String(a.sequence).padStart(2,'0')}-${slug(passage(a))}.md`);
const meetingPath=u=>normalizePath(`${ROOT}/Meetings/Unit ${u.unitNumber} Meeting.md`);
const planPath=u=>normalizePath(`${ROOT}/Study Plans/Unit ${u.unitNumber} Plan.md`);
const assignmentPath=u=>normalizePath(`${ROOT}/Assignments/Unit ${u.unitNumber}/assignment.json`);
async function folder(vault,path){let cur='';for(const part of normalizePath(path).split('/')){cur=cur?`${cur}/${part}`:part;if(!vault.getAbstractFileByPath(cur))await vault.createFolder(cur)}}
async function parent(vault,path){const i=path.lastIndexOf('/');if(i>0)await folder(vault,path.slice(0,i))}
function studyTemplate(u,a){return `---\nbryte_type: study\nprogram: "${u.programName}"\nunit: ${u.unitNumber}\nunit_id: ${u.unitId}\nassignment_id: ${a.id}\npassage: "${passage(a)}"\nstatus: not-started${a.combinedReview?'\ncombined_review: true':''}\n---\n\n# ${passage(a)} — Chapter Review\n\n${a.instructions?`> ${a.instructions}\n\n`:''}## 1. Summary\n\nWhat is the main idea of ${passage(a)}? Summarize the main idea in one phrase or concise statement.\n\n\n## 2. Christ, Gospel, and Redemption\n\nHow does this passage point to Christ, reveal the Gospel, and fit into God's global plan of human redemption?\n\n\n## 3. Practical Application\n\nHow can the truths presented in this passage be applied in your life?\n\n\n## Questions for the Meeting\n\n\n## Additional Observations and Cross-References\n\n`}
function meetingTemplate(u){const rows=u.assignments.slice().sort((a,b)=>a.sequence-b.sequence).map(a=>`- [[${studyPath(u,a).replace(/\.md$/,'')}|${passage(a)}]]`).join('\n');return `---\nbryte_type: meeting\nunit: ${u.unitNumber}\nunit_id: ${u.unitId}\n---\n\n# Unit ${u.unitNumber} Mentorship Meeting\n\n## Study Reviews\n\n${rows}\n\n## Meeting Notes\n\nAdd general meeting notes here. Keep passage-specific meeting notes in the related study note so the original preparation remains intact.\n`}
function setStatus(text,status){return /^status:\s*.+$/m.test(text)?text.replace(/^status:\s*.+$/m,`status: ${status}`):text.replace(/^---\n/,`---\nstatus: ${status}\n`)}
function summary(text){const m=text.match(/^## 1\. Summary\s*\n([\s\S]*?)(?=^##\s)/m);if(!m)return'';const p=m[1].trim().split(/\n\s*\n/);return p.length>1?p.slice(1).join('\n\n').trim():''}
function makePlan(assignments,start,meeting,days,buffer,def=45){const slots=[],allowed=new Set(days.length?days:[0,1,2,3,4,5,6]),last=addDays(dateOf(meeting),-Math.max(0,buffer));for(let d=dateOf(start);d<=last;d=addDays(d,1))if(allowed.has(d.getDay()))slots.push(new Date(d));if(!slots.length)slots.push(dateOf(start));const load=slots.map(()=>0),out=[];for(const a of assignments.slice().sort((x,y)=>x.sequence-y.sequence)){let i=0;for(let j=1;j<slots.length;j++)if(load[j]<load[i])i=j;const mins=a.estimatedMinutes||def;out.push({assignmentId:a.id,date:dateKey(slots[i]),estimatedMinutes:mins});load[i]+=mins}return out.sort((x,y)=>x.date.localeCompare(y.date)||assignments.findIndex(a=>a.id===x.assignmentId)-assignments.findIndex(a=>a.id===y.assignmentId))}
class BrytePlugin extends Plugin{
 async onload(){const saved=await this.loadData()||{};this.data={...clone(DEFAULT),...saved,settings:{...clone(DEFAULT.settings),...(saved.settings||{}),github:{...clone(DEFAULT.settings.github),...((saved.settings||{}).github||{})}},installedUnits:saved.installedUnits||{},assignmentStates:saved.assignmentStates||{},schedules:saved.schedules||{},meetingOverrides:saved.meetingOverrides||{},flashcardReviews:saved.flashcardReviews||{}};this.addRibbonIcon('graduation-cap','Bryte Mentorship',()=>new Dashboard(this.app,this).open());this.addSettingTab(new BryteSettings(this.app,this));this.addCommand({id:'open-dashboard',name:'Open mentorship dashboard',callback:()=>new Dashboard(this.app,this).open()});this.addCommand({id:'pull-assignments',name:'Pull released assignments',callback:()=>this.pull()});this.addCommand({id:'flashcard-mode',name:'Open flashcard mode',callback:()=>new FlashSetup(this.app,this).open()});this.addCommand({id:'set-meeting-date',name:'Set current Unit meeting date',callback:()=>{const u=this.current();u?new MeetingDate(this.app,this,u).open():new Notice('No current Unit is installed.')}});this.addCommand({id:'rebalance-study-plan',name:'Rebalance current Unit study plan',callback:()=>this.rebalance()});this.addCommand({id:'open-meeting-notes',name:'Open current Unit meeting notes',callback:()=>{const u=this.current();if(u)this.openMeeting(u)}});this.addCommand({id:'push-student-work',name:'Push student work to private GitHub repository',callback:()=>this.push()});if(this.data.settings.autoPullOnLoad)this.app.workspace.onLayoutReady(()=>this.pull(true))}
 save(){return this.saveData(this.data)}
 current(){if(this.data.currentUnitId)return this.data.installedUnits[this.data.currentUnitId]?.definition;return Object.values(this.data.installedUnits).map(x=>x.definition).sort((a,b)=>b.unitNumber-a.unitNumber)[0]}
 status(id){return this.data.assignmentStates[id]?.status||'not-started'}
 meetingDate(u){return this.data.meetingOverrides[u.unitId]?.date||u.meeting?.date||null}
 meetingTime(u){return this.data.meetingOverrides[u.unitId]?.time||u.meeting?.time||null}
 async pull(silent=false){try{const base=this.data.settings.assignmentBaseUrl.replace(/\/$/,'');const manifest=(await requestUrl({url:`${base}/manifest.json`})).json;let installed=0,updated=0,latest;for(const item of manifest.units.filter(x=>x.released).sort((a,b)=>a.unitNumber-b.unitNumber)){const old=this.data.installedUnits[item.unitId];if(old&&old.version>=item.version){latest=!latest||old.definition.unitNumber>latest.unitNumber?old.definition:latest;continue}const u=(await requestUrl({url:`${base}/${item.path.replace(/^\//,'')}`})).json;if(u.schemaVersion!==1||!u.unitId||!Array.isArray(u.assignments))throw new Error('Invalid Unit definition');await this.install(u);this.data.installedUnits[u.unitId]={version:u.version,installedAt:new Date().toISOString(),definition:u};old?updated++:installed++;latest=!latest||u.unitNumber>latest.unitNumber?u:latest}if(latest){this.data.currentUnitId=latest.unitId;const d=this.meetingDate(latest);if(d)await this.plan(latest,d)}await this.save();if(!silent)new Notice(installed||updated?`Bryte Mentorship: ${installed} Unit(s) installed, ${updated} updated.`:'Bryte Mentorship: assignments are up to date.')}catch(e){console.error(e);if(!silent)new Notice(`Assignment pull failed: ${e}`)}}
 async install(u){const ap=assignmentPath(u);await parent(this.app.vault,ap);const existing=this.app.vault.getAbstractFileByPath(ap),json=JSON.stringify(u,null,2)+'\n';existing instanceof TFile?await this.app.vault.modify(existing,json):await this.app.vault.create(ap,json);for(const a of u.assignments){const p=studyPath(u,a);if(!this.app.vault.getAbstractFileByPath(p)){await parent(this.app.vault,p);await this.app.vault.create(p,studyTemplate(u,a))}}const mp=meetingPath(u);if(!this.app.vault.getAbstractFileByPath(mp)){await parent(this.app.vault,mp);await this.app.vault.create(mp,meetingTemplate(u))}}
 async plan(u,date){const remaining=u.assignments.filter(a=>this.status(a.id)!=='complete');const p=makePlan(remaining,today(),date,this.data.settings.studyDays,this.data.settings.completionBufferDays,this.data.settings.sessionMinutes);this.data.schedules[u.unitId]=p;const byId=new Map(u.assignments.map(a=>[a.id,a])),lines=p.map(i=>{const a=byId.get(i.assignmentId);return a?`- ${i.date} — [[${studyPath(u,a).replace(/\.md$/,'')}|${passage(a)}]] (${i.estimatedMinutes} min)`:''}).filter(Boolean).join('\n');const text=`---\nbryte_type: study-plan\nunit: ${u.unitNumber}\nunit_id: ${u.unitId}\n---\n\n# Unit ${u.unitNumber} Study Plan\n\n${lines||'No remaining study work.'}\n`,pp=planPath(u);await parent(this.app.vault,pp);const f=this.app.vault.getAbstractFileByPath(pp);f instanceof TFile?await this.app.vault.modify(f,text):await this.app.vault.create(pp,text);await this.save()}
 async setMeeting(u,date,time){this.data.meetingOverrides[u.unitId]={date,time};await this.plan(u,date);new Notice(`Unit ${u.unitNumber} study plan generated.`)}
 async rebalance(){const u=this.current(),d=u&&this.meetingDate(u);if(!u)return new Notice('No current Unit is installed.');if(!d)return new Notice('Set the meeting date first.');await this.plan(u,d);new Notice('Remaining study work rebalanced.')}
 async openStudy(u,a){const f=this.app.vault.getAbstractFileByPath(studyPath(u,a));if(!(f instanceof TFile))return new Notice('Study note not found.');if(this.status(a.id)==='not-started'){this.data.assignmentStates[a.id]={status:'in-progress',startedAt:new Date().toISOString()};await this.app.vault.modify(f,setStatus(await this.app.vault.read(f),'in-progress'));await this.save()}await this.app.workspace.getLeaf(true).openFile(f)}
 async complete(u,a){const f=this.app.vault.getAbstractFileByPath(studyPath(u,a));if(!(f instanceof TFile))return;let text=setStatus(await this.app.vault.read(f),'complete');if(!/^## Meeting Notes\s*$/m.test(text))text=text.trimEnd()+'\n\n## Meeting Notes\n\n';await this.app.vault.modify(f,text);this.data.assignmentStates[a.id]={status:'complete',completedAt:new Date().toISOString()};await this.save();new Notice(`${passage(a)} complete.`)}
 async openMeeting(u){const f=this.app.vault.getAbstractFileByPath(meetingPath(u));if(f instanceof TFile)await this.app.workspace.getLeaf(true).openFile(f);else new Notice('Meeting note not found.')}
 async cards(unitId){const out=[];for(const u of Object.values(this.data.installedUnits).map(x=>x.definition).filter(u=>!unitId||u.unitId===unitId))for(const a of u.assignments){const f=this.app.vault.getAbstractFileByPath(studyPath(u,a));if(!(f instanceof TFile))continue;const s=summary(await this.app.vault.read(f));if(s)out.push({cardId:`summary:${a.id}`,assignmentId:a.id,unitId:u.unitId,unitNumber:u.unitNumber,sequence:a.sequence,passage:passage(a),summary:s})}return out.sort((a,b)=>a.unitNumber-b.unitNumber||a.sequence-b.sequence)}
 async rate(id,rating){const old=this.data.flashcardReviews[id]||{reviewCount:0};this.data.flashcardReviews[id]={lastRating:rating,lastReviewedAt:new Date().toISOString(),reviewCount:old.reviewCount+1};await this.save()}
 async push(){try{const g=this.data.settings.github;if(!g.owner||!g.repo||!g.token)throw new Error('Configure the student GitHub repository and token first.');const prefixes=[`${ROOT}/Studies/`,`${ROOT}/Meetings/`,`${ROOT}/Study Plans/`];let pushed=0,skipped=0;for(const f of this.app.vault.getFiles().filter(f=>prefixes.some(p=>f.path.startsWith(p)))){const content=await this.app.vault.read(f),remote=normalizePath(`${g.pathPrefix||ROOT}/${f.path.slice(ROOT.length+1)}`);(await upsert(g,remote,content))?pushed++:skipped++}new Notice(`Student work pushed: ${pushed} changed, ${skipped} unchanged.`)}catch(e){new Notice(`Push failed: ${e}`)}}
}
async function upsert(g,path,content){const enc=path.split('/').map(encodeURIComponent).join('/'),url=`https://api.github.com/repos/${encodeURIComponent(g.owner)}/${encodeURIComponent(g.repo)}/contents/${enc}`,headers={Authorization:`Bearer ${g.token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};let sha,remote;try{const j=(await requestUrl({url:`${url}?ref=${encodeURIComponent(g.branch||'main')}`,headers})).json;sha=j.sha;if(j.content)remote=decodeURIComponent(escape(atob(j.content.replace(/\n/g,''))))}catch(e){if(!String(e).includes('404'))throw e}if(remote===content)return false;const body={message:`Update ${path}`,content:btoa(unescape(encodeURIComponent(content))),branch:g.branch||'main'};if(sha)body.sha=sha;await requestUrl({url,method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});return true}
const bundledAssignment=(id,sequence,book,startChapter,extra={})=>({id,sequence,book,startChapter,type:'chapter-review',estimatedMinutes:45,...extra});
const BUNDLED_UNITS=[
 {schemaVersion:1,programId:'bryte-mentorship',programName:'Bryte Church Mentorship Program',unitId:'unit-001',unitNumber:1,title:'Genesis Foundations',version:2,releasedAt:'2026-08-14',assignments:[
  bundledAssignment('unit-001-gen-001',1,'Genesis',1),bundledAssignment('unit-001-gen-002',2,'Genesis',2),bundledAssignment('unit-001-gen-003',3,'Genesis',3),bundledAssignment('unit-001-gen-004',4,'Genesis',4),
  bundledAssignment('unit-001-gen-006-008',5,'Genesis',6,{endChapter:8,combinedReview:true,estimatedMinutes:75,instructions:'Prepare one combined Chapter Review for Genesis 6–8.'}),
  bundledAssignment('unit-001-gen-009',6,'Genesis',9),bundledAssignment('unit-001-gen-011',7,'Genesis',11),bundledAssignment('unit-001-gen-012',8,'Genesis',12),bundledAssignment('unit-001-gen-015',9,'Genesis',15),bundledAssignment('unit-001-gen-022',10,'Genesis',22)
 ]},
 {schemaVersion:1,programId:'bryte-mentorship',programName:'Bryte Church Mentorship Program',unitId:'unit-002',unitNumber:2,title:'Patriarchs and Exodus',version:2,releasedAt:'2026-08-15',assignments:[
  bundledAssignment('unit-002-gen-022',1,'Genesis',22,{instructions:"Revisit Genesis 22 for Unit 2. Preserve Unit 1 work and add new observations in this Unit's review."}),bundledAssignment('unit-002-gen-032',2,'Genesis',32),bundledAssignment('unit-002-gen-037',3,'Genesis',37),bundledAssignment('unit-002-gen-039',4,'Genesis',39),bundledAssignment('unit-002-gen-040',5,'Genesis',40),bundledAssignment('unit-002-gen-049',6,'Genesis',49),
  bundledAssignment('unit-002-exo-002',7,'Exodus',2),bundledAssignment('unit-002-exo-003',8,'Exodus',3),bundledAssignment('unit-002-exo-004',9,'Exodus',4),bundledAssignment('unit-002-exo-011',10,'Exodus',11),bundledAssignment('unit-002-exo-012',11,'Exodus',12),bundledAssignment('unit-002-exo-014',12,'Exodus',14),bundledAssignment('unit-002-exo-015',13,'Exodus',15),bundledAssignment('unit-002-exo-018',14,'Exodus',18),bundledAssignment('unit-002-exo-019',15,'Exodus',19),bundledAssignment('unit-002-exo-020',16,'Exodus',20),bundledAssignment('unit-002-exo-024',17,'Exodus',24),bundledAssignment('unit-002-exo-032',18,'Exodus',32)
 ]}
];
const BUNDLED_MANIFEST={schemaVersion:1,programId:'bryte-mentorship',programName:'Bryte Church Mentorship Program',latestUnit:2,units:BUNDLED_UNITS.map(u=>({unitId:u.unitId,unitNumber:u.unitNumber,version:u.version,releasedAt:u.releasedAt,path:`${u.unitId}/assignment.json`,released:true}))};
const bundledUnit=id=>{const unit=BUNDLED_UNITS.find(u=>u.unitId===id);return unit?clone(unit):null};
const sanitizePublicUnit=unit=>{const clean=clone(unit);delete clean.meeting;return clean};

BrytePlugin.prototype.pull=async function(silent=false){
 try{
  const base=this.data.settings.assignmentBaseUrl.replace(/\/$/,'');
  let manifest,remoteAvailable=true,usedBundled=false;
  try{
   manifest=(await requestUrl({url:`${base}/manifest.json`})).json;
   if(!manifest||!Array.isArray(manifest.units))throw new Error('Invalid assignment manifest');
  }catch(error){
   remoteAvailable=false;usedBundled=true;manifest=BUNDLED_MANIFEST;
   console.warn('Bryte Mentorship: remote assignment source unavailable; using bundled released Units.',error);
  }
  let installed=0,updated=0,latest;
  for(const item of manifest.units.filter(x=>x.released).sort((a,b)=>a.unitNumber-b.unitNumber)){
   const old=this.data.installedUnits[item.unitId];
   if(old&&old.version>=item.version){latest=!latest||old.definition.unitNumber>latest.unitNumber?old.definition:latest;continue}
   let unit=null;
   if(remoteAvailable){
    try{unit=(await requestUrl({url:`${base}/${item.path.replace(/^\//,'')}`})).json}
    catch(error){unit=bundledUnit(item.unitId);if(!unit)throw error;usedBundled=true;console.warn(`Bryte Mentorship: using bundled ${item.unitId} because its remote release could not be fetched.`,error)}
   }else unit=bundledUnit(item.unitId);
   if(!unit)continue;
   unit=sanitizePublicUnit(unit);
   if(unit.schemaVersion!==1||!unit.unitId||!Array.isArray(unit.assignments))throw new Error('Invalid Unit definition');
   await this.install(unit);
   this.data.installedUnits[unit.unitId]={version:unit.version,installedAt:new Date().toISOString(),definition:unit};
   old?updated++:installed++;
   latest=!latest||unit.unitNumber>latest.unitNumber?unit:latest;
  }
  if(latest){this.data.currentUnitId=latest.unitId;const date=this.meetingDate(latest);if(date)await this.plan(latest,date)}
  await this.save();
  if(!silent){let message=installed||updated?`Bryte Mentorship: ${installed} Unit(s) installed, ${updated} updated.`:'Bryte Mentorship: assignments are up to date.';if(usedBundled)message+=' Bundled released Units were used because the remote curriculum source is unavailable.';new Notice(message)}
 }catch(error){console.error(error);if(!silent)new Notice(`Assignment pull failed: ${error}`)}
};
class Dashboard extends Modal{constructor(app,p){super(app);this.p=p}onOpen(){this.render()}button(el,label,fn){const b=el.createEl('button',{text:label});b.onclick=()=>void fn()}async render(){const e=this.contentEl;e.empty();e.addClass('bryte-dashboard');e.createEl('h2',{text:'Bryte Mentorship'});const u=this.p.current();if(!u){e.createEl('p',{text:'No Unit installed. Pull released assignments to begin.'});return this.button(e,'Pull assignments',async()=>{await this.p.pull();await this.render()})}const head=e.createDiv({cls:'bryte-section'});head.createEl('h3',{text:`Unit ${u.unitNumber}${u.title?` — ${u.title}`:''}`});const d=this.p.meetingDate(u),t=this.p.meetingTime(u);head.createDiv({cls:'bryte-muted',text:d?`Next meeting: ${d}${t?` · ${t}`:''}`:'Meeting date not set'});head.createDiv({cls:'bryte-status',text:`${u.assignments.filter(a=>this.p.status(a.id)==='complete').length} of ${u.assignments.length} assignments complete`});const acts=head.createDiv({cls:'bryte-actions'});this.button(acts,'Pull assignments',async()=>{await this.p.pull();await this.render()});this.button(acts,'Set meeting date',()=>new MeetingDate(this.app,this.p,u,()=>this.render()).open());if(d)this.button(acts,'Rebalance plan',async()=>{await this.p.rebalance();await this.render()});this.button(acts,'Flashcards',()=>new FlashSetup(this.app,this.p).open());this.button(acts,'Meeting notes',()=>this.p.openMeeting(u));const plan=this.p.data.schedules[u.unitId]||[],now=today(),done=u.assignments.filter(a=>this.p.status(a.id)==='complete').slice(-5).reverse(),due=plan.filter(i=>i.date===now).map(i=>u.assignments.find(a=>a.id===i.assignmentId)).filter(a=>a&&this.p.status(a.id)!=='complete'),up=plan.filter(i=>i.date>now).map(i=>({...i,a:u.assignments.find(a=>a.id===i.assignmentId)})).filter(i=>i.a&&this.p.status(i.a.id)!=='complete').slice(0,5);this.section(e,'Completed',done,u,false);this.section(e,'Today',due,u,true);const s=e.createDiv({cls:'bryte-section'});s.createEl('h3',{text:'Upcoming'});if(!up.length)s.createDiv({cls:'bryte-muted',text:d?'No scheduled assignments after today.':'Set a meeting date to generate a study plan.'});for(const i of up){const r=s.createDiv({cls:'bryte-item'}),x=r.createDiv();x.createEl('strong',{text:passage(i.a)});x.createDiv({cls:'bryte-muted',text:i.date});this.button(r,'Open',()=>this.p.openStudy(u,i.a))}}section(root,title,items,u,canComplete){const s=root.createDiv({cls:'bryte-section'});s.createEl('h3',{text:title});if(!items.length)s.createDiv({cls:'bryte-muted',text:title==='Completed'?'Nothing completed yet.':'Nothing scheduled for today.'});for(const a of items){const r=s.createDiv({cls:'bryte-item'}),x=r.createDiv();x.createEl('strong',{text:passage(a)});x.createDiv({cls:'bryte-muted',text:canComplete?`${a.estimatedMinutes||45} min`:'Completed'});const z=r.createDiv({cls:'bryte-actions'});this.button(z,'Open',()=>this.p.openStudy(u,a));if(canComplete)this.button(z,'Complete',async()=>{await this.p.complete(u,a);await this.render()})}}}
class MeetingDate extends Modal{constructor(app,p,u,done){super(app);this.p=p;this.u=u;this.done=done;this.date=p.meetingDate(u)||'';this.time=p.meetingTime(u)||'07:00'}onOpen(){this.contentEl.createEl('h2',{text:`Unit ${this.u.unitNumber} meeting`});new Setting(this.contentEl).setName('Meeting date').setDesc('YYYY-MM-DD').addText(t=>t.setValue(this.date).onChange(v=>this.date=v.trim()));new Setting(this.contentEl).setName('Meeting time').setDesc('24-hour HH:MM').addText(t=>t.setValue(this.time).onChange(v=>this.time=v.trim()));new Setting(this.contentEl).addButton(b=>b.setButtonText('Save and generate plan').setCta().onClick(async()=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(this.date))return new Notice('Enter the meeting date as YYYY-MM-DD.');await this.p.setMeeting(this.u,this.date,this.time);this.close();if(this.done)this.done()}))}}
class FlashSetup extends Modal{constructor(app,p){super(app);this.p=p}onOpen(){this.contentEl.createEl('h2',{text:'Flashcard Mode'});this.contentEl.createEl('p',{text:'Choose scope and order.'});const u=this.p.current(),a=this.contentEl.createDiv({cls:'bryte-actions'});for(const [label,scope,random] of [['This Unit · Progression','unit',false],['This Unit · Random','unit',true],['All Entries · Progression','all',false],['All Entries · Random','all',true]]){const b=a.createEl('button',{text:label});b.onclick=async()=>{if(scope==='unit'&&!u)return new Notice('No current Unit is installed.');let cards=await this.p.cards(scope==='unit'?u.unitId:undefined);if(!cards.length)return new Notice('No summaries are available yet.');if(random){cards=cards.slice();for(let i=cards.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]]}}this.close();new Flashcards(this.app,this.p,cards).open()}}}}
class Flashcards extends Modal{constructor(app,p,cards){super(app);this.p=p;this.cards=cards;this.i=0;this.show=false}onOpen(){this.render()}render(){const e=this.contentEl;e.empty();const c=this.cards[this.i];e.createDiv({cls:'bryte-muted',text:`${this.i+1} / ${this.cards.length} · Unit ${c.unitNumber}`});const card=e.createDiv({cls:'bryte-card'});card.createDiv({cls:'passage',text:c.passage});this.show?card.createDiv({cls:'answer',text:c.summary}):card.createEl('p',{text:'Recall the summary, then tap to reveal.'});card.onclick=()=>{this.show=!this.show;this.render()};if(this.show){const r=e.createDiv({cls:'bryte-rating'});for(const q of ['again','hard','good','easy']){const b=r.createEl('button',{text:q[0].toUpperCase()+q.slice(1)});b.onclick=async()=>{await this.p.rate(c.cardId,q);this.next()}}}const n=e.createDiv({cls:'bryte-actions'}),prev=n.createEl('button',{text:'Previous'});prev.disabled=this.i===0;prev.onclick=()=>{this.i--;this.show=false;this.render()};const next=n.createEl('button',{text:this.i===this.cards.length-1?'Finish':'Next'});next.onclick=()=>this.next()}next(){if(this.i>=this.cards.length-1)return this.close();this.i++;this.show=false;this.render()}}
class BryteSettings extends PluginSettingTab{constructor(app,p){super(app,p);this.p=p}display(){const e=this.containerEl;e.empty();e.createEl('h2',{text:'Bryte Mentorship settings'});new Setting(e).setName('Assignment source').addText(t=>t.setValue(this.p.data.settings.assignmentBaseUrl).onChange(async v=>{this.p.data.settings.assignmentBaseUrl=v.trim().replace(/\/$/,'');await this.p.save()}));new Setting(e).setName('Pull assignments on load').addToggle(t=>t.setValue(this.p.data.settings.autoPullOnLoad).onChange(async v=>{this.p.data.settings.autoPullOnLoad=v;await this.p.save()}));new Setting(e).setName('Study days').setDesc('0 Sunday through 6 Saturday; comma-separated.').addText(t=>t.setValue(this.p.data.settings.studyDays.join(',')).onChange(async v=>{this.p.data.settings.studyDays=[...new Set(v.split(',').map(x=>Number(x.trim())).filter(x=>Number.isInteger(x)&&x>=0&&x<=6))];await this.p.save()}));new Setting(e).setName('Completion buffer days').addText(t=>t.setValue(String(this.p.data.settings.completionBufferDays)).onChange(async v=>{const n=Number(v);if(Number.isFinite(n)&&n>=0)this.p.data.settings.completionBufferDays=Math.round(n);await this.p.save()}));e.createEl('h3',{text:'Student private GitHub backup'});for(const [name,key] of [['Repository owner','owner'],['Repository name','repo'],['Branch','branch'],['Path prefix','pathPrefix']])new Setting(e).setName(name).addText(t=>t.setValue(this.p.data.settings.github[key]).onChange(async v=>{this.p.data.settings.github[key]=v.trim();await this.p.save()}));new Setting(e).setName('Fine-grained token').setDesc('Use a token limited to the student repository with Contents read/write.').addText(t=>{t.inputEl.type='password';t.setValue(this.p.data.settings.github.token).onChange(async v=>{this.p.data.settings.github.token=v.trim();await this.p.save()})})}}
module.exports=BrytePlugin;
function normalizeFlashcardDeck(deck, expectedUnitId){
 if(!deck||deck.schemaVersion!==1||deck.unitId!==expectedUnitId||!Array.isArray(deck.cards))throw new Error(`Invalid flashcard deck for ${expectedUnitId}`);
 const clean=clone(deck);
 clean.cards=clean.cards.map((card,index)=>{
  if(!card||!card.id||!card.prompt||!card.answer)throw new Error(`Invalid flashcard in ${expectedUnitId}`);
  const canonicalSequence=Number(card.canonicalSequence);
  return {...clone(card),canonicalSequence:Number.isFinite(canonicalSequence)&&canonicalSequence>0?canonicalSequence:index+1};
 });
 return clean;
}
function mergeFlashcardDecks(publicDeck,privateDeck){
 const cards=[],ids=new Set();
 for(const [deck,source] of [[publicDeck,'public'],[privateDeck,'private']]){
  if(!deck)continue;
  for(const card of deck.cards.slice().sort((a,b)=>a.canonicalSequence-b.canonicalSequence)){
   if(ids.has(card.id))continue;
   ids.add(card.id);
   cards.push({...clone(card),source});
  }
 }
 return cards.sort((a,b)=>a.canonicalSequence-b.canonicalSequence||a.id.localeCompare(b.id));
}
const flashcardPath=u=>normalizePath(`${ROOT}/Assignments/Unit ${u.unitNumber}/flashcards.json`);
async function writePulledFlashcards(vault,u,deck){
 const path=flashcardPath(u);await parent(vault,path);const file=vault.getAbstractFileByPath(path),text=JSON.stringify(deck,null,2)+'\n';file instanceof TFile?await vault.modify(file,text):await vault.create(path,text);
}
async function fetchOptionalPublicDeck(base,u){
 try{return (await requestUrl({url:`${base}/${u.unitId}/flashcards.json`})).json}
 catch(error){if(String(error).includes('404'))return null;throw error}
}
function decodeGitHubText(content){return decodeURIComponent(escape(atob(String(content||'').replace(/\n/g,''))))}
async function fetchOptionalPrivateDeck(g,u){
 if(!g||!g.owner||!g.repo||!g.token)return null;
 const path=`assignments/${u.unitId}/flashcards.json`,enc=path.split('/').map(encodeURIComponent).join('/'),url=`https://api.github.com/repos/${encodeURIComponent(g.owner)}/${encodeURIComponent(g.repo)}/contents/${enc}?ref=${encodeURIComponent(g.branch||'main')}`,headers={Authorization:`Bearer ${g.token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
 try{const json=(await requestUrl({url,headers})).json;if(!json||!json.content)return null;return JSON.parse(decodeGitHubText(json.content))}
 catch(error){if(String(error).includes('404'))return null;throw error}
}
function curriculumCardsForUnit(u,decks){
 const merged=mergeFlashcardDecks(decks?.public||null,decks?.private||null);
 return merged.map(card=>({cardId:`curriculum:${card.id}`,kind:'curriculum',source:card.source,unitId:u.unitId,unitNumber:u.unitNumber,sequence:card.canonicalSequence,sortSub:0,passage:card.book&&card.startChapter?passage(card):(card.topic||card.prompt),prompt:card.prompt,answer:card.answer,topic:card.topic||'',sourceQuizQuestionNumber:card.sourceQuizQuestionNumber||null}));
}
const baseAssignmentPull=BrytePlugin.prototype.pull;
BrytePlugin.prototype.pull=async function(silent=false){
 await baseAssignmentPull.call(this,silent);
 await this.pullFlashcards(silent);
};
BrytePlugin.prototype.pullFlashcards=async function(silent=false){
 this.data.flashcardDecks=this.data.flashcardDecks||{};
 const base=this.data.settings.assignmentBaseUrl.replace(/\/$/,'');
 const github=this.data.settings.github||{};
 let changed=0;
 for(const u of Object.values(this.data.installedUnits).map(x=>x.definition).sort((a,b)=>a.unitNumber-b.unitNumber)){
  const state=this.data.flashcardDecks[u.unitId]||{public:null,private:null};
  try{
   const raw=await fetchOptionalPublicDeck(base,u),next=raw?normalizeFlashcardDeck(raw,u.unitId):null;
   if(JSON.stringify(state.public)!==JSON.stringify(next))changed++;
   state.public=next;
   if(next)await writePulledFlashcards(this.app.vault,u,next);
  }catch(error){console.warn(`Bryte Mentorship: could not refresh public flashcards for ${u.unitId}; retaining the last known deck.`,error)}
  if(github.owner&&github.repo&&github.token){
   try{
    const raw=await fetchOptionalPrivateDeck(github,u),next=raw?normalizeFlashcardDeck(raw,u.unitId):null;
    if(JSON.stringify(state.private)!==JSON.stringify(next))changed++;
    state.private=next;
   }catch(error){console.warn(`Bryte Mentorship: could not refresh private flashcards for ${u.unitId}; retaining the last known deck.`,error)}
  }else if(state.private){state.private=null;changed++}
  this.data.flashcardDecks[u.unitId]=state;
 }
 await this.save();
 if(!silent&&changed)new Notice(`Bryte Mentorship: flashcards refreshed for ${changed} source(s).`);
};
const baseSummaryCards=BrytePlugin.prototype.cards;
BrytePlugin.prototype.cards=async function(unitId){
 const curriculum=[];
 for(const u of Object.values(this.data.installedUnits).map(x=>x.definition).filter(u=>!unitId||u.unitId===unitId))curriculum.push(...curriculumCardsForUnit(u,(this.data.flashcardDecks||{})[u.unitId]));
 const summaries=(await baseSummaryCards.call(this,unitId)).map(card=>({...card,kind:'summary',sortSub:1,prompt:`What is your summary of ${card.passage}?`,answer:card.summary}));
 return [...curriculum,...summaries].sort((a,b)=>a.unitNumber-b.unitNumber||a.sequence-b.sequence||(a.sortSub||0)-(b.sortSub||0)||a.cardId.localeCompare(b.cardId));
};
Flashcards.prototype.render=function(){
 const e=this.contentEl;e.empty();const c=this.cards[this.i];e.createDiv({cls:'bryte-muted',text:`${this.i+1} / ${this.cards.length} · Unit ${c.unitNumber}${c.source?` · ${c.source==='public'?'Released':'Private'}`:''}`});const card=e.createDiv({cls:'bryte-card'});card.createDiv({cls:'passage',text:c.prompt||c.passage});this.show?card.createDiv({cls:'answer',text:c.answer||c.summary}):card.createEl('p',{text:'Recall the answer, then tap to reveal.'});card.onclick=()=>{this.show=!this.show;this.render()};if(this.show){const r=e.createDiv({cls:'bryte-rating'});for(const q of ['again','hard','good','easy']){const b=r.createEl('button',{text:q[0].toUpperCase()+q.slice(1)});b.onclick=async()=>{await this.p.rate(c.cardId,q);this.next()}}}const n=e.createDiv({cls:'bryte-actions'}),prev=n.createEl('button',{text:'Previous'});prev.disabled=this.i===0;prev.onclick=()=>{this.i--;this.show=false;this.render()};const next=n.createEl('button',{text:this.i===this.cards.length-1?'Finish':'Next'});next.onclick=()=>this.next()
};
const updaterRequireApiVersion=require('obsidian').requireApiVersion;
const PLUGIN_UPDATE_MANIFEST_URL='https://raw.githubusercontent.com/fs-django/bryte-mentorship/main/downloads/plugin-release.json';
const PLUGIN_UPDATE_ASSET_ROOT='https://raw.githubusercontent.com/fs-django/bryte-mentorship/main/';
const PLUGIN_UPDATE_FILES=['main.js','manifest.json','styles.css','versions.json'];
const PLUGIN_UPDATE_WRITE_ORDER=['versions.json','styles.css','manifest.json','main.js'];
function parsePluginVersion(value){const match=String(value||'').trim().match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);if(!match)return null;return{major:Number(match[1]),minor:Number(match[2]),patch:Number(match[3]),pre:match[4]?match[4].split('.'):[]}}
function comparePrerelease(a,b){if(!a.length&&!b.length)return 0;if(!a.length)return 1;if(!b.length)return-1;const length=Math.max(a.length,b.length);for(let i=0;i<length;i++){if(i>=a.length)return-1;if(i>=b.length)return 1;const x=a[i],y=b[i],xn=/^\d+$/.test(x),yn=/^\d+$/.test(y);if(xn&&yn){const delta=Number(x)-Number(y);if(delta)return delta>0?1:-1;continue}if(xn!==yn)return xn?-1:1;if(x!==y)return x>y?1:-1}return 0}
function comparePluginVersions(left,right){const a=parsePluginVersion(left),b=parsePluginVersion(right);if(!a||!b)throw new Error('Invalid plugin version');for(const key of ['major','minor','patch'])if(a[key]!==b[key])return a[key]>b[key]?1:-1;return comparePrerelease(a.pre,b.pre)}
function validatePluginReleaseMetadata(raw){if(!raw||raw.schemaVersion!==1)throw new Error('Unsupported plugin release metadata');if(raw.pluginId!=='bryte-mentorship')throw new Error('Plugin release ID does not match Bryte Mentorship');if(raw.channel!=='stable')throw new Error('Only Stable Bryte Mentorship releases may self-update');if(!parsePluginVersion(raw.version)||String(raw.version).includes('-'))throw new Error('Stable release version is invalid');if(!Array.isArray(raw.files))throw new Error('Plugin release file list is invalid');const release={schemaVersion:1,pluginId:raw.pluginId,channel:raw.channel,version:String(raw.version),minAppVersion:String(raw.minAppVersion||'1.6.0'),releasedAt:raw.releasedAt?String(raw.releasedAt):null,files:[]},names=new Set();for(const entry of raw.files){if(!entry||!PLUGIN_UPDATE_FILES.includes(entry.name)||names.has(entry.name))throw new Error('Plugin release contains an invalid or duplicate file');const expectedPath=`downloads/plugin/${release.version}/${entry.name}`;if(entry.path!==expectedPath)throw new Error(`Plugin release path is invalid for ${entry.name}`);const sha256=String(entry.sha256||'').toLowerCase();if(!/^[0-9a-f]{64}$/.test(sha256))throw new Error(`Plugin release checksum is invalid for ${entry.name}`);names.add(entry.name);release.files.push({name:entry.name,path:entry.path,sha256})}return release}
function validateInstallablePluginRelease(release){const names=new Set(release.files.map(file=>file.name));if(PLUGIN_UPDATE_FILES.some(name=>!names.has(name))||names.size!==PLUGIN_UPDATE_FILES.length)throw new Error('Plugin release is missing required installed files');return release}
function ensurePluginUpdateState(plugin){plugin.data.settings=plugin.data.settings||{};if(typeof plugin.data.settings.checkPluginUpdatesOnLoad!=='boolean')plugin.data.settings.checkPluginUpdatesOnLoad=true;const hours=Number(plugin.data.settings.pluginUpdateCheckHours);plugin.data.settings.pluginUpdateCheckHours=Number.isFinite(hours)&&hours>=1?hours:12;plugin.data.pluginUpdate={lastCheckedAt:null,latestVersion:null,lastError:null,pendingRestartVersion:null,lastInstalledAt:null,...(plugin.data.pluginUpdate||{})};return plugin.data.pluginUpdate}
function effectivePluginVersion(plugin){const state=ensurePluginUpdateState(plugin),active=String(plugin.manifest.version);if(state.pendingRestartVersion&&parsePluginVersion(state.pendingRestartVersion)&&comparePluginVersions(state.pendingRestartVersion,active)>0)return state.pendingRestartVersion;return active}
function releaseAssetUrl(path){return`${PLUGIN_UPDATE_ASSET_ROOT}${String(path).replace(/^\//,'')}`}
async function fetchPluginReleaseMetadata(){const response=await requestUrl({url:PLUGIN_UPDATE_MANIFEST_URL,headers:{Accept:'application/json'}}),text=typeof response.text==='string'?response.text.trim():'';if(text.startsWith('<'))throw new Error('Plugin update service returned an unexpected HTML response');return validatePluginReleaseMetadata(text?JSON.parse(text):response.json)}
async function sha256Text(text){const subtle=globalThis.crypto&&globalThis.crypto.subtle,Encoder=globalThis.TextEncoder;if(!subtle||!Encoder)throw new Error('Secure checksum verification is unavailable on this device');const digest=await subtle.digest('SHA-256',new Encoder().encode(text));return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')}
async function downloadPluginReleaseFiles(release){validateInstallablePluginRelease(release);const assets={};for(const file of release.files){const response=await requestUrl({url:releaseAssetUrl(file.path),headers:{Accept:'text/plain, application/json;q=0.9, */*;q=0.1'}});if(typeof response.text!=='string')throw new Error(`Plugin update file ${file.name} was not returned as text`);if(await sha256Text(response.text)!==file.sha256)throw new Error(`Plugin update checksum failed for ${file.name}`);assets[file.name]=response.text}const manifest=JSON.parse(assets['manifest.json']);if(manifest.id!=='bryte-mentorship'||manifest.version!==release.version)throw new Error('Downloaded plugin manifest does not match the release');const versions=JSON.parse(assets['versions.json']);if(versions[release.version]!==manifest.minAppVersion)throw new Error('Downloaded plugin version contract is inconsistent');return assets}
async function replacePluginFiles(plugin,release,assets){const adapter=plugin.app.vault.adapter,configDir=plugin.app.vault.configDir||'.obsidian',pluginDir=normalizePath(`${configDir}/plugins/${plugin.manifest.id}`),originals=new Map(),written=[];if(!adapter||typeof adapter.read!=='function'||typeof adapter.write!=='function')throw new Error('Obsidian storage adapter cannot update plugin files on this device');for(const name of PLUGIN_UPDATE_FILES){const path=normalizePath(`${pluginDir}/${name}`),exists=typeof adapter.exists==='function'?await adapter.exists(path):true;originals.set(name,exists?await adapter.read(path):null)}try{for(const name of PLUGIN_UPDATE_WRITE_ORDER){await adapter.write(normalizePath(`${pluginDir}/${name}`),assets[name]);written.push(name)}}catch(error){for(const name of written.reverse()){const path=normalizePath(`${pluginDir}/${name}`),old=originals.get(name);try{if(old===null&&typeof adapter.remove==='function')await adapter.remove(path);else if(old!==null)await adapter.write(path,old)}catch(rollbackError){console.error(`Bryte Mentorship: rollback failed for ${name}`,rollbackError)}}throw error}return release.version}
BrytePlugin.prototype.checkPluginUpdate=async function(options={}){const state=ensurePluginUpdateState(this),force=Boolean(options.force),silent=Boolean(options.silent),hours=this.data.settings.pluginUpdateCheckHours;if(state.pendingRestartVersion&&state.pendingRestartVersion!==this.manifest.version){if(!silent)new Notice(`Bryte Mentorship ${state.pendingRestartVersion} is installed and will activate after Obsidian restarts.`);return state}if(!force&&state.lastCheckedAt){const elapsed=Date.now()-Date.parse(state.lastCheckedAt);if(Number.isFinite(elapsed)&&elapsed<hours*60*60*1000)return state}try{const release=await fetchPluginReleaseMetadata(),installed=effectivePluginVersion(this),available=comparePluginVersions(release.version,installed)>0;state.lastCheckedAt=new Date().toISOString();state.latestVersion=release.version;state.lastError=null;state.updateAvailable=available;await this.save();if(available)new Notice(`Bryte Mentorship ${release.version} is available. Run “Install Bryte Mentorship update” or open plugin settings.`);else if(!silent)new Notice(`Bryte Mentorship ${installed} is up to date.`);return state}catch(error){state.lastCheckedAt=new Date().toISOString();state.lastError=String(error&&error.message?error.message:error).slice(0,240);await this.save();console.warn('Bryte Mentorship: plugin update check failed.',error);if(!silent)new Notice(`Plugin update check failed: ${state.lastError}`);return state}};
BrytePlugin.prototype.installPluginUpdate=async function(){const state=ensurePluginUpdateState(this);if(state.pendingRestartVersion&&state.pendingRestartVersion!==this.manifest.version)return new Notice(`Bryte Mentorship ${state.pendingRestartVersion} is already installed. Restart Obsidian to activate it.`);try{const release=await fetchPluginReleaseMetadata(),installed=String(this.manifest.version);if(comparePluginVersions(release.version,installed)<=0){state.latestVersion=release.version;state.updateAvailable=false;state.lastCheckedAt=new Date().toISOString();state.lastError=null;await this.save();return new Notice(`Bryte Mentorship ${installed} is up to date.`)}if(typeof updaterRequireApiVersion==='function'&&!updaterRequireApiVersion(release.minAppVersion))throw new Error(`Obsidian ${release.minAppVersion} or newer is required for Bryte Mentorship ${release.version}`);const assets=await downloadPluginReleaseFiles(release);await replacePluginFiles(this,release,assets);state.latestVersion=release.version;state.updateAvailable=false;state.pendingRestartVersion=release.version;state.lastInstalledAt=new Date().toISOString();state.lastCheckedAt=state.lastInstalledAt;state.lastError=null;await this.save();new Notice(`Bryte Mentorship ${release.version} installed. Restart Obsidian to activate the update.`)}catch(error){state.lastError=String(error&&error.message?error.message:error).slice(0,240);await this.save();console.error('Bryte Mentorship: plugin update failed.',error);new Notice(`Plugin update failed: ${state.lastError}`)}};
const updaterBaseOnload=BrytePlugin.prototype.onload;BrytePlugin.prototype.onload=async function(){await updaterBaseOnload.call(this);const state=ensurePluginUpdateState(this);let activated=null;if(state.pendingRestartVersion===this.manifest.version){activated=state.pendingRestartVersion;state.pendingRestartVersion=null;state.updateAvailable=false;state.lastError=null}await this.save();this.addCommand({id:'check-plugin-update',name:'Check for plugin update',callback:()=>this.checkPluginUpdate({force:true,silent:false})});this.addCommand({id:'install-plugin-update',name:'Install Bryte Mentorship update',callback:()=>this.installPluginUpdate()});this.app.workspace.onLayoutReady(()=>{if(activated)new Notice(`Bryte Mentorship updated to ${activated}.`);if(this.data.settings.checkPluginUpdatesOnLoad)void this.checkPluginUpdate({silent:true})})};
const updaterBaseSettingsDisplay=BryteSettings.prototype.display;BryteSettings.prototype.display=function(){updaterBaseSettingsDisplay.call(this);const e=this.containerEl,state=ensurePluginUpdateState(this.p),installed=this.p.manifest.version,pending=state.pendingRestartVersion,latest=state.latestVersion||'Not checked';e.createEl('h3',{text:'Plugin updates'});new Setting(e).setName('Installed version').setDesc(pending?`${installed} active · ${pending} installed, restart required`:installed);new Setting(e).setName('Check for updates on startup').setDesc('Checks the public Bryte Mentorship release feed. Updates are never installed silently.').addToggle(t=>t.setValue(this.p.data.settings.checkPluginUpdatesOnLoad).onChange(async value=>{this.p.data.settings.checkPluginUpdatesOnLoad=value;await this.p.save()}));new Setting(e).setName('Update check interval').setDesc('Hours between automatic startup checks.').addText(t=>t.setValue(String(this.p.data.settings.pluginUpdateCheckHours)).onChange(async value=>{const n=Number(value);if(Number.isFinite(n)&&n>=1)this.p.data.settings.pluginUpdateCheckHours=Math.round(n);await this.p.save()}));const status=state.lastError?`Latest: ${latest} · Last check failed: ${state.lastError}`:state.updateAvailable?`Latest: ${latest} · Update available`:pending?`Latest: ${latest} · Restart required`:`Latest: ${latest}${state.lastCheckedAt?` · Checked ${state.lastCheckedAt}`:''}`;new Setting(e).setName('Update status').setDesc(status).addButton(b=>b.setButtonText('Check now').onClick(async()=>{await this.p.checkPluginUpdate({force:true,silent:false});this.display()})).addButton(b=>b.setButtonText(pending?'Restart required':'Update now').setCta().setDisabled(Boolean(pending)).onClick(async()=>{await this.p.installPluginUpdate();this.display()}))};

// Bryte Mentorship 0.1.8: discover the configured repository first, then restore supported saved work and notes.
const SAVED_WORK_DIRS=['Studies','Meetings','Study Plans'];
const savedRepoReady=g=>Boolean(g&&g.owner&&g.repo&&g.token);
const savedRepoHeaders=g=>({Authorization:`Bearer ${g.token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'});
const savedRepoRoot=g=>normalizePath(String(g.pathPrefix||ROOT).replace(/^\/+|\/+$/g,''));
const savedRepoLabel=g=>`${g.owner||'?'}\/${g.repo||'?'}@${g.branch||'main'}`;
const savedRepoNotFound=error=>Boolean(error&&(error.status===404||error.statusCode===404||error?.response?.status===404||error?.response?.statusCode===404||String(error).includes('404')));
function savedRepoUrl(g,path=''){const enc=normalizePath(path).split('/').filter(Boolean).map(encodeURIComponent).join('/');const suffix=enc?`/${enc}`:'';return `https://api.github.com/repos/${encodeURIComponent(g.owner)}/${encodeURIComponent(g.repo)}/contents${suffix}?ref=${encodeURIComponent(g.branch||'main')}`}
async function listSavedRepoFiles(g,path=''){
 try{
  const json=(await requestUrl({url:savedRepoUrl(g,path),headers:savedRepoHeaders(g)})).json;
  const entries=Array.isArray(json)?json:[json];
  const out=[];
  for(const entry of entries){
   if(!entry||!entry.path)continue;
   if(entry.type==='dir')out.push(...await listSavedRepoFiles(g,entry.path));
   else if(entry.type==='file')out.push(entry.path);
  }
  return out;
 }catch(error){if(path&&savedRepoNotFound(error))return[];throw error}
}
async function readSavedRepoFile(g,path){const json=(await requestUrl({url:savedRepoUrl(g,path),headers:savedRepoHeaders(g)})).json;if(!json||!json.content)throw new Error(`GitHub did not return content for ${path}`);return decodeGitHubText(json.content)}
function savedRelativePath(root,remotePath){
 const normalizedRoot=normalizePath(root).replace(/\/$/,'');
 const normalized=normalizePath(remotePath);
 if(!normalizedRoot||!normalized.startsWith(`${normalizedRoot}/`))return null;
 const rel=normalized.slice(normalizedRoot.length+1);
 if(!rel||rel.startsWith('/')||rel.split('/').some(part=>part==='..'))return null;
 if(!SAVED_WORK_DIRS.some(dir=>rel===dir||rel.startsWith(`${dir}/`)))return null;
 if(!rel.toLowerCase().endsWith('.md'))return null;
 return rel;
}
function savedNoteRelativePath(root,remotePath){
 const normalizedRoot=normalizePath(root).replace(/^\/+|\/+$/g,'');
 const normalized=normalizePath(remotePath).replace(/^\/+/,''),lower=normalized.toLowerCase();
 const prefixes=['notes/'];
 if(normalizedRoot)prefixes.push(`${normalizedRoot}/notes/`);
 for(const prefix of prefixes){
  if(!lower.startsWith(prefix.toLowerCase()))continue;
  const tail=normalized.slice(prefix.length);
  if(!tail||tail.startsWith('/')||tail.split('/').some(part=>part==='..')||!tail.toLowerCase().endsWith('.md'))return null;
  return normalizePath(`Notes/${tail}`);
 }
 return null;
}
function savedRepoLocalRelative(root,remotePath){return savedRelativePath(root,remotePath)||savedNoteRelativePath(root,remotePath)}
function frontmatterField(text,key){const match=String(text||'').match(new RegExp(`^${key}:\\s*["']?([^\\n"']+)["']?\\s*$`,'m'));return match?match[1].trim():''}
function restoreAssignmentState(plugin,text){
 const id=frontmatterField(text,'assignment_id'),status=frontmatterField(text,'status');
 if(!id||!['not-started','in-progress','complete'].includes(status))return;
 const previous=plugin.data.assignmentStates[id]||{};
 plugin.data.assignmentStates[id]={...previous,status,restoredAt:new Date().toISOString()};
}
async function writeRecoveredCopy(plugin,relative,content){
 const path=normalizePath(`${ROOT}/Recovered from GitHub/${relative}`);
 await parent(plugin.app.vault,path);
 const file=plugin.app.vault.getAbstractFileByPath(path);
 file instanceof TFile?await plugin.app.vault.modify(file,content):await plugin.app.vault.create(path,content);
 return path;
}
BrytePlugin.prototype.pullStudentWork=async function(options={}){
 const silent=Boolean(options.silent),g=this.data.settings.github||{},attemptedAt=new Date().toISOString(),repo=savedRepoLabel(g);
 if(!savedRepoReady(g)){
  this.data.savedRepoPull={attemptedAt,repo,scanned:0,matched:0,restored:0,unchanged:0,conflicts:0,error:'Repository owner, name, and token are required.'};
  await this.save();
  if(!silent)new Notice('Configure the student GitHub repository and fine-grained token first.');
  return{restored:0,unchanged:0,conflicts:0,error:this.data.savedRepoPull.error};
 }
 try{
  const root=savedRepoRoot(g);
  // Discover the repository that actually exists instead of probing guessed paths.
  const discovered=[...new Set(await listSavedRepoFiles(g,''))].sort();
  const remotePaths=discovered.filter(remotePath=>Boolean(savedRepoLocalRelative(root,remotePath)));
  let restored=0,unchanged=0,conflicts=0;
  for(const remotePath of remotePaths){
   const relative=savedRepoLocalRelative(root,remotePath);
   if(!relative)continue;
   const content=await readSavedRepoFile(g,remotePath),localPath=normalizePath(`${ROOT}/${relative}`),local=this.app.vault.getAbstractFileByPath(localPath);
   if(!(local instanceof TFile)){
    await parent(this.app.vault,localPath);
    await this.app.vault.create(localPath,content);
    restoreAssignmentState(this,content);
    restored++;
    continue;
   }
   const localContent=await this.app.vault.read(local);
   if(localContent===content){restoreAssignmentState(this,localContent);unchanged++;continue}
   restoreAssignmentState(this,localContent);
   await writeRecoveredCopy(this,relative,content);
   conflicts++;
  }
  this.data.savedRepoPull={attemptedAt,repo,scanned:discovered.length,matched:remotePaths.length,restored,unchanged,conflicts,error:null};
  await this.save();
  if(!silent){const conflictText=conflicts?` ${conflicts} conflict(s) preserved under “${ROOT}/Recovered from GitHub”.`:'';new Notice(`Saved repo ${repo}: scanned ${discovered.length}, matched ${remotePaths.length}, restored ${restored}, unchanged ${unchanged}.${conflictText}`)}
  return{restored,unchanged,conflicts,scanned:discovered.length,matched:remotePaths.length};
 }catch(error){
  const message=String(error&&error.message?error.message:error);
  this.data.savedRepoPull={attemptedAt,repo,scanned:0,matched:0,restored:0,unchanged:0,conflicts:0,error:message};
  await this.save();
  console.error('Bryte Mentorship: saved-repo pull failed.',error);
  if(!silent)new Notice(`Saved repo ${repo} failed: ${message}`);
  return{restored:0,unchanged:0,conflicts:0,error:message};
 }
};
const savedRepoBasePull=BrytePlugin.prototype.pull;
BrytePlugin.prototype.pull=async function(silent=false){
 if(this.data.settings.pullStudentWorkWithAssignments!==false&&savedRepoReady(this.data.settings.github||{}))await this.pullStudentWork({silent:true});
 return savedRepoBasePull.call(this,silent);
};
const savedRepoBaseOnload=BrytePlugin.prototype.onload;
BrytePlugin.prototype.onload=async function(){
 await savedRepoBaseOnload.call(this);
 if(typeof this.data.settings.pullStudentWorkWithAssignments!=='boolean')this.data.settings.pullStudentWorkWithAssignments=true;
 await this.save();
 this.addCommand({id:'pull-student-work',name:'Pull student work from private GitHub repository',callback:()=>this.pullStudentWork({silent:false})});
};
const savedRepoBaseSettingsDisplay=BryteSettings.prototype.display;
BryteSettings.prototype.display=function(){
 savedRepoBaseSettingsDisplay.call(this);
 const e=this.containerEl,g=this.p.data.settings.github||{},state=this.p.data.savedRepoPull||null;
 e.createEl('h3',{text:'Saved-repo restore'});
 new Setting(e).setName('Saved repository').setDesc(savedRepoReady(g)?savedRepoLabel(g):'Not fully configured');
 new Setting(e).setName('Pull saved work with assignments').setDesc('Before released assignments are installed, restore Studies, Meetings, Study Plans, and Markdown notes discovered in the configured student GitHub repository.').addToggle(t=>t.setValue(this.p.data.settings.pullStudentWorkWithAssignments!==false).onChange(async value=>{this.p.data.settings.pullStudentWorkWithAssignments=value;await this.p.save()}));
 const status=state?(state.error?`Last pull ${state.attemptedAt}: FAILED — ${state.error}`:`Last pull ${state.attemptedAt}: scanned ${state.scanned}, matched ${state.matched}, restored ${state.restored}, unchanged ${state.unchanged}, conflicts ${state.conflicts}.`):'No saved-repository pull has been recorded yet.';
 new Setting(e).setName('Last saved-repo pull').setDesc(status);
 new Setting(e).setName('Pull saved work now').setDesc('Discovers the repository root, then restores repo-root notes/ Markdown files into Bryte Mentorship/Notes. Existing local files are never silently overwritten.').addButton(b=>b.setButtonText('Pull now').setCta().onClick(async()=>{await this.p.pullStudentWork({silent:false});this.display()}));
};
const savedRepoBaseDashboardRender=Dashboard.prototype.render;
Dashboard.prototype.render=async function(){
 await savedRepoBaseDashboardRender.call(this);
 if(!savedRepoReady(this.p.data.settings.github||{}))return;
 const actions=this.contentEl.querySelector('.bryte-actions')||this.contentEl.createDiv({cls:'bryte-actions'});
 this.button(actions,'Pull saved work',async()=>{await this.p.pullStudentWork({silent:false});await this.render()});
};
