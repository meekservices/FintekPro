const fs = require('fs');
const file = 'shared/schema.ts';
let content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

const extStart = lines.findIndex(l => l.includes('export const externalHoldings = pgTable'));
const extEndReal = lines.findIndex((l, i) => i > extStart && l.includes(']);')) + 1;

const ppfStart = lines.findIndex(l => l.includes('export const ppfHoldings = '));
const ppfEnd = lines.findIndex((l, i) => i > ppfStart && l.startsWith('});')) + 1;

const epsStart = lines.findIndex(l => l.includes('export const epsHoldings = '));
const epsEnd = lines.findIndex((l, i) => i > epsStart && l.startsWith('});')) + 1;

const npsStart = lines.findIndex(l => l.includes('export const npsAccounts = '));
const npsEnd = lines.findIndex((l, i) => i > npsStart && l.startsWith('});')) + 1;

const apyStart = lines.findIndex(l => l.includes('export const apyAccounts = '));
const apyEnd = lines.findIndex((l, i) => i > apyStart && l.startsWith('});')) + 1;

const typesStart = lines.findIndex(l => l.includes('// PPF Holdings types'));
const typesEnd = lines.findIndex((l, i) => i > typesStart && l.includes('export const insertApyAccountSchema = '));
const typesEndReal = lines.findIndex((l, i) => i > typesEnd && l.startsWith('});')) + 1;


const indicesToRemove = new Set();
for (let i = extStart - 1; i <= extEndReal; i++) indicesToRemove.add(i);
for (let i = ppfStart - 1; i <= ppfEnd; i++) indicesToRemove.add(i);
for (let i = epsStart - 2; i <= epsEnd; i++) indicesToRemove.add(i); // include comment
for (let i = npsStart - 2; i <= npsEnd; i++) indicesToRemove.add(i);
for (let i = apyStart - 2; i <= apyEnd; i++) indicesToRemove.add(i);
for (let i = typesStart - 1; i <= typesEndReal; i++) indicesToRemove.add(i);

const toKeep = lines.filter((_, i) => !indicesToRemove.has(i));
fs.writeFileSync(file, toKeep.join('\n'));
console.log('Removed successfully.');
