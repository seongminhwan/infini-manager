-- 代理池配置表
CREATE TABLE IF NOT EXISTS proxy_pools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    proxy_mode VARCHAR(50) NOT NULL DEFAULT 'none', -- none, round_robin, random, failover
    enabled BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 代理服务器表
CREATE TABLE IF NOT EXISTS proxy_servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pool_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    proxy_type VARCHAR(20) NOT NULL, -- http, https, socks4, socks5
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    username VARCHAR(255),
    password VARCHAR(255),
    enabled BOOLEAN DEFAULT true,
    is_healthy BOOLEAN DEFAULT true,
    last_check_at DATETIME,
    response_time INTEGER, -- 响应时间(ms)
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pool_id) REFERENCES proxy_pools(id) ON DELETE CASCADE
);

-- 代理使用统计表
CREATE TABLE IF NOT EXISTS proxy_usage_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proxy_id INTEGER NOT NULL,
    date DATE NOT NULL,
    request_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    avg_response_time INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proxy_id) REFERENCES proxy_servers(id) ON DELETE CASCADE,
    UNIQUE(proxy_id, date)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_proxy_servers_pool_id ON proxy_servers(pool_id);
CREATE INDEX IF NOT EXISTS idx_proxy_servers_enabled ON proxy_servers(enabled);
CREATE INDEX IF NOT EXISTS idx_proxy_servers_healthy ON proxy_servers(is_healthy);
CREATE INDEX IF NOT EXISTS idx_proxy_usage_stats_date ON proxy_usage_stats(date);

-- 插入默认代理池
INSERT OR IGNORE INTO proxy_pools (id, name, description, proxy_mode, enabled) 
VALUES (1, 'default', '默认代理池', 'none', true); 