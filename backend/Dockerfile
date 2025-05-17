# 后端Dockerfile - 支持SQLite
# 使用Node.js官方镜像作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 安装SQLite所需的系统依赖
RUN apk add --no-cache --virtual .build-deps \
    python3 \
    make \
    g++ \
    build-base \
    && apk add --no-cache sqlite-dev

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装依赖 - 确保sqlite3模块在容器中正确编译
RUN npm install && \
    npm rebuild && \
    # 清理构建依赖，减小镜像体积
    apk del .build-deps

# 确保db目录存在
RUN mkdir -p db

# 复制源代码 (.dockerignore已排除node_modules)
COPY . .

# 构建TypeScript代码
RUN npm run build

# 设置环境变量
ENV NODE_ENV=production
ENV DB_TYPE=sqlite

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["npm", "start"]