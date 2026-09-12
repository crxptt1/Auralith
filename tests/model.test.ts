import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createProject,parseScript,validateProject,migrateProject,applyMode,findRepeatedLines,personalizeScript,duplicateProject,shouldReplaceTemplateScript} from '../src/model.ts';

test('only an untouched mode template is replaced by an imported script',()=>{
 const template=createProject('Import','forced-spell');
 assert.equal(shouldReplaceTemplateScript(template),true);
 template.script[0].text='Mój własny tekst';
 assert.equal(shouldReplaceTemplateScript(template),false);
});

test('a project round-trips without losing Unicode script or mode',()=>{
  const p=createProject('Mój spokojny głos','spell');
  const restored=validateProject(JSON.parse(JSON.stringify(p)));
  assert.equal(restored.name,p.name); assert.equal(restored.mode,'spell');
  assert.equal(restored.duration,180); assert.ok(restored.script.length>0);
});
test('script section headers select roles and are never spoken',()=>{
  const lines=parseScript('[A]\nJestem spokojny.\n\nWARSTWA B — coaching\nOddychaj spokojnie.\n[C]\nWyobraź sobie ciszę.');
  assert.deepEqual(lines.map(l=>l.role),['A','B','C']);
  assert.equal(lines[1].text,'Oddychaj spokojnie.');
});
test('legacy project preserves text and mix duration without pretending buffers survived',()=>{
  const p=migrateProject({id:'aim_v01',lines:[{text:'Rozluźniam dłoń',layer:'B'}],mix:{durationS:300,targetLufs:-24}});
  assert.equal(p.name,'aim_v01');assert.equal(p.script[0].role,'B');assert.equal(p.duration,300);assert.deepEqual(p.layers,[]);
});
test('invalid duration, gain and unbounded text are rejected',()=>{
  const p=createProject('Test','classic');
  assert.throws(()=>validateProject({...p,duration:Infinity}));
  assert.throws(()=>validateProject({...p,duration:-1}));
  assert.throws(()=>validateProject({...p,name:'x'.repeat(201)}));
  assert.throws(()=>validateProject({...p,layers:[{id:'x',gainDb:NaN}]}));
});
test('switching mode keeps user-authored script and only changes mode',()=>{
  const p=createProject('Test','classic');p.script=[{id:'custom',text:'Mój własny tekst',role:'C'}];
  const changed=applyMode(p,'forced');
  assert.deepEqual(changed.script,p.script);assert.equal(changed.mode,'forced');
});
test('duplicate detection ignores punctuation and case without changing text',()=>{
 const lines=parseScript('Jestem spokojny.\njestem spokojny!\nOddycham swobodnie.');
 assert.deepEqual(findRepeatedLines(lines),[lines[1].id]);
 assert.equal(lines[1].text,'jestem spokojny!');
});
test('personalization only replaces explicit name placeholders',()=>{
 const lines=parseScript('Cześć, {imię}.\n{name}, skup się.\nPiotr skupia się.');
 const personalized=personalizeScript(lines,'Ola');
 assert.deepEqual(personalized.map(l=>l.text),['Cześć, Ola.','Ola, skup się.','Piotr skupia się.']);
});
test('duplicating creates a new project with same media and no old export results',()=>{
 const p=createProject('Moja formuła','forced');const copy=duplicateProject(p);
 assert.notEqual(copy.id,p.id);assert.equal(copy.mode,'forced');assert.deepEqual(copy.script.map(l=>l.text),p.script.map(l=>l.text));
 assert.deepEqual(copy.exports,[]);assert.ok(copy.name.includes('copy'));
});
test('malformed import dates are rejected before project cards render',()=>{
 const p=createProject('Import');
 for(const updatedAt of ['not-a-date','',undefined])assert.throws(()=>validateProject({...p,updatedAt}));
 assert.throws(()=>validateProject({...p,createdAt:null}));
});
test('comparison results preserve ten integer votes and source ids',()=>{
 const p=createProject('Porównanie');
 const comparison={id:'compare',createdAt:new Date().toISOString(),firstId:'one',secondId:'two',firstVotes:6,secondVotes:3,ties:1};
 assert.deepEqual(validateProject({...p,comparisons:[comparison]}).comparisons,[comparison]);
 assert.throws(()=>validateProject({...p,comparisons:[{...comparison,ties:2}]}));
 assert.throws(()=>validateProject({...p,comparisons:[{...comparison,firstVotes:6.5,secondVotes:2.5}]}));
});
