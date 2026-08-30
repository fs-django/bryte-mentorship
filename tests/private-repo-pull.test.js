const assert=require('assert');
const path=require('path');
const Module=require('module');
if(typeof global.atob!=='function')global.atob=value=>Buffer.from(value,'base64').toString('binary');
class TFile{constructor(filePath,content=''){this.path=filePath;this.content=content}}
class Dummy{constructor(){} close(){} open(){}}
class Setting{setName(){return this}setDesc(){return this}addText(){return this}addToggle(){return this}addButton(){return this}}
const remoteStudy=`---\nbryte_type: study\nunit: 1\nassignment_id: unit-001-gen-001\nstatus: complete\n---\n\n# Genesis 1 — Chapter Review\n\nFinished work.\n`;
const remoteMeeting='# Unit 1 Mentorship Meeting\n\nRemote meeting notes.\n';
function decodePath(url){const marker='/contents';const start=url.indexOf(marker);const raw=url.slice(start+marker.length).split('?')[0].replace(/^\//,'');return raw.split('/').filter(Boolean).map(decodeURIComponent).join('/')}
async function requestUrl({url}){
 const p=decodePath(url);
 if(p==='')return{json:[{type:'dir',path:'Bryte Mentorship'}]};
 if(p==='Bryte Mentorship')return{json:[
  {type:'dir',path:'Bryte Mentorship/Studies'},
  {type:'dir',path:'Bryte Mentorship/Meetings'},
  {type:'dir',path:'Bryte Mentorship/Study Plans'}
 ]};
 if(p==='Bryte Mentorship/Studies')return{json:[{type:'dir',path:'Bryte Mentorship/Studies/Unit 1'}]};
 if(p==='Bryte Mentorship/Studies/Unit 1')return{json:[{type:'file',path:'Bryte Mentorship/Studies/Unit 1/01-genesis-1.md'}]};
 if(p==='Bryte Mentorship/Studies/Unit 1/01-genesis-1.md')return{json:{content:Buffer.from(remoteStudy,'utf8').toString('base64')}};
 if(p==='Bryte Mentorship/Meetings')return{json:[{type:'file',path:'Bryte Mentorship/Meetings/Unit 1 Meeting.md'}]};
 if(p==='Bryte Mentorship/Meetings/Unit 1 Meeting.md')return{json:{content:Buffer.from(remoteMeeting,'utf8').toString('base64')}};
 if(p==='Bryte Mentorship/Study Plans')return{json:[]};
 throw new Error(`Unexpected URL: ${url}`);
}
const obsidian={Plugin:Dummy,Modal:Dummy,PluginSettingTab:Dummy,Setting,Notice:class{},TFile,requestUrl,normalizePath:value=>String(value).replace(/\\/g,'/').replace(/\/+/g,'/'),requireApiVersion:()=>true};
const originalLoad=Module._load;
Module._load=function(request,parent,isMain){if(request==='obsidian')return obsidian;return originalLoad.apply(this,arguments)};
class Vault{
 constructor(){this.files=new Map();this.folders=new Set()}
 getAbstractFileByPath(p){return this.files.get(p)||null}
 async createFolder(p){this.folders.add(p)}
 async create(p,content){const file=new TFile(p,content);this.files.set(p,file);return file}
 async modify(file,content){file.content=content}
 async read(file){return file.content}
 getFiles(){return[...this.files.values()]}
}
(async()=>{
 const PluginClass=require(path.resolve(process.argv[2]));
 const plugin=Object.create(PluginClass.prototype);
 plugin.data={settings:{github:{owner:'student',repo:'saved-work',branch:'main',token:'token',pathPrefix:'Bryte Mentorship'}},assignmentStates:{}};
 plugin.app={vault:new Vault()};
 plugin.save=async()=>{};
 await plugin.app.vault.create('Bryte Mentorship/Meetings/Unit 1 Meeting.md','# Local meeting notes.\n');
 const result=await plugin.pullStudentWork({silent:true});
 assert.deepStrictEqual({restored:result.restored,unchanged:result.unchanged,conflicts:result.conflicts},{restored:1,unchanged:0,conflicts:1});
 const restored=plugin.app.vault.getAbstractFileByPath('Bryte Mentorship/Studies/Unit 1/01-genesis-1.md');
 assert(restored instanceof TFile,'study file should be restored');
 assert.strictEqual(restored.content,remoteStudy);
 assert.strictEqual(plugin.data.assignmentStates['unit-001-gen-001'].status,'complete');
 const localMeeting=plugin.app.vault.getAbstractFileByPath('Bryte Mentorship/Meetings/Unit 1 Meeting.md');
 assert.strictEqual(localMeeting.content,'# Local meeting notes.\n','local conflicts must not be overwritten');
 const recovered=plugin.app.vault.getAbstractFileByPath('Bryte Mentorship/Recovered from GitHub/Meetings/Unit 1 Meeting.md');
 assert(recovered instanceof TFile,'remote conflict copy should be written');
 assert.strictEqual(recovered.content,remoteMeeting);
 assert.strictEqual(plugin.data.savedRepoPull.matched,2);
 console.log('private repo restore discovery tests passed');
})().catch(error=>{console.error(error);process.exit(1)});
