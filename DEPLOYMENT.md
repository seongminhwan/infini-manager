# Infini 账号管理系统 - 部署手册

本文档为Infini账号管理系统的部署手册，详细介绍如何部署、更新和管理系统。

## 目录

- [版本信息](#版本信息)
- [部署方式](#部署方式)
  - [Docker部署](#docker部署)
- [更新与升级](#更新与升级)
- [备份与恢复](#备份与恢复)
- [常见问题](#常见问题)

## 版本信息

### 当前版本

- **版本号**: v0.3
- **发布日期**: 2025年5月
- **主要更新**:
  - 完善项目文档
  - 增加面向小白用户的使用手册
  - 优化Docker部署流程
  - 提供详细的数据库切换说明

### 版本历史

- **v0.2**
  - 添加Docker支持
  - 增加MySQL数据库支持
  - 优化前端界面

- **v0.1**
  - 初始版本
  - 基本账户监控功能
  - SQLite数据库支持

## 部署方式

### Docker部署

Docker部署是推荐的部署方式，它具有以下优点：
- 环境一致性，避免"在我电脑上能运行"的问题
- 简化部署流程，无需安装Node.js等依赖
- 便于管理和扩展

#### 前提条件

- 安装Docker和Docker Compose
  ```bash
  # 安装Docker (Ubuntu)
  curl -fsSL https://get.docker.com -o get-docker.sh
  sudo sh get-docker.sh
  
  # 安装Docker Compose
  sudo curl -L "https://github.com/docker/compose/releases/download/v2.15.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
  ```

#### 部署步骤

1. 获取项目代码
   ```bash
   git clone https://github.com/seongminhwan/infini-manager.git
   cd infini-manager
   ```

2. 配置环境
   ```bash
   # 复制后端环境配置文件
   cp backend/.env.example backend/.env
   
   # 根据需要修改.env文件
   # 注意：在Docker环境中，应设置DISABLE_IP_CHECK=true
   vi backend/.env
   ```

3. 启动服务
   ```bash
   # 使用Docker Compose启动所有服务
   docker-compose up -d
   ```

4. 验证部署
   - 访问前端: http://localhost:80 或直接http://localhost
   - 访问后端API: http://localhost:33201/api/health

#### 使用官方Docker镜像

我们也提供了预构建的官方Docker镜像，可以通过以下步骤使用：

1. 创建`docker-compose.yml`文件
   ```yaml
   version: '3.8'
   
   services:
     backend:
       image: ghcr.io/seongminhwan/infini-manager/backend:v0.3
       ports:
         - "33201:3000"
       environment:
         - NODE_ENV=production
         - DB_TYPE=sqlite
         - DISABLE_IP_CHECK=true
       volumes:
         - ./backend/.env:/app/.env
         - ./data:/app/data
       restart: unless-stopped
       networks:
         - infini-network
       depends_on:
         - mysql
   
     frontend:
       image: ghcr.io/seongminhwan/infini-manager/frontend:v0.3
       ports:
         - "80:80"
       restart: unless-stopped
       depends_on:
         - backend
       networks:
         - infini-network
       
     mysql:
       image: mysql:8.0
       container_name: infini-mysql
       restart: unless-stopped
       environment:
         - MYSQL_ROOT_PASSWORD=password
         - MYSQL_DATABASE=infini_manager
       ports:
         - "3307:3306"
       volumes:
         - ./data/mysql:/var/lib/mysql
         - ./backend/init-mysql.sql:/docker-entrypoint-initdb.d/init.sql
       networks:
         - infini-network
   
   networks:
     infini-network:
       driver: bridge
   ```

2. 启动服务
   ```bash
   docker-compose up -d
   ```

## 更新与升级

### Docker环境更新

对于使用Docker部署的环境，更新系统到新版本的步骤如下：

1. 拉取最新代码
   ```bash
   git fetch
   git checkout v0.3  # 切换到最新标签
   ```

2. 重新构建并启动容器
   ```bash
   docker-compose down
   docker-compose build
   docker-compose up -d
   ```

### 使用GitHub Actions构建镜像

本项目配置了GitHub Actions工作流，可以自动构建Docker镜像并发布到GitHub Packages。

1. 为发布创建一个新标签
   ```bash
   git tag v0.3.1  # 创建一个新标签
   git push origin v0.3.1  # 推送标签到GitHub
   ```

2. GitHub Actions工作流将自动触发，构建镜像并推送到GitHub Packages

3. 使用新镜像进行部署
   ```bash
   # 修改docker-compose.yml中的镜像标签
   # image: ghcr.io/seongminhwan/infini-manager/backend:v0.3.1
   
   # 重启服务
   docker-compose pull
   docker-compose up -d
   ```

## 备份与恢复

### 数据备份

#### SQLite数据库备份

SQLite数据库文件位于`backend/db/infini.sqlite3`，可以直接复制此文件进行备份：

```bash
# 创建备份目录
mkdir -p backups

# 备份数据库文件
cp backend/db/infini.sqlite3 backups/infini_$(date +%Y%m%d_%H%M%S).sqlite3
```

#### MySQL数据库备份

对于MySQL数据库，可以使用`mysqldump`工具进行备份：

```bash
# Docker环境中的MySQL备份
docker exec -i infini-mysql mysqldump -uroot -ppassword infini_manager > backups/infini_$(date +%Y%m%d_%H%M%S).sql

# 本地MySQL备份
mysqldump -uroot -ppassword -h localhost -P 3307 infini_manager > backups/infini_$(date +%Y%m%d_%H%M%S).sql
```

### 数据恢复

#### SQLite数据恢复

```bash
# 停止服务
docker-compose down

# 恢复数据库文件
cp backups/your_backup_file.sqlite3 backend/db/infini.sqlite3

# 重启服务
docker-compose up -d
```

#### MySQL数据恢复

```bash
# Docker环境中的MySQL恢复
cat backups/your_backup_file.sql | docker exec -i infini-mysql mysql -uroot -ppassword infini_manager

# 本地MySQL恢复
mysql -uroot -ppassword -h localhost -P 3307 infini_manager < backups/your_backup_file.sql
```

## 常见问题

### 1. Docker容器启动失败

**问题**: Docker容器无法正常启动。

**解决方案**:
1. 检查日志
   ```bash
   docker-compose logs
   ```
2. 确认端口未被占用
   ```bash
   netstat -tulpn | grep 33201
   netstat -tulpn | grep 80
   ```
3. 确认环境配置正确
   ```bash
   cat backend/.env
   ```

### 2. 无法连接MySQL数据库

**问题**: 后端服务无法连接MySQL数据库。

**解决方案**:
1. 检查MySQL容器是否运行
   ```bash
   docker ps | grep mysql
   ```
2. 确认数据库连接配置
   ```bash
   # 检查.env文件中的数据库配置
   cat backend/.env
   
   # 尝试手动连接数据库
   docker exec -it infini-mysql mysql -uroot -ppassword -h localhost infini_manager
   ```

### 3. 前端显示"无法连接到服务器"

**问题**: 前端界面加载，但无法获取后端数据。

**解决方案**:
1. 确认后端服务正常运行
   ```bash
   curl http://localhost:33201/api/health
   ```
2. 检查CORS配置
   ```bash
   # 确认后端允许前端域名的跨域请求
   # 在Docker环境中，前端应该可以直接访问后端API
   ```
3. 检查前端配置
   ```bash
   # 在Docker环境中，前端应使用相对路径访问API
   ```

### 4. 数据库迁移错误

**问题**: 启动时数据库迁移失败。

**解决方案**:
1. 检查数据库权限
2. 对于SQLite，确保db目录存在且可写
   ```bash
   mkdir -p backend/db
   chmod 777 backend/db  # 在开发环境中，生产环境应使用更严格的权限
   ```
3. 对于MySQL，确保数据库存在且用户有足够权限
   ```bash
   # 创建数据库和用户
   mysql -uroot -p
   CREATE DATABASE IF NOT EXISTS infini_manager;
   GRANT ALL PRIVILEGES ON infini_manager.* TO 'your_user'@'%';
   FLUSH PRIVILEGES;