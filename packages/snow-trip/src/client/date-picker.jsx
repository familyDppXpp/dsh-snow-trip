import React, {useState} from 'react';
import {DayPicker} from 'react-day-picker';
import {zhCN} from 'react-day-picker/locale';

// 日历使用本地年月日，避免转为 UTC 后日期偏移。
const toDate=value=>value?new Date(`${value}T00:00:00`):undefined;
const toISO=value=>value?`${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`:'';

export function DatePicker({mode,start,end,onChange,onClose}) {
  const range=mode==='range';
  const [selected,setSelected]=useState(()=>range?(start?{from:toDate(start),to:toDate(end)}:undefined):toDate(start));
  const apply=value=>{onChange(value);onClose();};
  return <>
    <DayPicker mode={mode} locale={zhCN} weekStartsOn={1} fixedWeeks showOutsideDays required resetOnSelect
      defaultMonth={toDate(start)} selected={selected} captionLayout="dropdown" navLayout="after"
      startMonth={new Date(1900,0)} endMonth={new Date(2100,11)}
      labels={{labelPrevious:()=> '上个月',labelNext:()=> '下个月',labelMonthDropdown:()=> '选择月份',labelYearDropdown:()=> '选择年份',labelDayButton:day=>toISO(day)}}
      onSelect={value=>{
        if(!range){apply({start:toISO(value),end:''});return;}
        setSelected(value);
      }}/>
    {range&&<p className="snow-date-hint" role="status">{!selected?.from?'请选择开始日期':!selected.to?`${toISO(selected.from)} → 请选择结束日期`:`${toISO(selected.from)} 至 ${toISO(selected.to)}`}</p>}
    <div className="snow-date-actions"><button type="button" onClick={()=>apply({start:'',end:''})}>清空日期</button>{range&&<button type="button" className="primary" disabled={!selected?.from||!selected?.to} onClick={()=>apply({start:toISO(selected.from),end:toISO(selected.to)})}>确定区间</button>}</div>
  </>;
}

export function MonthRangePicker({start,end,onChange,onClose}) {
  const [selected,setSelected]=useState({start,end});
  const choose=month=>setSelected(current=>!current.start||current.end?{start:month,end:''}:{start:month<current.start?month:current.start,end:month<current.start?current.start:month});
  return <>
    {[2026,2027].map(year=><section className="snow-month-picker-year" key={year} aria-label={`${year}年`}><h3>{year}</h3><div className="snow-month-picker-grid">{Array.from({length:12},(_,index)=>{
      const value=`${year}-${String(index+1).padStart(2,'0')}`,within=selected.start<=value&&value<=(selected.end||selected.start);
      return <button type="button" key={value} aria-label={`${year}年${index+1}月`} aria-pressed={within} data-endpoint={value===selected.start||value===selected.end||undefined} onClick={()=>choose(value)}>{index+1}月</button>;
    })}</div></section>)}
    <p className="snow-date-hint" role="status">{selected.end?`${selected.start} 至 ${selected.end}`:`${selected.start} → 请选择结束月份`}</p>
    <div className="snow-date-actions"><button type="button" onClick={onClose}>取消</button><button type="button" className="primary" disabled={!selected.end} onClick={()=>{onChange(selected);onClose();}}>确定区间</button></div>
  </>;
}
