# Infini管理系统后端

这是Infini账号管理系统的后端部分，使用TypeScript实现，提供账户监控、转账、注册和通知管理等功能的RESTful API。

## 技术栈

- TypeScript
- Node.js
- Express
- Swagger (API文档)
- JWT (认证)

## 目录结构

```
backend/
├── src/                  # 源码目录
│   ├── controllers/      # 控制器目录
│   │   ├── accountController.ts    # 账户监控控制器
│   │   ├── transferController.ts   # 账户转账控制器
│   │   ├── registerController.ts   # 账户注册控制器
│   │   └── notificationController.ts # 通知管理控制器
│   ├── routes/           # 路由目录
│   │   ├── accounts.ts   # 账户监控路由
│   │   ├── transfers.ts  # 账户转账路由
│   │   ├── registers.ts  # 账户注册路由
│   │   └── notifications.ts # 通知管理路由
│   ├── models/           # 数据模型目录 (待实现)
│   ├── middlewares/      # 中间件目录 (待实现)
│   ├── utils/            # 工具函数目录 (待实现)
│   ├── config/           # 配置文件目录 (待实现)
│   ├── types/            # TypeScript类型定义
│   │   └── index.ts      # 核心类型定义
│   ├── swagger/          # Swagger文档目录
│   │   └── swagger.ts    # Swagger补充定义
│   └── app.ts            # 应用主入口
├── dist/                 # 编译输出目录
├── .env.example          # 环境变量示例
├── tsconfig.json         # TypeScript配置
├── package.json          # 项目依赖配置
└── README.md             # 项目说明文档
```

## 功能模块

### 1. 账户监控模块

提供账户信息查询、余额监控和状态检查等功能。

API 端点:
- `GET /api/accounts` - 获取所有账户列表
- `GET /api/accounts/:id` - 获取指定账户详情
- `GET /api/accounts/:id/balance` - 获取指定账户余额
- `GET /api/accounts/:id/status` - 获取指定账户状态

### 2. 账户转账模块

处理账户间资金转移操作。

API 端点:
- `POST /api/transfers` - 创建新的转账请求
- `GET /api/transfers` - 获取转账记录列表
- `GET /api/transfers/:id` - 获取指定转账记录详情

### 3. 账户注册模块

支持单个和批量注册账户。

API 端点:
- `POST /api/registers` - 注册新账户
- `POST /api/registers/batch` - 批量注册账户
- `GET /api/registers` - 获取注册记录列表
- `GET /api/registers/template` - 下载批量注册模板文件
- `GET /api/registers/batch/:batchId` - 获取批量注册任务状态

### 4. 通知管理模块

管理系统通知设置和规则。

API 端点:
- `GET /api/notifications/settings` - 获取通知设置
- `PUT /api/notifications/settings` - 更新通知设置
- `POST /api/notifications/test` - 测试通知发送
- `GET /api/notifications/rules` - 获取通知规则列表
- `POST /api/notifications/rules` - 创建通知规则
- `PUT /api/notifications/rules/:id` - 更新通知规则
- `DELETE /api/notifications/rules/:id` - 删除通知规则
- `GET /api/notifications/history` - 获取通知历史记录

## TypeScript 类型系统

项目使用TypeScript实现，提供了完整的类型定义，主要包括：

- API请求和响应类型
- 账户、转账、注册和通知相关的业务类型
- 控制器方法类型
- 扩展的Express请求/响应类型

通过类型系统，可以获得更好的代码提示、编译时错误检查和代码文档。

## 安装与运行

### 环境要求

- Node.js >= 14.x
- NPM >= 6.x
- TypeScript >= 4.5.x

### 安装步骤

1. 克隆仓库
```bash
git clone [仓库URL]
cd infini-manager/backend
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
```bash
cp .env.example .env
# 使用编辑器修改.env文件中的配置
```

4. 构建项目
```bash
npm run build
```

5. 启动服务器
```bash
# 开发模式（支持热重载）
npm run dev

# 生产模式
npm start
```

6. 访问Swagger文档
```
http://localhost:5000/api-docs
```

## API文档

系统使用Swagger提供API文档，启动服务器后可通过`/api-docs`路径访问。

## 未来扩展

1. 添加数据库集成（MongoDB、MySQL等）
2. 实现用户认证和授权
3. 添加日志记录功能
4. 实现定时任务（账户余额检查、状态更新等）
5. 实现缓存系统优化性能
6. 添加单元测试和集成测试

## 贡献指南

1. Fork仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建Pull Request