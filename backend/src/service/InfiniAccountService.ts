/**
 * Infini账户服务
 * 用于管理Infini账户信息、登录和同步余额等功能的业务逻辑
 */
import httpClient from '../utils/httpClient';
import db from '../db/db';
import { ImapFlow } from 'imapflow';
import {
  ApiResponse,
  InfiniAccount,
  InfiniAccountCreate,
  InfiniLoginResponse,
  InfiniProfileResponse,
  GmailConfig,
} from '../types';

const INFINI_API_BASE_URL = 'https://api-card.infini.money';

// 存储验证码的Map（实际应用中应使用Redis或数据库）
const verificationCodesMap = new Map<string, { code: string, sentAt: Date }>();

export class InfiniAccountService {
  /**
   * 获取账户的有效Cookie（公共方法）
   * @param accountId Infini账户ID
   * @param errorContext 错误上下文信息，用于自定义错误消息前缀
   * @returns 返回有效的Cookie或null，以及账户对象
   */
  async getAccountCookie(accountId: string, errorContext: string = ''): Promise<{cookie: string | null, account: any}> {
    try {
      // 查找账户
      const account = await db('infini_accounts')
        .where('id', accountId)
        .first();

      if (!account) {
        console.error(`${errorContext}找不到ID为${accountId}的Infini账户`);
        return { cookie: null, account: null };
      }

      // 获取Cookie
      const cookie = await this.getCookieForAccount(account, errorContext);
      return { cookie, account };
    } catch (error) {
      console.error(`${errorContext}获取账户Cookie失败:`, error);
      return { cookie: null, account: null };
    }
  }

  /**
   * 获取账户的有效Cookie
   * 如果Cookie过期，会自动重新登录获取新Cookie并更新账户信息
   * @param account Infini账户对象或账户ID
   * @param errorContext 错误上下文信息，用于自定义错误消息前缀
   * @returns 返回有效的Cookie或null（如果获取失败）
   */
  private async getCookieForAccount(account: any, errorContext: string = ''): Promise<string | null> {
    try {
      // 如果传入的是ID，先获取完整账户信息
      if (typeof account === 'string' || typeof account === 'number') {
        account = await db('infini_accounts')
          .where('id', account)
          .first();

        if (!account) {
          return null;
        }
      }

      // 检查Cookie是否有效
      let cookie = account.cookie;
      let cookieIsValid = true;

      if (account.cookie_expires_at) {
        const expires = new Date(account.cookie_expires_at);
        cookieIsValid = expires > new Date();
      } else {
        cookieIsValid = false;
      }

      // 如果Cookie有效，直接返回
      if (cookieIsValid) {
        return cookie;
      }

      // 如果Cookie失效，重新登录获取新Cookie
      const loginResponse = await httpClient.post<InfiniLoginResponse>(
        `${INFINI_API_BASE_URL}/user/login`,
        { email: account.email, password: account.password },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
            'Referer': 'https://app.infini.money/',
            'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
          },
        }
      );

      if (loginResponse.data.code !== 0) {
        console.error(`${errorContext}Infini登录失败:`, loginResponse.data.message || '账户或密码错误');
        return null;
      }

      // 提取Cookie
      const cookies = loginResponse.headers['set-cookie'];
      if (!cookies || cookies.length === 0) {
        console.error(`${errorContext}无法获取登录Cookie`);
        return null;
      }

      cookie = cookies
        .filter((c: string) => c.includes('jwt_token='))
        .join('; ');

      // 提取Cookie过期时间
      const expiresMatch = cookie.match(/Expires=([^;]+)/);
      const cookieExpiresAt = expiresMatch ? new Date(expiresMatch[1]) : null;

      // 更新账户的Cookie信息
      await db('infini_accounts')
        .where('id', account.id)
        .update({
          cookie,
          cookie_expires_at: cookieExpiresAt
        });

