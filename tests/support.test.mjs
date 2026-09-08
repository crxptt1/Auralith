import test from 'node:test';
import assert from 'node:assert/strict';
import support from '../desktop/support.cjs';
test('support links allow only the creator and specified amounts',()=>{
 for(const suffix of ['', '/10PLN','/25PLN','/50PLN','/3USD','/8USD','/15USD'])assert.equal(support.validateSupportUrl(`https://www.paypal.com/paypalme/piotrkolodz${suffix}`),`https://www.paypal.com/paypalme/piotrkolodz${suffix}`);
 assert.equal(support.validateSupportUrl('https://ko-fi.com/piotrkolodz'),'https://ko-fi.com/piotrkolodz');
 for(const url of ['javascript:alert(1)','https://evil.test','https://ko-fi.com/piotrkolodz?redirect=evil','https://www.paypal.com/paypalme/other/25PLN',null])assert.throws(()=>support.validateSupportUrl(url));
});
