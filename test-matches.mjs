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
  for (const [required,expected] of [['PhD in Computer Science',false],['5 years of experience using Python or Java',false],["Bachelor’s, Master’s or PhD in computing",true],['1 year of experience',true]]) assert.equal(isEligible({title:'Engineer',required:[required],preferred:['PhD']}),expected,required);
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
    assert.match(html,/data-job-id="101">Résumé match · Private/);
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
  async function open(hash,scan=checkedAt) {
    const badge = {dataset:{jobId:'101'},textContent:'Private'}, note={}, tab={};
    let requests=0;
    await vm.runInNewContext(script,{location:{hash,pathname:'/jobs.html',search:''},history:{replaceState(){}},document:{
      getElementById:id=>id==='match-note'?note:id==='scan'?{dataset:{checked:scan}}:tab,
      querySelectorAll:()=>[badge]},crypto:webcrypto,fetch:async url=>{assert.equal(url,'matches.json'); requests++; return {ok:true,json:async()=>box};},TextDecoder,URLSearchParams,atob});
    return {badge,note,requests,tab};
  }
  assert.equal((await open('')).requests,0);
  const unlocked=await open('#matches='+key);
  assert.equal(unlocked.badge.dataset.tier,'Strong');
  assert.ok(unlocked.tab.hash.startsWith('matches='));
  assert.equal((await open('#matches='+key,'different')).badge.textContent,'Private');
  assert.equal((await open('#matches='+'A'.repeat(43))).badge.textContent,'Private');
});
