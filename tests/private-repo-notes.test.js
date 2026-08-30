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

const remoteBook='# Revitalize — Chapters 1–3\n\nBook notes.\n';
function normalizePath(value){return String(value).replace(/\\/g,'/').replace(/\/+/g,'/')}
function decodeGitHubText(value){return Buffer.from(value.replace(/\n/g,''),'base64').toString('utf8')}
function decodePath(url){const marker='/contents';const start=url.indexOf(marker);const raw=url.slice(start+marker.length).split('?')[0].replace(/^\//,'');return raw.split('/').filter(Boolean).map(decodeURIComponent).join('/')}
async function requestUrl({url}){
 const p=decodePath(url);
 // Mirror fs-django/bryte-mentorship-mh: repo-root assignments/ + notes/, no Bryte Mentorship/* tree.
 if(p==='notes')return{json:[{type:'dir',path:'notes/books'}]};
 if(p==='notes/books')return{json:[{type:'file',path:'notes/books/Revitalize - Chapters 1-3.md'}]};
 if(p==='notes/books/Revitalize - Chapters 1-3.md')return{json:{content:Buffer.from(remoteBook,'utf8').toString('base64')}};
 if(['Notes','Bryte Mentorship/Studies','Bryte Mentorship/Meetings','Bryte Mentorship/Study Plans','Bryte Mentorship/notes','Bryte Mentorship/Notes'].includes(p))throw{status:404,message:'Not Found'};
 throw new Error(`Unexpected URL: ${url}`);
}
async function parent(vault,filePath){
 const parts=normalizePath(filePath).split('/');parts.pop();let current='';
 for(const part of parts){current=current?`${current}/${part}`:part;if(!vault.getAbstractFileByPath(current))await vault.createFolder(current)}
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
 plugin.data={settings:{github:{owner:'fs-django',repo:'bryte-mentorship-mh',branch:'main',token:'token',pathPrefix:'Bryte Mentorship'}},assignmentStates:{}};
 plugin.app={vault:new Vault()};plugin.save=async()=>{};
 const result=await plugin.pullStudentWork({silent:true});
 assert.deepStrictEqual({restored:result.restored,unchanged:result.unchanged,conflicts:result.conflicts},{restored:1,unchanged:0,conflicts:0});
 const note=plugin.app.vault.getAbstractFileByPath('Bryte Mentorship/Notes/books/Revitalize - Chapters 1-3.md');
 assert(note instanceof TFile,'root-level repo notes should restore despite object-shaped 404s from missing prefixed paths');
 assert.strictEqual(note.content,remoteBook);
 console.log('private repo root-note restore tests passed');
})().catch(error=>{console.error(error);process.exit(1)});
