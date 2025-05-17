# Infini Manager 启动配置
# 定义端口号
BACKEND_PORT = 33201
FRONTEND_PORT = 33202

# 默认命令: 先启动后端，再启动前端
start:
	@echo "启动所有服务 (先后端，再前端)..."
	@$(MAKE) start-backend
	@sleep 5  # 等待后端完全启动
	@$(MAKE) start-front

# 启动后端命令
start-backend:
	@echo "正在启动后端服务 (端口: $(BACKEND_PORT))..."
	@# 检查端口是否被占用
	@echo "检查端口 $(BACKEND_PORT) 是否被占用..."
	@if lsof -i :$(BACKEND_PORT) > /dev/null; then \
		echo "端口 $(BACKEND_PORT) 已被占用，正在关闭相关进程..."; \
		PID=$$(lsof -t -i:$(BACKEND_PORT)); \
		if [ ! -z "$$PID" ]; then \
			echo "关闭进程 PID: $$PID"; \
			kill -9 $$PID || true; \
			sleep 1; \
		fi; \
	else \
		echo "端口 $(BACKEND_PORT) 未被占用"; \
	fi
	@# 检查node_modules是否存在
	@if [ ! -d "backend/node_modules" ]; then \
		echo "后端node_modules不存在，正在安装依赖..."; \
		cd backend && npm install; \
	fi
	@# 启动后端服务
	@echo "启动后端服务..."
	@cd backend && npm run dev &
	@echo "后端服务正在启动，请等待..."

# 启动前端命令
start-front:
	@echo "正在启动前端服务 (端口: $(FRONTEND_PORT))..."
	@# 检查端口是否被占用
	@echo "检查端口 $(FRONTEND_PORT) 是否被占用..."
	@if lsof -i :$(FRONTEND_PORT) > /dev/null; then \
		echo "端口 $(FRONTEND_PORT) 已被占用，正在关闭相关进程..."; \
		PID=$$(lsof -t -i:$(FRONTEND_PORT)); \
		if [ ! -z "$$PID" ]; then \
			echo "关闭进程 PID: $$PID"; \
			kill -9 $$PID || true; \
			sleep 1; \
		fi; \
	else \
		echo "端口 $(FRONTEND_PORT) 未被占用"; \
	fi
	@# 检查node_modules是否存在
	@if [ ! -d "frontend/node_modules" ]; then \
		echo "前端node_modules不存在，正在安装依赖..."; \
		cd frontend && npm install; \
	fi
	@# 启动前端服务
	@echo "启动前端服务..."
	@cd frontend && npm run dev &
	@echo "前端服务正在启动，请等待..."

# 单独指定其他命令
backend: start-backend
front: start-front

# 使用MySQL启动后端
start-mysql:
	@echo "使用MySQL启动后端服务..."
	@# 检查MySQL Docker是否运行，如果没有就启动
	@if ! docker ps | grep -q infini-mysql; then \
		echo "MySQL Docker实例未运行，正在启动..."; \
		$(MAKE) mysql-start; \
	fi
	@# 复制MySQL环境配置
	@echo "复制MySQL环境配置文件..."
	@cp backend/.env.mysql backend/.env
	@echo "环境配置已切换到MySQL"
	@# 启动后端服务
	@$(MAKE) start-backend

# 使用MySQL启动所有服务（后端和前端）
start-mysql-all:
	@echo "使用MySQL启动所有服务..."
	@# 首先启动MySQL后端
	@$(MAKE) start-mysql
	@sleep 5  # 等待后端完全启动
	@# 启动前端
	@$(MAKE) start-front
	@echo "所有服务已启动 (使用MySQL数据库)"

# 停止所有服务
stop:
	@echo "正在停止所有服务..."
	@# 停止后端服务
	@if lsof -i :$(BACKEND_PORT) > /dev/null; then \
		echo "停止后端服务 (端口: $(BACKEND_PORT))..."; \
		PID=$$(lsof -t -i:$(BACKEND_PORT)); \
		if [ ! -z "$$PID" ]; then \
			kill -9 $$PID || true; \
		fi; \
	fi
	@# 停止前端服务
	@if lsof -i :$(FRONTEND_PORT) > /dev/null; then \
		echo "停止前端服务 (端口: $(FRONTEND_PORT))..."; \
		PID=$$(lsof -t -i:$(FRONTEND_PORT)); \
		if [ ! -z "$$PID" ]; then \
			kill -9 $$PID || true; \
		fi; \
	fi
	@echo "所有服务已停止"

