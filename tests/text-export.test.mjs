import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseTextExportContent} from '../desktop/text-export.cjs';

const content={markdown:'## Identity\n\n- I am calm.\n',plain:'A: I am calm.\r\n'};

test('text export follows the selected Markdown or TXT extension',()=>{
  assert.equal(chooseTextExportContent(content,'script.md'),content.markdown);
  assert.equal(chooseTextExportContent(content,'script.txt'),content.plain);
});

test('text export rejects unsupported extensions',()=>{
  assert.throws(()=>chooseTextExportContent(content,'script.rtf'),/MD lub TXT/);
});
