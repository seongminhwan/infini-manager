# 前端Dockerfile
# 构建阶段
FROM node:18-alpine as build

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

COPY .env.docker .env

# 安装依赖
RUN npm install

# 复制其余源代码
COPY . .

# 使用Docker环境专用配置文件
RUN cp src/config.docker.ts src/config.ts

# 构建应用
RUN npm run build

# 运行阶段
FROM nginx:alpine

# 复制nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 从构建阶段复制构建产物

COPY --from=build /app/build /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 启动nginx
CMD ["nginx", "-g", "daemon off;"]