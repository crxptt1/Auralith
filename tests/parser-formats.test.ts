import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseScript} from '../src/model.ts';
const pairs=(text:string)=>parseScript(text).map(({role,text})=>[role,text]);
test('case-insensitive inline roles preserve affirmation content',()=>{
 assert.deepEqual(pairs('a) Jestem.\nb) Działam.\nc) Widzę.\nA: One\nb| Two\n[C] Three'),[['A','Jestem.'],['B','Działam.'],['C','Widzę.'],['A','One'],['B','Two'],['C','Three']]);
});
test('named English and Polish sections assign subsequent list items',()=>{
 assert.deepEqual(pairs('# Identity\n- I am.\n## Intention\n1. I act.\n### Imagination\n* I see.\n## Tożsamość\n+ Jestem.\n## Intencja\n2) Działam.\n## Wyobrażenie\n• Widzę.'),[['A','I am.'],['B','I act.'],['C','I see.'],['A','Jestem.'],['B','Działam.'],['C','Widzę.']]);
});
test('explicit sections persist while inline role overrides apply to one line',()=>{
 assert.deepEqual(pairs('[b]\nFirst\n[A] Second\nThird\nC:\nFourth\n- a) Fifth'),[['B','First'],['A','Second'],['B','Third'],['C','Fourth'],['A','Fifth']]);
});
test('markdown role tables consume only structural cells',()=>{
 assert.deepEqual(pairs('| Role | Affirmation |\n| :--- | ---: |\n| A | I am. |\n| intention | I act \\| calmly. |\n| c | I see. |'),[['A','I am.'],['B','I act | calmly.'],['C','I see.']]);
});
test('unmarked prose is preserved without inferring its role',()=>{
 assert.deepEqual(pairs('I imagine peace.\nA beautiful day\nIdentity matters.\n[B] My **exact** words: 1 + 2.'),[['A','I imagine peace.'],['A','A beautiful day'],['A','Identity matters.'],['B','My **exact** words: 1 + 2.']]);
});
test('markdown document headings and dividers are not spoken',()=>{
 assert.deepEqual(pairs('# My session\n---\n## B — Intention\n- B: Focus.\n## Wyobraźnia\n1. See light.\n```txt\n[C] Stay.\n```'),[['B','Focus.'],['C','See light.'],['C','Stay.']]);
});
test('blank input stays empty and imports retain the 500 line limit',()=>{
 assert.deepEqual(parseScript(' \r\n'),[]);assert.equal(parseScript(Array(510).fill('a) Text').join('\n')).length,500);
});
test('inline pipe markers preserve literal punctuation and spacing in the text',()=>{
 assert.deepEqual(pairs('B| Stay |exactly| here.\n[A] Keep  two spaces.'),[['B','Stay |exactly| here.'],['A','Keep  two spaces.']]);
});
