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
