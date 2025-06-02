/**
 * 查询邮箱账户ID为2的记录，检查其代理配置
 */
exports.seed = async function(knex) {
  try {
    console.log('查询邮箱账户ID为2的记录...');
    
    // 查询邮箱账户
    const account = await knex('email_accounts').where('id', 2).first();
    
    if (!account) {
      console.log('未找到ID为2的邮箱账户');
      return;
    }
    
    console.log('邮箱账户信息:');
    console.log(`ID: ${account.id}`);
    console.log(`邮箱: ${account.email}`);
    console.log(`状态: ${account.status}`);
    console.log(`使用代理: ${account.use_proxy ? '是' : '否'}`);
    console.log(`代理模式: ${account.proxy_mode || '未设置'}`);
    console.log(`代理服务器ID: ${account.proxy_server_id || '未设置'}`);
    console.log(`代理标签: ${account.proxy_tag || '未设置'}`);
    
    // 如果设置了代理服务器ID，查询代理服务器信息
    if (account.proxy_server_id) {
      const proxyServer = await knex('proxy_servers').where('id', account.proxy_server_id).first();
      
      if (proxyServer) {
        console.log('\n代理服务器信息:');
        console.log(`ID: ${proxyServer.id}`);
        console.log(`主机: ${proxyServer.host}`);
        console.log(`端口: ${proxyServer.port}`);
        console.log(`类型: ${proxyServer.proxy_type}`);
        console.log(`启用状态: ${proxyServer.enabled ? '启用' : '禁用'}`);
        console.log(`用户名: ${proxyServer.username || '无'}`);
        console.log(`密码: ${proxyServer.password ? '已设置' : '未设置'}`);
      } else {
        console.log(`\n未找到ID为${account.proxy_server_id}的代理服务器`);
      }
    }
    
    console.log('\n查询完成');
  } catch (error) {
    console.error('查询失败:', error);
  }
};