import { hourInSleepWindow, classifyGap, sleepWindowOverlapMinutes } from '../../src/shared/sleepWindow';
// A night owl who sets 01:00 -> 09:00 instead of the 22:00 -> 07:00 default.
const S = 1, E = 9;
const at = (h: number, m = 0) => new Date(2026, 9, 4, h, m).getTime();
console.log('window 01:00 -> 09:00');
for (const h of [0, 1, 5, 9, 12, 20, 23]) {
  console.log(`  ${String(h).padStart(2,'0')}:00 inside=${hourInSleepWindow(h,S,E)}`);
}
console.log('\nreturn at 23:00 (OLD code said true, was wrong for this user):');
console.log('  old `hour>=21||hour<10` ->', 23 >= 21 || 23 < 10);
console.log('  configured window      ->', hourInSleepWindow(23, S, E));
console.log('\nreturn at 07:30 after a 7h absence (both should agree it is sleep):');
const gap = sleepWindowOverlapMinutes(S, E, at(0,30), at(7,30));
console.log(`  overlap=${gap}min verdict=${classifyGap(S,E,at(0,30),at(7,30)).verdict}`);
