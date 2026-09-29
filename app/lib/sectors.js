const SECTOR_RULES = [
  { keywords: ['白酒'], name: '中证白酒', code: 'sz399997' },
  { keywords: ['沪深300'], name: '沪深300', code: 'sh000300' },
  { keywords: ['上证50'], name: '上证50', code: 'sh000016' },
  { keywords: ['中证500'], name: '中证500', code: 'sh000905' },
  { keywords: ['中证1000'], name: '中证1000', code: 'sh000852' },
  { keywords: ['创业板'], name: '创业板指', code: 'sz399006' },
  { keywords: ['科创50'], name: '科创50', code: 'sh000688' },
  { keywords: ['医药', '医疗', '生物医药'], name: '中证医疗', code: 'sz399989' },
  { keywords: ['半导体', '芯片'], name: '国证芯片', code: 'sz399006' }, // 无独立指数，创业板指兜底
  { keywords: ['新能源', '新能源车'], name: '新能源车', code: 'sz399976' },
  { keywords: ['军工'], name: '中证军工', code: 'sz399967' },
  { keywords: ['银行'], name: '中证银行', code: 'sz399986' },
  { keywords: ['券商', '证券'], name: '证券公司', code: 'sz399975' },
  { keywords: ['煤炭'], name: '中证煤炭', code: 'sz399998' },
  { keywords: ['钢铁'], name: '国证钢铁', code: 'sz399440' },
  { keywords: ['有色', '有色金属'], name: '国证有色', code: 'sz399395' },
  { keywords: ['房地产', '地产'], name: '国证地产', code: 'sz399393' },
  { keywords: ['传媒'], name: '中证传媒', code: 'sz399971' },
  { keywords: ['计算机'], name: 'CS计算机', code: 'sz399363' },
  { keywords: ['通信'], name: '中证通信', code: 'sz399909' },
  { keywords: ['5G'], name: '5G通信', code: 'sz994173' },
  { keywords: ['人工智能', 'AI'], name: 'CS人工智', code: 'sz930713' },
  { keywords: ['红利'], name: '中证红利', code: 'sh000922' },
  { keywords: ['纳斯达克'], name: '纳斯达克', code: 'usIXIC' },
  { keywords: ['恒生'], name: '恒生指数', code: 'hkHSI' }
];

export function inferSector(fundName) {
  if (!fundName) return null;
  const name = String(fundName);
  for (const rule of SECTOR_RULES) {
    if (rule.keywords.some((kw) => name.includes(kw))) {
      return { name: rule.name, code: rule.code };
    }
  }
  return null;
}
