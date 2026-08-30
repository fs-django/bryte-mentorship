const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

if(typeof global.atob!=='function')global.atob=value=>Buffer.from(value,'base64').toString('binary');

class TFile{constructor(filePath,content=''){this.path=filePath;this.content=content}}
class Notice{}
class Setting{setName(){return this}setDesc(){return this}addToggle(){return this}addButton(){return this}}
class BrytePlugin{async pull(){return null}async onload(){}addCommand(){}}
class BryteSettings{display(){}}
class Dashboard{async render(){}button(){}}

const remoteStudy=`---\nbryte_type: study\nunit: 1\nassignment_id: unit-001-gen-001\nstatus: complete\n---\n\n# Genesis 1 — Chapter Review\n\nFinished work.\n`;
const remoteMeeting='# Unit 1 Mentorship Meeting\n\nRemote meeting notes.\n';
const remoteBook='# Revitalize — Chapters 1–3\n\nBook notes.\n';

function normalizePath(value){return String(value).replace(/\\/g,'/').replace(/\/+/g,'/')}
function decodeGitHubText(value){return Buffer.from(value.replace(/\n/g,''),'base64').toString('utf8')}
function decodePath(url){const marker='/contents/';const start=url.indexOf(marker);const raw=url.slice(start+marker.length).split('?')[0];return raw.split('/').filter(Boolean).map(decodeURIComponent).join('/')}
async function requestUrl({url}){
 const p=decodePath(url);
 if(p==='Bryte Mentorship/Studies')return{json:[{type:'dir',path:'Bryte Mentorship/Studies/Unit 1'}]};
 if(p==='Bryte Mentorship/Studies/Unit 1')return{json:[{type:'file',path:'Bryte Mentorship/Studies/Unit 1/01-genesis-1.md'}]};
 if(p==='Bryte Mentorship/Studies/Unit 1/01-genesis-1.md')return{json:{content:Buffer.from(remoteStudy,'utf8').toString('base64')}};
 if(p==='Bryte Mentorship/Meetings')return{json:[{type:'file',path:'Bryte Mentorship/Meetings/Unit 1 Meeting.md'}]};
 if(p==='Bryte Mentorship/Meetings/Unit 1 Meeting.md')return{json:{content:Buffer.from(remoteMeeting,'utf8').toString('base64')}};
 if(p==='Bryte Mentorship/Study Plans')return{json:[]};
 if(p==='notes')return{json:[{type:'dir',path:'notes/books'}]};
 if(p==='notes/books')return{json:[{type:'file',path:'notes/books/Revitalize - Chapters 1-3.md'}]};
 if(p==='notes/books/Revitalize - Chapters 1-3.md')return{json:{content:Buffer.from(remoteBook,'utf8').toString('base64')}};
 if(['Notes','Bryte Mentorship/notes','Bryte Mentorship/Notes'].includes(p))throw new Error('404 Not Found');
 throw new Error(`Unexpected URL: ${url}`);
}
async function parent(vault,filePath){
 const parts=normalizePath(filePath).split('/');
 parts.pop();
 let current='';
 for(const part of parts){
  current=current?`${current}/${part}`:part;
  if(!vault.getAbstractFileByPath(current))await vault.createFolder(current);
 }
}
class Vault{
 constructor(){this.files=new Map();this.folders=new Set()}
 getAbstractFileByPath(p){return this.files.get(p)||null}
 async createFolder(p){this.folders.add(p)}
 async create(p,content){const file=new TFile(p,content);this.files.set(p,file);return file}
 async modify(file,content){file.content=content}
 async read(file){return file.content}
}

Object.assign(global,{TFile,Notice,Setting,BrytePlugin,BryteSettings,Dashboard,ROOT:'Bryte Mentorship',normalizePath,decodeGitHubText,requestUrl,parent});
const sourcePath=path.resolve(__dirname,'../src/private-repo-pull.js');
vm.runInThisContext(fs.readFileSync(sourcePath,'utf8'),{filename:sourcePath});

(async()=>{
 const plugin=Object.create(BrytePlugin.prototype);
 plugin.data={settings:{github:{owner:'student',repo:'saved-work',branch:'main',token:'token',pathPrefix:'Bryte Mentorship'}},assignmentStates:{}};
 plugin.app={vault:new Vault()};
 plugin.save=async()=>{};
 await plugin.app.vault.create('Bryte Mentorship/Meetings/Unit 1 Meeting.md','# Local meeting notes.\n');

 const result=await plugin.pullStudentWork({silent:true});
 assert.deepStrictEqual({restored:result.restored,unchanged:result.unchanged,conflicts:result.conflicts},{restored:2,unchanged:0,conflicts:1});

 const note=plugin.app.vault.getAbstractFileByPath('Bryte Mentorship/Notes/books/Revitalize - Chapters 1-3.md');
 assert(note instanceof TFile,'root-level repo notes should be restored into Bryte Mentorship/Notes');
 assert.strictEqual(note.content,remoteBook);

 const study=plugin.app.vault.getAbstractFileByPath('Bryte Mentorship/Studies/Unit 1/01-genesis-1.md');
 assert(study instanceof TFile,'legacy saved study should still restore');
 assert.strictEqual(study.content,remoteStudy);
 assert.strictEqual(plugin.data.assignmentStates['unit-001-gen-001'].status,'complete');

 const localMeeting=plugin.app.vault.getAbstractFileByPath('Bryte Mentorship/Meetings/Unit 1 Meeting.md');
 assert.strictEqual(localMeeting.content,'# Local meeting notes.\n','local conflicts must not be overwritten');
 const recovered=plugin.app.vault.getAbstractFileByPath('Bryte Mentorship/Recovered from GitHub/Meetings/Unit 1 Meeting.md');
 assert(recovered instanceof TFile,'remote conflict copy should be written');
 assert.strictEqual(recovered.content,remoteMeeting);

 console.log('private repo note restore tests passed');
})().catch(error=>{console.error(error);process.exit(1)});
