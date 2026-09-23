export const fields = { id: '编号', name: '套餐名称', hotel: '酒店', nights: '住宿晚数', paid: '订单金额（元）', status: '状态', room: '已购房型', validity: '有效期', resort: '雪场' };
const aliases = { id: ['编号','套餐编号','订单编号'], name: ['套餐名称','产品名称','商品名称'], hotel: ['酒店','酒店名称'], nights: ['住宿晚数','住宿间夜','晚数'], paid: ['订单金额（元）','实付金额（元）','订单合计（元）','金额'], status: ['状态','订单状态'], room: ['已购房型','房型'], validity: ['有效期','可入住期'], resort: ['雪场','雪场名称'] };
export const text = v => v == null ? '' : String(v).trim();
export function money(v) {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null;
  const s = text(v).replace(/[,，¥￥\s]/g, '');
  return /^\d+(\.\d{1,2})?$/.test(s) && Number.isFinite(Number(s)) ? Number(s) : null;
}
export function date(v) {
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s|T|$)/.exec(text(v));
  if (!m) return null;
  const iso = `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  const d = new Date(iso+'T00:00:00Z');
  return Number.isFinite(+d) && d.toISOString().slice(0,10) === iso ? iso : null;
}
export const plusDays = (iso, n) => new Date(Date.parse(iso+'T00:00:00Z') + n*86400000).toISOString().slice(0,10);
export function detect(sheets) {
  let best = null;
  for (const sheet of sheets) for (const row of sheet.rows.slice(0,40)) {
    const mapping = Object.fromEntries(Object.keys(fields).map(k => [k, row.cells.findIndex(v => aliases[k].includes(text(v)))]));
    const score = Object.values(mapping).filter(n => n >= 0).length;
    if (!best || score > best.score) best = { sheet: sheet.name, row: row.number, mapping, score };
  }
  return best;
}
export async function readWorkbook(bytes, fileName) {
  if (bytes.byteLength > 25*1024*1024) throw new Error('文件超过 25 MB，请删除无关大图后再导入。');
  const XLSX = await import('xlsx');
  const book = XLSX.read(bytes, { type:'array', cellDates:true, cellFormula:false });
  const sheets = [];
  let count = 0;
  for (const name of book.SheetNames) {
    const ws=book.Sheets[name];
    const rows = [];
    const range=XLSX.utils.decode_range(ws['!ref']||'A1');
    if(range.e.r>15000||range.e.c>=100) throw new Error('表格超过 15,000 行或 100 列，请拆分后导入。');
    for(let r=range.s.r;r<=range.e.r;r++) {
      if (++count > 15000) throw new Error('工作簿超过 15,000 行，请拆分后导入。');
      const cells = [];
      for(let c=0;c<=range.e.c;c++) {
        const v=ws[XLSX.utils.encode_cell({r,c})]?.v;
        cells[c]=v instanceof Date?v.toISOString().slice(0,10):v??null;
      }
      if (cells.some(v=>v!=null && v!=='')) rows.push({ number:r+1, cells });
    }
    sheets.push({ name, rows });
  }
  if (!sheets.some(s=>s.rows.length)) throw new Error('工作簿中没有可读取的数据。');
  return { fileName, importedAt: new Date().toISOString(), sheets };
}
const sourceOf = (sheet, row) => `${sheet}!第${row}行`;
function detailsFor(sheets, id, mainSheet) {
  return sheets.filter(s => s.name !== mainSheet && new RegExp(`^${id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?:\\D|$)`).test(s.name));
}
function pairs(sheets) {
  return sheets.flatMap(s => s.rows.flatMap(r => {
    const c=r.cells;
    // 三列“套餐编号、记录项、详情”与两列“字段、内容”都保留源行。
    const offset = /^\d{3}$/.test(text(c[0])) && c[2] != null ? 1 : 0;
    return typeof c[offset] === 'string' && c[offset+1]!=null ? [{key:c[offset],value:c[offset+1],source:sourceOf(s.name,r.number)}] : [];
  }));
}
function rangeText(value) {
  const m = /^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})至(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})$/.exec(text(value));
  return m && date(m[1]) && date(m[2]) ? [date(m[1]),date(m[2])] : null;
}
function extractRules(sheets, p) {
  const rules=[], blocked=[];
  for (const sheet of sheets) {
    let headers=[];
    for (const row of sheet.rows) {
      const c=row.cells.map(text);
      if (c.some(x=>/^(?:加价)?开始日期$/.test(x)) && c.some(x=>/^(?:加价)?结束日期$/.test(x))) { headers=c; continue; }
      const startIndex=headers.findIndex(x=>/^(?:加价)?开始日期$/.test(x));
      const endIndex=headers.findIndex(x=>/^(?:加价)?结束日期$/.test(x));
      const from=date(c[startIndex]), to=date(c[endIndex]);
      if (!from || !to) continue;
      const priceIndex=headers.findIndex(x=>/^加价（/.test(x));
      const source=sourceOf(sheet.name,row.number);
      if (priceIndex>=0 && money(row.cells[priceIndex])!=null) {
        const weekdayIndex=headers.findIndex(x=>x==='适用星期');
        const hotelIndex=headers.findIndex(x=>x==='适用酒店');
        rules.push({from,to,amount:money(row.cells[priceIndex]),weekdays:weekdayIndex>=0?c[weekdayIndex]:'全部',hotel:hotelIndex>=0?c[hotelIndex]:'',source});
      }
      if (headers[0]==='不可用时段') blocked.push({from,to,reason:c[0],source});
    }
  }
  // 明确标出的单段不可入住期，无需从描述推测年份。
  const from=p.find(x=>x.key==='不可入住开始'), to=p.find(x=>x.key==='不可入住结束');
  if (date(from?.value) && date(to?.value)) blocked.push({from:date(from.value),to:date(to.value),reason:'台账不可入住期',source:from.source});
  return {rules,blocked};
}
export function normalize(raw, selection) {
  const sheet=raw.sheets.find(s=>s.name===selection.sheet);
  if (!sheet) throw new Error('请选择包含套餐记录的工作表。');
  if (['id','name','paid','nights'].some(k=>!(selection.mapping[k]>=0))) throw new Error('请映射编号、套餐名称、订单金额和住宿晚数。');
  const mapped=Object.values(selection.mapping).filter(x=>x>=0);
  if(new Set(mapped).size!==mapped.length) throw new Error('不同字段不能映射到同一列。');
  const packages=[],issues=[],ids=new Set();
  for (const row of sheet.rows.filter(r=>r.number>selection.row)) {
    const get=k=>row.cells[selection.mapping[k]];
    if (!text(get('id')) && !text(get('name'))) continue;
    const id=text(get('id')).padStart(3,'0'), name=text(get('name'));
    if (!name || !text(get('id')) || ids.has(id)) { issues.push(`${sourceOf(sheet.name,row.number)}：编号或名称缺失／编号重复，未导入。`); continue; }
    const nights=Number(get('nights')),paid=money(get('paid'));
    if (!Number.isInteger(nights) || nights<1 || nights>366 || paid==null) {issues.push(`${sourceOf(sheet.name,row.number)}：晚数或金额无法识别，未导入。`);continue;}
    ids.add(id);
    const details=detailsFor(raw.sheets,id,sheet.name), p=pairs(details);
    const getPair=keys=>p.find(x=>keys.includes(x.key));
    const extra=getPair(['已付额外补款（元）']);
    const paidExtra=extra?money(extra.value):0;
    const start=getPair(['有效入住开始','可入住开始','最早可入住日期']);
    const end=getPair(['有效入住结束','可入住结束']);
    const period=rangeText(getPair(['可入住期'])?.value) ?? (date(start?.value)&&date(end?.value)?[date(start.value),date(end.value)]:rangeText(get('validity')));
    const allText=p.map(x=>`${x.key} ${x.value}`).join('\n');
    const split=/可拆|可分开使用/.test(name+'\n'+allText);
    const record={id,name,hotel:text(get('hotel')),nights,paid,paidExtra,status:text(get('status')),room:text(get('room')),validity:text(get('validity')),resort:text(get('resort')),source:sourceOf(sheet.name,row.number),details,pairs:p,period,split,...extractRules(details,p)};
    record.region=/禾木/.test(record.hotel)?'禾木':/长白山/.test(record.hotel+record.resort)?'长白山':/北大湖/.test(record.resort)?'北大湖':/崇礼|富龙|山麓|双龙/.test(record.hotel+record.resort+allText)?'崇礼':'待确认';
    record.regionInferred=!/禾木|长白山|北大湖|崇礼/.test(record.resort);
    record.notes=p.filter(x=>/待确认|待补|日期差异|加价规则说明|价格表性质|预约后退改/.test(x.key));
    if (paidExtra==null) issues.push(`${id}：补款金额无法识别，已付总额不完整。`);
    packages.push(record);
  }
  if (!packages.length) throw new Error('未识别到套餐记录，请调整工作表、表头行和字段对应关系。');
  return {version:1,fileName:raw.fileName,importedAt:raw.importedAt,packages,issues,sheetCount:raw.sheets.length};
}
function weekdaysMatch(rule, iso) {
  if (!rule || rule==='全部'||rule==='未另限星期') return true;
  const n=new Date(iso+'T00:00:00Z').getUTCDay();
  if(rule==='周一至周四、周日') return [0,1,2,3,4].includes(n);
  return rule.split(/[、，,]/).some(t=>t===['周日','周一','周二','周三','周四','周五','周六'][n]);
}
export function evaluate(pkg, start, requestedNights) {
  const nights=requestedNights || pkg.nights;
  if(!date(start)||!Number.isInteger(nights)||nights<1||nights>366) throw new Error('请输入有效入住日期和 1–366 晚的住宿时长。');
  const stay=Array.from({length:nights},(_,i)=>plusDays(start,i));
  const reasons=[];
  if(nights>pkg.nights || (!pkg.split && nights!==pkg.nights)) reasons.push(pkg.split?'超出订单总间夜':'需按套餐晚数连住；拆分规则未确认');
  if(pkg.period && stay.some(d=>d<pkg.period[0]||d>pkg.period[1])) reasons.push('超出台账可入住期');
  if(/预约完成|预订成功/.test(pkg.status)) reasons.push('已有预约，需先确认原日期及改期规则');
  const blocked=stay.flatMap(d=>pkg.blocked.filter(b=>d>=b.from&&d<=b.to).map(b=>`${d}：${b.reason}`));
  reasons.push(...blocked);
  const nightly=stay.map(day=>{
    const matches=pkg.rules.filter(r=>day>=r.from&&day<=r.to&&weekdaysMatch(r.weekdays,day));
    return {day,amount:matches.length===1?matches[0].amount:null,source:matches.length===1?matches[0].source:null,reason:matches.length>1?'加价区间重叠，待确认':matches.length===0?'未覆盖的日期，不能视为免加价':''};
  });
  const known=nightly.filter(n=>n.amount!==null).reduce((a,n)=>a+n.amount,0);
  const complete=nightly.every(n=>n.amount!==null);
  const needsHotel=pkg.rules.some(r=>r.hotel);
  return {pkg,start,end:plusDays(start,nights),nights,reasons,nightly,known,complete,needsHotel,eligible:reasons.length===0,amount:complete?known:null};
}
