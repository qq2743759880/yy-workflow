# 沙箱任务：TODO 工具后端 API

## 一句话需求
一个后端 API 服务，提供 TODO 任务的增删改查 RESTful 接口，支持用户注册登录和 JWT 认证，数据存 SQLite。

## 范围
- Node.js + Express 后端服务
- RESTful API：POST/GET/PUT/DELETE /todos
- 用户认证：注册、登录、JWT 中间件
- 数据持久化到 SQLite 文件
- 不做：前端页面、云部署、多租户

## 验收
- POST /register 创建用户
- POST /login 返回 JWT
- GET /todos 需认证，返回该用户的 TODO 列表
- POST /todos 创建新 TODO
- PUT /todos/:id 更新完成状态
- DELETE /todos/:id 删除
