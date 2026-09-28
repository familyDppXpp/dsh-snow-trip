// 合成数据覆盖工具传输中的字符串标量、单项/多项 item 包装与嵌套列表。
const cost={label:'交通',amount:'30000',basis:'用户确认前的估算'};
const combo={title:'测试方案',start:'2027-02-06',nights:'7',total:'212000',paid:'60000',pending:'152000',budget:'220000',estimated:'false',switches:'0',daily:{item:{date:'2027-02-06',hotel:'测试酒店',amount:'30000',basis:'分摊'}},sharedCosts:{item:cost},allocation:{item:'按间夜分摊'},checks:{item:'已核对'},unknowns:{item:'实时有房'}};
export const wireStages={
  confirm:{input:{nights:'7'},ids:{item:'p1'},packages:{item:{id:'p1',name:'测试套餐',nights:'7',splitAllowed:'false',completeness:'complete'}}},
  estimate:{start:'2027-02-06',nights:'7',suggested:{start:'false',nights:'true'},estimates:{item:cost},scope:'整趟交通'},
  results:{results:{item:combo},selected:{item:'0'}},
  discussion:{results:{item:[combo,{...combo,title:'另一方案'}]},selected:{item:['0','1']}},
  review:{plan:{...combo,packages:{item:{id:'p1'}}}},
  status:{notice:{title:'部分保存失败',text:'保留已成功项',actions:{item:{label:'处理失败项',value:'adjust'}}}},
};
export const brokenEstimate={start:'2027-02-06',nights:'7',suggested:{item:{label:'餐饮',amount:'350000',note:'餐饮估算依据'}},item:[{label:'雪票',amount:'400000',note:'雪票估算依据'}],$text:'仅估算共同费用'};
export const pendingStage=(stage,detail,key='wire')=>({questions:[{id:`snow-plan-${stage}-${key}`,question:'请确认',detail:JSON.stringify({...detail,stage,key})}],answer:async()=>{}});
