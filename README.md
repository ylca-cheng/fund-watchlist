# 基线 · 实时基金观察台

基于 Next.js 的实时基金查询与自选工具，参考 `real-time-fund` 的数据获取方式，通过东方财富 JSONP 接口搜索基金，并加载基金历史净值。

## 开发

```bash
npm install
npm run dev
```

打开 <http://localhost:3000>。

## 构建

```bash
npm run build
```

静态产物输出到 `out/`。

## 数据说明

- 基金搜索：东方财富 `FundSearchAPI`
- 基金净值：东方财富 `pingzhongdata`
- 自选基金：浏览器本地存储

第三方公开接口可能调整或限流，本项目不构成任何投资建议。
