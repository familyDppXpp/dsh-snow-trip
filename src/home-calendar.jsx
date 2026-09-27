import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {DayPicker,DayButton} from 'react-day-picker';
import {zhCN} from 'react-day-picker/locale';
import {localDay,seasonCalendar,filterCalendarDay,defaultMonthRange,validMonthRange} from './home-calendar.js';
import {storage} from './storage.js';
import {MonthRangePicker} from './date-picker.jsx';
import {plusDays} from './ledger.js';

const CalendarContext=createContext(null);
const legend=[['confirmed','已确认行程'],['draft','待预约 / 状态未知'],['packages','套餐当晚可用'],['pending','套餐日期待确认']];
function CalendarDayButton({day,children,...props}) {
  const {days,packagesReady,plansReady,filters}=useContext(CalendarContext);
  const [dismissed,setDismissed]=useState(false);
  const key=localDay(day.date),raw=days.get(key);
  if(!raw||day.outside)return <DayButton day={day} {...props}>{children}</DayButton>;
  const counts=filterCalendarDay(raw,filters);
  const label=`${key}，方案 ${plansReady?counts.plans.length:'—'}，套餐 ${packagesReady?counts.packages.length:'—'}${packagesReady&&counts.pendingPackages.length?`，待确认 ${counts.pendingPackages.length}`:''}`;
  const connected=offset=>{const other=days.get(plusDays(key,offset));return other&&filterCalendarDay(other,filters).plans.some(p=>counts.plans.some(row=>row.id===p.id));};
  const start=!connected(-1)||day.date.getDay()===1||day.date.getDate()===1;
  const end=!connected(1)||day.date.getDay()===0||new Date(day.date.getFullYear(),day.date.getMonth()+1,0).getDate()===day.date.getDate();
  return <div className="snow-date" data-dismissed={dismissed||undefined} onMouseEnter={()=>setDismissed(false)} onFocus={()=>setDismissed(false)} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();setDismissed(true);event.stopPropagation();}}}>
    <DayButton day={day} {...props} aria-label={label} aria-describedby={`snow-date-${key}`}
      data-marked={counts.plans.length>0||undefined} data-start={start||undefined} data-end={end||undefined}
      data-confirmed={counts.plans.some(plan=>plan.tracking?.booking==='confirmed')||undefined}
      data-draft={counts.plans.some(plan=>plan.tracking?.booking!=='confirmed')||undefined}
      data-package={counts.packages.length>0||undefined} data-pending={counts.pendingPackages.length>0||undefined}>
      {children}<span className="snow-date-marks" aria-hidden="true">{counts.packages.length>0&&<i/>}{counts.pendingPackages.length>0&&<i className="is-pending"/>}</span>
    </DayButton>
    <div className="snow-date-tooltip" role="tooltip" id={`snow-date-${key}`}>
      <strong>{key}</strong>
      {!plansReady&&<p>行程数据暂不可用</p>}{!packagesReady&&<p>套餐数据暂不可用</p>}
      {counts.plans.map(p=><p key={p.id}><b>{p.tracking?.booking==='confirmed'?'已确认行程':'待预约 / 状态未知'}</b><span>{p.title||'未命名行程'}</span></p>)}
      {counts.packages.map(p=><p key={p.id}><b>当晚可用套餐</b><span>{p.name||'未命名套餐'}</span></p>)}
      {counts.pendingPackages.map(p=><p key={p.id}><b>日期待确认</b><span>{p.name||'未命名套餐'}</span></p>)}
      {plansReady&&packagesReady&&!counts.plans.length&&!counts.packages.length&&!counts.pendingPackages.length&&<p>{filters.length?'当前筛选下暂无安排':'当天暂无安排或可用套餐'}</p>}
    </div>
  </div>;
}
function ReadStatus({label,loading,error,onRetry}) {
  return error?<p role="alert" className="snow-season-notice">{label}读取失败：{error} <button onClick={onRetry}>重试{label}</button></p>:loading?<p role="status" className="snow-season-notice">正在读取{label}…</p>:null;
}
export function HomeCalendar({active,host,plans,plansLoading,plansError,onRetryPlans,onStart,busy,Dropdown}) {
  const year=2026;
  const [range,setRange]=useState(defaultMonthRange),[rangeReady,setRangeReady]=useState(false),[rangeError,setRangeError]=useState('');
  useEffect(()=>{let mounted=true;storage('home-month-range').then(value=>{if(mounted&&validMonthRange(value))setRange(value);}).catch(()=>{if(mounted)setRangeError('无法读取上次月份选择，已使用默认区间。');}).finally(()=>{if(mounted)setRangeReady(true);});return()=>{mounted=false;};},[]);
  const changeRange=value=>{if(!validMonthRange(value))return;setRange(value);setSelected(undefined);setRangeError('');storage('home-month-range',value).catch(()=>setRangeError('月份已切换，但无法保存；下次打开可能恢复原区间。'));};
  const [selected,setSelected]=useState(),[filters,setFilters]=useState([]);
  const packagesReady=!host.loading&&!host.error,plansReady=!plansLoading&&!plansError;
  const season=useMemo(()=>seasonCalendar(packagesReady?host.rows:[],plansReady?plans:[],range.start,range.end),[range,host.rows,plans,packagesReady,plansReady]);
  if(!active)return null;
  const shortYear=value=>String(value).slice(-2);
  return <section className="snow-home" aria-label="首页月历">
    <header className="snow-season-hero">
      <div className="snow-season-intro"><span className="snow-season-eyebrow">我的山野计划 / 雪季总览</span><h1>一整个雪季。<br/><span>尽在眼前。</span></h1><p>让每一次出发都有位置。</p></div>
      <div className="snow-season-edition" aria-label={`${year} 至 ${year+1} 雪季`}><div className="snow-season-year" aria-hidden="true"><strong>{shortYear(year)}</strong><span>/</span><strong>{shortYear(year+1)}</strong></div><div className="snow-month-range-control">{rangeReady?<Dropdown label="展示月份" summary={`${range.start} 至 ${range.end}`} minWidth={320} popupClass="snow-date-popover">{(close,id,open)=>open&&<MonthRangePicker start={range.start} end={range.end} onChange={changeRange} onClose={close}/>}</Dropdown>:<span role="status">正在读取月份选择…</span>}</div></div>
      <div className="snow-season-totals" aria-label="雪季统计">
        <div><strong>{plansReady?season.planCount:'—'}</strong><span>份行程</span></div><div><strong>{plansReady?season.plannedDays:'—'}</strong><span>天有安排</span></div><div><strong>{packagesReady?season.packageCount:'—'}</strong><span>份日期可用套餐</span></div>
      </div>
    </header>
    <div className="snow-season-bottom">
      <div className="snow-season-legend" role="group" aria-label="日期图例">{legend.map(([value,label])=><button key={value} aria-pressed={filters.includes(value)} onClick={()=>setFilters(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])}><i className={`is-${value}`}/>{label}</button>)}</div>
    </div>
    {rangeError&&<p role="alert" className="snow-season-notice">{rangeError}</p>}
    <ReadStatus label="套餐" loading={host.loading} error={host.error} onRetry={host.retry}/>
    <ReadStatus label="方案" loading={plansLoading} error={plansError} onRetry={onRetryPlans}/>
    <CalendarContext.Provider value={{days:season.days,packagesReady,plansReady,filters}}>
      <div className="snow-season-months">
        {season.months.map((month,index)=>{
          const values=[...season.days].filter(([day])=>day.startsWith(localDay(month).slice(0,7))).map(([,value])=>value);
          const count=new Set(values.flatMap(value=>filterCalendarDay(value,filters).plans.map(p=>p.id))).size;
          const ready=plansReady;
          return <section className="snow-season-month" aria-label={`${month.getFullYear()}年${month.getMonth()+1}月`} key={localDay(month)} style={{'--month-index':Math.min(index,3)}}>
            <header><h2><strong>{String(month.getMonth()+1).padStart(2,'0')}</strong><span>月<small>{month.getFullYear()}</small></span></h2><span className="snow-month-count">{ready?count:'—'} 份行程</span></header>
            <DayPicker mode="single" locale={zhCN} weekStartsOn={1} month={month} fixedWeeks hideNavigation disableNavigation
              selected={selected} onSelect={setSelected} components={{DayButton:CalendarDayButton}}/>
          </section>;
        })}
      </div>
    </CalendarContext.Provider>

    {packagesReady&&plansReady&&!host.rows.length&&!plans.length?<div className="snow-season-empty"><p>这个雪季，还等你写下第一程。</p><button onClick={onStart} disabled={busy}>开始录入第一份套餐 <span aria-hidden="true">↗</span></button></div>:null}
  </section>;
}
