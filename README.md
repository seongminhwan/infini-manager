# Infini 账号管理系统

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

## 系统简介

这是一个用于监测和维护Infini账号的系统，系统主要分为两个部分:
1. 账号情况监控，管理，转账，包括账户余额监控，账户状态监控，账户信息查询
2. 通知系统，可以通过tg/email方式通知用户，后续还会扩展

## 系统架构

项目在架构上分为前端和后端两个部分：
- 前端基于React提供一个现代化美观的UI视图
- 后端通过nodejs+express提供接口和定时任务
- 支持Docker容器化部署，便于快速搭建和迁移

## 安装与配置

### 方式一：本地安装

#### 前端安装
```bash
cd frontend
npm install
npm start
```

#### 后端安装
```bash
cd backend
npm install
npm run dev
```

#### 环境配置
1. 在后端目录下复制`.env.example`文件并重命名为`.env`
2. 编辑`.env`文件，配置您的邮箱和其他必要信息
3. 重启后端服务使配置生效

### 方式二：使用Makefile快速启动

```bash
# 启动所有服务（后端+前端）
make start

# 仅启动后端服务
make backend

# 仅启动前端服务
make front

# 停止所有服务
make stop

# 查看所有可用命令
make help
```

### 方式三：使用Docker部署

#### 前提条件
- 已安装Docker和Docker Compose
- 确保端口33201和33202未被占用

#### 使用Docker Compose启动
```bash
# 使用Makefile启动
make docker-start

# 或直接使用Docker Compose命令
docker-compose up -d
```

#### 手动构建和启动
```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 服务访问地址
# 前端：http://localhost:33202
# 后端：http://localhost:33201

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

#### Docker环境配置
1. 在backend目录下复制`.env.example`文件并重命名为`.env`
2. 编辑`.env`文件，配置所需的环境变量
3. Docker Compose会自动加载此配置文件

## 使用指南

1. 首先确保完成邮箱配置和验证
2. 登录系统进入账户监控模块
3. 按照界面提示添加和监控账户

## 常见问题

如遇问题，请先检查：
- 邮箱配置是否正确
- 后端服务是否正常运行
- 数据库连接是否正常
- Docker环境下，确保容器正常运行：`docker-compose ps`
- Docker部署时，可通过以下地址访问服务：
  - 前端界面：http://localhost:33202
  - 后端API：http://localhost:33201