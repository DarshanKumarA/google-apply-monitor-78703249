import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {webcrypto} from 'node:crypto';
import {isEligible} from './eligibility.mjs';
import {publishFolders} from './render-jobs.mjs';

test('filters hard requirements without treating preference or title substrings as seniority', () => {
  for (const title of ['Staff Engineer','Principal Designer','Silicon Design Lead','Sr. Engineer','Director, Sales','Engineer II','Engineer V','Intern, Ph.D.','Postdoctoral Researcher']) assert.equal(isEligible({title}),false,title);
  for (const title of ['Engineer I','Staffing Associate','Lead Generation Associate','Student Researcher, BS/MS']) assert.equal(isEligible({title}),true,title);
  for (const [required,expected] of [['PhD in Computer Science',false],['5 years of experience using Python or Java',false],["Bachelor’s, Master’s or PhD in computing",true],['1 year of experience',true], ['Experience: at least two years in SQL',false],['18 months using Java',false],['2–4 years of experience',false],['12 months of development',true],['1–2 years of experience',true],['A four-year undergraduate degree',true],['Master’s degree in CS',false],['MBA or PhD',false],['BS/MS in computer science',true],['2 years with BS or 1 year with MS',false],['2 years with MS or 1 year with BS',true],['1 year and 6 months in Python',false],['Over a year of work',false],['two (2) years of experience',false]]) assert.equal(isEligible({title:'Engineer',required:[required],preferred:['PhD','3 years of experience']}),expected,required);
});

test('private launch decrypts the matching scan on either folder; public, stale and invalid launches do not reveal tiers', async t => {
  const dir = fs.mkdtempSync(path.join(tmpdir(),'tracker-regression-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const pub = path.join(dir,'public');
  fs.mkdirSync(pub); fs.mkdirSync(path.join(dir,'matchroom'));
  const checkedAt = '2026-11-25T01:00:00Z';
  const job = {id:'101',title:'Engineer I',location:'India'};
  publishFolders({checkedAt, initial:[job],newOpenings:[job]}, pub);
  for (const name of ['jobs.html','jobs-archive.html']) {
    const html = fs.readFileSync(path.join(pub,name),'utf8');
    assert.match(html,/data-job-id="101" hidden/);
    assert.match(html,/No numeric experience minimum stated/);
    assert.ok(!html.includes('matches='));
  }
  const seal = () => execFileSync(process.execPath,[fileURLToPath(new URL('./seal-matches.mjs',import.meta.url))],{cwd:dir,input:JSON.stringify({checkedAt,tiers:{101:'Strong'}})});
  seal();
  const key = fs.readFileSync(path.join(dir,'matchroom','.match-key'),'utf8');
  const previous = fs.readFileSync(path.join(pub,'matches.json'),'utf8');
  seal();
  const box = JSON.parse(fs.readFileSync(path.join(pub,'matches.json'),'utf8'));
  assert.notEqual(JSON.parse(previous).iv,box.iv);
  assert.ok(!JSON.stringify(box).includes('Strong'));
  const script = fs.readFileSync(new URL('./public/jobs-matches.js',import.meta.url),'utf8');
  let saved;
  async function open(hash,scan=checkedAt) {
    const badge = {dataset:{jobId:'101'},textContent:'Private'}, note={}, tab={},remember={hidden:true},forget={hidden:true};
    let requests=0;
    const indexedDB={open(){const request={result:{close(){},transaction(){const tx={objectStore(){return {get:()=>({result:saved}),put:key=>{saved=structuredClone(key);return {};},delete:()=>{saved=null;return {};}}}};queueMicrotask(()=>tx.oncomplete());return tx;}}};queueMicrotask(()=>request.onsuccess());return request;}};
    await vm.runInNewContext(script,{indexedDB,location:{hash,pathname:'/jobs.html',search:'',reload(){}},history:{replaceState(){}},document:{
      getElementById:id=>id==='remember-matches'?remember:id==='forget-matches'?forget:id==='match-note'?note:id==='scan'?{dataset:{checked:scan}}:tab,
      querySelectorAll:()=>[badge]},crypto:webcrypto,fetch:async url=>{assert.equal(url,'matches.json'); requests++; return {ok:true,json:async()=>box};},TextDecoder,URLSearchParams,atob});
    return {badge,note,requests,tab,remember,forget};
  }
  assert.equal((await open('')).requests,0);
  const unlocked=await open('#matches='+key);
  assert.equal(unlocked.badge.dataset.tier,'Strong');
  assert.ok(unlocked.tab.hash.startsWith('matches='));
  assert.equal((await open('#matches='+key,'different')).badge.textContent,'Private');
  assert.equal((await open('#matches='+'A'.repeat(43))).badge.textContent,'Private');
  assert.equal(saved,undefined);
  await unlocked.remember.onclick();
  assert.equal(saved.extractable,false);
  const revisit=await open('');
  assert.equal(revisit.badge.dataset.tier,'Strong');
  await revisit.forget.onclick();
  assert.equal((await open('')).requests,0);
});
