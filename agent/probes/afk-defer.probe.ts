/**
 * WHY THE AFK PROMPT NEVER APPEARED.
 *
 * Replays real absences against the OLD rule (overlap >= 10 min) and the NEW
 * rule (the WHOLE absence is inside bedtime), and asserts the AFK prompt is
 * raised in every case except a genuine night.
 */
const store: Record<string,string> = {};
(globalThis as any).localStorage = {
  getItem:(k:string)=> k in store ? store[k] : null,
  setItem:(k:string,v:string)=>{ store[k]=String(v); },
  removeItem:(k:string)=>{ delete store[k]; },
};
(globalThis as any).window = { dispatchEvent:()=>{}, addEventListener:()=>{}, deskflowAPI: undefined };
(globalThis as any).CustomEvent = class { constructor(public type:string, public init?:any){} };

import { shouldDeferToSleep, setSleepWindow } from '../../src/lib/sleepWindow';
import { classifyGap, AFK_DEFER_TO_SLEEP_MINUTES } from '../../src/shared/sleepWindow';

setSleepWindow({ enabled: true, startHour: 22, endHour: 7 });

const OLD = (s:number,e:number) =>
  classifyGap(22,7,s,e,AFK_DEFER_TO_SLEEP_MINUTES).verdict === 'sleep';

const at = (d:number,h:number,m=0)=> new Date(2026,9,d,h,m).getTime();

const cases = [
  { label:'2h away 21:30 -> 23:30  (THE REPORTED BUG)',        s:at(3,21,30), e:at(3,23,30), wantDefer:false },
  { label:'2h away 20:00 -> 22:00  (ends exactly at bedtime)',s:at(3,20,0),  e:at(3,22,0),  wantDefer:false },
  { label:'90m away 22:30 -> 00:00 (inside bedtime, too short to trust)', s:at(3,22,30), e:at(4,0,0), wantDefer:false },
  { label:'3h away 23:00 -> 02:00 (all bedtime)',             s:at(3,23,0),  e:at(4,2,0),   wantDefer:true  },
  { label:'8h overnight 23:00 -> 07:00 (a real night)',       s:at(3,23,0),  e:at(4,7,0),   wantDefer:true  },
  { label:'9h overnight 22:30 -> 07:30 (a real night)',       s:at(3,22,30), e:at(4,7,30),  wantDefer:true  },
  { label:'2h lunch 12:30 -> 14:30',                           s:at(3,12,30), e:at(3,14,30), wantDefer:false },
  { label:'20m bathroom 23:40 -> 00:00',                       s:at(3,23,40), e:at(4,0,0),   wantDefer:false },
  { label:'5h away 09:00 -> 14:00 (daytime)',                  s:at(3,9,0),   e:at(3,14,0),  wantDefer:false },
];

let fails=0;
console.log('absence'.padEnd(50)+'old'.padStart(7)+'new'.padStart(7)+'  AFK prompt?');
console.log('-'.repeat(88));
for (const c of cases) {
  const oldD = OLD(c.s,c.e);
  const newD = shouldDeferToSleep(c.s,c.e);
  const shows = !newD;
  const ok = newD === c.wantDefer;
  if(!ok) fails++;
  if(oldD && !newD) console.log('   ^^ old rule SWALLOWED this prompt');
  console.log(
    c.label.padEnd(50)
    + (oldD?'defer':'ASK').padStart(7)
    + (newD?'defer':'ASK').padStart(7)
    + `  ${shows?'SHOWN':'silent'} ${ok?'PASS':'FAIL want '+(c.wantDefer?'defer':'ASK')}`
  );
}

console.log(`\nRESULT: ${fails===0?'ALL PASS':fails+' FAILURE(S)'}`);
process.exit(fails===0?0:1);
