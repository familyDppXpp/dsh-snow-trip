import type { PackageRecord } from '../integration/types.ts';
import { PackageCard } from '../packages/card.tsx';
import { initial, PackageTagFilter } from '../packages/filters.tsx';
import type { Ledger } from '../packages/ledger.ts';
import { usePackages } from '../packages/use-packages.ts';
import { DateFilter, Option, Select, SortControl } from '../ui/filters.tsx';
import { yuan } from '../ui/format.ts';
import { Icon, Mountain } from '../ui/icon.tsx';

import { usePackageExplorer } from './use-explorer.ts';
export function PackageExplorePage({
  active,
  explorer,
  host,
  ledger,
  plansError,
  mobile,
  startSession,
  sessionBusy,
  onInspect,
  onDelete,
  openPackage,
  onRetryPlans,
}: {
  active: boolean;
  explorer: ReturnType<typeof usePackageExplorer>;
  host: ReturnType<typeof usePackages>;
  ledger: Ledger | null;
  plansError: string;
  mobile: boolean;
  startSession: () => void;
  sessionBusy: boolean;
  onInspect: (id: string) => void;
  onDelete: (record: PackageRecord) => void;
  openPackage: (record: PackageRecord) => void;
  onRetryPlans: () => void;
}) {
  const {
    filtersOpen,
    setFiltersOpen,
    form,
    setForm,
    filter,
    setFilter,
    selection,
    sort,
    setSort,
    sortDirection,
    setSortDirection,
    setDetail,
    formError,
    startInput,
    stats,
    planFilterPending,
    candidates,
    results,
    toggle,
    search,
  } = explorer;
  if (!active) return null;
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="green-dot" /> 雪季计划进行中
          </div>
          <h1>
            下一站，
            <br />
            去山里过冬。
          </h1>
          <p>从已购套餐出发，找到时间和预算都合适的那一程。</p>
          <div className="hero-tags">
            <span>套餐权益</span>
            <span>逐晚补款</span>
            <span>方案对比</span>
          </div>
        </div>
        <Mountain />
        <div className="mountain-caption">这个雪季，把好时光留给山野。</div>
      </section>
      <section className="stats" aria-label="台账概况">
        <div>
          <span>已录入套餐</span>
          <strong>
            {host.loading || host.error
              ? '—'
              : stats.count.toString().padStart(2, '0')}
            <small> 份</small>
          </strong>
        </div>
        <div>
          <span>已知住宿间夜</span>
          <strong>
            {host.loading || host.error ? '—' : stats.nights}
            <small> 晚</small>
          </strong>
          {stats.nightsUnknown > 0 && (
            <small>{stats.nightsUnknown} 份晚数待确认</small>
          )}
        </div>
        <div>
          <span>已知实付与补款合计</span>
          <strong>
            {host.loading || host.error ? '—' : yuan(stats.paid / 100)}
          </strong>
          {stats.paidUnknown > 0 && (
            <small>{stats.paidUnknown} 份金额未完整，非最终总额</small>
          )}
        </div>
        <div>
          <span>已知目的地区域</span>
          <strong>
            {host.loading || host.error ? '—' : stats.regions.length}
            <small> 处</small>
          </strong>
          {stats.regionsUnknown > 0 && (
            <small>{stats.regionsUnknown} 份地区待确认</small>
          )}
        </div>
      </section>
      <section className="search-panel">
        {mobile ? (
          <button
            className="snow-filter-toggle"
            aria-expanded={filtersOpen}
            aria-controls="snow-explore-filters"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <Icon name="search" size={17} />
            <span>
              <strong>筛选出行</strong>
              <small>
                {filter.start || '不限日期'} ·{' '}
                {filter.nights ? `${filter.nights} 晚` : '按套餐晚数'} ·{' '}
                {filter.region}
              </small>
            </span>
            <span aria-hidden="true">{filtersOpen ? '−' : '＋'}</span>
          </button>
        ) : (
          <div className="section-head">
            <h2>
              <Icon name="search" /> 找一程适合的出行
            </h2>
            <span>先选日期，再看套餐怎么用</span>
          </div>
        )}
        <form
          id="snow-explore-filters"
          hidden={mobile && !filtersOpen}
          noValidate
          onSubmit={search}
        >
          <div className="filter-grid">
            <DateFilter
              label="入住日期"
              triggerRef={startInput}
              start={form.start}
              onChange={({ start }) => setForm({ ...form, start })}
            />
            <Select
              label="住宿晚数"
              value={form.nights}
              options={[
                ['', '按各套餐晚数'],
                ...[1, 2, 3, 4, 5, 7, 10, 15].map(
                  (n) => [String(n), `${n} 晚`] as Option,
                ),
              ]}
              onChange={(nights) => setForm({ ...form, nights })}
            />
            <Select
              label="目的地区域"
              value={form.region}
              options={['全部目的地', ...stats.regions].map((region) => [
                region,
                region,
              ])}
              onChange={(region) => setForm({ ...form, region })}
            />
            <PackageTagFilter value={form} onChange={setForm} />
            <Select
              label="出行方案"
              value={form.hasPlan}
              options={[
                ['', '全部'],
                ['yes', '已有方案'],
                ['no', '暂无方案'],
              ]}
              onChange={(hasPlan) => setForm({ ...form, hasPlan })}
            />
          </div>
          <div className="filter-bottom">
            <div className="text-search">
              <Icon name="search" size={17} />
              <input
                aria-label="搜索套餐或酒店"
                placeholder="搜索酒店、套餐或雪场"
                value={form.query}
                onChange={(e) => setForm({ ...form, query: e.target.value })}
              />
              {form.query && (
                <button
                  type="button"
                  aria-label="清空搜索"
                  onClick={(e) => {
                    setForm({ ...form, query: '' });
                    setFilter({ ...filter, query: '' });
                    (
                      e.currentTarget
                        .previousElementSibling as HTMLElement | null
                    )?.focus();
                  }}
                >
                  <Icon name="close" size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="filter-actions">
            <button className="primary" type="submit">
              <Icon name="search" /> 查找套餐
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(initial);
                setFilter(initial);
              }}
            >
              重置筛选
            </button>
          </div>
          {formError && (
            <p id="snow-filter-error" role="alert" className="error">
              {formError}
            </p>
          )}
        </form>
      </section>
      <div className="results-head">
        <div>
          <h2>
            你的出行候选{' '}
            <span>
              {host.loading || host.error || planFilterPending
                ? '—'
                : candidates.length}
            </span>
          </h2>
          <p>
            {filter.start ? `${filter.start} 入住` : '不限入住日期'} ·
            仅展示符合所选条件的套餐，不代表实时有房
          </p>
        </div>
        <SortControl
          value={sort}
          direction={sortDirection}
          onChange={setSort}
          onDirectionChange={setSortDirection}
          options={[
            ['nights', '住宿晚数'],
            ['paid', '累计已支付'],
          ]}
        />
      </div>
      {filter.hasPlan && plansError ? (
        <div className="empty" role="alert">
          读取出行方案失败：{plansError}
          <button onClick={() => onRetryPlans()}>重试</button>
        </div>
      ) : planFilterPending ? (
        <div className="empty" role="status">
          正在读取出行方案…
        </div>
      ) : host.error ? (
        <div className="empty" role="alert">
          读取套餐失败：{host.error}
          <button onClick={host.retry}>重试</button>
        </div>
      ) : host.loading ? (
        <div className="empty" role="status">
          正在读取已录入套餐…
        </div>
      ) : !host.rows.length ? (
        <div className="empty">
          <Icon name="book" size={36} />
          <h3>先记下一份套餐</h3>
          <p>粘贴套餐说明，和助理核对后保存。信息不全也可以先记下来。</p>
          <button
            className="primary"
            onClick={() => startSession()}
            disabled={sessionBusy}
          >
            {sessionBusy ? '正在准备…' : '开始录入'}
          </button>
        </div>
      ) : !candidates.length ? (
        <div className="empty">
          <h3>没有符合筛选条件的套餐</h3>
          <p>试试放宽日期、晚数、目的地、标签、出行方案或搜索关键词。</p>
          <button
            onClick={() => {
              setForm(initial);
              setFilter(initial);
            }}
          >
            重置筛选
          </button>
        </div>
      ) : (
        <div className="cards package-candidates">
          {candidates.map(({ record }) => (
            <div className="package-candidate" key={record.id}>
              <PackageCard
                record={record}
                onInspect={(record) => onInspect(record.id)}
                onOpen={openPackage}
                onDelete={onDelete}
              />
            </div>
          ))}
        </div>
      )}
      {ledger && (
        <section aria-label="历史台账候选">
          <h2>历史 Excel 台账候选</h2>
          {!filter.start && (
            <p className="muted">选择入住日期后核算历史台账补款。</p>
          )}
          <div className="cards">
            {results.map((r) => {
              const p = r.pkg;
              return (
                <article
                  key={p.id}
                  className={`trip-card ${selection.includes(p.id) ? 'selected' : ''}`}
                >
                  <div className={`card-scenery scenery-${p.region}`}>
                    <Icon size={75} />
                    <span className="destination">
                      <Icon name="pin" size={14} />
                      {p.region}
                      {p.regionInferred ? ' · 地区推断' : ''}
                    </span>
                    <span className="package-id">套餐 {p.id}</span>
                  </div>
                  <div className="card-body">
                    <div className="card-meta">
                      <span>{p.status || '状态待确认'}</span>
                      <span>
                        {p.split ? '可拆分使用' : '连住 / 拆分待确认'}
                      </span>
                    </div>
                    <h3>{p.hotel || p.name}</h3>
                    <p className="package-name" title={p.name}>
                      {p.name}
                    </p>
                    <div className="stay">
                      <Icon name="calendar" size={16} />
                      {r.start.slice(5)} — {r.end.slice(5)}
                      <b>{r.nights} 晚</b>
                    </div>
                    <div className="cost-row">
                      <div>
                        <small>
                          台账房间补款{r.needsHotel ? ' · 示例' : ''}
                        </small>
                        <strong>
                          {r.complete ? yuan(r.amount) : '待核对'}
                          {r.complete && <em> / 本次</em>}
                        </strong>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => setDetail(r)}
                      >
                        查看依据 <Icon name="arrow" size={15} />
                      </button>
                    </div>
                    <p className="paid">
                      原订单已付{' '}
                      {yuan(p.paidExtra === null ? null : p.paid + p.paidExtra)}
                      {p.split ? ' · 总间夜金额' : ''}
                    </p>
                    <div
                      className={`card-warning ${r.reasons.length ? 'blocked' : ''}`}
                    >
                      <Icon name="info" size={14} />
                      <span>
                        {r.reasons[0] ||
                          (r.complete
                            ? r.needsHotel
                              ? '加价仅为指定酒店示例，需确认门店'
                              : '加价已按晚展开，权益及库存仍需确认'
                            : '年份、房型或部分日期加价待确认')}
                      </span>
                    </div>
                    <div className="card-actions">
                      <button onClick={() => setDetail(r)}>套餐详情</button>
                      <button
                        className={selection.includes(p.id) ? 'chosen' : ''}
                        aria-pressed={selection.includes(p.id)}
                        onClick={() => toggle(p.id)}
                      >
                        {selection.includes(p.id) ? (
                          <Icon name="check" size={16} />
                        ) : (
                          <Icon name="compare" size={16} />
                        )}{' '}
                        {selection.includes(p.id) ? '已选对比' : '加入对比'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
