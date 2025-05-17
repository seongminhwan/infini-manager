# 后端Dockerfile - 支持SQLite
# 使用Node.js官方镜像作为基础镜像
FROM node:18-alpine

# 安装SQLite所需的系统依赖
RUN apk add --no-cache --virtual .build-deps \
    python3 \
    make \
    g++ \
    build-base \
    && apk add --no-cache sqlite-dev

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装依赖 - 确保sqlite3模块在容器中正确编译
RUN npm install && \
    npm uninstall sqlite3 && \
    npm install sqlite3 --build-from-source && \
    npm rebuild

# 复制其余源代码
COPY . .

# 确保db目录存在
RUN mkdir -p db

# 构建TypeScript代码
RUN npm run build

# 设置环境变量
ENV NODE_ENV=production
ENV DB_TYPE=sqlite

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["npm", "start"]