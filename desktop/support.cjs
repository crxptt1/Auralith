const base='https://www.paypal.com/paypalme/piotrkolodz';
const allowed=new Set(['https://ko-fi.com/piotrkolodz',base,...['10PLN','25PLN','50PLN','3USD','8USD','15USD'].map(amount=>`${base}/${amount}`)]);
function validateSupportUrl(url){if(typeof url!=='string'||!allowed.has(url))throw new Error('Unsupported support link.');return url;}
module.exports={validateSupportUrl};
