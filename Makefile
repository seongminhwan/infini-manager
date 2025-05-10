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

# 帮助说明
help:
	@echo "Infini Manager 使用说明:"
	@echo "本地服务命令:"
	@echo "  make start        - 启动所有服务 (先后端，再前端)"
	@echo "  make backend      - 仅启动后端服务"
	@echo "  make front        - 仅启动前端服务"
	@echo "  make stop         - 停止所有服务"
	@echo ""
	@echo "Docker服务命令:"
	@echo "  make docker-start - 使用Docker Compose启动所有服务"
	@echo "  make docker-stop  - 停止Docker Compose服务"
	@echo "  make docker-build - 构建Docker Compose镜像"
	@echo "  make docker-logs  - 查看Docker Compose日志"
	@echo ""
	@echo "其他命令:"
	@echo "  make help         - 显示帮助信息"

.PHONY: start start-backend start-front backend front stop help docker-start docker-stop docker-build docker-logs