# Docker相关命令
# 使用docker-compose启动所有服务
docker-start:
	@echo "使用Docker Compose启动所有服务..."
	@docker-compose up -d
	@echo "Docker服务已启动, 前端访问: http://localhost:33202, 后端访问: http://localhost:33201"

# 停止docker-compose服务
docker-stop:
	@echo "停止Docker Compose服务..."
	@docker-compose down
	@echo "Docker服务已停止"

# 构建docker-compose镜像
docker-build:
	@echo "构建Docker Compose镜像..."
	@docker-compose build
	@echo "Docker镜像构建完成"

# 查看docker-compose日志
docker-logs:
	@echo "查看Docker Compose日志..."
	@docker-compose logs -f

# MySQL Docker相关命令
# 启动MySQL Docker实例
mysql-start:
	@echo "启动MySQL Docker实例..."
	@# 创建MySQL数据持久化目录
	@mkdir -p ./data/mysql
	@# 检查MySQL容器是否已存在
	@if docker ps -a | grep -q infini-mysql; then \
		echo "MySQL容器已存在，正在停止并移除..."; \
		docker stop infini-mysql || true; \
		docker rm infini-mysql || true; \
	fi
	@# 启动MySQL容器
	@echo "正在启动MySQL容器..."
	@docker run --name infini-mysql \
		-e MYSQL_ROOT_PASSWORD=password \
		-e MYSQL_DATABASE=infini_manager \
		-p 3307:3306 \
		-v $(shell pwd)/data/mysql:/var/lib/mysql \
		-d mysql:8.0 \
		--character-set-server=utf8mb4 \
		--collation-server=utf8mb4_unicode_ci
	@echo "MySQL容器已启动，正在等待服务就绪..."
	@# 等待MySQL服务就绪
	@sleep 10
	@echo "MySQL服务已启动"
	@echo "连接信息:"
	@echo "  主机: localhost"
	@echo "  端口: 3307"
	@echo "  用户: root"
	@echo "  密码: password"
	@echo "  数据库: infini_manager"
	@echo ""
	@echo "在.env文件中设置DB_TYPE=mysql以使用MySQL数据库"

# 停止MySQL Docker实例
mysql-stop:
	@echo "停止MySQL Docker实例..."
	@if docker ps -a | grep -q infini-mysql; then \
		docker stop infini-mysql; \
		echo "MySQL实例已停止"; \
	else \
		echo "MySQL实例未运行"; \
	fi

# 帮助说明
help:
	@echo "Infini Manager 使用说明:"
	@echo "本地服务命令:"
	@echo "  make start        - 启动所有服务 (先后端，再前端，使用SQLite)"
	@echo "  make backend      - 仅启动后端服务 (使用SQLite)"
	@echo "  make front        - 仅启动前端服务"
	@echo "  make stop         - 停止所有服务"
	@echo ""
	@echo "MySQL服务命令:"
	@echo "  make start-mysql      - 使用MySQL启动后端服务"
	@echo "  make start-mysql-all  - 使用MySQL启动所有服务 (先后端，再前端)"
	@echo ""
	@echo "Docker服务命令:"
	@echo "  make docker-start - 使用Docker Compose启动所有服务"
	@echo "  make docker-stop  - 停止Docker Compose服务"
	@echo "  make docker-build - 构建Docker Compose镜像"
	@echo "  make docker-logs  - 查看Docker Compose日志"
	@echo ""
	@echo "MySQL Docker命令:"
	@echo "  make mysql-start  - 启动MySQL Docker实例 (数据持久化到./data/mysql目录)"
	@echo "  make mysql-stop   - 停止MySQL Docker实例"
	@echo ""
	@echo "其他命令:"
	@echo "  make help         - 显示帮助信息"

.PHONY: start start-backend start-front backend front stop help docker-start docker-stop docker-build docker-logs mysql-start mysql-stop start-mysql start-mysql-all