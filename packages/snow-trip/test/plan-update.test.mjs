import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const compiled=await build({entryPoints:['src/server/plan-update.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {packageChanges,updatePreview}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const snapshot={id:'p',revision:1,name:'禾木套餐',resort:'禾木',region:'禾木',paid:10000};
const old={id:'a',title:'行程',start:'2027-01-01',nights:2,total:10000,paid:null,pending:null,budget:null,items:[{packageId:'p',revision:1,start:'2027-01-01',nights:2}],packages:[{id:'p',revision:1,snapshot}],daily:[],sharedCosts:[],estimates:[],conditions:{rooms:1,people:2,fees:[]},tracking:{booking:'confirmed',refund:'refundable',refundPolicy:'出发前可退'}};
test('套餐名称修正自动识别，保留标签；费用变化要求重新核算',()=>{
 const renamed={...snapshot,revision:2,resort:'吉克普林',updatedAt:'later'};
 const changes=packageChanges(old,[renamed]);
 assert.equal(changes.requiresCalculation,false);assert.equal(changes.rows.length,1);
 assert.match(changes.rows[0].label,/雪场/);assert.equal(changes.rows[0].after,'吉克普林');
 const next={...old,packages:[{id:'p',revision:2,snapshot:renamed}],items:old.items.map(i=>({...i,revision:2}))};
 const preview=updatePreview(old,next);assert.equal(preview.resetTracking,false);assert.deepEqual(preview.plan.tracking,old.tracking);
 assert.equal(packageChanges(old,[{...renamed,paid:12000}]).requiresCalculation,true);
 assert.equal(packageChanges(old,[]).requiresCalculation,true);
});
test('实际行程变化清空标签；未知金额不当零，单纯费用变动保留标签',()=>{
 const changed=updatePreview(old,{...old,total:12000});assert.equal(changed.resetTracking,false);
 assert.match(changed.rows.find(r=>r.label==='整趟总成本').after,/120/);
 assert.equal(updatePreview(old,{...old,items:[{...old.items[0],nights:1},{...old.items[0],start:'2027-01-02',nights:1}]}).resetTracking,false,'同一套餐连续住宿拆分核算段不改变实际行程');
 const moved=updatePreview(old,{...old,conditions:{...old.conditions,people:3}});
 assert.equal(moved.resetTracking,true);assert.deepEqual(moved.plan.tracking,{booking:null,refund:null,refundPolicy:null});
 assert.equal(updatePreview(old,{...old,items:[{...old.items[0],packageId:'other'}]}).resetTracking,true);
 const fees=updatePreview({...old,sharedCosts:[{label:'餐饮',amount:100,basis:'旧'}]},{...old,sharedCosts:[{label:'交通',amount:200,basis:'新'}]}).rows;
 assert.ok(fees.some(r=>r.label==='共同费用 · 餐饮（删除）'&&r.after==='无'));assert.ok(fees.some(r=>r.label==='共同费用 · 交通（新增）'&&r.before==='无'));
 assert.equal(updatePreview(old,{...old,total:null}).rows.find(r=>r.label==='整趟总成本').after,'未知');
});
