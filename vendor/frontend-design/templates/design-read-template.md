# Design Read 交付模板（frontend-design 生产资源）

> 模板标准件注记：五个区块（Design Read/三拨盘/数据查询留痕/机检门/红线核对）与字段行为 FIXED 区；`<>` 占位为 VARIABLE 区。

```
## Design Read
Reading this as: <页面类型> for <受众>, with <vibe 词>, leaning toward <体系/风格族>。
简报六信号：类型=<…>；vibe=<…>；参考=<…>；受众=<…>；品牌资产=<…>；静默约束=<…（若有，声明其覆盖审美偏好）>

## 三拨盘
DESIGN_VARIANCE=<n>/10（理由：<简报依据>）
MOTION_INTENSITY=<n>/10（理由：<…>）
VISUAL_DENSITY=<n>/10（理由：<…>）

## 数据查询留痕
- [style] "dark tech saas" → 命中 <行名/值>（采用：<具体值>）
- [color] "calm fintech palette" → 命中 <…>
- [typography] "editorial pairing" → 命中 <…>
（python 缺失时：直读 CSV <文件+行> 或 □ 跳过已声明）

## 机检门
frontend-quality-gate exit=<0|1>；警告=<n> 条（例外标记及简报依据：<…>）；主观项 N/A 如实。

## 红线核对
AI Slop 五红线：无默认采用 / 例外（理由）：<…>
```
