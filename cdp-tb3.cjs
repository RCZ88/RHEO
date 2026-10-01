const WebSocket=require('ws');
const sock=new WebSocket(process.argv[2]);
let id=0;const pend=new Map();
const send=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);sock.send(JSON.stringify({id:i,method:m,params:p}));});
const READ=`(()=>{const inner=document.querySelector('[data-titlebar-drag="true"]');if(!inner)return JSON.stringify({err:'no bar'});
 const wrap=inner.closest('.shrink-0.overflow-hidden');const app=document.querySelector('.flex.flex-1.min-h-0');
 return JSON.stringify({wrapH:wrap?Math.round(wrap.getBoundingClientRect().height):null,
   appTop:app?Math.round(app.getBoundingClientRect().top):null,appH:app?Math.round(app.getBoundingClientRect().height):null});})()`;
const g=v=>{try{return JSON.parse(v.result.result.value)}catch{return v}};
sock.on('open',async()=>{
 await send('Runtime.evaluate',{expression:`window.deskflowAPI.setTitleBarMode('hover')`,awaitPromise:true});
 await new Promise(r=>setTimeout(r,400));
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:900,y:12});
 await new Promise(r=>setTimeout(r,300));
 const shown=g(await send('Runtime.evaluate',{expression:READ,returnByValue:true}));
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:900,y:700});
 await new Promise(r=>setTimeout(r,900));
 const hidden=g(await send('Runtime.evaluate',{expression:READ,returnByValue:true}));
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:900,y:11});
 await new Promise(r=>setTimeout(s=>0,0)); await new Promise(r=>setTimeout(r,700));
 const back=g(await send('Runtime.evaluate',{expression:READ,returnByValue:true}));
 console.log(JSON.stringify({mode:'hover',SHOWN:shown,HIDDEN:hidden,HOVER_BACK:back},null,1));
 sock.close();process.exit(0);
});
sock.on('message',d=>{const m=JSON.parse(d);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}});
sock.on('error',e=>{console.log('ERR',e.message);process.exit(1);});
