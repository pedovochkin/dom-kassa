import assert from 'node:assert/strict';
import {DEFAULT_CONFIG,feeFor,summarize} from '../src/accounting.ts';
const data={config:DEFAULT_CONFIG,payments:[],expenses:[],reminders:[],sheets:{connected:true}};
assert.equal(feeFor(DEFAULT_CONFIG,'91'),100000);assert.equal(feeFor(DEFAULT_CONFIG,'87'),110000);assert.equal(feeFor(DEFAULT_CONFIG,'65'),130000);
assert.equal(summarize(data,'2026-10').expected,4110000);
data.payments=[{id:'a',month:'2026-10',apartment:'91',amountCents:100000,createdAt:''},{id:'b',month:'2026-10',apartment:'87',amountCents:50000,createdAt:''},{id:'c',month:'2026-10',apartment:'65',amountCents:150000,createdAt:''}];
let s=summarize(data,'2026-10');assert.equal(s.rows.find(r=>r.apartment==='91').status,'paid');assert.equal(s.rows.find(r=>r.apartment==='87').due,60000);assert.equal(s.rows.find(r=>r.apartment==='65').over,20000);assert.equal(s.bank,300000);
data.config={...DEFAULT_CONFIG,fees:{...DEFAULT_CONFIG.fees,'87':120000}};s=summarize(data,'2026-10');assert.equal(s.rows.find(r=>r.apartment==='87').due,70000);assert.equal(s.expected,4120000);
console.log('Accounting: individual fees, 41,100 ₽ plan, partial/over payments, configurable tariffs passed.');
