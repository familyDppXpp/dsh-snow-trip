import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saveTurnDefinition as saves} from '../src/package-turns.js';
test('提交卡片在同一 callId 从运行更新为结果，失败与下一轮不串卡片',()=>{
 let state=saves.start(null,{event:{data:{turn:2}}});
 const apply=event=>{state=saves.update({state},{event});};
 apply({type:'tool/call',data:{name:'snow_commit',callId:'one'}});
 assert.deepEqual(state.items,[{callId:'one'}]);
 apply({type:'tool/result',data:{message:{source:{callId:'one'},content:[{isError:true,content:[{type:'text',text:'版本冲突'}]}]}}});
 assert.equal(state.items.length,1);assert.equal(state.items[0].error,'版本冲突');
 assert.equal(saves.buildLocationData({state},'turn').turn,2);
 assert.deepEqual(saves.start(null,{event:{data:{turn:3}}}).items,[]);
});
