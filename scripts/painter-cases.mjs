export function painterCases(examples){
  const grid=(n,stack=false)=>({name:stack?'Two depth layers':'Separated spheres',atoms:Array.from({length:n*n*(stack?2:1)},(_,i)=>({element:i%3?'C':'O',radius:.76,position:[(i%n-(n-1)/2)*1.8,(Math.floor(i/n)%n-(n-1)/2)*1.8,stack?(Math.floor(i/(n*n))?2.5:-2.5):0]})),bonds:[]});
  return [
    {name:'sphere',model:examples.sphere},
    {name:'overlap-separated',model:{atoms:[{element:'C',position:[0,0,-2],radius:1},{element:'O',position:[.4,0,2],radius:1}],bonds:[]}},
    {name:'nested-unequal',model:{atoms:[{element:'C',position:[0,0,0],radius:2},{element:'O',position:[.2,0,.8],radius:.5}],bonds:[]}},
    {name:'front-crossing',model:{atoms:[{element:'C',position:[0,0,0],radius:1},{element:'O',position:[.7,0,.25],radius:1}],bonds:[]}},
    {name:'grid-64',model:grid(8)},
    {name:'stack-32',model:grid(4,true)},
    {name:'ethanol-original',model:examples.ethanol},
    {name:'c60-original',model:examples.c60},
    {name:'c60-atoms-only',model:{...examples.c60,name:'C60 atoms only (explicit experimental fixture)',bonds:[]}}
  ];
}
