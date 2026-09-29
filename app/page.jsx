'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchFundHistory, fetchSectorHistory, searchRemoteFunds } from './lib/fund-api';
import { computeMacd } from './lib/indicators';

const QUICK_DAYS = [7, 30, 90, 180, 365];
const DEFAULT_CODES = ['110020', '161725', '270042'];
const STORAGE_KEY = 'baseline-live-watch-v1';

const formatDate = (timestamp) => new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit', day: '2-digit', year: 'numeric'
}).format(new Date(timestamp));
const formatPercent = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function TrendChart({ points }) {
  const width = 900;
  const height = 320;
  const padding = { top: 26, right: 25, bottom: 34, left: 58 };
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || Math.max(max * 0.04, 0.1);
  const low = min - range * 0.14;
  const high = max + range * 0.14;
  const x = (index) => padding.left + (index / Math.max(points.length - 1, 1)) * (width - padding.left - padding.right);
  const y = (value) => padding.top + ((high - value) / (high - low)) * (height - padding.top - padding.bottom);
  const polyline = points.map((point, index) => `${x(index)},${y(point.value)}`).join(' ');
  const area = `M ${x(0)} ${height - padding.bottom} L ${polyline.replaceAll(' ', ' L ')} L ${x(points.length - 1)} ${height - padding.bottom} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="基金净值走势图">
      <defs>
        <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5eead4" stopOpacity=".28" />
          <stop offset="1" stopColor="#5eead4" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((tick) => {
        const lineY = padding.top + tick * (height - padding.top - padding.bottom);
        const value = high - tick * (high - low);
        return <g key={tick}><line x1={padding.left} y1={lineY} x2={width - padding.right} y2={lineY} /><text x={padding.left - 10} y={lineY + 4}>{value.toFixed(3)}</text></g>;
      })}
      <path d={area} fill="url(#area-fill)" />
      <polyline points={polyline} />
      <text x={padding.left} y={height - 9}>{formatDate(points[0].timestamp)}</text>
      <text x={width - padding.right} y={height - 9} textAnchor="end">{formatDate(points.at(-1).timestamp)}</text>
    </svg>
  );
}

function MacdChart({ points }) {
  const width = 900;
  const height = 240;
  const padding = { top: 24, right: 25, bottom: 34, left: 58 };
  const values = points.flatMap((point) => [point.macd, point.signal, point.hist]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || Math.max(Math.abs(max) * 0.04, 0.01);
  const low = min - range * 0.12;
  const high = max + range * 0.12;
  const x = (index) => padding.left + (index / Math.max(points.length - 1, 1)) * (width - padding.left - padding.right);
  const y = (value) => padding.top + ((high - value) / (high - low)) * (height - padding.top - padding.bottom);
  const zeroY = y(0);
  const barWidth = (width - padding.left - padding.right) / Math.max(points.length, 1) * 0.55;
  const macdPolyline = points.map((point, index) => `${x(index)},${y(point.macd)}`).join(' ');
  const signalPolyline = points.map((point, index) => `${x(index)},${y(point.signal)}`).join(' ');
  const ticks = [0, 0.5, 1];

  return (
    <svg className="chart macd-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="MACD 走势图">
      {ticks.map((tick) => {
        const lineY = padding.top + tick * (height - padding.top - padding.bottom);
        const value = high - tick * (high - low);
        return <g key={tick}><line x1={padding.left} y1={lineY} x2={width - padding.right} y2={lineY} /><text x={padding.left - 10} y={lineY + 4}>{value.toFixed(3)}</text></g>;
      })}
      <line x1={padding.left} y1={zeroY} x2={width - padding.right} y2={zeroY} stroke="#68758a" strokeDasharray="4 4" />
      {points.map((point, index) => {
        const cx = x(index);
        const top = Math.min(y(point.hist), zeroY);
        const bottom = Math.max(y(point.hist), zeroY);
        return <rect key={point.timestamp} x={cx - barWidth / 2} y={top} width={barWidth} height={Math.max(bottom - top, 1)} fill={point.hist >= 0 ? 'rgba(251,113,133,.55)' : 'rgba(52,211,153,.55)'} rx={1} />;
      })}
      <polyline points={macdPolyline} fill="none" style={{ stroke: '#5eead4' }} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={signalPolyline} fill="none" style={{ stroke: '#f59e0b' }} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <text x={padding.left} y={height - 9}>{formatDate(points[0].timestamp)}</text>
      <text x={width - padding.right} y={height - 9} textAnchor="end">{formatDate(points.at(-1).timestamp)}</text>
    </svg>
  );
}

function SearchBox({ query, setQuery, results, searching, searchError, addFund, watch, className = '' }) {
  return (
    <div className={`search-box ${className}`}>
      <span>⌕</span>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：沪深300 / 110020" aria-label="搜索基金" />
      {query && <div className="search-results">
        {searching && <div className="message">正在搜索全市场基金…</div>}
        {!searching && searchError && <div className="message error">{searchError}</div>}
        {!searching && !searchError && !results.length && <div className="message">未找到匹配基金</div>}
        {!searching && results.map((fund) => <button key={fund.code} onClick={() => addFund(fund)}><span><strong>{fund.name}</strong><small>{fund.code} · {fund.type}</small></span><b>{watch.some((item) => item.code === fund.code) ? '✓' : '+'}</b></button>)}
      </div>}
    </div>
  );
}

function useMobile(breakpoint = 900) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(m.matches);
    update();
    m.addEventListener('change', update);
    return () => m.removeEventListener('change', update);
  }, [breakpoint]);
  return isMobile;
}

export default function Home() {
  const [watch, setWatch] = useState([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [fundCache, setFundCache] = useState({});
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataError, setDataError] = useState('');
  const [days, setDays] = useState(30);
  const [customDays, setCustomDays] = useState('');
  const debouncedQuery = useDebouncedValue(query, 320);
  const searchId = useRef(0);
  const isMobile = useMobile();
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) setMobileDetailOpen(false);
  }, [isMobile]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      const initial = Array.isArray(stored) && stored.length ? stored : DEFAULT_CODES.map((code) => ({ code, name: code }));
      setWatch(initial);
      setSelectedCode(initial[0]?.code || '');
    } catch {
      const initial = DEFAULT_CODES.map((code) => ({ code, name: code }));
      setWatch(initial);
      setSelectedCode(initial[0].code);
    }
  }, []);

  useEffect(() => {
    if (!selectedCode || fundCache[selectedCode]) return;
    let cancelled = false;
    setLoading(true);
    setDataError('');
    fetchFundHistory(selectedCode)
      .then((fund) => {
        if (cancelled) return;
        setFundCache((current) => ({ ...current, [selectedCode]: fund }));
        setWatch((current) => {
          const next = current.map((item) => item.code === selectedCode ? { ...item, name: fund.name } : item);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      })
      .catch((error) => !cancelled && setDataError(error.message || '基金数据加载失败'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [selectedCode, fundCache]);

  useEffect(() => {
    const fund = fundCache[selectedCode];
    if (!fund?.sector?.code || fund.sectorHistory !== undefined) return;
    let cancelled = false;
    fetchSectorHistory(fund.sector.code).then((sectorHistory) => {
      if (cancelled) return;
      setFundCache((current) => ({
        ...current,
        [selectedCode]: { ...current[selectedCode], sectorHistory }
      }));
    });
    return () => { cancelled = true; };
  }, [fundCache, selectedCode]);

  useEffect(() => {
    const value = debouncedQuery.trim();
    if (!value) {
      setResults([]);
      setSearchError('');
      return;
    }
    const id = ++searchId.current;
    setSearching(true);
    setSearchError('');
    searchRemoteFunds(value)
      .then((rows) => { if (id === searchId.current) setResults(rows.slice(0, 8)); })
      .catch((error) => { if (id === searchId.current) setSearchError(error.message || '搜索服务暂时不可用，请稍后重试'); })
      .finally(() => { if (id === searchId.current) setSearching(false); });
  }, [debouncedQuery]);

  const selected = fundCache[selectedCode];
  const rangedPoints = useMemo(() => selected?.history.slice(-days) || [], [selected, days]);
  const macdPoints = useMemo(() => {
    const history = selected?.sectorHistory;
    if (!history?.length) return [];
    const all = computeMacd(history);
    return all.slice(-days);
  }, [selected, days]);
  const stats = useMemo(() => {
    if (!rangedPoints.length) return null;
    const first = rangedPoints[0];
    const latest = rangedPoints.at(-1);
    const previous = rangedPoints.at(-2) || null;
    const high = rangedPoints.reduce((current, point) => point.value > current.value ? point : current);
    const low = rangedPoints.reduce((current, point) => point.value < current.value ? point : current);
    return {
      first,
      latest,
      previous,
      high,
      low,
      total: (latest.value / first.value - 1) * 100,
      daily: previous ? (latest.value / previous.value - 1) * 100 : null,
      drawdown: (latest.value / high.value - 1) * 100,
      rebound: (latest.value / low.value - 1) * 100,
    };
  }, [rangedPoints]);

  const saveWatch = (next) => {
    setWatch(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };
  const addFund = (fund) => {
    if (!watch.some((item) => item.code === fund.code)) saveWatch([{ code: fund.code, name: fund.name }, ...watch]);
    setSelectedCode(fund.code);
    if (isMobile) setMobileDetailOpen(true);
    setQuery('');
    setResults([]);
  };
  const closeMobileDetail = () => setMobileDetailOpen(false);
  const removeFund = (code) => {
    const next = watch.filter((item) => item.code !== code);
    saveWatch(next);
    if (selectedCode === code) setSelectedCode(next[0]?.code || '');
  };
  const applyCustomDays = () => {
    const value = Number(customDays);
    if (!Number.isInteger(value) || value <= 1) return;
    setDays(Math.min(value, 10000));
  };

  return (
    <div className={`app-shell ${isMobile && mobileDetailOpen ? 'detail-open' : ''}`}>
      <header className="topbar">
        <div className="brand"><span className="brand-mark">⌁</span><span>基线</span><small>实时基金观察台</small></div>
        {isMobile && <div className="topbar-search-wrap"><SearchBox query={query} setQuery={setQuery} results={results} searching={searching} searchError={searchError} addFund={addFund} watch={watch} /></div>}
        <div className="live-status"><i /> 东方财富实时数据</div>
      </header>

      <main className="workspace">
        {isMobile && mobileDetailOpen && <div className="detail-scrim" onClick={closeMobileDetail} aria-hidden="true" />}
        <aside className="sidebar">
          <div className="sidebar-head">
            <h1>自选基金</h1>
            <p>搜索基金名称、拼音或 6 位代码</p>
            <SearchBox query={query} setQuery={setQuery} results={results} searching={searching} searchError={searchError} addFund={addFund} watch={watch} />
          </div>
          <div className="list-caption">我的列表 · {watch.length}</div>
          <div className="watch-list">
            {watch.length === 0 && <div className="empty">搜索并添加第一只基金</div>}
            {watch.map((item) => {
              const cached = fundCache[item.code];
              const history = cached?.history;
              const latest = history?.at(-1);
              const previous = history?.at(-2);
              const change = latest && previous ? (latest.value / previous.value - 1) * 100 : null;
              return <button className={`fund-row ${selectedCode === item.code ? 'active' : ''}`} key={item.code} onClick={() => { setSelectedCode(item.code); if (isMobile) setMobileDetailOpen(true); }}>
                <span className="avatar">{item.name.slice(0, 2)}</span>
                <span className="fund-title"><strong>{cached?.name || item.name}</strong><small>{item.code}{cached?.sector && ` · ${cached.sector.name}`}</small></span>
                <span className="fund-meta">
                  <span className={change == null ? 'muted' : change >= 0 ? 'rise' : 'fall'}>{change == null ? '—' : formatPercent(change)}</span>
                  {latest && <span className="latest-value">{latest.value.toFixed(4)}</span>}
                </span>
                <span className="remove" role="button" tabIndex="0" aria-label={`移除${item.name}`} onClick={(event) => { event.stopPropagation(); removeFund(item.code); }}>×</span>
              </button>;
            })}
          </div>
        </aside>

        <section className="detail">
          {!selectedCode && <div className="detail-empty"><strong>还没有自选基金</strong><span>从左侧搜索并添加一只基金。</span></div>}
          {selectedCode && loading && <div className="detail-empty"><span className="loader" /><strong>正在获取实时净值</strong><span>基金代码 {selectedCode}</span></div>}
          {selectedCode && !loading && dataError && <div className="detail-empty"><strong>数据加载失败</strong><span>{dataError}</span><button onClick={() => { setFundCache((current) => ({ ...current, [selectedCode]: undefined })); }}>重新加载</button></div>}
          {selected && stats && <>
            <div className="detail-head">
              {isMobile && <button className="mobile-back" onClick={closeMobileDetail} aria-label="返回自选">← 返回</button>}
              <div><span className="eyebrow">LIVE FUND OVERVIEW</span><h2>{selected.name}</h2><p>{selected.code} · 净值数据实时获取</p></div>
              <div className="latest"><small>最新单位净值</small><strong>{stats.latest.value.toFixed(4)}</strong><span>{formatDate(stats.latest.timestamp)}</span>{stats.daily != null && <span className={stats.daily >= 0 ? 'rise' : 'fall'}>日涨跌 {formatPercent(stats.daily)}</span>}</div>
            </div>
            <div className="period-bar">
              <div className="quick-days">{QUICK_DAYS.map((item) => <button className={days === item ? 'active' : ''} key={item} onClick={() => { setDays(item); setCustomDays(''); }}>{item}天</button>)}</div>
              <form onSubmit={(event) => { event.preventDefault(); applyCustomDays(); }}>
                <label htmlFor="custom-days">自定义</label>
                <input id="custom-days" type="number" min="2" max="10000" step="1" value={customDays} onChange={(event) => setCustomDays(event.target.value)} placeholder="> 1" />
                <button type="submit" disabled={!Number.isInteger(Number(customDays)) || Number(customDays) <= 1}>应用</button>
              </form>
            </div>
            <div className="detail-body">
              <div className="metrics">
                <article><span>最新净值</span><strong>{stats.latest.value.toFixed(4)}</strong><small>{formatDate(stats.latest.timestamp)}{stats.daily == null ? '' : ` · 日涨跌 ${formatPercent(stats.daily)}`}</small></article>
                <article><span>区间最高净值</span><strong>{stats.high.value.toFixed(4)}</strong><small>{formatDate(stats.high.timestamp)}</small></article>
                <article><span>区间最低净值</span><strong>{stats.low.value.toFixed(4)}</strong><small>{formatDate(stats.low.timestamp)}</small></article>
                <article><span>{days} 天总涨跌幅</span><strong className={stats.total >= 0 ? 'rise' : 'fall'}>{formatPercent(stats.total)}</strong><small>{stats.first.value.toFixed(4)} → {stats.latest.value.toFixed(4)}</small></article>
                <article><span>较区间最高点回撤</span><strong className={stats.drawdown < 0 ? 'fall' : ''}>{stats.drawdown < 0 ? formatPercent(stats.drawdown) : '0.00%'}</strong><small>{stats.high.value.toFixed(4)} → {stats.latest.value.toFixed(4)}</small></article>
                <article><span>较区间最低点涨幅</span><strong className={stats.rebound > 0 ? 'rise' : ''}>{stats.rebound > 0 ? formatPercent(stats.rebound) : '0.00%'}</strong><small>{stats.low.value.toFixed(4)} → {stats.latest.value.toFixed(4)}</small></article>
              </div>
              <div className="chart-card"><div className="chart-caption"><strong>单位净值走势</strong><span>{rangedPoints.length} 个净值日</span></div><TrendChart points={rangedPoints} /></div>
              {macdPoints.length > 0 && selected?.sector && <div className="chart-card macd-card"><div className="chart-caption"><strong>MACD 走势 · {selected.sector.name}</strong><span>快线(青) · 慢线(橙) · 柱</span></div><MacdChart points={macdPoints} /></div>}
              <footer><span>数据来源：东方财富公开行情接口</span><span>统计区间：{formatDate(stats.first.timestamp)} — {formatDate(stats.latest.timestamp)}</span></footer>
            </div>
          </>}
        </section>
      </main>
    </div>
  );
}
