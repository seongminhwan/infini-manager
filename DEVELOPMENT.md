# Infini 账号管理系统 - 开发手册

本文档为Infini账号管理系统的开发手册，主要面向开发者和系统管理员，详细介绍如何搭建开发环境、配置系统和进行部署。

## 目录

- [环境要求](#环境要求)
- [安装步骤](#安装步骤)
  - [方法一：本地开发环境](#方法一本地开发环境)
  - [方法二：使用Makefile快速启动](#方法二使用makefile快速启动)
  - [方法三：使用Docker部署](#方法三使用docker部署)
- [数据库配置](#数据库配置)
  - [SQLite配置](#sqlite配置)
  - [MySQL配置](#mysql配置)
  - [如何切换数据库类型](#如何切换数据库类型)
- [项目配置](#项目配置)
  - [后端配置](#后端配置)
  - [前端配置](#前端配置)
- [常见问题](#常见问题)

## 环境要求

开发和运行本项目需要以下环境：

- Node.js 14.x 或更高版本
- npm 6.x 或更高版本
- 可选：Docker 和 Docker Compose (用于容器化部署)
- 可选：MySQL 8.0 (如果不使用SQLite或Docker中的MySQL)

## 安装步骤

### 方法一：本地开发环境

这种方法适合开发者在本地进行开发和测试。

#### 1. 克隆代码库

```bash
git clone <项目Git地址>
cd infini-manager
```

#### 2. 安装后端依赖并启动

```bash
cd backend
npm install
# 复制环境配置文件并根据需要修改
cp .env.example .env
# 启动开发服务器
npm run dev
```

此时，后端API服务会启动在 http://localhost:33201

#### 3. 安装前端依赖并启动

在新的终端窗口中执行：

```bash
cd frontend
npm install
# 启动开发服务器
npm start
```

此时，前端开发服务器会启动在 http://localhost:33202

### 方法二：使用Makefile快速启动

这种方法通过Makefile脚本简化了环境的启动过程，适合快速部署和测试。

```bash
# 启动所有服务（默认使用SQLite数据库）
make start

# 仅启动后端服务
make backend

# 仅启动前端服务
make front

# 使用MySQL启动后端服务
make start-mysql

# 使用MySQL启动所有服务
make start-mysql-all

# 停止所有服务
make stop

# 查看所有可用命令
make help
```

### 方法三：使用Docker部署

这种方法使用Docker容器化技术部署整个应用，包括前端、后端和数据库，适合生产环境或者不想在本地安装依赖的情况。

#### 前提条件

- 已安装Docker和Docker Compose
- 确保端口33201和33202未被占用

#### 步骤

1. 配置环境文件

```bash
# 复制后端环境配置文件
cp backend/.env.example backend/.env
```

2. 使用Docker Compose启动服务

```bash
# 使用Makefile启动（推荐）
make docker-start

# 或直接使用Docker Compose命令
docker-compose up -d
```

3. 使用SQLite模式启动Docker服务（适合轻量级部署）

```bash
make docker-sqlite
```

4. 查看日志和停止服务

```bash
# 查看服务日志
make docker-logs
# 或
docker-compose logs -f

# 停止服务
make docker-stop
# 或
docker-compose down
```

## 数据库配置

本系统支持两种数据库：SQLite（默认）和MySQL。

### SQLite配置

SQLite是默认的数据库类型，不需要额外的数据库服务器。

- 数据库文件位置：`backend/db/infini.sqlite3`
- 优点：无需安装额外的数据库服务，适合开发和小型部署
- 缺点：性能和并发处理能力相对有限

### MySQL配置

对于生产环境或者需要更好性能的场景，推荐使用MySQL。

#### 本地MySQL配置

1. 确保MySQL服务已安装并启动
2. 在`backend/.env`文件中设置MySQL连接信息：

```
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306   # 默认MySQL端口
DB_USER=用户名
DB_PASSWORD=密码
DB_NAME=infini_manager
```

#### Docker MySQL配置

使用Docker Compose启动时，会自动创建一个MySQL容器：

- 主机：localhost
- 端口：3307（映射到宿主机）
- 用户名：root
- 密码：password
- 数据库名：infini_manager
- 数据存储目录：`./data/mysql`

也可以单独启动MySQL Docker容器：

```bash
make mysql-start
```

### 如何切换数据库类型

#### 方法1：修改环境变量

编辑`backend/.env`文件，修改`DB_TYPE`的值：

```
# SQLite
DB_TYPE=sqlite

# 或MySQL
DB_TYPE=mysql
```

#### 方法2：使用Makefile命令

```bash
# 默认使用SQLite
make start

# 使用MySQL
make start-mysql
```

#### 方法3：Docker环境变量

在`docker-compose.yml`文件中，可以通过修改backend服务的环境变量来切换数据库类型：

```yaml
backend:
  environment:
    - DB_TYPE=sqlite  # 或mysql
```

## 项目配置

### 后端配置

后端环境变量存储在`backend/.env`文件中，主要配置项包括：

| 环境变量        | 描述                       | 默认值                    |
|----------------|----------------------------|--------------------------|
| PORT           | 后端服务端口                | 33201                    |
| NODE_ENV       | 环境（development/production）| development               |
| DB_TYPE        | 数据库类型（sqlite/mysql）   | sqlite                   |
| DB_HOST        | MySQL主机地址               | localhost                |
| DB_PORT        | MySQL端口                   | 3307                     |
| DB_USER        | MySQL用户名                 | root                     |
| DB_PASSWORD    | MySQL密码                   | password                 |
| DB_NAME        | MySQL数据库名               | infini_manager           |
| DISABLE_IP_CHECK | 禁用IP检查（Docker环境中设为true） | false |
| JWT_SECRET     | JWT密钥                    | your_jwt_secret_key_here |

### 前端配置

前端使用TypeScript配置文件而非.env文件，配置文件位于：

- `frontend/src/config.ts` - 主配置文件，根据环境导入不同配置
- `frontend/src/config.dev.ts` - 开发环境配置
- `frontend/src/config.docker.ts` - Docker环境配置

#### 开发环境配置 (config.dev.ts)

```typescript
export const API_BASE_URL = 'http://localhost:33201';
export const PORT = 33202;
export const CONFIG = {
  environment: 'development',
  apiBaseUrl: API_BASE_URL,
  port: PORT,
  debug: true,
  logLevel: 'debug'
};
```

#### Docker环境配置 (config.docker.ts)

```typescript
export const API_BASE_URL = '';  // 空字符串，由Nginx代理转发
export const PORT = 80;
export const CONFIG = {
  environment: 'docker',
  apiBaseUrl: API_BASE_URL,
  port: PORT,
  debug: false,
  logLevel: 'info'
};
```

## 常见问题

### 1. 端口冲突问题

如果启动服务时提示端口被占用，可以：

- 修改后端.env文件中的PORT设置
- 修改前端配置文件中的端口设置
- 或使用make命令停止现有服务：`make stop`

### 2. 数据库连接问题

- SQLite：确保backend/db目录存在并有写入权限
- MySQL：检查连接参数是否正确，MySQL服务是否运行

### 3. Docker相关问题

- 确保Docker和Docker Compose已正确安装
- 检查Docker服务是否启动：`docker info`
- 查看容器日志：`docker-compose logs -f`

### 4. 依赖安装失败

如果npm安装依赖失败，尝试：

```bash
# 清除npm缓存
npm cache clean --force
# 重新安装
npm install
```

### 5. 如何清空数据库

- SQLite：删除`backend/db/infini.sqlite3`文件
- MySQL：重新创建数据库或执行重置脚本：
  ```bash
  # 对于Docker MySQL
  docker exec -i infini-mysql mysql -uroot -ppassword infini_manager < backend/reset-mysql.sql
  ```</kodu_content>