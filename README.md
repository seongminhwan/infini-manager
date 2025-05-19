# Infini 账号管理系统

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/seongminhwan/infini-manager)

## 免责声明 | DISCLAIMER

**⚠️ 重要声明：本项目仅供学习和研究使用 ⚠️**  
**⚠️ IMPORTANT DISCLAIMER: THIS PROJECT IS FOR EDUCATIONAL AND RESEARCH PURPOSES ONLY ⚠️**

- 本项目仅用于技术学习、研究和个人非商业用途  
  This project is solely for technical learning, research, and personal non-commercial use
  
- 严禁将本系统用于任何商业目的  
  Commercial use of this system is strictly prohibited
  
- 严禁使用本系统进行任何违反法律法规的活动  
  Any use of this system for illegal activities is strictly prohibited
  
- 使用本系统所产生的任何法律责任均由使用者自行承担  
  Users bear all legal responsibilities arising from the use of this system
  
- 开发者不对使用本系统所导致的任何直接或间接损失负责  
  Developers are not responsible for any direct or indirect losses caused by using this system
  
- 如对系统用途有疑问，请在使用前咨询法律顾问  
  If you have questions about the system's usage, please consult a legal advisor before use

## 系统状态警告

**⚠️ 开发阶段警告 ⚠️**

本系统目前处于开发阶段，存在以下风险：
- 系统稳定性无法保证
- 可能存在未知的安全隐患
- 功能可能随时变更或失效
- 数据可能丢失或损坏
- 由使用本系统造成的任何损失需自行承担

## 未完成工作提示

请注意，本系统仍有大量功能尚未完成或验证：
- 多项核心功能仍在开发中
- 部分已实现功能未经充分测试
- 性能优化尚未完成
- 安全机制可能不完善
- API接口可能发生变化

## 使用前提条件

**⚠️ 必须配置主邮箱 ⚠️**

在使用本系统前，您必须：
1. 配置系统主邮箱
2. 完成邮箱验证流程
3. 确认邮箱可正常接收通知

未正确配置邮箱将导致系统核心功能无法使用。

## 当前可用功能

**目前系统仅开放以下功能：**
- 账户监控模块

其他模块尚在开发中，暂不可用。

---

# 使用手册 (面向小白用户)

## 系统简介

这是一个用于监测和维护Infini账号的系统，系统主要分为两个部分:
1. 账号情况监控、管理、转账，包括账户余额监控、账户状态监控、账户信息查询
2. 通知系统，可以通过TG/Email方式通知用户，后续还会扩展

## 环境准备（小白必读）

在开始安装之前，请确保您的电脑已安装以下软件：

### 必需软件

1. **Node.js**：JavaScript运行环境
   - 下载地址：https://nodejs.org/
   - 推荐版本：14.x或更高版本
   - 安装后，打开命令行窗口输入`node -v`确认安装成功

2. **npm**：Node.js包管理器（Node.js安装时会自动安装）
   - 命令行输入`npm -v`确认安装成功

### 可选软件（使用Docker部署时必需）

1. **Docker**：容器化平台
   - 下载地址：https://www.docker.com/products/docker-desktop/
   - 安装后，打开命令行窗口输入`docker -v`确认安装成功

2. **Docker Compose**：容器编排工具（通常Docker Desktop会自带）
   - 命令行输入`docker-compose -v`确认安装成功

## 安装与启动（三种方式）

### 方式一：本地安装（入门级）

这种方式适合开发者或者想要了解系统内部工作原理的用户。

1. **获取源代码**
```bash
# 使用Git克隆项目
git clone https://github.com/seongminhwan/infini-manager.git
# 进入项目目录
cd infini-manager
```

2. **安装和启动后端**
```bash
# 进入后端目录
cd backend
# 安装依赖
npm install
# 复制环境配置文件（首次使用需要）
cp .env.example .env
# 启动后端服务
npm run dev
```

3. **安装和启动前端**（在新的命令行窗口中）
```bash
# 进入前端目录
cd frontend
# 安装依赖
npm install
# 启动前端服务
npm start
```

4. **访问系统**
   - 前端界面：http://localhost:33202
   - 后端API：http://localhost:33201

### 方式二：使用Makefile一键启动（推荐）

这种方式是最简单的，它会自动检查和安装所需的依赖。

```bash
# 一键启动所有服务（前端+后端+SQLite数据库）
make start

# 或者仅启动后端
make backend

# 或者仅启动前端
make front
```

如果要使用MySQL数据库：
```bash
# 启动MySQL服务和后端
make start-mysql

# 启动所有服务（前端+后端+MySQL数据库）
make start-mysql-all
```

停止服务：
```bash
make stop
```

