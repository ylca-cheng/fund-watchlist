import './globals.css';

export const metadata = {
  title: '基线 · 实时基金观察台',
  description: '搜索全市场基金，查看实时净值历史、区间最高净值和总涨跌幅。',
  icons: { icon: '/favicon.svg' }
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
