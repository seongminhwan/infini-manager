/**
 * 更新邮箱账户ID为2的代理配置
 * 从extra_config中提取代理配置，并同步到直接字段
 */
exports.seed = async function(knex) {
  try {
    console.log('开始更新邮箱账户ID为2的代理配置...');
    
    // 查询邮箱账户
    const account = await knex('email_accounts').where('id', 2).first();
    
    if (!account) {
      console.log('未找到ID为2的邮箱账户');
      return;
    }
    
    console.log('原始邮箱账户配置:');
    console.log(`ID: ${account.id}`);
    console.log(`邮箱: ${account.email}`);
    console.log(`使用代理: ${account.use_proxy ? '是' : '否'}`);
    console.log(`代理模式: ${account.proxy_mode || '未设置'}`);
    console.log(`代理服务器ID: ${account.proxy_server_id || '未设置'}`);
    console.log(`代理标签: ${account.proxy_tag || '未设置'}`);
    
    // 提取extra_config中的代理配置
    let proxyConfig = {};
    if (account.extra_config) {
      try {
        const extraConfig = JSON.parse(account.extra_config);
        if (extraConfig.proxy) {
          proxyConfig = extraConfig.proxy;
          console.log('\n从extra_config中提取的代理配置:');
          console.log(JSON.stringify(proxyConfig, null, 2));
        } else {
          console.log('\nextra_config中未找到代理配置');
        }
      } catch (e) {
        console.error('解析extra_config失败:', e);
      }
    }
    
    // 如果没有提取到代理配置，手动设置一个代理配置
    if (Object.keys(proxyConfig).length === 0) {
      console.log('\n未找到代理配置，将手动设置一个代理配置');
      
      // 查询可用的代理服务器
      const proxyServers = await knex('proxy_servers').where('enabled', true).limit(1);
      
      if (proxyServers.length === 0) {
        console.log('未找到可用的代理服务器，无法设置代理配置');
        return;
      }
      
      const proxyServer = proxyServers[0];
      console.log(`找到代理服务器: ID=${proxyServer.id}, 主机=${proxyServer.host}, 端口=${proxyServer.port}`);
      
      // 设置代理配置
      proxyConfig = {
        useProxy: true,
        proxyMode: 'specific',
        proxyServerId: proxyServer.id
      };
      
      // 更新extra_config
      let extraConfig = {};
      if (account.extra_config) {
        try {
          extraConfig = JSON.parse(account.extra_config);
        } catch (e) {
          console.warn('解析extra_config失败，将使用新的对象');
        }
      }
      
      extraConfig.proxy = proxyConfig;
      
      // 更新数据库中的extra_config
      await knex('email_accounts')
        .where('id', 2)
        .update({
          extra_config: JSON.stringify(extraConfig)
        });
      
      console.log('已更新extra_config中的代理配置');
    }
    
    // 从proxyConfig中提取代理配置
    const useProxy = proxyConfig.useProxy !== undefined ? proxyConfig.useProxy : true;
    const proxyMode = proxyConfig.proxyMode || 'specific';
    const proxyServerId = proxyConfig.proxyServerId;
    const proxyTag = proxyConfig.proxyTag;
    
    // 更新代理配置直接字段
    await knex('email_accounts')
      .where('id', 2)
      .update({
        use_proxy: useProxy,
        proxy_mode: proxyMode,
        proxy_server_id: proxyServerId,
        proxy_tag: proxyTag,
        updated_at: knex.fn.now()
      });
    
    console.log('\n已更新代理配置直接字段:');
    console.log(`使用代理: ${useProxy ? '是' : '否'}`);
    console.log(`代理模式: ${proxyMode}`);
    console.log(`代理服务器ID: ${proxyServerId || '未设置'}`);
    console.log(`代理标签: ${proxyTag || '未设置'}`);
    
    // 验证更新结果
    const updatedAccount = await knex('email_accounts').where('id', 2).first();
    
    console.log('\n更新后的邮箱账户配置:');
    console.log(`ID: ${updatedAccount.id}`);
    console.log(`邮箱: ${updatedAccount.email}`);
    console.log(`使用代理: ${updatedAccount.use_proxy ? '是' : '否'}`);
    console.log(`代理模式: ${updatedAccount.proxy_mode || '未设置'}`);
    console.log(`代理服务器ID: ${updatedAccount.proxy_server_id || '未设置'}`);
    console.log(`代理标签: ${updatedAccount.proxy_tag || '未设置'}`);
    
    console.log('\n更新完成');
  } catch (error) {
    console.error('更新邮箱账户代理配置失败:', error);
  }
};