查看所有可用命令：
```bash
make help
```

### 方式三：使用Docker部署

这种方式适合不想在本地安装Node.js或需要在隔离环境中运行的用户。

1. **准备工作**
```bash
# 复制后端配置文件（首次使用需要）
cp backend/.env.example backend/.env
```

2. **启动服务**
```bash
# 使用Docker Compose启动所有服务
make docker-start
# 或者直接使用Docker Compose命令
docker-compose up -d
```

3. **访问系统**
   - 前端界面：http://localhost 或 http://localhost:80
   - 后端API：http://localhost:33201

4. **查看日志**
```bash
make docker-logs
# 或者
docker-compose logs -f
```

5. **停止服务**
```bash
make docker-stop
# 或者
docker-compose down
```

## 数据库选择

本系统支持两种数据库：

### 1. SQLite（默认）

- **优点**：无需安装其他软件，开箱即用
- **缺点**：性能较弱，不适合高并发场景
- **适用场景**：个人使用，测试环境
- **数据文件位置**：`backend/db/infini.sqlite3`

### 2. MySQL

- **优点**：性能较好，适合多用户访问
- **缺点**：需要额外安装MySQL服务器，配置较复杂
- **适用场景**：生产环境，多用户使用
- **默认配置**：主机localhost，端口3307，用户名root，密码password，数据库名infini_manager

## 如何切换数据库类型（小白教程）

### 方法一：修改配置文件

1. 打开`backend/.env`文件
2. 找到`DB_TYPE=sqlite`这一行
3. 修改为`DB_TYPE=mysql`即可切换到MySQL
4. 如果要切回SQLite，则改为`DB_TYPE=sqlite`

### 方法二：使用Makefile命令（最简单）

```bash
# 使用SQLite数据库启动
make start

# 使用MySQL数据库启动
make start-mysql
```

## 目录结构说明

本项目分为前端和后端两个部分：

```
infini-manager/
├── backend/           # 后端代码目录
│   ├── src/           # 源代码
│   │   ├── controllers/  # 控制器
│   │   ├── db/           # 数据库相关
│   │   ├── routes/       # 路由定义
│   │   ├── service/      # 服务层
│   │   ├── types/        # 类型定义
│   │   └── utils/        # 工具函数
│   ├── .env           # 环境配置
│   └── knexfile.ts    # 数据库配置
│
├── frontend/           # 前端代码目录
│   ├── public/         # 静态资源
│   ├── src/            # 源代码
│   │   ├── components/   # 组件
│   │   ├── pages/        # 页面
│   │   ├── services/     # API服务
│   │   └── config.*.ts   # 配置文件
│   └── nginx.conf     # Nginx配置（Docker环境使用）
│
├── docker-compose.yml  # Docker配置
└── Makefile           # 快速命令脚本
```

## 常见问题与解决方案

### 1. 启动时提示端口被占用

**问题**: 启动服务时提示端口33201或33202已被占用。

**解决方案**:
```bash
# 查找占用端口的进程
lsof -i :33201
# 或
lsof -i :33202

# 停止占用端口的进程
kill -9 <进程ID>

# 或者使用make命令停止所有服务
make stop
```

### 2. MySQL连接失败

**问题**: 使用MySQL时连接失败。

**解决方案**:
1. 确认MySQL服务是否启动
2. 检查`backend/.env`中的数据库配置是否正确
3. 如果使用Docker的MySQL，可以重启容器：
   ```bash
   make mysql-stop
   make mysql-start
   ```

### 3. 前端无法连接后端API

**问题**: 前端界面加载成功，但无法获取数据。

**解决方案**:
1. 确认后端服务是否正常运行
2. 打开浏览器控制台（F12），查看是否有请求错误
3. 确认前端配置文件中的API地址是否正确：
   - 开发环境：`frontend/src/config.dev.ts`
   - Docker环境：`frontend/src/config.docker.ts`

### 4. Docker环境数据丢失

**问题**: 使用Docker重启后数据丢失。

**解决方案**:
- 确保数据卷正确配置，Docker数据应该存储在：
  - MySQL数据：`./data/mysql`
  - SQLite数据：`./backend/db`

### 5. 无法发送通知

**问题**: 系统无法发送电子邮件或TG通知。

**解决方案**:
1. 检查后端`.env`文件中的邮箱和TG配置
2. 确保配置的邮箱账户可用且允许第三方应用访问
3. 对于Gmail，需要生成应用专用密码

## 更多帮助

如果您在使用过程中遇到其他问题，可以：

1. 查阅详细的开发文档：`DEVELOPMENT.md`
2. 提交Issue到项目仓库
3. 联系开发团队获取支持