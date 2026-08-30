// Bryte Mentorship 0.1.5: restore student-owned work from the configured GitHub repository.
// This file is concatenated after the 0.1.4 runtime when the 0.1.5 release is built.
const SAVED_WORK_DIRS=['Studies','Meetings','Study Plans'];
const savedRepoReady=g=>Boolean(g&&g.owner&&g.repo&&g.token);
const savedRepoHeaders=g=>({Authorization:`Bearer ${g.token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'});
const savedRepoRoot=g=>normalizePath(String(g.pathPrefix||ROOT).replace(/^\/+|\/+$/g,''));
function savedRepoUrl(g,path){const enc=normalizePath(path).split('/').filter(Boolean).map(encodeURIComponent).join('/');return `https://api.github.com/repos/${encodeURIComponent(g.owner)}/${encodeURIComponent(g.repo)}/contents/${enc}?ref=${encodeURIComponent(g.branch||'main')}`}
async function listSavedRepoFiles(g,path){
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
 }catch(error){if(String(error).includes('404'))return[];throw error}
}
async function readSavedRepoFile(g,path){const json=(await requestUrl({url:savedRepoUrl(g,path),headers:savedRepoHeaders(g)})).json;if(!json||!json.content)throw new Error(`GitHub did not return content for ${path}`);return decodeGitHubText(json.content)}
function savedRelativePath(root,remotePath){
 const normalizedRoot=normalizePath(root).replace(/\/$/,'');
 const normalized=normalizePath(remotePath);
 if(!normalized.startsWith(`${normalizedRoot}/`))return null;
 const rel=normalized.slice(normalizedRoot.length+1);
 if(!rel||rel.startsWith('/')||rel.split('/').some(part=>part==='..'))return null;
 if(!SAVED_WORK_DIRS.some(dir=>rel===dir||rel.startsWith(`${dir}/`)))return null;
 if(!rel.toLowerCase().endsWith('.md'))return null;
 return rel;
}
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
 const silent=Boolean(options.silent),g=this.data.settings.github||{};
 if(!savedRepoReady(g)){
  if(!silent)new Notice('Configure the student GitHub repository and fine-grained token first.');
  return{restored:0,unchanged:0,conflicts:0};
 }
 try{
  const root=savedRepoRoot(g);
  let remotePaths=[];
  for(const dir of SAVED_WORK_DIRS)remotePaths.push(...await listSavedRepoFiles(g,normalizePath(`${root}/${dir}`)));
  remotePaths=[...new Set(remotePaths)].sort();
  let restored=0,unchanged=0,conflicts=0;
  for(const remotePath of remotePaths){
   const relative=savedRelativePath(root,remotePath);
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
  await this.save();
  if(!silent){const conflictText=conflicts?` ${conflicts} conflict(s) were preserved locally and the GitHub copy was written under “${ROOT}/Recovered from GitHub”.`:'';new Notice(`Saved work pull: ${restored} restored, ${unchanged} unchanged.${conflictText}`)}
  return{restored,unchanged,conflicts};
 }catch(error){console.error('Bryte Mentorship: saved-repo pull failed.',error);if(!silent)new Notice(`Saved work pull failed: ${error&&error.message?error.message:error}`);return{restored:0,unchanged:0,conflicts:0,error}}
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
 const e=this.containerEl;
 e.createEl('h3',{text:'Saved-repo restore'});
 new Setting(e).setName('Pull saved work with assignments').setDesc('Before released assignments are installed, restore Studies, Meetings, and Study Plans from the configured student GitHub repository.').addToggle(t=>t.setValue(this.p.data.settings.pullStudentWorkWithAssignments!==false).onChange(async value=>{this.p.data.settings.pullStudentWorkWithAssignments=value;await this.p.save()}));
 new Setting(e).setName('Pull saved work now').setDesc('Existing local files are never silently overwritten. A differing GitHub copy is placed under “Bryte Mentorship/Recovered from GitHub” for review.').addButton(b=>b.setButtonText('Pull now').setCta().onClick(async()=>{await this.p.pullStudentWork({silent:false})}));
};
const savedRepoBaseDashboardRender=Dashboard.prototype.render;
Dashboard.prototype.render=async function(){
 await savedRepoBaseDashboardRender.call(this);
 if(!savedRepoReady(this.p.data.settings.github||{}))return;
 const actions=this.contentEl.querySelector('.bryte-actions')||this.contentEl.createDiv({cls:'bryte-actions'});
 this.button(actions,'Pull saved work',async()=>{await this.p.pullStudentWork({silent:false});await this.render()});
};
