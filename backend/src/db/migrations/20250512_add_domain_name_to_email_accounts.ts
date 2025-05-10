/**
 * 为email_accounts表添加domain_name字段
 * 用于存储邮箱域名，便于随机用户生成时使用
 */
const { Knex } = require('knex');

exports.up = async function(knex) {
  await knex.schema.table('email_accounts', table => {
    // 添加域名字段，nullable，允许为空
    table.string('domain_name').nullable().comment('邮箱域名，用于随机用户生成');
  });
  
  // 更新已有记录，提取邮箱域名
  await knex.raw(`
    UPDATE email_accounts 
    SET domain_name = SUBSTR(email, INSTR(email, '@') + 1) 
    WHERE email LIKE '%@%'
  `);
  
  return Promise.resolve();
};

exports.down = function(knex) {
  return knex.schema.table('email_accounts', table => {
    table.dropColumn('domain_name');
  });
};