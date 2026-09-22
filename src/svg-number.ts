// Exact legacy round-to-three-decimals serialization in the normal SVG range.
// Integer conversion avoids repeatedly formatting a fractional binary double.
// This table is module-private and independent of scenes, callbacks and options.
const tails=[''];
for(let i=1;i<1000;i++)tails[i]='.'+(i%100===0?String(i/100):i%10===0?('0'+i/10).slice(-2):('00'+i).slice(-3));
export function rounded3(value:number):string {
  const n=Math.round(value*1000);
  // Below one million SVG units, every integer thousandth has exactly the same
  // shortest decimal spelling as n/1000. Keep native formatting for extremes,
  // non-finite values, exponential notation and coarser floating-point spacing.
  if(!(n>-1e9&&n<1e9))return String(n/1000);
  if(n<0){const a=-n;return '-'+Math.floor(a/1000)+tails[a%1000];}
  return Math.floor(n/1000)+tails[n%1000];
}
