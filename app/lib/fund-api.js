'use client';

const PINGZHONG_KEYS = [
  'fS_code',
  'fS_name',
  'Data_netWorthTrend',
  'Data_ACWorthTrend'
];

let loadQueue = Promise.resolve();

function enqueue(task) {
  const result = loadQueue.then(task, task);
  loadQueue = result.catch(() => undefined);
  return result;
}

function loadScript(url, { timeout = 15000, onLoad } = {}) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    let completed = false;
    const cleanup = () => {
      script.remove();
      clearTimeout(timer);
    };
    const finish = (callback) => {
      if (completed) return;
      completed = true;
      cleanup();
      callback();
    };
    const timer = setTimeout(() => finish(() => reject(new Error('实时数据请求超时'))), timeout);
    script.async = true;
    script.src = url;
    script.onload = () => finish(() => resolve(onLoad ? onLoad() : true));
    script.onerror = () => finish(() => reject(new Error('实时数据加载失败')));
    document.body.appendChild(script);
  });
}

export function searchRemoteFunds(query, { timeout = 10000 } = {}) {
  const key = String(query || '').trim();
  if (!key) return Promise.resolve([]);
  const callbackName = `FundSuggest_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const url = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(key)}&callback=${callbackName}&_=${Date.now()}`;

  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      delete window[callbackName];
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const timer = setTimeout(() => fail(new Error(`搜索请求超时（${timeout / 1000}s），请检查网络或稍后重试`)), timeout);

    window[callbackName] = (payload) => {
      const rows = Array.isArray(payload?.Datas) ? payload.Datas : [];
      const funds = rows
        .filter((item) => String(item.CATEGORY) === '700' || item.CATEGORYDESC === '基金')
        .map((item) => ({
          code: String(item.CODE || '').trim(),
          name: String(item.NAME || item.SHORTNAME || '').trim(),
          type: String(item.FundBaseInfo?.FTYPE || item.CATEGORYDESC || '基金').trim()
        }))
        .filter((item) => /^\d{6}$/.test(item.code));
      if (settled) return;
      settled = true;
      cleanup();
      resolve(funds);
    };

    loadScript(url).catch((error) => fail(error instanceof Error ? error : new Error('搜索脚本加载失败，可能被浏览器插件拦截')));
  });
}

export function fetchFundHistory(code) {
  const normalized = String(code || '').trim();
  if (!/^\d{6}$/.test(normalized)) return Promise.reject(new Error('基金代码格式不正确'));

  return enqueue(() =>
    loadScript(`https://fund.eastmoney.com/pingzhongdata/${normalized}.js?v=${Date.now()}`, {
      timeout: 20000,
      onLoad: () => {
        const snapshot = {};
        PINGZHONG_KEYS.forEach((key) => {
          if (window[key] !== undefined) snapshot[key] = JSON.parse(JSON.stringify(window[key]));
        });
        const trend = Array.isArray(snapshot.Data_netWorthTrend) ? snapshot.Data_netWorthTrend : [];
        const history = trend
          .map((point) => ({
            timestamp: Number(point?.x),
            value: Number(point?.y),
            dailyReturn: Number.isFinite(Number(point?.equityReturn)) ? Number(point.equityReturn) : null
          }))
          .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.value))
          .sort((a, b) => a.timestamp - b.timestamp);
        if (!history.length) throw new Error('该基金暂无净值历史');
        return {
          code: snapshot.fS_code || normalized,
          name: snapshot.fS_name || normalized,
          history
        };
      }
    })
  );
}