      return cookie;
    } catch (error) {
      console.error(`${errorContext}获取Cookie失败:`, error);
      return null;
    }
  }

  /**
   * 发送验证码并等待获取
   * @param email 目标邮箱地址
   * @param type 验证码类型，默认为0（注册验证码）
   */
  async sendAndWaitVerificationCode(email: string, type: number = 0): Promise<ApiResponse> {
    const response = await this.sendVerificationCode(email, type);
    if (!response.success) {
      return response;
    }
    return this.fetchVerificationCode(email);
  }

  /**
   * 发送Infini注册验证码
   */
  async sendVerificationCode(email: string, type = 0): Promise<ApiResponse> {
    try {
      if (!email) {
        return {
          success: false,
          message: '邮箱地址是必填项'
        };
      }

      console.log(`正在向邮箱 ${email} 发送Infini验证码...`);

      // 检查并清除该邮箱已有的验证码记录
      if (verificationCodesMap.has(email)) {
        console.log(`清除邮箱 ${email} 已有的验证码记录`);
        verificationCodesMap.delete(email);
      }

      // 调用Infini API发送验证码
      const verifyResponse = await httpClient.post(`${INFINI_API_BASE_URL}/user/verify-email`,
        { email, type: type },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
            'Referer': 'https://app.infini.money/',
            'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'Accept': 'application/json, text/plain, */*'
          }
        }
      );

      console.log('Infini验证码API响应:', verifyResponse.data);

      if (verifyResponse.data.code === 0) {
        // 记录发送时间（使用UTC时间），标识验证码已发送但尚未获取
        const sentTime = new Date();
        console.log(`记录验证码发送时间: ${sentTime.toISOString()} (当前系统时间)`);
        verificationCodesMap.set(email, { code: '', sentAt: sentTime });

        return {
          success: true,
          message: '验证码发送成功，请查收邮件',
          data: { email }
        };
      } else {
        return {
          success: false,
          message: `验证码发送失败: ${verifyResponse.data.message || '未知错误'}`
        };
      }
    } catch (error) {
      console.error('发送验证码失败:', error);
      return {
        success: false,
        message: `发送验证码失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 从邮件中获取验证码
   * @param email 目标邮箱地址
   * @param mainEmail 用来获取验证码的主邮箱账户（可选）
   * @param retryCount 重试次数（默认为1，表示不重试）
   * @param intervalSeconds 重试间隔秒数（默认为5秒）
   */
  async fetchVerificationCode(
    email: string,
    mainEmail?: string,
    retryCount: number = 1,
    intervalSeconds: number = 5
  ): Promise<ApiResponse> {
    try {
      if (!email) {
        return {
          success: false,
          message: '邮箱地址是必填项'
        };
      }

      // 检查是否已发送过验证码
      const verificationData = verificationCodesMap.get(email);
      if (!verificationData) {
        return {
          success: false,
          message: '未找到该邮箱的验证码请求，请先发送验证码'
        };
      }

      // 如果已经获取到验证码，直接返回并移除缓存
      if (verificationData.code) {
        // 获取验证码后移除缓存
        verificationCodesMap.delete(email);
        return {
          success: true,
          message: '成功获取验证码',
          data: { code: verificationData.code }
        };
      }

      // 重试机制
      console.log(`将尝试获取验证码，最多重试${retryCount}次，间隔${intervalSeconds}秒`);

      // 一个辅助函数用于执行单次验证码获取尝试
      const attemptFetchCode = async (): Promise<ApiResponse> => {

        // 获取邮箱账户 - 如果提供了主邮箱参数，优先使用该参数指定的邮箱
        let emailAccount;

        if (mainEmail) {
          console.log(`尝试使用指定的主邮箱: ${mainEmail}`);

          // 先尝试精确匹配
          emailAccount = await db('email_accounts')
            .where({ email: mainEmail, status: 'active' })
            .first();

          // 如果精确匹配失败，尝试模糊匹配（邮箱的任何部分包含提供的主邮箱）
          if (!emailAccount) {
            console.log(`未找到精确匹配的主邮箱账户，尝试模糊匹配...`);

            // 获取所有活跃的邮箱账户
            const allAccounts = await db('email_accounts')
              .where({ status: 'active' })
              .select('*');

            // 从中找出与主邮箱相关的账户
            for (const account of allAccounts) {
              // 检查账户邮箱或域名是否包含传入的主邮箱信息
              if (account.email && (
                account.email.toLowerCase() === mainEmail.toLowerCase() ||
                account.email.toLowerCase().includes(mainEmail.toLowerCase()) ||
                (account.domainName && mainEmail.toLowerCase().includes(account.domainName.toLowerCase()))
              )) {
                emailAccount = account;
                console.log(`找到模糊匹配的主邮箱账户: ${account.email}`);
                break;
              }
            }
          }
        }

        // 如果没有提供主邮箱或找不到指定的主邮箱，尝试找域名匹配的邮箱
        if (!emailAccount && mainEmail) {
          console.log(`尝试根据域名找到主邮箱账户...`);
          // 提取域名部分
          const domainPart = mainEmail.includes('@') ? mainEmail.split('@')[1] : mainEmail;

          // 查找具有匹配域名的账户
          const domainAccounts = await db('email_accounts')
            .where({ status: 'active' })
            .select('*');

          for (const account of domainAccounts) {
            if (account.email && account.email.includes(`@${domainPart}`)) {
              emailAccount = account;
              console.log(`根据域名找到主邮箱账户: ${account.email}`);
              break;
            } else if (account.domainName && account.domainName.includes(domainPart)) {
              emailAccount = account;
              console.log(`根据域名配置找到主邮箱账户: ${account.email}`);
              break;
            }
          }
        }

        // 如果仍然未找到邮箱账户，使用默认邮箱
        if (!emailAccount) {
          console.log(`尝试使用默认主邮箱...`);
          emailAccount = await db('email_accounts')
            .where({ is_default: true, status: 'active' })
            .first();
        }

        // 如果仍然未找到，尝试使用任何活跃的邮箱
        if (!emailAccount) {
          console.log(`未找到默认主邮箱，尝试使用任何活跃的邮箱...`);
          emailAccount = await db('email_accounts')
            .where({ status: 'active' })
            .first();
        }

        if (!emailAccount) {
          return {
            success: false,
            message: '未找到有效的邮箱账户，无法获取验证码。请先在邮箱管理中添加并激活邮箱账户。'
          };
        }

        console.log(`将使用邮箱账户 ${emailAccount.email} 获取验证码`);

        // 创建IMAP配置
        const config: GmailConfig = {
          user: emailAccount.email,
          password: emailAccount.password,
          imapHost: emailAccount.imap_host,
          imapPort: emailAccount.imap_port,
          imapSecure: emailAccount.imap_secure,
          smtpHost: emailAccount.smtp_host,
          smtpPort: emailAccount.smtp_port,
          smtpSecure: emailAccount.smtp_secure
        };

        console.log(`尝试从邮箱 ${emailAccount.email} 获取发送给 ${email} 的验证码...`);

        // 计算查询的起始时间（验证码发送时间之后）
        const since = verificationData.sentAt;

        // 记录验证码请求时间的详细信息，包括UTC时间和本地时间
        console.log(`验证码请求时间(UTC): ${since.toISOString()}`);
        console.log(`验证码请求时间(本地): ${since.toLocaleString()}`);

        // 创建ImapFlow客户端
        const client = new ImapFlow({
          host: config.imapHost,
          port: config.imapPort,
          secure: config.imapSecure,
          auth: {
            user: config.user,
            pass: config.password
          },
          logger: false,
          tls: {
            rejectUnauthorized: false // 允许自签名证书
          }
        });

        try {
          // 连接到服务器
          console.log('正在连接到IMAP服务器...');
          await client.connect();

          // 选择收件箱
          console.log('正在打开收件箱...');
          await client.mailboxOpen('INBOX');

          console.log(`正在搜索验证码邮件，发件人: Infini Card <no-reply@infini.money>, 收件人: ${email}, 主题包含: Verification Code, 时间晚于: ${since.toISOString()}`);

          // 搜索对应邮件，添加邮件时间过滤
          console.log(`使用时间 ${since.toISOString()} (当地时间: ${since.toLocaleString()}) 作为过滤条件`);

          // 创建一个时间戳比验证码发送时间早5分钟的时间点作为辅助参考
          const fiveMinutesBefore = new Date(since.getTime() - 5 * 60 * 1000);
          console.log(`参考：验证码发送前5分钟时间点: ${fiveMinutesBefore.toISOString()}`);

          // 搜索对应邮件
          const allMessages = [];
          const filteredMessages = [];

          // 获取所有可能相关的邮件（使用宽松的时间条件，但之后会进行精确过滤）
          for await (const message of client.fetch({
            // 使用更宽松的时间范围初始查询，后面会精确过滤
            since: fiveMinutesBefore, // 使用比验证码发送时间早5分钟的时间点
            from: 'no-reply@infini.money',
            to: email,
            subject: 'Verification Code'
          }, { source: true, envelope: true, bodyStructure: true, uid: true, flags: true })) {

            // 获取邮件的实际接收时间 - 从envelope对象中获取日期
            const messageDate = message.envelope?.date || new Date(0);
            allMessages.push(message);

            // 详细的时间比较信息
            console.log(`邮件UID ${message.uid} - 接收时间: ${messageDate.toISOString()} - 验证码请求时间: ${since.toISOString()}`);

            // 计算邮件接收时间与验证码请求时间的时间差（毫秒）
            const timeDifferenceMs = messageDate.getTime() - since.getTime();

            // 设置一个10秒的容差时间窗口
            const toleranceMs = 10 * 1000; // 10秒，单位毫秒

            // 时间差在容差范围内（-10秒到+无穷大）的邮件视为有效
            // 这解决邮件服务器时间精度和时区差异的问题
            const isValidTimeWindow = timeDifferenceMs > -toleranceMs;

            console.log(`邮件时间差: ${timeDifferenceMs}毫秒 (${Math.round(timeDifferenceMs / 1000)}秒), 容差: ${toleranceMs}毫秒`);
            console.log(`时间容差判断结果: ${isValidTimeWindow ? '【有效】在容差范围内' : '【无效】超出容差范围'}`);

            // 添加所有在容差范围内的邮件
            if (isValidTimeWindow) {
              console.log(`√ 保留邮件 UID: ${message.uid} - 在容差范围内 (${Math.round(timeDifferenceMs / 1000)}秒)`);
              filteredMessages.push(message);
            } else {
              console.log(`✗ 忽略邮件 UID: ${message.uid} - 超出容差范围 (${Math.round(timeDifferenceMs / 1000)}秒)`);
            }
          }

          console.log(`总共找到 ${allMessages.length} 封匹配的邮件，其中 ${filteredMessages.length} 封是在验证码发送后收到的`);

          const messages = filteredMessages;

          let verificationCode = '';

          // 处理邮件内容，按照接收时间倒序排序，处理最新的邮件
          const sortedMessages = messages.sort((a, b) => {
            // 按UID降序排序，越大越新
            return b.uid - a.uid;
          });

          // 处理邮件内容，提取验证码
          for (const message of sortedMessages) {
            let source = message.source.toString();
            console.log('正在从邮件内容中提取验证码...');
            // 替换\r\n为\n
            source = source.replace(/\r\n/g, '\n');
            source = source.replace(/\n/g, '');
            // 替换<br>标签为\n
            source = source.replace(/<br\s*\/?>/g, '\n');

            // 使用正则表达式提取验证码
            const codeMatch = source.match(/<strong.*>(\d+)<\/strong\s?>/);
            if (codeMatch && codeMatch[1]) {
              verificationCode = codeMatch[1];
              console.log(`成功提取到验证码: ${verificationCode}`);
              break;
            }
          }

          // 安全关闭连接
          try {
            await client.logout();
          } catch (logoutError) {
            console.warn('IMAP注销时出现警告，但不影响验证码获取:', (logoutError as Error).message);
          }

          if (verificationCode) {
            // 成功获取验证码后删除缓存，确保不会重复使用
            verificationCodesMap.delete(email);

            return {
              success: true,
              message: '成功获取验证码',
              data: { code: verificationCode }
            };
          } else {
            return {
              success: false,
              message: '未找到验证码邮件或无法提取验证码，请稍后再试'
            };
          }
        } catch (error) {
          console.error('获取验证码邮件失败:', error);

          return {
            success: false,
            message: `获取验证码邮件失败: ${(error as Error).message}`
          };
        } finally {
          // 确保连接关闭
          if (client && client.authenticated) {
            try {
              await client.logout();
            } catch (e) {
              console.error('关闭IMAP连接失败:', (e as Error).message);
            }
          }
        }
      };

      // 执行第一次尝试
      let result = await attemptFetchCode();

      // 如果成功则直接返回
      if (result.success) {
        return result;
      }

      // 如果未成功且需要重试
      for (let i = 1; i < retryCount; i++) {
        console.log(`第${i}次尝试未成功，等待${intervalSeconds}秒后重试...`);

        // 等待指定的间隔时间
        await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000));

        console.log(`开始第${i + 1}/${retryCount}次尝试...`);
        result = await attemptFetchCode();

        // 如果成功则直接返回
        if (result.success) {
          console.log(`第${i + 1}次尝试成功获取到验证码`);
          return result;
        }
      }

      // 如果所有尝试都失败，返回最后一次的结果
      console.log(`已完成所有${retryCount}次尝试，仍未获取到验证码`);
      return result;
    } catch (error) {
      console.error('获取验证码失败:', error);
      return {
        success: false,
        message: `获取验证码失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 获取所有Infini账户，包含2FA信息
   * @param groupId 可选的分组ID，用于筛选特定分组的账户
   */
  async getAllInfiniAccounts(groupId?: string): Promise<ApiResponse> {
    try {
      let query = db('infini_accounts')
        .select([
          'infini_accounts.id',
          'infini_accounts.user_id as userId',
          'infini_accounts.email',
          'infini_accounts.password', // 返回密码，用于账户管理
          'infini_accounts.uid',
          'infini_accounts.invitation_code as invitationCode',
          'infini_accounts.available_balance as availableBalance',
          'infini_accounts.withdrawing_amount as withdrawingAmount',
          'infini_accounts.red_packet_balance as redPacketBalance',
          'infini_accounts.total_consumption_amount as totalConsumptionAmount',
          'infini_accounts.total_earn_balance as totalEarnBalance',
          'infini_accounts.daily_consumption as dailyConsumption',
          'infini_accounts.status',
          'infini_accounts.user_type as userType',
          'infini_accounts.google_2fa_is_bound as google2faIsBound',
          'infini_accounts.google_password_is_set as googlePasswordIsSet',
          'infini_accounts.is_kol as isKol',
          'infini_accounts.is_protected as isProtected',
          'infini_accounts.verification_level as verificationLevel', // 添加验证级别字段
          // 不返回cookie，敏感信息
          'infini_accounts.cookie_expires_at as cookieExpiresAt',
          'infini_accounts.infini_created_at as infiniCreatedAt',
          'infini_accounts.last_sync_at as lastSyncAt',
          'infini_accounts.created_at as createdAt',
          'infini_accounts.updated_at as updatedAt',
          'infini_accounts.mock_user_id as mockUserId', // 添加关联的随机用户ID
        ]);

      // 如果提供了分组ID，则筛选该分组下的账户
      if (groupId) {
        query = query
          .join('infini_account_group_relations', 'infini_accounts.id', 'infini_account_group_relations.infini_account_id')
          .where('infini_account_group_relations.group_id', groupId);
      }

      const accounts = await query;

      // 获取所有账户的2FA信息
      const twoFaInfos = await db('infini_2fa_info').select('*');

      // 创建一个快速查找映射，通过账户ID找到对应的2FA信息
      const twoFaInfoMap = new Map();
      twoFaInfos.forEach(info => {
        twoFaInfoMap.set(info.infini_account_id, {
          qrCodeUrl: info.qr_code_url,
          secretKey: info.secret_key,
          recoveryCodes: info.recovery_codes ? JSON.parse(info.recovery_codes) : []
        });
      });

      // 获取所有账户的分组信息
      const accountGroups = await db('infini_account_group_relations')
        .join('infini_account_groups', 'infini_account_group_relations.group_id', 'infini_account_groups.id')
        .select([
          'infini_account_group_relations.infini_account_id',
          'infini_account_groups.id as groupId',
          'infini_account_groups.name as groupName',
          'infini_account_groups.description',
          'infini_account_groups.is_default as isDefault'
        ]);

      // 创建账户ID到分组列表的映射
      const accountGroupsMap = new Map();
      accountGroups.forEach(relation => {
        if (!accountGroupsMap.has(relation.infini_account_id)) {
          accountGroupsMap.set(relation.infini_account_id, []);
        }
        accountGroupsMap.get(relation.infini_account_id).push({
          id: relation.groupId,
          name: relation.groupName,
          description: relation.description,
          isDefault: relation.isDefault
        });
      });

      // 为每个账户添加2FA信息和分组信息
      accounts.forEach(account => {
        // 添加2FA信息
        if (twoFaInfoMap.has(account.id)) {
          account.twoFaInfo = twoFaInfoMap.get(account.id);
        }
        
        // 添加分组信息
        account.groups = accountGroupsMap.get(account.id) || [];
      });

      return {
        success: true,
        data: accounts,
      };
    } catch (error) {
      console.error('获取Infini账户列表失败:', error);
      return {
        success: false,
        message: `获取Infini账户列表失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 获取单个Infini账户，包含2FA信息和分组信息
   */
  async getInfiniAccountById(id: string): Promise<ApiResponse> {
    try {
      const account = await db('infini_accounts')
        .select([
          'id',
          'user_id as userId',
          'email',
          'password', // 返回密码，用于查看和编辑功能
          'uid',
          'invitation_code as invitationCode',
          'available_balance as availableBalance',
          'withdrawing_amount as withdrawingAmount',
          'red_packet_balance as redPacketBalance',
          'total_consumption_amount as totalConsumptionAmount',
          'total_earn_balance as totalEarnBalance',
          'daily_consumption as dailyConsumption',
          'status',
          'user_type as userType',
          'google_2fa_is_bound as google2faIsBound',
          'google_password_is_set as googlePasswordIsSet',
          'is_kol as isKol',
          'is_protected as isProtected',
          'verification_level as verificationLevel', // 添加验证级别字段
          // 不返回cookie，敏感信息
          'cookie_expires_at as cookieExpiresAt',
          'infini_created_at as infiniCreatedAt',
          'last_sync_at as lastSyncAt',
          'created_at as createdAt',
          'updated_at as updatedAt',
          'mock_user_id as mockUserId', // 添加关联的随机用户ID
        ])
        .where('id', id)
        .first();

      if (!account) {
        return {
          success: false,
          message: '找不到指定的Infini账户',
        };
      }

      // 获取账户的2FA信息
      const twoFaInfo = await db('infini_2fa_info')
        .where('infini_account_id', id)
        .first();

      // 如果存在2FA信息，添加到返回数据中
      if (twoFaInfo) {
        account.twoFaInfo = {
          qrCodeUrl: twoFaInfo.qr_code_url,
          secretKey: twoFaInfo.secret_key,
          recoveryCodes: twoFaInfo.recovery_codes ? JSON.parse(twoFaInfo.recovery_codes) : []
        };
      }

      // 获取账户的分组信息
      const groups = await db('infini_account_group_relations')
        .join('infini_account_groups', 'infini_account_group_relations.group_id', 'infini_account_groups.id')
        .where('infini_account_group_relations.infini_account_id', id)
        .select([
          'infini_account_groups.id',
          'infini_account_groups.name',
          'infini_account_groups.description',
          'infini_account_groups.is_default as isDefault'
        ]);

      // 添加分组信息到账户数据
      account.groups = groups;

      return {
        success: true,
        data: account,
      };
    } catch (error) {
      console.error('获取Infini账户失败:', error);
      return {
        success: false,
        message: `获取Infini账户失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 登录Infini并获取账户信息
   * 用于测试登录凭据和获取账户信息，但不保存到数据库
   */
  async loginInfiniAccount(email: string, password: string): Promise<ApiResponse> {
    try {
      if (!email || !password) {
        return {
          success: false,
          message: '邮箱和密码是必填项',
        };
      }

      // 登录Infini获取Cookie
      const loginResponse = await httpClient.post<InfiniLoginResponse>(
        `${INFINI_API_BASE_URL}/user/login`,
        { email, password },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
            'Referer': 'https://app.infini.money/',
            'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
          },
        }
      );

      if (loginResponse.data.code !== 0) {
        return {
          success: false,
          message: `Infini登录失败: ${loginResponse.data.message || '账户或密码错误'}`,
        };
      }

      // 提取Cookie
      const cookies = loginResponse.headers['set-cookie'];
      if (!cookies || cookies.length === 0) {
        return {
          success: false,
          message: '无法获取登录Cookie',
        };
      }

      const cookie = cookies
        .filter((c: string) => c.includes('jwt_token='))
        .join('; ');

      // 获取用户资料信息
      const profileResponse = await httpClient.get<InfiniProfileResponse>(
        `${INFINI_API_BASE_URL}/user/profile`,
        {
          headers: {
            'Cookie': cookie,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
            'Referer': 'https://app.infini.money/',
            'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
          },
        }
      );

      if (profileResponse.data.code !== 0 || !profileResponse.data.data) {
        return {
          success: false,
          message: `获取用户资料失败: ${profileResponse.data.message || '未知错误'}`,
        };
      }

      // 提取Cookie过期时间
      const expiresMatch = cookie.match(/Expires=([^;]+)/);
      const cookieExpiresAt = expiresMatch ? new Date(expiresMatch[1]) : null;

      // 格式化用户资料数据
      const userData = profileResponse.data.data;
      const accountInfo = {
        userId: userData.user_id,
        email: userData.email,
        uid: userData.uid,
        invitationCode: userData.invitation_code,
        availableBalance: parseFloat(userData.available_balance),
        withdrawingAmount: parseFloat(userData.withdrawing_amount),
        redPacketBalance: parseFloat(userData.red_packet_balance),
        totalConsumptionAmount: parseFloat(userData.total_consumption_amount),
        totalEarnBalance: parseFloat(userData.total_earn_balance),
        dailyConsumption: parseFloat(userData.daily_consumption),
        status: userData.status,
        userType: userData.user_type,
        google2faIsBound: userData.google_2fa_is_bound,
        googlePasswordIsSet: userData.google_password_is_set,
        isKol: userData.is_kol,
        isProtected: userData.is_protected,
        infiniCreatedAt: userData.created_at,
        cookie,
        cookieExpiresAt,
      };

      return {
        success: true,
        data: accountInfo,
      };
    } catch (error) {
      console.error('Infini登录失败:', error);
      return {
        success: false,
        message: `Infini登录失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 创建Infini账户
   * 登录后保存账户信息到数据库，并关联到默认分组
   * @param email 邮箱地址
   * @param password 密码
   * @param mock_user_id 关联的随机用户ID（可选）
   */
  async createInfiniAccount(email: string, password: string, mock_user_id?: number): Promise<ApiResponse> {
    try {
      if (!email || !password) {
        return {
          success: false,
          message: '邮箱和密码是必填项',
        };
      }

      // 检查是否已存在相同邮箱的账户
      const existingAccount = await db('infini_accounts')
        .where('email', email)
        .first();

      if (existingAccount) {
        return {
          success: false,
          message: '该邮箱已经添加过Infini账户',
        };
      }

      // 登录Infini获取Cookie
      const loginResponse = await httpClient.post<InfiniLoginResponse>(
        `${INFINI_API_BASE_URL}/user/login`,
        { email, password },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
            'Referer': 'https://app.infini.money/',
            'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
          },
        }
      );

      if (loginResponse.data.code !== 0) {
        return {
          success: false,
          message: `Infini登录失败: ${loginResponse.data.message || '账户或密码错误'}`,
        };
      }

      // 提取Cookie
      const cookies = loginResponse.headers['set-cookie'];
      if (!cookies || cookies.length === 0) {
        return {
          success: false,
          message: '无法获取登录Cookie',
        };
      }

      const cookie = cookies
        .filter((c: string) => c.includes('jwt_token='))
        .join('; ');

      // 获取用户资料信息
      const profileResponse = await httpClient.get<InfiniProfileResponse>(
        `${INFINI_API_BASE_URL}/user/profile`,
        {
          headers: {
            'Cookie': cookie,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
            'Referer': 'https://app.infini.money/',
            'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
          },
        }
      );

      if (profileResponse.data.code !== 0 || !profileResponse.data.data) {
        return {
          success: false,
          message: `获取用户资料失败: ${profileResponse.data.message || '未知错误'}`,
        };
      }

      // 提取Cookie过期时间
      const expiresMatch = cookie.match(/Expires=([^;]+)/);
      const cookieExpiresAt = expiresMatch ? new Date(expiresMatch[1]) : null;

      // 格式化用户资料数据
      const userData = profileResponse.data.data;

      // 保存账户信息到数据库 - 使用下划线命名法与数据库表匹配
      const [newAccountId] = await db('infini_accounts').insert({
        user_id: userData.user_id,
        email,
        password, // 注意：实际应用中应该加密存储
        uid: userData.uid,
        invitation_code: userData.invitation_code,
        available_balance: parseFloat(userData.available_balance),
        withdrawing_amount: parseFloat(userData.withdrawing_amount),
        red_packet_balance: parseFloat(userData.red_packet_balance),
        total_consumption_amount: parseFloat(userData.total_consumption_amount),
        total_earn_balance: parseFloat(userData.total_earn_balance),
        daily_consumption: parseFloat(userData.daily_consumption),
        status: userData.status,
        user_type: userData.user_type,
        google_2fa_is_bound: userData.google_2fa_is_bound,
        google_password_is_set: userData.google_password_is_set,
        is_kol: userData.is_kol,
        is_protected: userData.is_protected,
        mock_user_id: mock_user_id, // 添加关联的随机用户ID
        cookie,
        cookie_expires_at: cookieExpiresAt,
        infini_created_at: userData.created_at,
        last_sync_at: new Date(),
      });

      // 获取默认分组
      const defaultGroup = await db('infini_account_groups')
        .where('is_default', true)
        .first();

      if (!defaultGroup) {
        console.error('创建默认分组关联失败：未找到默认分组');
      } else {
        // 将账户关联到默认分组
        await db('infini_account_group_relations').insert({
          infini_account_id: newAccountId,
          group_id: defaultGroup.id,
          created_at: new Date(),
          updated_at: new Date()
        });
        console.log(`已将账户 ${newAccountId} 关联到默认分组 ${defaultGroup.id}`);
      }

      // 获取包含分组信息的新账户
      const newAccount = await this.getInfiniAccountById(newAccountId.toString());
      
      return {
        success: true,
        data: newAccount.data,
        message: '成功添加Infini账户',
      };
    } catch (error) {
      console.error('创建Infini账户失败:', error);
      return {
        success: false,
        message: `创建Infini账户失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 同步Infini账户信息
   */
  async syncInfiniAccount(id: string): Promise<ApiResponse> {
    try {
      // 查找账户
      const account = await db('infini_accounts')
        .where('id', id)
        .first();

      if (!account) {
        return {
          success: false,
          message: '找不到指定的Infini账户',
        };
      }

      // 获取有效Cookie
      const cookie = await this.getCookieForAccount(account, '同步账户信息失败，');

      if (!cookie) {
        return {
          success: false,
          message: '同步账户信息失败，无法获取有效的登录凭证'
        };
      }

      // 获取用户资料信息
      const profileResponse = await httpClient.get<InfiniProfileResponse>(
        `${INFINI_API_BASE_URL}/user/profile`,
        {
          headers: {
            'Cookie': cookie,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
            'Referer': 'https://app.infini.money/',
            'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
          },
        }
      );

      if (profileResponse.data.code !== 0 || !profileResponse.data.data) {
        return {
          success: false,
          message: `同步失败，获取用户资料失败: ${profileResponse.data.message || '未知错误'}`,
        };
      }

      // 提取Cookie过期时间
      const expiresMatch = cookie.match(/Expires=([^;]+)/);
      const cookieExpiresAt = expiresMatch ? new Date(expiresMatch[1]) : null;

      // 格式化用户资料数据
      const userData = profileResponse.data.data;

      // 更新账户信息 - 使用下划线命名法与数据库表匹配
      await db('infini_accounts')
        .where('id', id)
        .update({
          user_id: userData.user_id,
          uid: userData.uid,
          invitation_code: userData.invitation_code,
          available_balance: parseFloat(userData.available_balance),
          withdrawing_amount: parseFloat(userData.withdrawing_amount),
          red_packet_balance: parseFloat(userData.red_packet_balance),
          total_consumption_amount: parseFloat(userData.total_consumption_amount),
          total_earn_balance: parseFloat(userData.total_earn_balance),
          daily_consumption: parseFloat(userData.daily_consumption),
          status: userData.status,
          user_type: userData.user_type,
          google_2fa_is_bound: userData.google_2fa_is_bound,
          google_password_is_set: userData.google_password_is_set,
          is_kol: userData.is_kol,
          is_protected: userData.is_protected,
          cookie,
          cookie_expires_at: cookieExpiresAt,
          last_sync_at: new Date(),
        });

      // 获取更新后的账户信息
      const updatedAccount = await db('infini_accounts')
        .where('id', id)
        .select([
          'id',
          'user_id as userId',
          'email',
          'uid',
          'invitation_code as invitationCode',
          'available_balance as availableBalance',
          'withdrawing_amount as withdrawingAmount',
          'red_packet_balance as redPacketBalance',
          'total_consumption_amount as totalConsumptionAmount',
          'total_earn_balance as totalEarnBalance',
          'daily_consumption as dailyConsumption',
          'status',
          'user_type as userType',
          'google_2fa_is_bound as google2faIsBound',
          'google_password_is_set as googlePasswordIsSet',
          'is_kol as isKol',
          'is_protected as isProtected',
          'cookie_expires_at as cookieExpiresAt',
          'infini_created_at as infiniCreatedAt',
          'last_sync_at as lastSyncAt',
          'created_at as createdAt',
          'updated_at as updatedAt',
          'mock_user_id as mockUserId', // 添加关联的随机用户ID
        ])
        .first();

      return {
        success: true,
        data: updatedAccount,
        message: '账户信息同步成功',
      };
    } catch (error) {
      console.error('同步Infini账户失败:', error);
      return {
        success: false,
        message: `同步Infini账户失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 更新Infini账户信息
   */
  async updateInfiniAccount(id: string, updateData: any): Promise<ApiResponse> {
    try {
      // 查找账户
      const account = await db('infini_accounts')
        .where('id', id)
        .first();

      if (!account) {
        return {
          success: false,
          message: '找不到指定的Infini账户',
        };
      }

      const updateFields: Record<string, any> = {};

      // 可以更新的字段列表
      const allowedFields = [
        'email',
        'password',
        'status',
        'user_type',
      ];

      // 遍历请求体中的字段，构建更新对象
      for (const field of allowedFields) {
        const camelCaseField = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

        if (updateData[camelCaseField] !== undefined) {
          updateFields[field] = updateData[camelCaseField];
        }
      }

      // 如果更新了密码，清除Cookie
      if (updateFields.password) {
        updateFields.cookie = null;
        updateFields.cookie_expires_at = null;
      }

      // 如果没有要更新的字段，返回成功
      if (Object.keys(updateFields).length === 0) {
        return {
          success: true,
          message: '没有字段需要更新',
        };
      }

      // 更新账户信息
      await db('infini_accounts')
        .where('id', id)
        .update(updateFields);

      // 获取更新后的账户信息
      const updatedAccount = await db('infini_accounts')
        .where('id', id)
        .select([
          'id',
          'user_id as userId',
          'email',
          'uid',
          'invitation_code as invitationCode',
          'available_balance as availableBalance',
          'withdrawing_amount as withdrawingAmount',
          'red_packet_balance as redPacketBalance',
          'total_consumption_amount as totalConsumptionAmount',
          'total_earn_balance as totalEarnBalance',
          'daily_consumption as dailyConsumption',
          'status',
          'user_type as userType',
          'google_2fa_is_bound as google2faIsBound',
          'google_password_is_set as googlePasswordIsSet',
          'is_kol as isKol',
          'is_protected as isProtected',
          'cookie_expires_at as cookieExpiresAt',
          'infini_created_at as infiniCreatedAt',
          'last_sync_at as lastSyncAt',
          'created_at as createdAt',
          'updated_at as updatedAt',
          'mock_user_id as mockUserId', // 添加关联的随机用户ID
        ])
        .first();

      return {
        success: true,
        data: updatedAccount,
        message: '账户信息更新成功',
      };
    } catch (error) {
      console.error('更新Infini账户失败:', error);
      return {
        success: false,
        message: `更新Infini账户失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 上传KYC图片到Infini系统
   * @param accountId Infini账户ID
   * @param file 图片文件数据
   * @param fileName 文件名（可选）
   * @returns 上传结果，成功时返回文件名
   */
  async uploadKycImage(accountId: string, file: Buffer, fileName?: string): Promise<ApiResponse> {
    try {
      console.log(`开始上传KYC图片，账户ID: ${accountId}, 文件大小: ${file.length} 字节`);

      // 查找账户
      const account = await db('infini_accounts')
        .where('id', accountId)
        .first();

      if (!account) {
        console.error(`上传KYC图片失败: 找不到ID为${accountId}的Infini账户`);
        return {
          success: false,
          message: '找不到指定的Infini账户'
        };
      }

      console.log(`找到账户 ${account.email}，正在获取有效的登录凭证...`);

      // 获取有效Cookie
      const cookie = await this.getCookieForAccount(account, '上传KYC图片失败，');

      if (!cookie) {
        console.error(`上传KYC图片失败: 无法获取账户${account.email}的有效登录凭证`);
        return {
          success: false,
          message: '上传KYC图片失败，无法获取有效的登录凭证'
        };
      }

      console.log(`成功获取登录凭证，正在准备表单数据...`);

      // 创建FormData对象
      const FormData = require('form-data');
      const formData = new FormData();

      // 生成唯一文件名，如果未提供
      const actualFileName = fileName || `kyc_${Date.now()}.png`;

      // 添加文件到表单
      formData.append('file', file, {
        filename: actualFileName,
        contentType: 'image/png',
      });

      console.log(`正在上传文件 "${actualFileName}" 到Infini KYC系统...`);

      // 发送请求上传图片
      const response = await httpClient.post(
        'https://api-card.infini.money/card/kyc/upload_file',
        formData,
        {
          headers: {
            'Cookie': cookie,
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
            'Referer': 'https://app.infini.money/',
            'Origin': 'https://app.infini.money',
            'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            ...formData.getHeaders()
          }
        }
      );

      console.log('Infini KYC图片上传API响应成功');

      // 验证API响应
      if (response.data.code === 0) {
        console.log(`KYC图片上传成功，文件名: ${response.data.data.file_name}`);

        return {
          success: true,
          data: {
            file_name: response.data.data.file_name
          },
          message: 'KYC图片上传成功'
        };
      } else {
        console.error(`Infini API返回错误: ${response.data.message || '未知错误'}`);
        return {
          success: false,
          message: `上传KYC图片失败: ${response.data.message || '未知错误'}`
        };
      }
    } catch (error) {
      console.error('上传KYC图片失败:', error);
      return {
        success: false,
        message: `上传KYC图片失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 删除Infini账户
   */
  async deleteInfiniAccount(id: string): Promise<ApiResponse> {
    try {
      // 查找账户
      const account = await db('infini_accounts')
        .where('id', id)
        .first();

      if (!account) {
        return {
          success: false,
          message: '找不到指定的Infini账户',
        };
      }

      // 删除账户
      await db('infini_accounts')
        .where('id', id)
        .delete();

      return {
        success: true,
        message: '账户信息删除成功',
      };
    } catch (error) {
      console.error('删除Infini账户失败:', error);
      return {
        success: false,
        message: `删除Infini账户失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 批量同步所有Infini账户信息
   */
  async syncAllInfiniAccounts(): Promise<ApiResponse> {
    try {
      // 获取所有Infini账户
      const accounts = await db('infini_accounts').select('*');

      if (accounts.length === 0) {
        return {
          success: true,
          message: '没有找到需要同步的账户',
          data: { total: 0, success: 0, failed: 0 }
        };
      }

      // 同步结果统计
      const result = {
        total: accounts.length,
        success: 0,
        failed: 0,
        accounts: [] as Array<{ id: number; email: string; success: boolean; message?: string }>
      };

      // 逐个处理账户
      for (const account of accounts) {
        try {
          // 获取有效Cookie
          const cookie = await this.getCookieForAccount(account, '');

          if (!cookie) {
            result.failed++;
            result.accounts.push({
              id: account.id,
              email: account.email,
              success: false,
              message: '无法获取有效的登录凭证'
            });
            continue;
          }

          // 获取用户资料信息
          const profileResponse = await httpClient.get<InfiniProfileResponse>(
            `${INFINI_API_BASE_URL}/user/profile`,
            {
              headers: {
                'Cookie': cookie,
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
                'Referer': 'https://app.infini.money/',
                'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
              },
            }
          );

          if (profileResponse.data.code !== 0 || !profileResponse.data.data) {
            result.failed++;
            result.accounts.push({
              id: account.id,
              email: account.email,
              success: false,
              message: `获取用户资料失败: ${profileResponse.data.message || '未知错误'}`
            });
            continue;
          }

          // 提取Cookie过期时间
          const expiresMatch = cookie.match(/Expires=([^;]+)/);
          const cookieExpiresAt = expiresMatch ? new Date(expiresMatch[1]) : null;

          // 格式化用户资料数据
          const userData = profileResponse.data.data;

          // 更新账户信息 - 使用下划线命名法与数据库表匹配
          await db('infini_accounts')
            .where('id', account.id)
            .update({
              user_id: userData.user_id,
              uid: userData.uid,
              invitation_code: userData.invitation_code,
              available_balance: parseFloat(userData.available_balance),
              withdrawing_amount: parseFloat(userData.withdrawing_amount),
              red_packet_balance: parseFloat(userData.red_packet_balance),
              total_consumption_amount: parseFloat(userData.total_consumption_amount),
              total_earn_balance: parseFloat(userData.total_earn_balance),
              daily_consumption: parseFloat(userData.daily_consumption),
              status: userData.status,
              user_type: userData.user_type,
              google_2fa_is_bound: userData.google_2fa_is_bound,
              google_password_is_set: userData.google_password_is_set,
              is_kol: userData.is_kol,
              is_protected: userData.is_protected,
              cookie,
              cookie_expires_at: cookieExpiresAt,
              last_sync_at: new Date(),
            });

          result.success++;
          result.accounts.push({
            id: account.id,
            email: account.email,
            success: true
          });
        } catch (error) {
          result.failed++;
          result.accounts.push({
            id: account.id,
            email: account.email,
            success: false,
            message: (error as Error).message
          });
        }
      }

      return {
        success: true,
        data: result,
        message: `批量同步完成: 总计${result.total}个账户, 成功${result.success}个, 失败${result.failed}个`
      };
    } catch (error) {
      console.error('批量同步Infini账户失败:', error);
      return {
        success: false,
        message: `批量同步Infini账户失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 获取Infini 2FA二维码
   * @param accountId Infini账户ID
   */
  async getGoogle2faQrcode(accountId: string): Promise<ApiResponse> {
    try {
      console.log(`开始获取Infini 2FA二维码，账户ID: ${accountId}`);

      // 查找账户
      const account = await db('infini_accounts')
        .where('id', accountId)
        .first();

      if (!account) {
        console.error(`获取2FA二维码失败: 找不到ID为${accountId}的Infini账户`);
        return {
          success: false,
          message: '找不到指定的Infini账户'
        };
      }

      console.log(`找到账户 ${account.email}，正在获取有效的登录凭证...`);

      // 获取有效Cookie
      const cookie = await this.getCookieForAccount(account, '获取2FA二维码失败，');

      if (!cookie) {
        console.error(`获取2FA二维码失败: 无法获取账户${account.email}的有效登录凭证`);
        return {
          success: false,
          message: '获取2FA二维码失败，无法获取有效的登录凭证'
        };
      }

      console.log(`成功获取登录凭证，正在调用Infini API获取2FA二维码...`);

      // 调用Infini API获取2FA二维码
      const response = await httpClient.post(
        `${INFINI_API_BASE_URL}/user/gen-google-2fa-qrcode`,
        {}, // 空请求体
        {
          headers: {
            'Cookie': cookie,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
            'Referer': 'https://app.infini.money/',
            'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'Accept': 'application/json, text/plain, */*'
          }
        }
      );

      console.log('Infini 2FA二维码API响应成功');

      // 记录完整的API响应用于调试
      console.log('Infini 2FA二维码API完整响应:', JSON.stringify(response.data));

      if (response.data.code === 0) {
        console.log('成功获取2FA二维码，正在处理和保存...');

        // 检查响应数据结构
        if (!response.data.data) {
          console.error('API响应缺少data字段');
          throw new Error('API响应结构异常：缺少data字段');
        }

        // 注意：API返回的字段是qr_code而不是qrcode_url
        if (!response.data.data.qr_code) {
          console.error('API响应中缺少二维码URL字段');
          throw new Error('API响应结构异常：缺少二维码URL');
        }

        // 从二维码URL中提取2FA密钥
        const qrCodeUrl = response.data.data.qr_code; // 正确的字段名
        let secretKey = '';

        console.log(`获取到二维码URL: ${qrCodeUrl}`);

        // 解析二维码URL提取密钥
        try {
          if (typeof qrCodeUrl !== 'string' || qrCodeUrl.trim() === '') {
            throw new Error('二维码URL不是有效的字符串');
          }

          // 二维码URL格式：otpauth://totp/Infini:email@example.com?secret=ABCDEFGH&issuer=Infini
          const urlMatch = qrCodeUrl.match(/secret=([A-Z0-9]+)/i);
          if (urlMatch && urlMatch[1]) {
            secretKey = urlMatch[1];
            console.log(`成功从二维码URL提取2FA密钥: ${secretKey}`);
          } else {
            console.warn('无法从2FA二维码URL中提取密钥，二维码URL格式不符合预期');
            // 尝试使用另一种匹配模式
            const fallbackMatch = qrCodeUrl.match(/[?&]secret=([^&]+)/i);
            if (fallbackMatch && fallbackMatch[1]) {
              secretKey = fallbackMatch[1];
              console.log(`使用备用方法成功提取2FA密钥: ${secretKey}`);
            } else {
              console.error('所有尝试提取密钥的方法均失败，二维码URL可能使用了不同格式');
            }
          }
        } catch (parseError) {
          console.error('解析2FA二维码URL提取密钥失败:', parseError);
          // 不中断流程，继续执行，但使用空密钥
          secretKey = '';
        }

        // 检查是否已存在2FA信息记录
        console.log(`检查账户ID ${accountId} 是否已存在2FA记录...`);
        const existing2faInfo = await db('infini_2fa_info')
          .where('infini_account_id', accountId)
          .first();

        // 使用事务确保数据完整性
        await db.transaction(async (trx) => {
          if (existing2faInfo) {
            console.log(`找到现有2FA记录，ID: ${existing2faInfo.id}，将保存到历史记录中`);

            // 将现有记录保存到历史表
            await trx('infini_2fa_history').insert({
              infini_account_id: accountId,
              qr_code_url: existing2faInfo.qr_code_url,
              secret_key: existing2faInfo.secret_key,
              recovery_codes: existing2faInfo.recovery_codes,
              created_at: new Date(),
              archived_at: new Date(),
              archived_reason: '重新生成2FA二维码'
            });

            console.log(`成功将现有2FA记录保存到历史表，正在更新现有记录...`);

            // 更新现有记录
            await trx('infini_2fa_info')
              .where('id', existing2faInfo.id)
              .update({
                qr_code_url: qrCodeUrl,
                secret_key: secretKey,
                updated_at: new Date()
              });

            console.log(`成功更新现有2FA记录`);
          } else {
            console.log(`未找到现有2FA记录，创建新记录...`);

            // 创建新记录
            await trx('infini_2fa_info').insert({
              infini_account_id: accountId,
              qr_code_url: qrCodeUrl,
              secret_key: secretKey,
              recovery_codes: '[]', // 初始为空数组字符串
              created_at: new Date(),
              updated_at: new Date()
            });

            console.log(`成功创建新的2FA记录`);
          }
        });

        console.log(`2FA信息处理完成，返回结果...`);

        // 返回增强的数据，包含提取出的密钥
        return {
          success: true,
          data: {
            ...response.data.data,
            secret_key: secretKey, // 额外添加提取出的密钥
            qr_code: qrCodeUrl     // 确保前端能获取到QR码URL
          },
          message: '成功获取并保存2FA二维码信息'
        };
      } else {
        console.error(`Infini API返回错误: ${response.data.message || '未知错误'}`);
        return {
          success: false,
          message: `获取2FA二维码失败: ${response.data.message || '未知错误'}`
        };
      }
    } catch (error) {
      console.error('获取2FA二维码失败:', error);
      return {
        success: false,
        message: `获取2FA二维码失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 发送Infini 2FA验证邮件
   * @param email 邮箱地址
   * @param accountId Infini账户ID
   * @param type 验证码类型，默认为6（2FA验证码）
   */
  async sendGoogle2faVerificationEmail(email: string, accountId: string, type: number = 6): Promise<ApiResponse> {
    try {
      if (!email) {
        return {
          success: false,
          message: '邮箱地址不能为空'
        };
      }

      // 查找账户
      const account = await db('infini_accounts')
        .where('id', accountId)
        .first();

      if (!account) {
        return {
          success: false,
          message: '找不到指定的Infini账户'
        };
      }

      // 获取有效Cookie
      const cookie = await this.getCookieForAccount(account, '发送2FA验证邮件失败，');

      if (!cookie) {
        return {
          success: false,
          message: '发送2FA验证邮件失败，无法获取有效的登录凭证'
        };
      }

      // 使用sendVerificationCode方法发送验证码，传递type参数
      console.log(`正在发送2FA验证邮件到 ${email}，使用type=${type}...`);
      const response = await this.sendVerificationCode(email, type);

      if (response.success) {
        return {
          success: true,
          message: '2FA验证邮件发送成功',
          data: response.data
        };
      } else {
        return {
          success: false,
          message: `发送2FA验证邮件失败: ${response.message || '未知错误'}`
        };
      }
    } catch (error) {
      console.error('发送2FA验证邮件失败:', error);
      return {
        success: false,
        message: `发送2FA验证邮件失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 获取用户基本信息
   * 调用Infini API获取用户基本信息
   * @param accountId Infini账户ID
   * @returns 包含基本信息的响应对象
   */
  async getBasicInformation(accountId: string): Promise<ApiResponse> {
    try {
      console.log(`开始获取账户 ${accountId} 的基本信息`);

      // 查找账户
      const account = await db('infini_accounts')
        .where('id', accountId)
        .first();

      if (!account) {
        console.error(`获取基本信息失败: 找不到ID为${accountId}的Infini账户`);
        return {
          success: false,
          message: '找不到指定的Infini账户'
        };
      }

      // 获取有效Cookie
      const cookie = await this.getCookieForAccount(account, '获取基本信息失败，');

      if (!cookie) {
        console.error(`获取基本信息失败: 无法获取账户${account.email}的有效登录凭证`);
        return {
          success: false,
          message: '获取基本信息失败，无法获取有效的登录凭证'
        };
      }

      // 调用API获取基本信息
      const response = await httpClient.post(
        `${INFINI_API_BASE_URL}/card/kyc/basic/information`,
        {}, // 空请求体
        {
          headers: {
            'Cookie': cookie,
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
            'Referer': 'https://app.infini.money/',
            'Origin': 'https://app.infini.money',
            'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"'
          }
        }
      );

      console.log('Infini 基本信息API响应:', response.data);

      // 验证API响应
      if (response.data.code === 0 && response.data.data && response.data.data.basic_information) {
        console.log(`成功获取基本信息: ${JSON.stringify(response.data.data.basic_information)}`);

        // 如果有基本信息，更新账户验证级别为基础认证(1)
        if (account.verification_level < 1) {
          await db('infini_accounts')
            .where('id', accountId)
            .update({
              verification_level: 1 // 更新为基础认证
            });
          console.log(`已更新账户 ${accountId} 的验证级别为基础认证(1)`);
        }

        return {
          success: true,
          data: response.data.data,
          message: '成功获取用户基本信息'
        };
      } else {
        console.error(`Infini API返回错误: ${response.data.message || '未知错误'}`);
        return {
          success: false,
          message: `获取基本信息失败: ${response.data.message || '未知错误'}`
        };
      }
    } catch (error) {
      console.error('获取基本信息失败:', error);
      return {
        success: false,
        message: `获取基本信息失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 获取KYC信息
   * 先从数据库查询，如果没有记录则调用API获取并保存到数据库
   * 如果KYC信息不存在，则尝试获取基本信息
   * @param accountId Infini账户ID
   * @returns 包含KYC信息的响应对象
   */
  async getKycInformation(accountId: string): Promise<ApiResponse> {
    try {
      console.log(`开始获取账户 ${accountId} 的KYC信息`);

      // 查找账户
      const account = await db('infini_accounts')
        .where('id', accountId)
        .first();

      if (!account) {
        console.error(`获取KYC信息失败: 找不到ID为${accountId}的Infini账户`);
        return {
          success: false,
          message: '找不到指定的Infini账户'
        };
      }

      // 先从数据库查询KYC信息
      console.log(`从数据库查询账户 ${accountId} 的KYC信息...`);
      const existingKycRecords = await db('infini_kyc_information')
        .where('infini_account_id', accountId)
        .orderBy('created_at', 'desc'); // 按创建时间倒序，获取最新记录

      // 如果数据库中有记录，直接返回
      if (existingKycRecords && existingKycRecords.length > 0) {
        console.log(`找到账户 ${accountId} 的KYC信息记录，共 ${existingKycRecords.length} 条`);

        // 如果账户验证级别低于KYC认证(2)，则更新
        if (account.verification_level < 2) {
          await db('infini_accounts')
            .where('id', accountId)
            .update({
              verification_level: 2 // 更新为KYC认证
            });
          console.log(`已更新账户 ${accountId} 的验证级别为KYC认证(2)`);
        }

        return {
          success: true,
          data: {
            kyc_information: existingKycRecords.map(record => ({
              id: record.kyc_id,
              is_valid: record.is_valid,
              type: record.type,
              s3_key: record.s3_key,
              first_name: record.first_name,
              last_name: record.last_name,
              country: record.country,
              phone: record.phone,
              phone_code: record.phone_code,
              identification_number: record.identification_number,
              status: record.status,
              applicant_id: record.applicant_id,
              sumsub_raw: record.sumsub_raw ? JSON.parse(record.sumsub_raw) : {},
              created_at: record.api_created_at
            }))
          },
          message: '成功获取KYC信息'
        };
      }

      // 如果数据库没有记录，调用API获取
      console.log(`数据库中没有账户 ${accountId} 的KYC信息记录，调用API获取...`);

      // 获取有效Cookie
      const cookie = await this.getCookieForAccount(account, '获取KYC信息失败，');

      if (!cookie) {
        console.error(`获取KYC信息失败: 无法获取账户${account.email}的有效登录凭证`);
        return {
          success: false,
          message: '获取KYC信息失败，无法获取有效的登录凭证'
        };
      }

      // 调用API获取KYC信息
      const response = await httpClient.post(
        `${INFINI_API_BASE_URL}/card/kyc/information`,
        {}, // 空请求体
        {
          headers: {
            'Cookie': cookie,
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
            'Referer': 'https://app.infini.money/',
            'Origin': 'https://app.infini.money',
            'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'cache-control': 'no-cache',
            'pragma': 'no-cache'
          }
        }
      );

      console.log('Infini KYC信息API响应:', response.data);

      // 验证API响应
      if (response.data.code === 0) {
        // 检查是否包含KYC信息
        if (response.data.data.kyc_information && response.data.data.kyc_information.length > 0) {
          console.log(`成功获取KYC信息，数据条数: ${response.data.data.kyc_information.length}`);

          // 保存到数据库
          await this.saveKycInformation(accountId, response.data.data.kyc_information);

          // 打印KYC信息的详细状态，用于调试
          console.log(`KYC信息详细内容:`, JSON.stringify(response.data.data.kyc_information));

          // 检查KYC信息中是否有已完成的认证记录
          // 扩展判断逻辑，捕获更多可能的"已完成"状态
          const kycRecords = response.data.data.kyc_information;
          let hasCompletedKyc = false;

          for (const kyc of kycRecords) {
            console.log(`检查KYC记录 ID:${kyc.id}, status:${kyc.status}, is_valid:${kyc.is_valid}`);

            // 只要有一条记录满足以下任一条件，就认为KYC已完成:
            // 1. status = 1 (常见的完成状态)
            // 2. is_valid = true (有效的KYC记录)
            // 3. status包含"通过"、"完成"、"成功"等中文状态
            // 4. 任何status不为0或null/undefined的记录 (0通常表示待处理)
            if (
              kyc.status === 1 ||
              kyc.is_valid === true ||
              (typeof kyc.status === 'string' &&
                (kyc.status.includes('通过') || kyc.status.includes('完成') || kyc.status.includes('成功'))) ||
              (kyc.status !== 0 && kyc.status !== null && kyc.status !== undefined)
            ) {
              hasCompletedKyc = true;
              console.log(`发现已完成的KYC记录: ID=${kyc.id}, status=${kyc.status}, is_valid=${kyc.is_valid}`);
              break;
            }
          }

          // 对于非0的验证级别，首先检查API返回的KYC信息
          if (hasCompletedKyc) {
            // 如果有已完成的KYC记录，更新账户验证级别为KYC认证(2)
            await db('infini_accounts')
              .where('id', accountId)
              .update({
                verification_level: 2 // 更新为KYC认证
              });
            console.log(`已更新账户 ${accountId} 的验证级别为KYC认证(2) - 检测到已完成的KYC记录`);
          } else if (account.verification_level === 3) {
            // 特别处理：如果账户当前是"认证中"状态且有KYC记录，我们认为KYC已完成
            // 这是为了处理账户7、8、9这种情况，API可能没明确表示完成，但实际已完成
            console.log(`账户 ${accountId} 当前处于认证中状态且有KYC记录，更新为已完成KYC认证`);
            await db('infini_accounts')
              .where('id', accountId)
              .update({
                verification_level: 2 // 更新为KYC认证
              });
          } else {
            // 如果KYC记录存在但未完成，且不是特殊处理的情况，更新为KYC认证中(3)
            await db('infini_accounts')
              .where('id', accountId)
              .update({
                verification_level: 3 // 更新为KYC认证中
              });
            console.log(`已更新账户 ${accountId} 的验证级别为KYC认证中(3) - KYC记录存在但未完成`);
          }

          return {
            success: true,
            data: response.data.data,
            message: '成功获取KYC信息'
          };
        } else {
          console.log(`账户 ${accountId} 暂无KYC信息记录，尝试获取基本信息...`);

          // 如果没有KYC信息，尝试获取基本信息
          const basicInfoResponse = await this.getBasicInformation(accountId);

          if (basicInfoResponse.success) {
            return {
              success: true,
              data: {
                kyc_information: [],
                basic_information: basicInfoResponse.data.basic_information
              },
              message: '未找到KYC信息，但成功获取基本信息'
            };
          } else {
            return {
              success: true,
              data: {
                kyc_information: []
              },
              message: '未找到KYC信息或基本信息'
            };
          }
        }
      } else {
        console.error(`Infini API返回错误: ${response.data.message || '未知错误'}`);

        // 如果KYC API调用失败，尝试获取基本信息
        console.log(`KYC信息获取失败，尝试获取基本信息...`);
        const basicInfoResponse = await this.getBasicInformation(accountId);

        if (basicInfoResponse.success) {
          return basicInfoResponse;
        } else {
          return {
            success: false,
            message: `获取KYC信息失败: ${response.data.message || '未知错误'}`
          };
        }
      }
    } catch (error) {
      console.error('获取KYC信息失败:', error);
      return {
        success: false,
        message: `获取KYC信息失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 保存KYC信息到数据库
   * @param accountId Infini账户ID
   * @param kycInfoList API返回的KYC信息列表
   */
  private async saveKycInformation(accountId: string, kycInfoList: any[]): Promise<void> {
    try {
      console.log(`开始保存账户 ${accountId} 的KYC信息，共 ${kycInfoList.length} 条...`);

      // 使用事务确保数据完整性
      await db.transaction(async (trx) => {
        for (const kycInfo of kycInfoList) {
          // 检查记录是否已存在
          const existingRecord = await trx('infini_kyc_information')
            .where({
              infini_account_id: accountId,
              kyc_id: kycInfo.id
            })
            .first();

          if (existingRecord) {
            // 更新现有记录
            console.log(`更新KYC信息记录 ID: ${kycInfo.id}`);
            await trx('infini_kyc_information')
              .where('id', existingRecord.id)
              .update({
                infini_account_id: accountId,
                kyc_id: kycInfo.id,
                is_valid: kycInfo.is_valid,
                type: kycInfo.type,
                s3_key: kycInfo.s3_key,
                first_name: kycInfo.first_name,
                last_name: kycInfo.last_name,
                country: kycInfo.country,
                phone: kycInfo.phone,
                phone_code: kycInfo.phone_code,
                identification_number: kycInfo.identification_number,
                status: kycInfo.status,
                applicant_id: kycInfo.applicant_id,
                sumsub_raw: JSON.stringify(kycInfo.sumsub_raw || {}),
                api_created_at: kycInfo.created_at,
                updated_at: new Date()
              });
          } else {
            // 插入新记录
            console.log(`插入新的KYC信息记录 ID: ${kycInfo.id}`);
            await trx('infini_kyc_information').insert({
              infini_account_id: accountId,
              kyc_id: kycInfo.id,
              is_valid: kycInfo.is_valid,
              type: kycInfo.type,
              s3_key: kycInfo.s3_key,
              first_name: kycInfo.first_name,
              last_name: kycInfo.last_name,
              country: kycInfo.country,
              phone: kycInfo.phone,
              phone_code: kycInfo.phone_code,
              identification_number: kycInfo.identification_number,
              status: kycInfo.status,
              applicant_id: kycInfo.applicant_id,
              sumsub_raw: JSON.stringify(kycInfo.sumsub_raw || {}),
              api_created_at: kycInfo.created_at,
              created_at: new Date(),
              updated_at: new Date()
            });
          }
        }
      });

      console.log(`成功保存账户 ${accountId} 的所有KYC信息`);
    } catch (error) {
      console.error('保存KYC信息到数据库失败:', error);
      throw error; // 向上传递错误，由调用方处理
    }
  }

  /**
   * 提交护照KYC验证
   * @param accountId Infini账户ID
   * @param passportData 护照数据对象，包含必要的护照信息
   * @returns 提交结果
   */
  async submitPassportKyc(accountId: string, passportData: {
    phoneNumber: string;
    phoneCode: string;
    firstName: string;
    lastName: string;
    country: string;
    passportNumber: string;
    fileName: string;
  }): Promise<ApiResponse> {
    try {
      console.log(`开始提交护照KYC验证，账户ID: ${accountId}`);

      // 查找账户
      const account = await db('infini_accounts')
        .where('id', accountId)
        .first();

      if (!account) {
        console.error(`提交护照KYC验证失败: 找不到ID为${accountId}的Infini账户`);
        return {
          success: false,
          message: '找不到指定的Infini账户'
        };
      }

      console.log(`找到账户 ${account.email}，正在获取有效的登录凭证...`);

      // 获取有效Cookie
      const cookie = await this.getCookieForAccount(account, '提交护照KYC验证失败，');

      if (!cookie) {
        console.error(`提交护照KYC验证失败: 无法获取账户${account.email}的有效登录凭证`);
        return {
          success: false,
          message: '提交护照KYC验证失败，无法获取有效的登录凭证'
        };
      }

      console.log(`成功获取登录凭证，正在准备请求数据...`);

      // 准备请求数据 - 转换为API所需的格式
      const requestData = {
        phone_number: passportData.phoneNumber,
        phone_code: passportData.phoneCode,
        first_name: passportData.firstName,
        last_name: passportData.lastName,
        country: passportData.country,
        passport_number: passportData.passportNumber,
        file_name: passportData.fileName
      };

      console.log(`正在提交护照KYC数据到Infini API...`);

      // 发送请求提交护照KYC数据
      const response = await httpClient.post(
        `${INFINI_API_BASE_URL}/card/kyc/passport`,
        requestData,
        {
          headers: {
            'Cookie': cookie,
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
            'Referer': 'https://app.infini.money/',
            'Origin': 'https://app.infini.money',
            'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"'
          }
        }
      );

      console.log('Infini 护照KYC验证API响应:', response.data);

      // 验证API响应
      if (response.data.code === 0) {
        console.log(`护照KYC验证提交成功`);

        // 更新账户验证级别为"KYC认证中"(3)
        await db('infini_accounts')
          .where('id', accountId)
          .update({
            verification_level: 3 // 3表示"KYC认证中"
          });
        console.log(`已更新账户 ${accountId} 的验证级别为KYC认证中(3)`);

        // 创建或更新KYC信息记录
        const currentDate = new Date();
        const kycData = {
          infini_account_id: accountId,
          kyc_id: null, // API响应中可能没有返回ID
          is_valid: false, // 初始状态为未验证
          type: 0, // 默认类型为护照
          s3_key: passportData.fileName,
          first_name: passportData.firstName,
          last_name: passportData.lastName,
          country: passportData.country,
          phone: passportData.phoneNumber,
          phone_code: passportData.phoneCode,
          identification_number: passportData.passportNumber,
          status: 0, // 初始状态为待处理
          applicant_id: '',
          sumsub_raw: '{}',
          api_created_at: Math.floor(currentDate.getTime() / 1000), // 转换为Unix时间戳
          created_at: currentDate,
          updated_at: currentDate
        };

        // 检查是否已有KYC记录
        const existingKyc = await db('infini_kyc_information')
          .where({
            infini_account_id: accountId,
            s3_key: passportData.fileName
          })
          .first();

        if (existingKyc) {
          // 更新现有记录
          await db('infini_kyc_information')
            .where('id', existingKyc.id)
            .update({
              first_name: kycData.first_name,
              last_name: kycData.last_name,
              country: kycData.country,
              phone: kycData.phone,
              phone_code: kycData.phone_code,
              identification_number: kycData.identification_number,
              updated_at: kycData.updated_at
            });
          console.log(`已更新KYC信息记录，ID: ${existingKyc.id}`);
        } else {
          // 创建新记录
          await db('infini_kyc_information').insert(kycData);
          console.log(`已创建新的KYC信息记录`);
        }

        return {
          success: true,
          data: response.data.data,
          message: '护照KYC验证提交成功'
        };
      } else {
        console.error(`Infini API返回错误: ${response.data.message || '未知错误'}`);
        return {
          success: false,
          message: `提交护照KYC验证失败: ${response.data.message || '未知错误'}`
        };
      }
    } catch (error) {
      console.error('提交护照KYC验证失败:', error);
      return {
        success: false,
        message: `提交护照KYC验证失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 绑定Infini 2FA
   * @param verificationCode 邮件验证码
   * @param google2faCode 2FA验证码
   * @param accountId Infini账户ID
   * @param recoveryCodes 恢复码数组（可选）
   */
  async bindGoogle2fa(verificationCode: string, google2faCode: string, accountId: string, recoveryCodes?: string[]): Promise<ApiResponse> {
    try {
      if (!verificationCode || !google2faCode) {
        return {
          success: false,
          message: '邮件验证码和2FA验证码均不能为空'
        };
      }

      // 查找账户
      const account = await db('infini_accounts')
        .where('id', accountId)
        .first();

      if (!account) {
        return {
          success: false,
          message: '找不到指定的Infini账户'
        };
      }

      // 获取有效Cookie
      const cookie = await this.getCookieForAccount(account, '绑定2FA失败，');

      if (!cookie) {
        return {
          success: false,
          message: '绑定2FA失败，无法获取有效的登录凭证'
        };
      }

      // 调用Infini API绑定2FA
      const response = await httpClient.post(
        `${INFINI_API_BASE_URL}/user/bind-google-2fa`,
        {
          verification_code: verificationCode,
          google_2fa_code: google2faCode
        },
        {
          headers: {
            'Cookie': cookie,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
            'Referer': 'https://app.infini.money/',
            'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'Accept': 'application/json, text/plain, */*'
          }
        }
      );

      console.log('Infini 绑定2FA API响应:', response.data);

      if (response.data.code === 0) {
        // 更新账户的2FA状态
        await db('infini_accounts')
          .where('id', accountId)
          .update({
            google_2fa_is_bound: true,
            last_sync_at: new Date()
          });

        // 从API响应中提取恢复码
        const apiRecoveryCodes = response.data.data.recovery_code;

        // 使用API返回的恢复码，或者传入的恢复码参数（两者取其一，优先使用API返回的）
        const recoveryCodeArray = (apiRecoveryCodes && apiRecoveryCodes.length > 0)
          ? apiRecoveryCodes
          : (recoveryCodes && recoveryCodes.length > 0) ? recoveryCodes : [];

        if (recoveryCodeArray.length > 0) {
          console.log(`从API响应中提取到${recoveryCodeArray.length}个恢复码，保存到2FA信息表`);

          // 查找2FA信息记录
          const twoFaInfo = await db('infini_2fa_info')
            .where('infini_account_id', accountId)
            .first();

          if (twoFaInfo) {
            // 更新恢复码，但保留现有的qr_code_url和secret_key
            const updateData: any = {
              recovery_codes: JSON.stringify(recoveryCodeArray),
              updated_at: new Date()
            };

            // 确保不覆盖已有的2FA信息
            if (!twoFaInfo.qr_code_url && !twoFaInfo.secret_key) {
              console.log('警告：当前2FA信息缺少qr_code_url和secret_key，请确保先调用getGoogle2faQrcode获取相关信息');
            }

            await db('infini_2fa_info')
              .where('id', twoFaInfo.id)
              .update(updateData);

            console.log(`成功更新2FA信息记录中的恢复码，保留了原有2FA链接和密钥`);
          } else {
            // 不太可能走到这里，因为getGoogle2faQrcode应该已经创建了记录
            // 但以防万一，创建一个新记录，并记录警告信息
            console.log('警告：未找到既有的2FA信息记录，将创建新记录，但缺少2FA链接和密钥，请确保先调用getGoogle2faQrcode');

            await db('infini_2fa_info').insert({
              infini_account_id: accountId,
              recovery_codes: JSON.stringify(recoveryCodeArray),
              created_at: new Date(),
              updated_at: new Date()
            });

            console.log(`创建了新的2FA信息记录并保存恢复码，但缺少2FA链接和密钥`);
          }
        }

        return {
          success: true,
          message: '2FA绑定成功',
          data: response.data.data
        };
      } else {
        return {
          success: false,
          message: `绑定2FA失败: ${response.data.message || '未知错误'}`
        };
      }
    } catch (error) {
      console.error('绑定2FA失败:', error);
      return {
        success: false,
        message: `绑定2FA失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 获取开卡金额
   * @param accountId Infini账户ID
   * @param cardType 卡片类型
   * @returns 开卡金额信息
   */
  async getCardPrice(accountId: string, cardType: string = '3'): Promise<ApiResponse> {
    try {
      console.log(`开始获取卡片价格信息，账户ID: ${accountId}, 卡片类型: ${cardType}`);

      // 查找账户
      const account = await db('infini_accounts')
        .where('id', accountId)
        .first();

      if (!account) {
        console.error(`获取卡片价格信息失败: 找不到ID为${accountId}的Infini账户`);
        return {
          success: false,
          message: '找不到指定的Infini账户'
        };
      }

      // 获取有效Cookie
      const cookie = await this.getCookieForAccount(account, '获取卡片价格信息失败，');

      if (!cookie) {
        console.error(`获取卡片价格信息失败: 无法获取账户${account.email}的有效登录凭证`);
        return {
          success: false,
          message: '获取卡片价格信息失败，无法获取有效的登录凭证'
        };
      }

      // 调用API获取卡片价格信息
      const response = await httpClient.get(
        `${INFINI_API_BASE_URL}/card/budget_card/price`,
        {
          params: {
            card_type: cardType
          },
          headers: {
            'Cookie': cookie,
            'sec-ch-ua-platform': '"macOS"',
            'Referer': 'https://app.infini.money/',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
            'sec-ch-ua-mobile': '?0'
          }
        }
      );

      console.log('Infini 卡片价格API响应:', response.data);

      // 验证API响应
      if (response.data.code === 0) {
        console.log(`成功获取卡片价格信息: ${JSON.stringify(response.data.data)}`);

        return {
          success: true,
          data: response.data.data,
          message: '成功获取卡片价格信息'
        };
      } else {
        console.error(`Infini API返回错误: ${response.data.message || '未知错误'}`);
        return {
          success: false,
          message: `获取卡片价格信息失败: ${response.data.message || '未知错误'}`
        };
      }
    } catch (error) {
      console.error('获取卡片价格信息失败:', error);
      return {
        success: false,
        message: `获取卡片价格信息失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 获取可用的卡的类型
   * @param accountId Infini账户ID
   * @returns 可用的卡类型信息
   */
  async getAvailableCardTypes(accountId: string): Promise<ApiResponse> {
    try {
      console.log(`开始获取可用卡类型信息，账户ID: ${accountId}`);

      // 查找账户
      const account = await db('infini_accounts')
        .where('id', accountId)
        .first();

      if (!account) {
        console.error(`获取可用卡类型信息失败: 找不到ID为${accountId}的Infini账户`);
        return {
          success: false,
          message: '找不到指定的Infini账户'
        };
      }

      // 获取有效Cookie
      const cookie = await this.getCookieForAccount(account, '获取可用卡类型信息失败，');

      if (!cookie) {
        console.error(`获取可用卡类型信息失败: 无法获取账户${account.email}的有效登录凭证`);
        return {
          success: false,
          message: '获取可用卡类型信息失败，无法获取有效的登录凭证'
        };
      }

      // 调用API获取可用卡类型信息
      const response = await httpClient.get(
        `${INFINI_API_BASE_URL}/card/create_card/available`,
        {
          headers: {
            'Cookie': cookie,
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'en',
            'cache-control': 'no-cache',
            'origin': 'https://app.infini.money',
            'pragma': 'no-cache',
            'priority': 'u=1, i',
            'referer': 'https://app.infini.money/',
            'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
          }
        }
      );

      console.log('Infini 可用卡类型API响应:', response.data);

      // 验证API响应
      if (response.data.code === 0) {
        console.log(`成功获取可用卡类型信息: ${JSON.stringify(response.data.data)}`);

        // 转换card_status对象的key为数字数组
        const cardTypes = Object.keys(response.data.data.card_status).map(key => parseInt(key));

        return {
          success: true,
          data: {
            cardTypes,
            rawData: response.data.data
          },
          message: '成功获取可用卡类型信息'
        };
      } else {
        console.error(`Infini API返回错误: ${response.data.message || '未知错误'}`);
        return {
          success: false,
          message: `获取可用卡类型信息失败: ${response.data.message || '未知错误'}`
        };
      }
    } catch (error) {
      console.error('获取可用卡类型信息失败:', error);
      return {
        success: false,
        message: `获取可用卡类型信息失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 创建卡
   * @param accountId Infini账户ID
   * @param cardType 卡片类型
   * @returns 创建卡的结果
   */
  async createCard(accountId: string, cardType: number = 3): Promise<ApiResponse> {
    try {
      console.log(`开始创建卡片，账户ID: ${accountId}, 卡片类型: ${cardType}`);

      // 查找账户
      const account = await db('infini_accounts')
        .where('id', accountId)
        .first();

      if (!account) {
        console.error(`创建卡片失败: 找不到ID为${accountId}的Infini账户`);
        return {
          success: false,
          message: '找不到指定的Infini账户'
        };
      }

      // 获取有效Cookie
      const cookie = await this.getCookieForAccount(account, '创建卡片失败，');

      if (!cookie) {
        console.error(`创建卡片失败: 无法获取账户${account.email}的有效登录凭证`);
        return {
          success: false,
          message: '创建卡片失败，无法获取有效的登录凭证'
        };
      }

      // 调用API创建卡片
      const response = await httpClient.post(
        `${INFINI_API_BASE_URL}/card/create/intent`,
        { card_type: cardType },
        {
          headers: {
            'Cookie': cookie,
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'en',
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            'origin': 'https://app.infini.money',
            'pragma': 'no-cache',
            'priority': 'u=1, i',
            'referer': 'https://app.infini.money/',
            'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
          }
        }
      );

      console.log('Infini 创建卡片API响应:', response.data);

      // 验证API响应
      if (response.data.code === 0) {
        console.log(`成功创建卡片: ${JSON.stringify(response.data.data)}`);

        return {
          success: true,
          data: response.data.data,
          message: '成功创建卡片'
        };
      } else {
        console.error(`Infini API返回错误: ${response.data.message || '未知错误'}`);
        return {
          success: false,
          message: `创建卡片失败: ${response.data.message || '未知错误'}`
        };
      }
    } catch (error) {
      console.error('创建卡片失败:', error);
      return {
        success: false,
        message: `创建卡片失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 获取卡片列表
   * @param accountId Infini账户ID
   * @returns 卡片列表信息
   */
  async getCardList(accountId: string): Promise<ApiResponse> {
    try {
      console.log(`开始获取卡片列表，账户ID: ${accountId}`);

      // 查找账户
      const account = await db('infini_accounts')
        .where('id', accountId)
        .first();

      if (!account) {
        console.error(`获取卡片列表失败: 找不到ID为${accountId}的Infini账户`);
        return {
          success: false,
          message: '找不到指定的Infini账户'
        };
      }

      // 获取有效Cookie
      const cookie = await this.getCookieForAccount(account, '获取卡片列表失败，');

      if (!cookie) {
        console.error(`获取卡片列表失败: 无法获取账户${account.email}的有效登录凭证`);
        return {
          success: false,
          message: '获取卡片列表失败，无法获取有效的登录凭证'
        };
      }

      // 调用API获取卡片列表
      const response = await httpClient.get(
        `${INFINI_API_BASE_URL}/card/info`,
        {
          headers: {
            'Cookie': cookie,
            'sec-ch-ua-platform': '"macOS"',
            'Referer': 'https://app.infini.money/',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
            'sec-ch-ua-mobile': '?0'
          }
        }
      );

      console.log('Infini 卡片列表API响应:', response.data);

      // 验证API响应
      if (response.data.code === 0) {
        console.log(`成功获取卡片列表: ${JSON.stringify(response.data.data)}`);

        return {
          success: true,
          data: response.data.data,
          message: '成功获取卡片列表'
        };
      } else {
        console.error(`Infini API返回错误: ${response.data.message || '未知错误'}`);
        return {
          success: false,
          message: `获取卡片列表失败: ${response.data.message || '未知错误'}`
        };
      }
    } catch (error) {
      console.error('获取卡片列表失败:', error);
      return {
        success: false,
        message: `获取卡片列表失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 更新2FA信息
   * @param accountId Infini账户ID
   * @param twoFaData 2FA信息数据，包含qr_code_url、secret_key和recovery_codes
   * @returns 更新结果
   */
  async update2faInfo(
    accountId: string, 
    twoFaData: {
      qr_code_url?: string;
      secret_key?: string;
      recovery_codes?: string[];
    }
  ): Promise<ApiResponse> {
    try {
      console.log(`开始更新账户 ${accountId} 的2FA信息`);

      // 查找账户
      const account = await db('infini_accounts')
        .where('id', accountId)
        .first();

      if (!account) {
        console.error(`更新2FA信息失败: 找不到ID为${accountId}的Infini账户`);
        return {
          success: false,
          message: '找不到指定的Infini账户'
        };
      }

      // 检查是否存在2FA信息记录
      const existing2faInfo = await db('infini_2fa_info')
        .where('infini_account_id', accountId)
        .first();

      // 准备更新数据
      const updateData: any = {
        updated_at: new Date()
      };

      if (twoFaData.qr_code_url !== undefined) {
        updateData.qr_code_url = twoFaData.qr_code_url;
      }

      if (twoFaData.secret_key !== undefined) {
        updateData.secret_key = twoFaData.secret_key;
      }

      if (twoFaData.recovery_codes !== undefined) {
        updateData.recovery_codes = JSON.stringify(twoFaData.recovery_codes);
      }

      if (existing2faInfo) {
        // 更新现有记录
        await db('infini_2fa_info')
          .where('id', existing2faInfo.id)
          .update(updateData);

        console.log(`成功更新账户 ${accountId} 的2FA信息记录`);
      } else {
        // 创建新记录
        updateData.infini_account_id = accountId;
        updateData.created_at = new Date();
        
        await db('infini_2fa_info').insert(updateData);

        console.log(`为账户 ${accountId} 创建了新的2FA信息记录`);
      }

      // 获取更新后的2FA信息
      const updatedInfo = await db('infini_2fa_info')
        .where('infini_account_id', accountId)
        .first();

      // 格式化返回数据
      const formattedInfo = {
        qrCodeUrl: updatedInfo.qr_code_url,
        secretKey: updatedInfo.secret_key,
        recoveryCodes: updatedInfo.recovery_codes ? JSON.parse(updatedInfo.recovery_codes) : []
      };

      return {
        success: true,
        data: formattedInfo,
        message: '成功更新2FA信息'
      };
    } catch (error) {
      console.error('更新2FA信息失败:', error);
      return {
        success: false,
        message: `更新2FA信息失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 获取所有账户分组
   * @returns 包含所有分组信息的响应对象
   */
  async getAllAccountGroups(): Promise<ApiResponse> {
    try {
      const groups = await db('infini_account_groups')
        .select([
          'id',
          'name',
          'description',
          'is_default as isDefault',
          'created_at as createdAt',
          'updated_at as updatedAt'
        ])
        .orderBy('is_default', 'desc') // 默认分组排在前面
        .orderBy('name', 'asc'); // 然后按名称排序

      // 获取每个分组关联的账户数量
      const groupCounts = await db('infini_account_group_relations')
        .select('group_id')
        .count('infini_account_id as accountCount')
        .groupBy('group_id');

      // 创建分组ID到账户数量的映射
      const countMap = new Map();
      groupCounts.forEach(item => {
        countMap.set(item.group_id, parseInt(item.accountCount as string, 10));
      });

      // 添加账户数量到分组信息中
      const groupsWithCount = groups.map(group => ({
        ...group,
        accountCount: countMap.get(group.id) || 0
      }));

      return {
        success: true,
        data: groupsWithCount,
        message: '成功获取所有账户分组'
      };
    } catch (error) {
      console.error('获取账户分组列表失败:', error);
      return {
        success: false,
        message: `获取账户分组列表失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 获取单个账户分组
   * @param id 分组ID
   * @returns 包含分组信息的响应对象
   */
  async getAccountGroupById(id: string): Promise<ApiResponse> {
    try {
      const group = await db('infini_account_groups')
        .select([
          'id',
          'name',
          'description',
          'is_default as isDefault',
          'created_at as createdAt',
          'updated_at as updatedAt'
        ])
        .where('id', id)
        .first();

      if (!group) {
        return {
          success: false,
          message: '找不到指定的账户分组'
        };
      }

      // 获取分组关联的账户数量
      const countResult = await db('infini_account_group_relations')
        .where('group_id', id)
        .count('infini_account_id as accountCount')
        .first();

      // 获取分组关联的账户列表
      const accounts = await db('infini_account_group_relations')
        .join('infini_accounts', 'infini_account_group_relations.infini_account_id', 'infini_accounts.id')
        .where('infini_account_group_relations.group_id', id)
        .select([
          'infini_accounts.id',
          'infini_accounts.email',
          'infini_accounts.status',
          'infini_accounts.available_balance as availableBalance'
        ]);

      // 添加账户数量和账户列表到响应中
      const groupWithDetails = {
        ...group,
        accountCount: countResult ? parseInt(countResult.accountCount as string, 10) : 0,
        accounts
      };

      return {
        success: true,
        data: groupWithDetails,
        message: '成功获取账户分组信息'
      };
    } catch (error) {
      console.error('获取账户分组信息失败:', error);
      return {
        success: false,
        message: `获取账户分组信息失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 创建账户分组
   * @param groupData 分组数据，包含name和description
   * @returns 包含新创建的分组信息的响应对象
   */
  async createAccountGroup(groupData: { name: string; description?: string }): Promise<ApiResponse> {
    try {
      // 检查分组名称是否为空
      if (!groupData.name || groupData.name.trim() === '') {
        return {
          success: false,
          message: '分组名称不能为空'
        };
      }

      // 检查分组名称是否已存在
      const existingGroup = await db('infini_account_groups')
        .where('name', groupData.name)
        .first();

      if (existingGroup) {
        return {
          success: false,
          message: '分组名称已存在'
        };
      }

      // 插入新分组
      const [newGroupId] = await db('infini_account_groups').insert({
        name: groupData.name,
        description: groupData.description || '',
        is_default: false, // 新创建的分组不是默认分组
        created_at: new Date(),
        updated_at: new Date()
      });

      // 获取新创建的分组信息
      const newGroup = await db('infini_account_groups')
        .select([
          'id',
          'name',
          'description',
          'is_default as isDefault',
          'created_at as createdAt',
          'updated_at as updatedAt'
        ])
        .where('id', newGroupId)
        .first();

      return {
        success: true,
        data: newGroup,
        message: '成功创建账户分组'
      };
    } catch (error) {
      console.error('创建账户分组失败:', error);
      return {
        success: false,
        message: `创建账户分组失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 更新账户分组
   * @param id 分组ID
   * @param groupData 分组数据，包含name和description
   * @returns 包含更新后的分组信息的响应对象
   */
  async updateAccountGroup(id: string, groupData: { name?: string; description?: string }): Promise<ApiResponse> {
    try {
      // 查找分组
      const group = await db('infini_account_groups')
        .where('id', id)
        .first();

      if (!group) {
        return {
          success: false,
          message: '找不到指定的账户分组'
        };
      }

      // 不允许修改默认分组的名称
      if (group.is_default && groupData.name && groupData.name !== group.name) {
        return {
          success: false,
          message: '不允许修改默认分组的名称'
        };
      }

      // 如果要修改名称，检查是否与其他分组重名
      if (groupData.name && groupData.name !== group.name) {
        const existingGroup = await db('infini_account_groups')
          .where('name', groupData.name)
          .whereNot('id', id)
          .first();

        if (existingGroup) {
          return {
            success: false,
            message: '分组名称已存在'
          };
        }
      }

      // 准备更新字段
      const updateData: Record<string, any> = {
        updated_at: new Date()
      };

      if (groupData.name !== undefined && groupData.name.trim() !== '') {
        updateData.name = groupData.name;
      }

      if (groupData.description !== undefined) {
        updateData.description = groupData.description;
      }

      // 如果没有要更新的字段，直接返回成功
      if (Object.keys(updateData).length === 1) { // 只有updated_at
        return {
          success: true,
          message: '没有字段需要更新',
          data: group
        };
      }

      // 更新分组
      await db('infini_account_groups')
        .where('id', id)
        .update(updateData);

      // 获取更新后的分组信息
      const updatedGroup = await db('infini_account_groups')
        .select([
          'id',
          'name',
          'description',
          'is_default as isDefault',
          'created_at as createdAt',
          'updated_at as updatedAt'
        ])
        .where('id', id)
        .first();

      return {
        success: true,
        data: updatedGroup,
        message: '成功更新账户分组'
      };
    } catch (error) {
      console.error('更新账户分组失败:', error);
      return {
        success: false,
        message: `更新账户分组失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 删除账户分组
   * @param id 分组ID
   * @returns 删除结果
   */
  async deleteAccountGroup(id: string): Promise<ApiResponse> {
    try {
      // 查找分组
      const group = await db('infini_account_groups')
        .where('id', id)
        .first();

      if (!group) {
        return {
          success: false,
          message: '找不到指定的账户分组'
        };
      }

      // 不允许删除默认分组
      if (group.is_default) {
        return {
          success: false,
          message: '不允许删除默认分组'
        };
      }

      // 查找分组关联的账户数量
      const accountCount = await db('infini_account_group_relations')
        .where('group_id', id)
        .count('* as count')
        .first();

      const count = parseInt(accountCount?.count as string || '0', 10);

      // 获取默认分组
      const defaultGroup = await db('infini_account_groups')
        .where('is_default', true)
        .first();

      if (!defaultGroup) {
        return {
          success: false,
          message: '找不到默认分组，无法删除当前分组'
        };
      }

      // 使用事务保证操作的原子性
      await db.transaction(async (trx) => {
        // 如果分组有关联的账户，将这些账户移到默认分组（如果它们还不在默认分组中）
        if (count > 0) {
          // 获取当前分组中的所有账户ID
          const accountIds = await trx('infini_account_group_relations')
            .where('group_id', id)
            .pluck('infini_account_id');

          // 获取已经在默认分组中的账户ID
          const accountsInDefaultGroup = await trx('infini_account_group_relations')
            .where('group_id', defaultGroup.id)
            .whereIn('infini_account_id', accountIds)
            .pluck('infini_account_id');

          // 找出不在默认分组中的账户ID
          const accountsNotInDefaultGroup = accountIds.filter(
            accountId => !accountsInDefaultGroup.includes(accountId)
          );

          // 为这些账户添加到默认分组的关联记录
          if (accountsNotInDefaultGroup.length > 0) {
            const relationRecords = accountsNotInDefaultGroup.map(accountId => ({
              infini_account_id: accountId,
              group_id: defaultGroup.id,
              created_at: new Date(),
              updated_at: new Date()
            }));

            await trx('infini_account_group_relations').insert(relationRecords);
          }
        }

        // 删除与该分组相关的所有账户关联
        await trx('infini_account_group_relations')
          .where('group_id', id)
          .delete();

        // 删除分组
        await trx('infini_account_groups')
          .where('id', id)
          .delete();
      });

      return {
        success: true,
        message: `成功删除账户分组"${group.name}"，其中的账户已移至默认分组`
      };
    } catch (error) {
      console.error('删除账户分组失败:', error);
      return {
        success: false,
        message: `删除账户分组失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 向分组添加账户
   * @param groupId 分组ID
   * @param accountId 账户ID
   * @returns 添加结果
   */
  async addAccountToGroup(groupId: string, accountId: string): Promise<ApiResponse> {
    try {
      // 查找分组
      const group = await db('infini_account_groups')
        .where('id', groupId)
        .first();

      if (!group) {
        return {
          success: false,
          message: '找不到指定的账户分组'
        };
      }

      // 查找账户
      const account = await db('infini_accounts')
        .where('id', accountId)
        .first();

      if (!account) {
        return {
          success: false,
          message: '找不到指定的Infini账户'
        };
      }

      // 检查账户是否已在该分组中
      const existingRelation = await db('infini_account_group_relations')
        .where({
          infini_account_id: accountId,
          group_id: groupId
        })
        .first();

      if (existingRelation) {
        return {
          success: true,
          message: '账户已在该分组中，无需再次添加'
        };
      }

      // 添加账户到分组
      await db('infini_account_group_relations').insert({
        infini_account_id: accountId,
        group_id: groupId,
        created_at: new Date(),
        updated_at: new Date()
      });

      return {
        success: true,
        message: '成功将账户添加到分组'
      };
    } catch (error) {
      console.error('添加账户到分组失败:', error);
      return {
        success: false,
        message: `添加账户到分组失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 批量向分组添加账户
   * @param groupId 分组ID
   * @param accountIds 账户ID数组
   * @returns 添加结果
   */
  async addAccountsToGroup(groupId: string, accountIds: string[]): Promise<ApiResponse> {
    try {
      if (!accountIds || accountIds.length === 0) {
        return {
          success: false,
          message: '账户ID列表不能为空'
        };
      }

      // 查找分组
      const group = await db('infini_account_groups')
        .where('id', groupId)
        .first();

      if (!group) {
        return {
          success: false,
          message: '找不到指定的账户分组'
        };
      }

      // 验证所有账户ID是否有效
      const validAccounts = await db('infini_accounts')
        .whereIn('id', accountIds)
        .pluck('id');

      if (validAccounts.length === 0) {
        return {
          success: false,
          message: '未找到有效的账户'
        };
      }

      // 查找已经存在的关联关系
      const existingRelations = await db('infini_account_group_relations')
        .where('group_id', groupId)
        .whereIn('infini_account_id', validAccounts)
        .pluck('infini_account_id');

      // 找出不存在关联关系的账户ID
      const accountsToAdd = validAccounts.filter(id => !existingRelations.includes(id));

      // 如果没有需要添加的账户，直接返回
      if (accountsToAdd.length === 0) {
        return {
          success: true,
          message: '所有有效账户已在分组中，无需再次添加',
          data: { addedCount: 0, totalCount: validAccounts.length }
        };
      }

      // 批量添加关联关系
      const now = new Date();
      const relationRecords = accountsToAdd.map(accountId => ({
        infini_account_id: accountId,
        group_id: groupId,
        created_at: now,
        updated_at: now
      }));

      await db('infini_account_group_relations').insert(relationRecords);

      return {
        success: true,
        message: `成功将${accountsToAdd.length}个账户添加到分组`,
        data: { 
          addedCount: accountsToAdd.length, 
          totalCount: validAccounts.length,
          invalidCount: accountIds.length - validAccounts.length
        }
      };
    } catch (error) {
      console.error('批量添加账户到分组失败:', error);
      return {
        success: false,
        message: `批量添加账户到分组失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 从分组中移除账户
   * @param groupId 分组ID
   * @param accountId 账户ID
   * @returns 移除结果
   */
  async removeAccountFromGroup(groupId: string, accountId: string): Promise<ApiResponse> {
    try {
      // 查找分组
      const group = await db('infini_account_groups')
        .where('id', groupId)
        .first();

      if (!group) {
        return {
          success: false,
          message: '找不到指定的账户分组'
        };
      }

      // 不允许从默认分组中移除账户，除非该账户同时属于其他分组
      if (group.is_default) {
        // 检查账户是否同时属于其他分组
        const otherGroupCount = await db('infini_account_group_relations')
          .where('infini_account_id', accountId)
          .whereNot('group_id', groupId)
          .count('* as count')
          .first();

        const count = parseInt(otherGroupCount?.count as string || '0', 10);
        if (count === 0) {
          return {
            success: false,
            message: '不能从默认分组中移除账户，除非该账户同时属于其他分组'
          };
        }
      }

      // 查找账户
      const account = await db('infini_accounts')
        .where('id', accountId)
        .first();

      if (!account) {
        return {
          success: false,
          message: '找不到指定的Infini账户'
        };
      }

      // 检查账户是否在该分组中
      const relation = await db('infini_account_group_relations')
        .where({
          infini_account_id: accountId,
          group_id: groupId
        })
        .first();

      if (!relation) {
        return {
          success: true,
          message: '账户不在该分组中，无需移除'
        };
      }

      // 从分组中移除账户
      await db('infini_account_group_relations')
        .where({
          infini_account_id: accountId,
          group_id: groupId
        })
        .delete();

      return {
        success: true,
        message: '成功将账户从分组中移除'
      };
    } catch (error) {
      console.error('从分组中移除账户失败:', error);
      return {
        success: false,
        message: `从分组中移除账户失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 批量从分组中移除账户
   * @param groupId 分组ID
   * @param accountIds 账户ID数组
   * @returns 移除结果
   */
  async removeAccountsFromGroup(groupId: string, accountIds: string[]): Promise<ApiResponse> {
    try {
      if (!accountIds || accountIds.length === 0) {
        return {
          success: false,
          message: '账户ID列表不能为空'
        };
      }

      // 查找分组
      const group = await db('infini_account_groups')
        .where('id', groupId)
        .first();

      if (!group) {
        return {
          success: false,
          message: '找不到指定的账户分组'
        };
      }

      // 如果是默认分组，需要检查每个账户是否同时属于其他分组
      if (group.is_default) {
        // 获取所有待移除账户的其他分组关联信息
        const accountGroupCounts = await db('infini_account_group_relations')
          .whereIn('infini_account_id', accountIds)
          .whereNot('group_id', groupId)
          .select('infini_account_id')
          .count('* as count')
          .groupBy('infini_account_id');

        // 创建账户ID到其他分组数量的映射
        const accountGroupCountMap = new Map();
        accountGroupCounts.forEach(item => {
          accountGroupCountMap.set(item.infini_account_id, parseInt(item.count as string, 10));
        });

        // 筛选出只属于默认分组的账户
        const accountsOnlyInDefaultGroup = accountIds.filter(id => 
          !accountGroupCountMap.has(id) || accountGroupCountMap.get(id) === 0
        );

        if (accountsOnlyInDefaultGroup.length > 0) {
          return {
            success: false,
            message: `不能从默认分组中移除${accountsOnlyInDefaultGroup.length}个账户，因为它们不属于任何其他分组`,
            data: { accountsOnlyInDefaultGroup }
          };
        }
      }

      // 查找实际存在于该分组中的账户
      const existingRelations = await db('infini_account_group_relations')
        .where('group_id', groupId)
        .whereIn('infini_account_id', accountIds)
        .pluck('infini_account_id');

      // 如果没有账户在该分组中，直接返回
      if (existingRelations.length === 0) {
        return {
          success: true,
          message: '所有指定账户都不在该分组中，无需移除',
          data: { removedCount: 0, totalCount: accountIds.length }
        };
      }

      // 批量删除关联关系
      await db('infini_account_group_relations')
        .where('group_id', groupId)
        .whereIn('infini_account_id', existingRelations)
        .delete();

      return {
        success: true,
        message: `成功将${existingRelations.length}个账户从分组中移除`,
        data: { 
          removedCount: existingRelations.length, 
          totalCount: accountIds.length
        }
      };
    } catch (error) {
      console.error('批量从分组中移除账户失败:', error);
      return {
        success: false,
        message: `批量从分组中移除账户失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 批量同步所有Infini账户KYC信息
   * 针对每个账户，获取并更新KYC信息
   * 已完成KYC状态的账户会跳过再次同步
   */
  async syncAllKycInformation(): Promise<ApiResponse> {
    try {
      // 获取所有Infini账户
      const accounts = await db('infini_accounts').select('*');

      if (accounts.length === 0) {
        return {
          success: true,
          message: '没有找到需要同步的账户',
          data: { total: 0, success: 0, failed: 0 }
        };
      }

      // 同步结果统计
      const result = {
        total: accounts.length,
        success: 0,
        failed: 0,
        accounts: [] as Array<{ id: number; email: string; success: boolean; message?: string; skipped?: boolean }>
      };

      // 逐个处理账户
      for (const account of accounts) {
        // 检查账户验证级别状态:
        // verification_level = 1：基础认证 - 需要同步以获取最新认证状态
        // verification_level = 2：已完成KYC认证 - 可以跳过同步
        // verification_level = 3：KYC认证中 - 需要同步以获取最新认证状态
        // 其他值：未认证或其他状态 - 需要同步

        // 只有已完成KYC认证的账户才跳过
        if (account.verification_level === 2) {
          console.log(`账户 ${account.id} (${account.email}) 已完成KYC认证，跳过同步`);

          // 标记为跳过，但计入成功数量
          result.success++;
          result.accounts.push({
            id: account.id,
            email: account.email,
            success: true,
            skipped: true,
            message: '已完成KYC验证，跳过同步'
          });

          continue;
        }

        // 获取有效Cookie
        const cookie = await this.getCookieForAccount(account, '');

        if (!cookie) {
          result.failed++;
          result.accounts.push({
            id: account.id,
            email: account.email,
            success: false,
            message: '无法获取有效的登录凭证'
          });
          continue;
        }

        // 调用KYC信息API并保存结果
        console.log(`同步账户 ${account.id} (${account.email}) 的KYC信息`);

        try {
          // 直接调用API获取KYC信息
          const response = await httpClient.post(
            `${INFINI_API_BASE_URL}/card/kyc/information`,
            {}, // 空请求体
            {
              headers: {
                'Cookie': cookie,
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
                'Referer': 'https://app.infini.money/',
                'Origin': 'https://app.infini.money',
                'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'cache-control': 'no-cache',
                'pragma': 'no-cache',
                'priority': 'u=1, i'
              }
            }
          );

          console.log(`账户 ${account.id} (${account.email}) KYC信息API响应:`, JSON.stringify(response.data));

          if (response.data.code === 0) {
            // 保存KYC信息到数据库
            if (response.data.data.kyc_information && response.data.data.kyc_information.length > 0) {
              await this.saveKycInformation(account.id.toString(), response.data.data.kyc_information);

              // 检查KYC信息中是否有已完成的认证记录
              const kycRecords = response.data.data.kyc_information;
              let hasCompletedKyc = false;

              for (const kyc of kycRecords) {
                console.log(`账户 ${account.id} KYC记录: ID=${kyc.id}, status=${kyc.status}, is_valid=${kyc.is_valid}`);

                // 根据API返回判断KYC是否已完成
                if (kyc.status === 1 || kyc.is_valid === true) {
                  hasCompletedKyc = true;
                  console.log(`账户 ${account.id} 发现已完成的KYC记录`);

                  // 更新账户验证级别为已完成KYC认证
                  await db('infini_accounts')
                    .where('id', account.id)
                    .update({
                      verification_level: 2 // 更新为已完成KYC认证
                    });
                  console.log(`已更新账户 ${account.id} 的验证级别为KYC认证(2) - API返回显示已完成`);
                  break;
                }
              }

              // 如果没有检测到已完成的KYC记录，但账户处于"认证中"状态，保持现状
              if (!hasCompletedKyc && account.verification_level === 3) {
                console.log(`账户 ${account.id} 当前处于认证中状态，未检测到已完成的KYC记录，保持现状`);
              }
            }

            result.success++;
            result.accounts.push({
              id: account.id,
              email: account.email,
              success: true,
              message: 'KYC'
            });
          } else {
            throw new Error(`API返回错误: ${response.data.message || '未知错误'}`);
          }

        } catch (kycError) {
          console.log(`直接调用KYC API失败，尝试使用getKycInformation方法: ${(kycError as Error).message}`);
          const kycResponse = await this.getKycInformation(account.id.toString());

          if (kycResponse.success) {
            result.success++;
            result.accounts.push({
              id: account.id,
              email: account.email,
              success: true
            });
          } else {
            result.failed++;
            result.accounts.push({
              id: account.id,
              email: account.email,
              success: false,
              message: kycResponse.message
            });
          }
        }
      }
      return {
        success: true,
        data: result,
        message: `批量同步KYC信息完成: 总计${result.total}个账户, 成功${result.success}个, 失败${result.failed}个`
      };
    } catch (error) {
      console.error('批量同步Infini账户KYC信息失败:', error);
      return {
        success: false,
        message: `批量同步Infini账户KYC信息失败: ${(error as Error).message}`,
      };
    }
  }
}