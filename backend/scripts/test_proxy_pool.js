/**
 * 代理池功能测试脚本
 * 测试代理池的各项功能
 */

const axios = require('axios');

const API_BASE = 'http://localhost:33201/api';

async function testProxyPoolFunctions() {
  console.log('🚀 开始测试代理池功能...\n');
  
  try {
    // 1. 测试获取代理池列表
    console.log('1️⃣ 测试获取代理池列表...');
    const poolsResponse = await axios.get(`${API_BASE}/proxy-pools`);
    console.log('✅ 代理池列表获取成功:', poolsResponse.data);
    
    if (poolsResponse.data.success && poolsResponse.data.data.length > 0) {
      const poolId = poolsResponse.data.data[0].id;
      console.log(`   使用代理池ID: ${poolId} 进行后续测试`);
      
      // 2. 测试获取代理服务器列表
      console.log('\n2️⃣ 测试获取代理服务器列表...');
      const serversResponse = await axios.get(`${API_BASE}/proxy-pools/${poolId}/servers`);
      console.log('✅ 代理服务器列表获取成功:', serversResponse.data);
      
      // 3. 测试代理字符串解析
      console.log('\n3️⃣ 测试代理字符串解析...');
      const testProxies = [
        '127.0.0.1:8080',
        'http://127.0.0.1:8080',
        'socks5://user:pass@127.0.0.1:1080',
        'https://proxy.example.com:8443'
      ];
      
      for (const proxyString of testProxies) {
        try {
          const parseResponse = await axios.post(`${API_BASE}/proxy-pools/parse`, {
            proxyString
          });
          console.log(`   ✅ 解析 "${proxyString}":`, parseResponse.data);
        } catch (error) {
          console.log(`   ❌ 解析 "${proxyString}" 失败:`, error.response?.data || error.message);
        }
      }
      
      // 4. 测试批量添加代理（使用测试代理）
      console.log('\n4️⃣ 测试批量添加代理...');
      try {
        const batchResponse = await axios.post(`${API_BASE}/proxy-pools/${poolId}/servers/batch`, {
          proxyStrings: [
            '127.0.0.1:8080',
            'http://127.0.0.1:8081',
            // 注意：这些是测试代理，实际使用中应该使用真实的代理地址
          ]
        });
        console.log('✅ 批量添加代理成功:', batchResponse.data);
      } catch (error) {
        console.log('❌ 批量添加代理失败:', error.response?.data || error.message);
      }
      
      // 5. 测试健康检查
      console.log('\n5️⃣ 测试健康检查...');
      try {
        const healthResponse = await axios.post(`${API_BASE}/proxy-pools/health-check`);
        console.log('✅ 健康检查启动成功:', healthResponse.data);
      } catch (error) {
        console.log('❌ 健康检查失败:', error.response?.data || error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.response?.data || error.message);
  }
  
  console.log('\n🏁 代理池功能测试完成！');
}

// 等待3秒后开始测试，给服务器时间启动
setTimeout(testProxyPoolFunctions, 3000); 