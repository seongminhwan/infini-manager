/**
 * Infini账户服务
 * 用于管理Infini账户信息、登录和同步余额等功能的业务逻辑
 */
import httpClient from '../utils/httpClient';
import db from '../db/db';
import { ImapFlow } from 'imapflow';
import { TotpToolService } from './TotpToolService';
import {
  ApiResponse,
  InfiniAccount,
  InfiniAccountCreate,
  InfiniLoginResponse,
  InfiniProfileResponse,
  GmailConfig,
} from '../types';
import { InfiniCardService } from './InfiniCardService';
import { RandomUserService } from './RandomUserService';

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
  async getAccountCookie(accountId: string, errorContext: string = ''): Promise<{ cookie: string | null, account: any }> {
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

      // 查找包含 jwt_token=VALUE 且 VALUE 非空的 cookie
      let validJwtCookieString = null;
      for (const cookieStr of cookies) {
        const match = cookieStr.match(/jwt_token=([^;]+)/); // 尝试匹配 jwt_token=VALUE
        if (match && match[1] && match[1].trim() !== '') { // 确保 VALUE 存在且非空
          // 如果需要组合所有Set-Cookie中的cookie，这里需要更复杂的逻辑
          // 但通常我们主要关心的是包含有效jwt_token的那部分
          // 为了简化，我们假设第一个找到的有效jwt_token的完整cookie字符串即可
          // 或者，如果Set-Cookie中只有jwt_token是关键，可以只用它
          // 但更安全的做法是，如果一个cookie字符串包含有效的jwt_token，就用这个字符串
          validJwtCookieString = cookieStr; // 使用包含有效token的整个cookie字符串
          // 如果有多个jwt_token cookie（不常见），这里可能需要调整
          // 但通常Set-Cookie中对于同一个token名只有一个
          break;
        }
      }

      if (!validJwtCookieString) {
        console.error(`${errorContext}无法从Set-Cookie中提取到有效的jwt_token值 (jwt_token=VALUE, VALUE非空)`);
        return null;
      }
      
      // 如果我们决定只使用包含jwt_token的那部分cookie（可能还有其他如Path, Expires等）
      // 并且假设Set-Cookie中可能有多条，但我们只关心包含有效jwt_token的那些
      // 那么，更精确的组合方式是：
      const relevantCookies = cookies.filter(c => {
        const match = c.match(/jwt_token=([^;]+)/);
        return match && match[1] && match[1].trim() !== '';
      });

      if (relevantCookies.length === 0) {
         // 这个分支理论上不会走到，因为上面的循环已经检查过了
        console.error(`${errorContext}逻辑错误：无法找到相关的有效jwt_token cookie`);
        return null;
      }
      
      cookie = relevantCookies.join('; '); // 使用所有包含有效jwt_token的cookie字符串进行组合

      // 提取Cookie过期时间
      // 确保cookie不是null或空字符串再进行match
      const expiresMatch = cookie ? cookie.match(/Expires=([^;]+)/) : null;
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
   * 获取分页的Infini账户列表，包含卡片数量
   * 支持分页、筛选和排序功能
   * @param page 页码，默认为1
   * @param pageSize 每页记录数，默认为10
   * @param filters 筛选条件，可按字段过滤
   * @param sortField 排序字段
   * @param sortOrder 排序方向：'asc'或'desc'
   * @param groupId 可选的分组ID，用于筛选特定分组的账户
   */
  async getInfiniAccountsPaginated(
    page: number = 1, 
    pageSize: number = 10, 
    filters: Record<string, any> = {}, 
    sortField?: string, 
    sortOrder?: 'asc' | 'desc',
    groupId?: string
  ): Promise<ApiResponse> {
    try {
      console.log(`执行分页查询: page=${page}, pageSize=${pageSize}, sortField=${sortField}, sortOrder=${sortOrder}`);
      console.log(`传入的筛选条件:`, JSON.stringify(filters, null, 2));
      
      // 使用子查询计算每个账户的卡片数量
      const cardCountSubquery = db('infini_cards')
        .whereNotNull('card_id')
        .andWhere('card_id', '!=', '')
        .select('infini_account_id')
        .count('* as card_count')
        .groupBy('infini_account_id')
        .as('card_counts');
        
      // 构建基础查询
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
          'infini_accounts.verification_level as verificationLevel',
          'infini_accounts.cookie_expires_at as cookieExpiresAt',
          'infini_accounts.infini_created_at as infiniCreatedAt',
          'infini_accounts.last_sync_at as lastSyncAt',
          'infini_accounts.created_at as createdAt',
          'infini_accounts.updated_at as updatedAt',
          'infini_accounts.mock_user_id as mockUserId',
          db.raw('IFNULL(card_counts.card_count, 0) as cardCount') // 添加卡片数量字段
        ])
        // 左连接卡片计数子查询
        .leftJoin(cardCountSubquery, 'infini_accounts.id', 'card_counts.infini_account_id');

      // 应用分组筛选（两种方式：通过groupId参数或filters.groups）
      if (groupId) {
        console.log(`通过groupId参数筛选分组: ${groupId}`);
        query = query
          .join('infini_account_group_relations', 'infini_accounts.id', 'infini_account_group_relations.infini_account_id')
          .where('infini_account_group_relations.group_id', groupId);
      }

      // 应用动态筛选条件
      if (filters) {
        // 特殊处理分组筛选
        if (filters.groups !== undefined && filters.groups !== null && filters.groups !== '') {
          // 如果没有通过groupId参数筛选，则通过filters.groups筛选
          if (!groupId) {
            console.log(`通过filters.groups筛选分组: ${filters.groups}`);
            query = query
              .join('infini_account_group_relations', 'infini_accounts.id', 'infini_account_group_relations.infini_account_id')
              .where('infini_account_group_relations.group_id', filters.groups);
          }
          // 从filters中移除groups属性，避免后续处理时尝试查询不存在的列
          delete filters.groups;
        }

        // 特殊处理安全相关筛选
        if (filters.security !== undefined && filters.security !== null && filters.security !== '') {
          console.log(`处理安全相关筛选: filters.security=${filters.security}`);
          
          // 检查数据库中google_2fa_is_bound字段的实际值，帮助调试
          console.log('执行简单测试查询以检查google_2fa_is_bound字段值分布:');
          const testQuery = await db('infini_accounts')
            .select('id', 'email', 'google_2fa_is_bound')
            .limit(5);
          console.log('样本记录google_2fa_is_bound值:', testQuery.map(r => ({ 
            id: r.id, 
            email: r.email, 
            google_2fa_is_bound: r.google_2fa_is_bound,
            valueType: typeof r.google_2fa_is_bound
          })));
          
          // 获取google_2fa_is_bound为true和false的记录数量，用于调试
          const boundCount = await db('infini_accounts')
            .where('google_2fa_is_bound', 1)
            .count('id as count')
            .first();
          const unboundCount = await db('infini_accounts')
            .where('google_2fa_is_bound', 0)
            .count('id as count')
            .first();
          console.log(`google_2fa_is_bound=1的记录数量: ${boundCount?.count || 0}`);
          console.log(`google_2fa_is_bound=0的记录数量: ${unboundCount?.count || 0}`);
          
          // 处理2FA相关筛选 - 尝试多种方法确保查询正确工作
          if (filters.security === '2fa_bound') {
            console.log('应用2FA已绑定筛选条件 - security=2fa_bound');
            
            try {
              // 方法1: 使用标准where条件，尝试使用多种值类型
              query = query.where(function() {
                // 主要条件: google_2fa_is_bound = 1
                this.where('infini_accounts.google_2fa_is_bound', 1)
                  // 备选条件: 处理可能的布尔值存储
                  .orWhere('infini_accounts.google_2fa_is_bound', '=', true)
                  .orWhereRaw('infini_accounts.google_2fa_is_bound = ?', [1]);
              });
              
              // 输出完整SQL查询以方便调试
              const sqlString = query.toString();
              console.log(`2FA已绑定筛选SQL: ${sqlString}`);
            } catch (error) {
              console.error('构建2FA已绑定筛选查询时出错:', error);
              // 出错时使用最简单的查询以确保功能可用
              query = query.where('infini_accounts.google_2fa_is_bound', 1);
            }
          } else if (filters.security === '2fa_unbound') {
            console.log('应用2FA未绑定筛选条件 - security=2fa_unbound');
            
            try {
              // 方法1: 使用标准where条件，尝试使用多种值类型
              query = query.where(function() {
                // 主要条件: google_2fa_is_bound = 0
                this.where('infini_accounts.google_2fa_is_bound', 0)
                  // 备选条件: 处理可能的布尔值存储
                  .orWhere('infini_accounts.google_2fa_is_bound', '=', false)
                  .orWhereRaw('infini_accounts.google_2fa_is_bound = ?', [0])
                  // 处理可能的NULL值
                  .orWhereNull('infini_accounts.google_2fa_is_bound');
              });
              
              // 输出完整SQL查询以方便调试
              const sqlString = query.toString();
              console.log(`2FA未绑定筛选SQL: ${sqlString}`);
            } catch (error) {
              console.error('构建2FA未绑定筛选查询时出错:', error);
              // 出错时使用最简单的查询以确保功能可用
              query = query.where('infini_accounts.google_2fa_is_bound', 0);
            }
          }
          
          // 从filters中移除security属性，避免后续处理时尝试查询不存在的列
          delete filters.security;
        }

        // 处理其他筛选条件
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            console.log(`应用筛选条件: ${key}=${value}`);
            
            // 特殊处理卡片数量筛选
            if (key === 'cardCount') {
              // 支持 '>5', '<10', '=3' 等格式
              if (typeof value === 'string') {
                const match = value.match(/([><]=?|=)(\d+)/);
                if (match) {
                  const [, operator, count] = match;
                  switch (operator) {
                    case '>':
                      query = query.havingRaw('cardCount > ?', [parseInt(count, 10)]);
                      break;
                    case '>=':
                      query = query.havingRaw('cardCount >= ?', [parseInt(count, 10)]);
                      break;
                    case '<':
                      query = query.havingRaw('cardCount < ?', [parseInt(count, 10)]);
                      break;
                    case '<=':
                      query = query.havingRaw('cardCount <= ?', [parseInt(count, 10)]);
                      break;
                    case '=':
                      query = query.havingRaw('cardCount = ?', [parseInt(count, 10)]);
                      break;
                  }
                }
              }
            } else if (typeof value === 'string' && value.includes('%')) {
              // 模糊搜索
              query = query.where(`infini_accounts.${key}`, 'like', value);
            } else {
              // 精确匹配
              query = query.where(`infini_accounts.${key}`, value);
            }
          }
        });
      }

      // 获取总记录数（需要在应用排序和分页前计算）
      const countQuery = query.clone();
      const countResult = await countQuery.count('infini_accounts.id as total').first();
      const total = countResult ? parseInt(countResult.total as string, 10) : 0;
      
      console.log(`查询结果总数: ${total}条记录`);

      // 应用排序
      if (sortField && sortOrder) {
        console.log(`应用排序: 字段=${sortField}, 顺序=${sortOrder}`);
        // 特殊处理卡片数量排序
        if (sortField === 'cardCount') {
          query = query.orderBy('cardCount', sortOrder);
        } else {
          query = query.orderBy(`infini_accounts.${sortField}`, sortOrder);
        }
      } else {
        // 默认排序
        console.log('应用默认排序: created_at DESC');
        query = query.orderBy('infini_accounts.created_at', 'desc');
      }

      // 应用分页
      const offset = (page - 1) * pageSize;
      query = query.limit(pageSize).offset(offset);
      console.log(`应用分页: offset=${offset}, limit=${pageSize}`);

      // 执行最终查询获取分页数据
      console.log('执行最终查询...');
      const finalSql = query.toString();
      console.log(`最终执行的SQL查询: ${finalSql}`);
      
      const accounts = await query;
      console.log(`查询返回 ${accounts.length} 条记录`);

      // 输出首条记录的关键字段用于调试（如果有记录）
      if (accounts.length > 0) {
        const firstAccount = accounts[0];
        console.log(`首条记录示例: ID=${firstAccount.id}, Email=${firstAccount.email}, 2FA绑定状态=${firstAccount.google2faIsBound} (值类型: ${typeof firstAccount.google2faIsBound})`);
      }

      // 获取所有账户的2FA信息
      console.log(`获取 ${accounts.length} 个账户的2FA信息...`);
      const accountIds = accounts.map(account => account.id);
      const twoFaInfos = await db('infini_2fa_info')
        .whereIn('infini_account_id', accountIds)
        .select('*');
      console.log(`找到 ${twoFaInfos.length} 条2FA信息记录`);

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
        .whereIn('infini_account_group_relations.infini_account_id', accountIds)
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
        data: {
          accounts, // 当前页数据
          pagination: {
            current: page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
          }
        },
      };
    } catch (error) {
      console.error('获取分页Infini账户列表失败:', error);
      return {
        success: false,
        message: `获取分页Infini账户列表失败: ${(error as Error).message}`,
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
   * 验证手机号格式
   * 支持的格式：
   * 1. +区号 手机号（例如：+86 13800138000）
   * 2. 区号 手机号（例如：86 13800138000）
   * 3. 纯手机号（例如：13800138000）
   * @param phoneCode 电话区号
   * @param phoneNumber 电话号码
   * @returns {string|null} 错误消息，如果验证通过则返回null
   */
  private validatePhoneFormat(phoneCode: string, phoneNumber: string): string | null {
    // 手机号不能为空
    if (!phoneNumber) {
      return '手机号不能为空';
    }
    
    // 如果phoneCode以"+"开头，检查格式1
    if (phoneCode && phoneCode.startsWith('+')) {
      // 区号应该是+数字格式
      if (!/^\+\d+$/.test(phoneCode)) {
        return '区号格式不正确，应为"+数字"格式，例如：+86';
      }
      // 手机号应该只包含数字
      if (!/^\d+$/.test(phoneNumber)) {
        return '手机号格式不正确，应只包含数字';
      }
      return null;
    }
    
    // 如果phoneCode不为空且不含"+"，检查格式2
    if (phoneCode && !/^\d+$/.test(phoneCode)) {
      return '区号格式不正确，应只包含数字，例如：86';
    }
    
    // 手机号应该只包含数字
    if (!/^\d+$/.test(phoneNumber)) {
      return '手机号格式不正确，应只包含数字';
    }
    
    return null;
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

      // 验证手机号格式
      const phoneFormatError = this.validatePhoneFormat(passportData.phoneCode, passportData.phoneNumber);
      if (phoneFormatError) {
        return {
          success: false,
          message: phoneFormatError
        };
      }

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

      // 转换card_status对象的key为数字数组
      const cardTypes = [3, 2]

      return {
        success: true,
        data: {
          cardTypes,
          rawData: '{"card_status":{}}'
        },
        message: '成功获取可用卡类型信息'
      };

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
  async createCard(accountId: string, cardType: number = 3, allowFlushMockUser: boolean = false): Promise<ApiResponse> {
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
      // 循环调用3次接口,因为basic接口有可能因为infini那边的问题导致报错,所以这里循环调用5次
      // 如果basic返回500,则刷新当前用户的mock_user_id,然后重新调用basic接口
      for (let i = 0; i < 20; i++) {
        if (!allowFlushMockUser) {
          i = 20;
        }

        // 根据mock_user_id获取mock_user_id对应的kyc_basic信息
        const mockUserId = account.mock_user_id;
        let mockUser = await db('random_users')
          .where('id', mockUserId)
          .first();

        if (!mockUser) {
          console.error(`创建卡片失败: 找不到ID为${mockUserId}的mock用户`);
          return {
            success: false,
            message: '找不到指定的mock用户'
          };
        }
        const infiniCardService = new InfiniCardService();
        // 从手机号提取phone_code和phone_number,二者通过空格分割
        const phoneCode = mockUser.phone.split(' ')[0];
        const phoneNumber = mockUser.phone.split(' ')[1];
        try {
          const birthday = mockUser.birth_year + '-' + mockUser.birth_month.toString().padStart(2, '0') + '-' + mockUser.birth_day.toString().padStart(2, '0');
          const basicResponse = await infiniCardService.submitKycBasic(accountId, {
            first_name: mockUser.first_name,
            last_name: mockUser.last_name,
            phone_code: phoneCode,
            phone_number: phoneNumber,
            birthday: birthday
          });
          console.log('提交KYC基础信息响应:', basicResponse);
          if (!basicResponse.success) {
            if (!allowFlushMockUser) {
              return basicResponse;
            }
            // 刷新当前用户的mock_user_id
            const randomUserService = new RandomUserService();
            const randomUserResponse = await randomUserService.generateRandomUsers({
              email_suffix: mockUser.full_email.split('@')[1],
              count: 1
            });
            if (!randomUserResponse.success) {
              return randomUserResponse;
            }
            mockUser = randomUserResponse.data[0];
            console.log(`刷新mock_user_id,新的mock_user_id: ${mockUser.id}`);
            // 更新当前用户和mock_user_id
            await db('infini_accounts')
              .where('id', accountId)
              .update({ mock_user_id: mockUser.id });
            console.log(`更新当前用户和mock_user_id成功,新的mock_user_id: ${mockUser.id}`);
          }
          break;
        } catch (error) {
          console.error(`创建卡片失败: ${error}`);
          if (!allowFlushMockUser) {
            return {
              success: false,
              message: `创建卡片失败: 无法通过basic接口提交kyc信息`
            };
          }
          // 刷新当前用户的mock_user_id
          const randomUserService = new RandomUserService();
          const randomUserResponse = await randomUserService.generateRandomUsers({
            email_suffix: mockUser.full_email.split('@')[1],
            count: 1
          })
          if (!randomUserResponse.success) {
            return randomUserResponse;
          }
          mockUser = randomUserResponse.data[0];
          console.log(`刷新mock_user_id,新的mock_user_id: ${mockUser.id}`);
          // 更新当前用户和mock_user_id
          await db('infini_accounts')
            .where('id', accountId)
            .update({ mock_user_id: mockUser.id });
          console.log(`更新当前用户和mock_user_id成功,新的mock_user_id: ${mockUser.id}`);
        }
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
   * 重置密码
   * @param email 邮箱地址
   * @param verificationCode 验证码
   * @returns 重置结果，成功时返回账户ID
   */
  async resetPassword(email: string, verificationCode: string): Promise<ApiResponse<{id: number}>> {
    try {
      if (!email || !verificationCode) {
        return {
          success: false,
          message: '邮箱和验证码是必填项'
        };
      }

      console.log(`开始重置账户 ${email} 的密码，验证码: ${verificationCode}`);

      // 调用Infini API重置密码
      const response = await httpClient.post(
        `${INFINI_API_BASE_URL}/user/verify-email`,
        {
          email: email,
          type: 1,
          email_verify_code: verificationCode
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en',
            'Cache-Control': 'no-cache',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
            'Referer': 'https://app.infini.money/',
            'Origin': 'https://app.infini.money',
            'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'Pragma': 'no-cache',
            'Priority': 'u=1, i'
          }
        }
      );

      console.log('Infini 重置密码API响应:', response.data);

      if (response.data.code === 0) {
        // 获取对应的账户信息
        const accountsRes = await db('infini_accounts')
          .where({ email })
          .first();

        if (!accountsRes) {
          return { success: false, message: '账户不存在' };
        }
        
        console.log(`账户 ${email} 密码重置成功，账户ID: ${accountsRes.id}`);
        return {
          success: true,
          data: { id: accountsRes.id },
          message: '密码重置成功'
        };
      } else {
        console.error(`Infini API返回错误: ${response.data.message || '未知错误'}`);
        return {
          success: false,
          message: `密码重置失败: ${response.data.message || '未知错误'}`
        };
      }
    } catch (error) {
      console.error('重置密码失败:', error);
      return {
        success: false,
        message: `重置密码失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 解绑2FA
   * @param accountId Infini账户ID
   * @param google2faToken 2FA验证码
   * @param password 账户密码
   * @returns 解绑结果
   */
  async unbindGoogle2fa(accountId: string, google2faToken: string, password?: string): Promise<ApiResponse> {
    try {
      if (!google2faToken) {
        return {
          success: false,
          message: '2FA验证码是必填项'
        };
      }

      // 查找账户
      const account = await db('infini_accounts')
        .where('id', accountId)
        .first();

      if (!account) {
        console.error(`解绑2FA失败: 找不到ID为${accountId}的Infini账户`);
        return {
          success: false,
          message: '找不到指定的Infini账户'
        };
      }

      // 获取有效Cookie
      const cookie = await this.getCookieForAccount(account, '解绑2FA失败，');

      if (!cookie) {
        console.error(`解绑2FA失败: 无法获取账户${account.email}的有效登录凭证`);
        return {
          success: false,
          message: '解绑2FA失败，无法获取有效的登录凭证'
        };
      }

      // 使用账户自身的密码（如果未提供）
      const userPassword = password || account.password;
      
      if (!userPassword) {
        return {
          success: false,
          message: '解绑2FA失败，缺少密码参数'
        };
      }

      // 调用Infini API解绑2FA
      const response = await httpClient.post(
        `${INFINI_API_BASE_URL}/user/unbind-google-2fa`,
        {
          google2fa_token: google2faToken,
          password: userPassword
        },
        {
          headers: {
            'Cookie': cookie,
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en',
            'Cache-Control': 'no-cache',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
            'Referer': 'https://app.infini.money/',
            'Origin': 'https://app.infini.money',
            'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'Pragma': 'no-cache',
            'Priority': 'u=1, i'
          }
        }
      );

      console.log('Infini 解绑2FA API响应:', response.data);

      if (response.data.code === 0) {
        // 更新账户的2FA状态
        await db('infini_accounts')
          .where('id', accountId)
          .update({
            google_2fa_is_bound: false,
            last_sync_at: new Date()
          });

        console.log(`账户 ${account.email} 解绑2FA成功`);
        return {
          success: true,
          data: response.data.data,
          message: '2FA解绑成功'
        };
      } else {
        console.error(`Infini API返回错误: ${response.data.message || '未知错误'}`);
        return {
          success: false,
          message: `解绑2FA失败: ${response.data.message || '未知错误'}`
        };
      }
    } catch (error) {
      console.error('解绑2FA失败:', error);
      return {
        success: false,
        message: `解绑2FA失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 恢复账户
   * @param email 邮箱地址
   * @returns 恢复结果
   */
  async recoverAccount(email: string): Promise<ApiResponse> {
    try {
      if (!email) {
        return {
          success: false,
          message: '邮箱地址是必填项'
        };
      }

      console.log(`开始恢复账户 ${email}`);

      // 第一步：发送验证码
      console.log(`为账户 ${email} 发送验证码...`);
      const sendVerificationCodeResponse = await this.sendVerificationCode(email, 1);
      if (!sendVerificationCodeResponse.success) {
        console.error(`为账户 ${email} 发送验证码失败:`, sendVerificationCodeResponse.message);
        return {
          success: false,
          message: `发送验证码失败: ${sendVerificationCodeResponse.message}`
        };
      }

      // 第二步：获取验证码
      console.log(`获取账户 ${email} 的验证码...`);
      const fetchVerificationCodeResponse = await this.fetchVerificationCode(email);
      if (!fetchVerificationCodeResponse.success || !fetchVerificationCodeResponse.data?.code) {
        console.error(`获取账户 ${email} 的验证码失败:`, fetchVerificationCodeResponse.message);
        return {
          success: false,
          message: `获取验证码失败: ${fetchVerificationCodeResponse.message}`
        };
      }

      const verificationCode = fetchVerificationCodeResponse.data.code;

      // 第三步：重置密码
      console.log(`重置账户 ${email} 的密码...`);
      const resetPasswordResponse = await this.resetPassword(email, verificationCode);
      if (!resetPasswordResponse.success) {
        console.error(`重置账户 ${email} 的密码失败:`, resetPasswordResponse.message);
        return {
          success: false,
          message: `重置密码失败: ${resetPasswordResponse.message}`
        };
      }

      // 第四步：查找账户或创建新账户
      console.log(`查找或创建账户 ${email} 的记录...`);
      let account = await db('infini_accounts')
        .where('email', email)
        .first();

      if (!account) {
        // 账户不存在，创建新账户
        console.log(`数据库中不存在账户 ${email}，将创建新账户`);
        // 尝试登录获取信息
        const loginResponse = await this.loginInfiniAccount(email, 'K9@iuptLL@wJ55X'); // 使用默认密码
        if (!loginResponse.success) {
          console.error(`登录账户 ${email} 失败:`, loginResponse.message);
          return {
            success: false,
            message: `登录账户失败: ${loginResponse.message}`
          };
        }

        // 创建账户
        const createAccountResponse = await this.createInfiniAccount(email, 'K9@iuptLL@wJ55X');
        if (!createAccountResponse.success) {
          console.error(`创建账户 ${email} 失败:`, createAccountResponse.message);
          return {
            success: false,
            message: `创建账户失败: ${createAccountResponse.message}`
          };
        }

        account = createAccountResponse.data;
      } else {
        // 账户存在，更新密码
        console.log(`更新账户 ${email} 的密码...`);
        await db('infini_accounts')
          .where('id', account.id)
          .update({
            password: 'K9@iuptLL@wJ55X',
            cookie: null,
            cookie_expires_at: null,
            updated_at: new Date()
          });
      }

      // 第五步：获取2FA二维码
      console.log(`获取账户 ${email} 的2FA二维码...`);
      const get2faQrcodeResponse = await this.getGoogle2faQrcode(account.id.toString());
      if (!get2faQrcodeResponse.success) {
        console.error(`获取账户 ${email} 的2FA二维码失败:`, get2faQrcodeResponse.message);
        return {
          success: false,
          message: `获取2FA二维码失败: ${get2faQrcodeResponse.message}`
        };
      }

      const secretKey = get2faQrcodeResponse.data.secret_key;

      // 第六步：解绑2FA（如果已绑定）
      if (account.google_2fa_is_bound) {
        console.log(`账户 ${email} 已绑定2FA，尝试解绑...`);

        // 使用TotpToolService生成2FA验证码
        const totpService = new TotpToolService();
        const totpResult = await totpService.generateTotpCode(secretKey);

        if (!totpResult.success || !totpResult.data || !totpResult.data.code) {
          console.error(`为账户 ${email} 生成2FA验证码失败:`, totpResult.message);
          return {
            success: false,
            message: `生成2FA验证码失败: ${totpResult.message}`
          };
        }

        const google2faToken = totpResult.data.code;

        // 解绑2FA
        console.log(`使用验证码 ${google2faToken} 解绑账户 ${email} 的2FA...`);
        const unbind2faResponse = await this.unbindGoogle2fa(account.id.toString(), google2faToken);
        if (!unbind2faResponse.success) {
          console.error(`解绑账户 ${email} 的2FA失败:`, unbind2faResponse.message);
          return {
            success: false,
            message: `解绑2FA失败: ${unbind2faResponse.message}`
          };
        }
      }

      // 第七步：重新绑定2FA
      console.log(`为账户 ${email} 发送2FA验证邮件...`);
      const send2faVerificationResponse = await this.sendGoogle2faVerificationEmail(email, account.id.toString());
      if (!send2faVerificationResponse.success) {
        console.error(`为账户 ${email} 发送2FA验证邮件失败:`, send2faVerificationResponse.message);
        return {
          success: false,
          message: `发送2FA验证邮件失败: ${send2faVerificationResponse.message}`
        };
      }

      // 获取2FA验证码
      console.log(`获取账户 ${email} 的2FA验证码...`);
      const fetch2faVerificationResponse = await this.fetchVerificationCode(email);
      if (!fetch2faVerificationResponse.success || !fetch2faVerificationResponse.data?.code) {
        console.error(`获取账户 ${email} 的2FA验证码失败:`, fetch2faVerificationResponse.message);
        return {
          success: false,
          message: `获取2FA验证码失败: ${fetch2faVerificationResponse.message}`
        };
      }

      const twoFaVerificationCode = fetch2faVerificationResponse.data.code;

      // 使用TotpToolService生成2FA验证码
      const totpService = new TotpToolService();
      const totpResult = await totpService.generateTotpCode(secretKey);

      if (!totpResult.success || !totpResult.data || !totpResult.data.code) {
        console.error(`为账户 ${email} 生成2FA验证码失败:`, totpResult.message);
        return {
          success: false,
          message: `生成2FA验证码失败: ${totpResult.message}`
        };
      }

      const google2faCode = totpResult.data.code;

      // 绑定2FA
      console.log(`使用验证码 ${twoFaVerificationCode} 和2FA码 ${google2faCode} 绑定账户 ${email} 的2FA...`);
      const bind2faResponse = await this.bindGoogle2fa(twoFaVerificationCode, google2faCode, account.id.toString());
      if (!bind2faResponse.success) {
        console.error(`绑定账户 ${email} 的2FA失败:`, bind2faResponse.message);
        return {
          success: false,
          message: `绑定2FA失败: ${bind2faResponse.message}`
        };
      }

      console.log(`账户 ${email} 恢复成功`);
      return {
        success: true,
        data: {
          accountId: account.id,
          email: account.email,
          status: 'recovered'
        },
        message: '账户恢复成功'
      };
    } catch (error) {
      console.error('恢复账户失败:', error);
      return {
        success: false,
        message: `恢复账户失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 批量恢复账户
   * @param emails 邮箱地址数组
   * @returns 批量恢复结果
   */
  async batchRecoverAccounts(emails: string[]): Promise<ApiResponse> {
    try {
      if (!emails || emails.length === 0) {
        return {
          success: false,
          message: '邮箱地址列表不能为空'
        };
      }

      console.log(`开始批量恢复账户，共 ${emails.length} 个账户`);

      // 结果统计
      const results = {
        total: emails.length,
        success: 0,
        failed: 0,
        accounts: [] as Array<{
          email: string;
          success: boolean;
          message?: string;
          accountId?: string;
        }>
      };

      // 逐个处理账户
      for (const email of emails) {
        try {
          console.log(`处理账户 ${email}...`);
          const recoverResult = await this.recoverAccount(email);
          
          if (recoverResult.success) {
            results.success++;
            results.accounts.push({
              email,
              success: true,
              message: '恢复成功',
              accountId: recoverResult.data?.accountId
            });
          } else {
            results.failed++;
            results.accounts.push({
              email,
              success: false,
              message: recoverResult.message
            });
          }
        } catch (error) {
          console.error(`处理账户 ${email} 时出错:`, error);
          results.failed++;
          results.accounts.push({
            email,
            success: false,
            message: (error as Error).message
          });
        }
      }

      return {
        success: true,
        data: results,
        message: `批量恢复完成: 总计${results.total}个账户, 成功${results.success}个, 失败${results.failed}个`
      };
    } catch (error) {
      console.error('批量恢复账户失败:', error);
      return {
        success: false,
        message: `批量恢复账户失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 获取所有账户分组
   * @returns 包含所有分组信息的响应对象
   */
  async getAllAccountGroups(): Promise<ApiResponse> {
    try {
      console.log('执行获取所有账户分组方法...');

      // 查询所有账户分组
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

      console.log(`找到 ${groups.length} 个账户分组`);

      // 获取每个分组关联的账户数量
      const groupCounts = await db('infini_account_group_relations')
        .select('group_id')
        .count('infini_account_id as accountCount')
        .groupBy('group_id');

      console.log(`获取到 ${groupCounts.length} 个分组的账户数量信息`);

      // 创建分组ID到账户数量的映射
      const countMap = new Map();
      groupCounts.forEach(item => {
        countMap.set(item.group_id, parseInt(item.accountCount.toString(), 10));
      });

      // 添加账户数量到分组信息中
      const groupsWithCount = groups.map(group => ({
        ...group,
        accountCount: countMap.get(group.id) || 0
      }));

      console.log('成功获取所有账户分组信息');

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
   * 执行Infini内部转账
   * @param accountId 内部账户ID
   * @param contactType 联系人类型：uid或email
   * @param targetIdentifier 目标标识符：UID、Email或内部账户ID
   * @param amount 转账金额（字符串格式）
   * @param source 转账来源
   * @param isForced 是否强制执行（忽略风险）
   * @param remarks 备注信息（可选）
   * @param auto2FA 是否自动处理2FA验证（可选，默认为false）
   * @param verificationCode 2FA验证码（可选）
   * @returns 转账结果
   */
  async internalTransfer(
    accountId: string,
    contactType: 'uid' | 'email' | 'inner',
    targetIdentifier: string,
    amount: string,
    source: string,
    isForced: boolean = false,
    remarks?: string,
    auto2FA: boolean = false,
    verificationCode?: string
  ): Promise<ApiResponse> {
    try {
      console.log(`开始执行内部转账，账户ID: ${accountId}, 目标: ${contactType}:${targetIdentifier}, 金额: ${amount}`);

      // 查找账户
      const account = await db('infini_accounts')
        .where('id', accountId)
        .first();

      if (!account) {
        console.error(`执行内部转账失败: 找不到ID为${accountId}的Infini账户`);
        return {
          success: false,
          message: '找不到指定的Infini账户'
        };
      }

      // 特殊处理转账请求
      let actualContactType = contactType;
      let actualTargetIdentifier = targetIdentifier;
      let matchedInternalAccount = null;

      // 情况1: inner类型 - 用于内部账户间转账，需要转换为uid类型
      if (contactType === 'inner') {
        console.log(`检测到内部转账请求，目标账户ID: ${targetIdentifier}`);

        // 查询目标账户信息
        const targetAccount = await db('infini_accounts')
          .where('id', targetIdentifier)
          .first();

        if (!targetAccount || !targetAccount.uid) {
          console.error(`内部转账失败: 找不到ID为${targetIdentifier}的目标账户或账户缺少UID`);
          return {
            success: false,
            message: '找不到目标账户或账户缺少UID'
          };
        }

        // 将contactType转换为uid，targetIdentifier转换为目标账户的uid
        actualContactType = 'uid';
        actualTargetIdentifier = targetAccount.uid;
        matchedInternalAccount = targetAccount;

        console.log(`已转换内部转账请求，实际目标: ${actualContactType}:${actualTargetIdentifier}`);
      }
      // 情况2: uid类型 - 检查是否匹配内部用户
      else if (contactType === 'uid') {
        console.log(`检测到UID转账请求: ${targetIdentifier}，尝试匹配内部账户`);

        // 尝试查找匹配的内部账户
        const matchedAccount = await db('infini_accounts')
          .where('uid', targetIdentifier)
          .first();

        if (matchedAccount) {
          console.log(`UID ${targetIdentifier} 匹配到内部账户: ${matchedAccount.id} (${matchedAccount.email})`);
          matchedInternalAccount = matchedAccount;
          // 不修改actualContactType和actualTargetIdentifier，保持原始请求不变
        } else {
          console.log(`UID ${targetIdentifier} 没有匹配到内部账户，使用原始请求`);
        }
      }
      // 情况3: email类型 - 检查是否匹配内部用户
      else if (contactType === 'email') {
        console.log(`检测到Email转账请求: ${targetIdentifier}，尝试匹配内部账户`);

        // 尝试查找匹配的内部账户
        const matchedAccount = await db('infini_accounts')
          .where('email', targetIdentifier)
          .first();

        if (matchedAccount) {
          console.log(`Email ${targetIdentifier} 匹配到内部账户: ${matchedAccount.id} (${matchedAccount.email})`);
          matchedInternalAccount = matchedAccount;
          // 不修改actualContactType和actualTargetIdentifier，保持原始请求不变
        } else {
          console.log(`Email ${targetIdentifier} 没有匹配到内部账户，使用原始请求`);
        }
      }

      // 检查账户是否开启了2FA
      if (account.google_2fa_is_bound) {
        console.log(`账户已开启2FA，需要验证码`);
        verificationCode = verificationCode || '';
        if (!verificationCode) {
          if (!auto2FA) {
            return {
              success: false,
              message: '账户已开启2FA，请提供验证码',
              data: {
                require2FA: true,
              }
            };
          }

          // 检查账户是否有2FA信息记录
          const twoFaInfo = await db('infini_2fa_info')
            .where({ infini_account_id: account.id })
            .first();

          if (!twoFaInfo || !twoFaInfo.secret_key) {
            console.error(`自动2FA验证失败: 账户未配置2FA或缺少密钥`);
            return {
              success: false,
              message: '账户未配置2FA或缺少密钥'
            };
          }

          // 使用账户的密钥生成当前的2FA验证码
          const secret = twoFaInfo.secret_key;
          console.log(`使用密钥生成2FA验证码: ${secret}`);

          // 使用TotpToolService生成TOTP验证码
          const totpService = new TotpToolService();
          const totpResult = await totpService.generateTotpCode(secret);

          if (!totpResult.success || !totpResult.data || !totpResult.data.code) {
            console.error(`自动2FA验证失败: 无法生成2FA验证码 - ${totpResult.message}`);
            return {
              success: false,
              message: `无法生成2FA验证码: ${totpResult.message || '未知错误'}`
            };
          }

          const twoFactorCode = totpResult.data.code;
          console.log(`已为账户 ${account.email} 自动生成验证码: ${twoFactorCode}`);

          // 使用生成的验证码继续转账流程
          console.log(`使用自动生成的验证码继续转账流程`);
          verificationCode = twoFactorCode;
        }
      }

      // 检查是否存在相同条件的准备状态转账记录
      if (!isForced) {
        const existingTransfer = await db('infini_transfers')
          .where({
            account_id: accountId,
            contact_type: actualContactType,
            target_identifier: actualTargetIdentifier,
            amount,
            source,
            status: 'pending'
          })
          .first();

        if (existingTransfer) {
          console.warn(`检测到重复的转账请求，ID: ${existingTransfer.id}`);
          return {
            success: false,
            message: '检测到重复的转账请求，请确认是否继续',
            data: {
              duplicate: true,
              transferId: existingTransfer.id
            }
          };
        }
      }

      // 创建预转账记录
      const transferRecord = {
        account_id: accountId,
        contact_type: actualContactType,
        target_identifier: actualTargetIdentifier,
        original_contact_type: contactType,  // 保存原始contactType
        original_target_identifier: targetIdentifier,  // 保存原始targetIdentifier
        verification_code: verificationCode,
        matched_account_id: matchedInternalAccount ? matchedInternalAccount.id : null,
        matched_account_email: matchedInternalAccount ? matchedInternalAccount.email : null,
        matched_account_uid: matchedInternalAccount ? matchedInternalAccount.uid : null,
        amount,
        source,
        is_forced: isForced,
        remarks: remarks || '',
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      };

      // 如果匹配到了内部账户，添加相关信息
      if (matchedInternalAccount) {
        transferRecord.matched_account_id = matchedInternalAccount.id;
        transferRecord.matched_account_email = matchedInternalAccount.email;
        transferRecord.matched_account_uid = matchedInternalAccount.uid;
      }

      const [transferId] = await db('infini_transfers').insert(transferRecord);

      console.log(`创建预转账记录成功，ID: ${transferId}`);

      // 添加转账历史记录 - 初始状态
      await this.addTransferHistory(transferId, 'pending', '转账请求已创建', {
        accountId,
        originalContactType: contactType,
        originalTargetIdentifier: targetIdentifier,
        actualContactType,
        actualTargetIdentifier,
        amount,
        source,
        remarks,
        matchedInternalAccount: matchedInternalAccount ? {
          id: matchedInternalAccount.id,
          email: matchedInternalAccount.email,
          uid: matchedInternalAccount.uid
        } : null
      });

      // 获取有效Cookie
      const cookie = await this.getCookieForAccount(account, '执行内部转账失败，');

      if (!cookie) {
        await this.updateTransferStatus(transferId, 'failed', '无法获取有效的登录凭证');
        return {
          success: false,
          message: '执行内部转账失败，无法获取有效的登录凭证'
        };
      }

      // 构建请求数据
      const requestData = {
        contactType: actualContactType,
        [actualContactType === 'uid' ? 'user_id' : 'email']: actualTargetIdentifier,
        email_verify_code: verificationCode,
        amount
      };

      // 记录请求数据并更新状态为processing
      await this.updateTransferStatus(transferId, 'processing', undefined, JSON.stringify(requestData));

      // 添加转账历史记录 - 处理中状态
      await this.addTransferHistory(transferId, 'processing', '正在处理转账请求', {
        requestData
      });

      // 调用Infini API执行转账
      console.log(`正在调用Infini内部转账API，请求数据:`, requestData);

      const response = await httpClient.post(
        `${INFINI_API_BASE_URL}/account/internal-transfer`,
        requestData,
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
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }
      );

      // 记录响应数据
      await db('infini_transfers')
        .where('id', transferId)
        .update({
          response_data: JSON.stringify(response.data)
        });

      console.log(`Infini内部转账API响应:`, response.data);

      // 添加转账历史记录 - API响应
      await this.addTransferHistory(transferId, 'processing', 'Infini API响应已接收', {
        apiResponse: response.data
      });

      // 处理响应
      if (response.data.code === 0) {
        await this.updateTransferStatus(transferId, 'completed');

        // 添加转账历史记录 - 完成状态
        await this.addTransferHistory(transferId, 'completed', '转账已完成', {
          result: response.data.data
        });

        // 同步账户信息以获取最新余额
        // const syncResult = await this.syncInfiniAccount(accountId);

        return {
          success: true,
          data: {
            transferId,
            ...response.data.data
          },
          message: '内部转账成功'
        };
      } else {
        const errorMessage = response.data.message || '转账失败，API返回错误';
        await this.updateTransferStatus(transferId, 'failed', errorMessage);

        // 添加转账历史记录 - 失败状态
        await this.addTransferHistory(transferId, 'failed', `转账失败: ${errorMessage}`, {
          error: response.data
        });

        return {
          success: false,
          message: `内部转账失败: ${errorMessage}`
        };
      }
    } catch (error) {
      console.error('执行内部转账失败:', error);

      // 如果已创建转账记录，更新状态
      try {
        const transfers = await db('infini_transfers')
          .where({
            account_id: accountId,
            contact_type: contactType,
            target_identifier: targetIdentifier,
            amount,
            source,
            status: 'pending'
          })
          .orWhere({
            account_id: accountId,
            contact_type: contactType,
            target_identifier: targetIdentifier,
            amount,
            source,
            status: 'processing'
          })
          .orderBy('created_at', 'desc')
          .limit(1);

        if (transfers && transfers.length > 0) {
          await this.updateTransferStatus(
            transfers[0].id,
            'failed',
            (error as Error).message
          );
        }
      } catch (dbError) {
        console.error('更新转账状态失败:', dbError);
      }

      return {
        success: false,
        message: `执行内部转账失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 更新转账状态
   * @param transferId 转账ID
   * @param status 新状态
   * @param errorMessage 错误信息（可选）
   * @param requestData 请求数据（可选）
   */
  private async updateTransferStatus(
    transferId: number | string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    errorMessage?: string,
    requestData?: string
  ): Promise<void> {
    const updateData: Record<string, any> = {
      status,
      updated_at: new Date()
    };

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    if (requestData) {
      updateData.request_data = requestData;
    }

    if (status === 'completed') {
      updateData.completed_at = new Date();
    }

    await db('infini_transfers')
      .where('id', transferId)
      .update(updateData);

    console.log(`已更新转账记录 ${transferId} 的状态为 ${status}`);
  }

  /**
   * 添加转账历史记录
   * @param transferId 转账ID
   * @param status 状态
   * @param message 消息描述
   * @param details 详细信息（可选，将转换为JSON字符串）
   */
  private async addTransferHistory(
    transferId: number | string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    message: string,
    details?: any
  ): Promise<number> {
    try {
      console.log(`添加转账历史记录，转账ID: ${transferId}, 状态: ${status}, 消息: ${message}`);

      // 将details转换为JSON字符串
      const detailsJson = details ? JSON.stringify(details) : null;

      // 插入历史记录
      const [historyId] = await db('infini_transfer_histories').insert({
        transfer_id: transferId,
        status,
        message,
        details: detailsJson,
        created_at: new Date(),
        updated_at: new Date()
      });

      console.log(`成功添加转账历史记录，ID: ${historyId}`);
      return historyId;
    } catch (error) {
      console.error(`添加转账历史记录失败:`, error);
      // 历史记录添加失败不应影响主流程，因此只记录错误
      return 0;
    }
  }

  /**
   * 获取转账历史记录
   * @param transferId 转账ID
   * @returns 包含历史记录的响应对象
   */
  async getTransferHistory(transferId: string): Promise<ApiResponse> {
    try {
      console.log(`获取转账历史记录，转账ID: ${transferId}`);

      // 查询转账记录是否存在
      const transfer = await db('infini_transfers')
        .where('id', transferId)
        .first();

      if (!transfer) {
        return {
          success: false,
          message: '找不到指定的转账记录'
        };
      }

      // 查询历史记录
      const histories = await db('infini_transfer_histories')
        .where('transfer_id', transferId)
        .orderBy('created_at', 'asc') // 按时间升序，展示完整流程
        .select('*');

      console.log(`找到${histories.length}条转账历史记录`);

      // 处理历史记录中的JSON字段
      const formattedHistories = histories.map(history => ({
        id: history.id,
        transferId: history.transfer_id,
        status: history.status,
        message: history.message,
        details: history.details ? JSON.parse(history.details) : null,
        createdAt: history.created_at
      }));

      return {
        success: true,
        data: {
          transfer: {
            id: transfer.id,
            accountId: transfer.account_id,
            contactType: transfer.contact_type,
            targetIdentifier: transfer.target_identifier,
            amount: transfer.amount,
            source: transfer.source,
            status: transfer.status,
            remarks: transfer.remarks,
            createdAt: transfer.created_at,
            completedAt: transfer.completed_at
          },
          histories: formattedHistories
        },
        message: '成功获取转账历史记录'
      };
    } catch (error) {
      console.error('获取转账历史记录失败:', error);
      return {
        success: false,
        message: `获取转账历史记录失败: ${(error as Error).message}`
      };
    }
  }

  // 移除了continueTransferWith2FA和autoGet2FAAndCompleteTransfer方法，
  // 现在在internalTransfer中处理所有2FA场景

  /**
   * 获取转账记录
   * @param accountId 可选的账户ID，用于筛选特定账户的转账记录
   * @param status 可选的转账状态，用于筛选特定状态的转账记录
   * @param page 页码，默认为1
   * @param pageSize 每页记录数，默认为20
   * @returns 包含转账记录的响应对象
   */
  async getTransferRecords(
    accountId?: string,
    status?: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<ApiResponse> {
    try {
      // 构建查询
      let query = db('infini_transfers')
        .select([
          'infini_transfers.*',
          'infini_accounts.email as account_email'
        ])
        .leftJoin('infini_accounts', 'infini_transfers.account_id', 'infini_accounts.id')
        .orderBy('infini_transfers.created_at', 'desc');

      // 应用筛选条件
      if (accountId) {
        query = query.where('infini_transfers.account_id', accountId);
      }

      if (status) {
        query = query.where('infini_transfers.status', status);
      }

      // 获取总记录数
      const countQuery = db('infini_transfers')
        .count('id as total');

      if (accountId) {
        countQuery.where('account_id', accountId);
      }

      if (status) {
        countQuery.where('status', status);
      }

      const [countResult] = await countQuery;
      const total = (countResult as any).total;

      // 应用分页
      const offset = (page - 1) * pageSize;
      query = query.limit(pageSize).offset(offset);

      // 执行查询
      const transfers = await query;

      return {
        success: true,
        data: {
          transfers,
          pagination: {
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
          }
        },
        message: '成功获取转账记录'
      };
    } catch (error) {
      console.error('获取转账记录失败:', error);
      return {
        success: false,
        message: `获取转账记录失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 批量同步所有Infini账户KYC信息
   * 针对每个账户，获取并更新KYC信息
   * 已完成KYC状态的账户会跳过再次同步
   */
  /**
   * 上传KYC生日信息
   * @param accountId Infini账户ID
   * @param birthday 生日日期，格式为YYYY-MM-DD
   * @returns 上传结果
   */
  async submitKycBirthday(accountId: string, birthday: string): Promise<ApiResponse> {
    try {
      console.log(`开始上传KYC生日信息，账户ID: ${accountId}, 生日: ${birthday}`);

      // 查找账户
      const account = await db('infini_accounts')
        .where('id', accountId)
        .first();

      if (!account) {
        console.error(`上传KYC生日信息失败: 找不到ID为${accountId}的Infini账户`);
        return {
          success: false,
          message: '找不到指定的Infini账户'
        };
      }

      // 获取有效Cookie
      const cookie = await this.getCookieForAccount(account, '上传KYC生日信息失败，');

      if (!cookie) {
        console.error(`上传KYC生日信息失败: 无法获取账户${account.email}的有效登录凭证`);
        return {
          success: false,
          message: '上传KYC生日信息失败，无法获取有效的登录凭证'
        };
      }

      // 调用API上传生日信息
      const response = await httpClient.post(
        `${INFINI_API_BASE_URL}/card/kyc/birthday`,
        { birthday },
        {
          headers: {
            'Cookie': cookie,
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en',
            'Cache-Control': 'no-cache',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
            'Referer': 'https://app.infini.money/',
            'Origin': 'https://app.infini.money',
            'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'Pragma': 'no-cache'
          }
        }
      );

      console.log('Infini KYC生日信息API响应:', response.data);

      // 验证API响应
      if (response.data.code === 0) {
        console.log(`KYC生日信息上传成功`);
        return {
          success: true,
          data: response.data.data,
          message: 'KYC生日信息上传成功'
        };
      } else {
        console.error(`Infini API返回错误: ${response.data.message || '未知错误'}`);
        return {
          success: false,
          message: `上传KYC生日信息失败: ${response.data.message || '未知错误'}`
        };
      }
    } catch (error) {
      console.error('上传KYC生日信息失败:', error);
      return {
        success: false,
        message: `上传KYC生日信息失败: ${(error as Error).message}`
      };
    }
  }

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