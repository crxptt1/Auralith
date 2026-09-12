import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildWaveformEnvelope} from '../src/components/Waveform';

test('waveform envelope smooths narrow peaks without losing the real contour',()=>{
 const envelope=buildWaveformEnvelope([0.1,1,0.1],3);
 assert.equal(envelope.length,3);
 assert.ok(envelope[1]>envelope[0]);
 assert.ok(envelope[1]<1,'a single pixel peak should not become a chunky full-height block');
 assert.ok(envelope[1]>.4,'the peak must remain visible');
});

test('waveform envelope stays bounded for empty or invalid dimensions',()=>{
 assert.deepEqual(buildWaveformEnvelope([],12),Array(12).fill(0));
 assert.deepEqual(buildWaveformEnvelope([1,0],0),[]);
});
