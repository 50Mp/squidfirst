/** Local design-preview arithmetic only; checkout prices always come from the API. */
export function previewLakForUsd(usd:string,rate:string):string|null{
 if(!/^\d{1,7}(?:\.\d{1,2})?$/.test(usd)||!/^\d{1,12}(?:\.\d{1,6})?$/.test(rate))return null;
 const [whole,fraction='']=usd.split('.'),[rateWhole,rateFraction='']=rate.split('.');
 const cents=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
 const multiplier=BigInt(rateWhole+rateFraction),scale=10n**BigInt(rateFraction.length);
 if(multiplier===0n)return null;
 const lakCents=(cents*multiplier+scale/2n)/scale;
 return(lakCents/100n).toLocaleString('en-US')+'.'+String(lakCents%100n).padStart(2,'0');
}
