/**
 * 代理工具类
 * 提供代理获取和应用的通用方法
 */
import { ProxyServer } from "../service/ProxyPoolService";
import db from '../db/db';

// 代理服务器接口 - 所有字段都是必需的
export interface SimpleProxyConfig {
  host: string;
  port: number;
  type: 'http' | 'https' | 'socks4' | 'socks5';
  auth?: {
    username?: string;
    password?: string;
  };
}

// 可选代理配置接口 - 所有字段都是可选的
export interface OptionalProxyConfig {
  host?: string;
  port?: number;
  type?: 'http' | 'https' | 'socks4' | 'socks5';
  auth?: {
    username?: string;
    password?: string;
  };
}

/**
 * 将可选代理配置转换为完整的代理配置
 * @param optionalConfig 可选代理配置
 * @returns 完整的代理配置或null
 */
export function convertToSimpleProxyConfig(optionalConfig: OptionalProxyConfig): SimpleProxyConfig | null {
  if (!optionalConfig.host || !optionalConfig.port || !optionalConfig.type) {
    return null;
  }
  
  return {
    host: optionalConfig.host,
    port: optionalConfig.port,
    type: optionalConfig.type,
    auth: optionalConfig.auth
  };
}
/**
 * 获取指定ID的代理服务器
 * @param proxyServerId 代理服务器ID
 * @returns 代理服务器配置
 */
export async function getProxyById(proxyServerId: number): Promise<SimpleProxyConfig | null> {
  try {
    const proxy = await db('proxy_servers').where({ id: proxyServerId }).first();
    
    if (!proxy) {
      console.warn(`未找到ID为${proxyServerId}的代理服务器`);
      return null;
    }
    
    if (!proxy.enabled) {
      console.warn(`ID为${proxyServerId}的代理服务器已禁用`);
      return null;
    }
    
    return {
      host: proxy.host,
      port: proxy.port,
      type: proxy.proxy_type,
      auth: proxy.username && proxy.password ? {
        username: proxy.username,
        password: proxy.password
      } : undefined
    };
  } catch (error) {
    console.error('获取代理服务器失败:', error);
    return null;
  }
}

/**
 * 根据标签随机获取一个代理服务器
 * @param tag 代理标签
 * @returns 代理服务器配置
 */
export async function getRandomProxyByTag(tag: string): Promise<SimpleProxyConfig | null> {
  try {
    // 获取带有指定标签的代理服务器列表
    const proxies = await db('proxy_servers')
      .join('proxy_server_tags', 'proxy_servers.id', 'proxy_server_tags.proxy_server_id')
      .join('proxy_tags', 'proxy_server_tags.tag_id', 'proxy_tags.id')
      .where('proxy_tags.name', tag)
      .where('proxy_servers.enabled', true)
      .select('proxy_servers.*');
    
    if (!proxies || proxies.length === 0) {
      console.warn(`未找到标签为"${tag}"的可用代理服务器`);
      return null;
    }
    
    // 随机选择一个代理服务器
    const randomIndex = Math.floor(Math.random() * proxies.length);
    const proxy = proxies[randomIndex];
    
    return {
      host: proxy.host,
      port: proxy.port,
      type: proxy.proxy_type,
      auth: proxy.username && proxy.password ? {
        username: proxy.username,
        password: proxy.password
      } : undefined
    };
  } catch (error) {
    console.error(`根据标签"${tag}"获取随机代理服务器失败:`, error);
    return null;
  }
}

/**
 * 创建IMAP代理代理对象
 * @param proxyConfig 代理配置
 * @returns 代理代理对象或null
 */
export function createImapProxyAgent(proxyConfig: SimpleProxyConfig): any {
  try {
    // 根据代理类型创建不同的代理代理
    if (proxyConfig.type === 'socks4' || proxyConfig.type === 'socks5') {
      // 对于SOCKS代理，使用socks-proxy-agent
      const { SocksProxyAgent } = require('socks-proxy-agent');
      
      const socksVersion = proxyConfig.type === 'socks5' ? 5 : 4;
      const proxyUrl = `socks${socksVersion}://${proxyConfig.auth?.username ? `${proxyConfig.auth.username}:${proxyConfig.auth.password}@` : ''}${proxyConfig.host}:${proxyConfig.port}`;
      
      return new SocksProxyAgent(proxyUrl);
    } else {
      // 对于HTTP/HTTPS代理，使用http-proxy-agent或https-proxy-agent
      const { HttpProxyAgent } = require('http-proxy-agent');
      const { HttpsProxyAgent } = require('https-proxy-agent');
      
      const Agent = proxyConfig.type === 'https' ? HttpsProxyAgent : HttpProxyAgent;
      const proxyUrl = `${proxyConfig.type}://${proxyConfig.auth?.username ? `${proxyConfig.auth.username}:${proxyConfig.auth.password}@` : ''}${proxyConfig.host}:${proxyConfig.port}`;
      
      return new Agent(proxyUrl);
    }
  } catch (error) {
    console.error('创建IMAP代理代理对象失败:', error);
    return null;
  }
}

/**
 * 获取SMTP代理配置
 * @param proxyConfig 代理配置
 * @returns SMTP代理配置对象或null
 */
export function createSmtpProxyConfig(proxyConfig: SimpleProxyConfig): any {
  try {
    // 根据代理类型创建不同的代理配置
    const proxyUrl = `${proxyConfig.type}://${proxyConfig.auth?.username ? `${proxyConfig.auth.username}:${proxyConfig.auth.password}@` : ''}${proxyConfig.host}:${proxyConfig.port}`;
    
    return {
      url: proxyUrl,
      secure: proxyConfig.type === 'https',
    };
  } catch (error) {
    console.error('创建SMTP代理配置失败:', error);
    return null;
  }
}