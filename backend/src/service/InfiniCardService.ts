/**
 * Infini卡片服务
 * 用于管理Infini卡片申请、查询和保存卡片信息
 */
import httpClient from '../utils/httpClient';
import db from '../db/db';
import { InfiniAccountService } from './InfiniAccountService';
import { ApiResponse } from '../types';
import { TotpToolService } from './TotpToolService';

const INFINI_API_BASE_URL = 'https://api-card.infini.money';

export class InfiniCardService {
  private infiniAccountService: InfiniAccountService;
  private totpToolService: TotpToolService;

  constructor() {
    this.infiniAccountService = new InfiniAccountService();
    this.totpToolService = new TotpToolService();
  }

  /**
   * 获取卡片详情
   * @param accountId Infini账户ID
   * @param cardId 卡片ID
   * @returns 卡片详细信息
   */
  async getCardDetail(accountId: string, cardId: string): Promise<ApiResponse> {
    try {
      console.log(`开始获取卡片详情，账户ID: ${accountId}, 卡片ID: ${cardId}`);

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
      const { cookie } = await this.infiniAccountService.getAccountCookie(accountId, '获取卡片详情失败，');

      if (!cookie) {
        return {
          success: false,
          message: '获取卡片详情失败，无法获取有效的登录凭证'
        };
      }

      // 检查账户是否开启了2FA
      const needVerificationCode = account.google2faIsBound === true;
      let verificationCode = '';

      if (needVerificationCode) {
        // 账户已开启2FA，需要获取验证码
        // 从数据库获取2FA密钥
        const twoFaInfo = await db('infini_2fa_info')
          .where('infini_account_id', accountId)
          .first();

        if (!twoFaInfo || !twoFaInfo.secret_key) {
          return {
            success: false,
            message: '无法获取2FA密钥，请先设置2FA'
          };
        }

        // 使用TotpToolService生成验证码
        const totpResponse = await this.totpToolService.generateTotpCode(twoFaInfo.secret_key);
        if (!totpResponse.success) {
          return {
            success: false,
            message: `无法生成2FA验证码: ${totpResponse.message}`
          };
        }

        verificationCode = totpResponse.data.code;
        console.log(`成功生成2FA验证码: ${verificationCode}`);
      }

      // 调用API获取卡片详情
      const response = await httpClient.post(
        `${INFINI_API_BASE_URL}/card/reveal`,
        {
          verification_code: verificationCode,
          card_id: cardId
        },
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

      console.log('Infini 卡片详情API响应:', response.data);

      if (response.data.code === 0) {
        // 调用成功后，将卡片详情保存到数据库
        await this.saveCardDetail(cardId, response.data.data);

        return {
          success: true,
          data: response.data.data,
          message: '成功获取卡片详情'
        };
      } else {
        return {
          success: false,
          message: `获取卡片详情失败: ${response.data.message || '未知错误'}`
        };
      }
    } catch (error) {
      console.error('获取卡片详情失败:', error);
      return {
        success: false,
        message: `获取卡片详情失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 保存卡片详情到数据库
   * @param cardId 卡片ID
   * @param cardDetail 卡片详情
   */
  private async saveCardDetail(cardId: string, cardDetail: any): Promise<void> {
    try {
      // 查找卡片记录
      const card = await db('infini_cards')
        .where('card_id', cardId)
        .first();

      if (!card) {
        console.log(`未找到卡片记录，card_id: ${cardId}，无法保存卡片详情`);
        return;
      }

      // 检查是否已有卡片详情记录
      const existingDetail = await db('infini_card_details')
        .where('card_id', card.id)
        .first();

      if (existingDetail) {
        // 更新现有记录
        await db('infini_card_details')
          .where('id', existingDetail.id)
          .update({
            card_no: cardDetail.card_no,
            expire_year: cardDetail.expire_year,
            expire_month: cardDetail.expire_month,
            cvv: cardDetail.cvv,
            generated_address: cardDetail.generated_address,
            updated_at: new Date()
          });

        console.log(`已更新卡片详情记录，ID: ${existingDetail.id}`);
      } else {
        // 创建新记录
        await db('infini_card_details').insert({
          card_id: card.id,
          card_no: cardDetail.card_no,
          expire_year: cardDetail.expire_year,
          expire_month: cardDetail.expire_month,
          cvv: cardDetail.cvv,
          generated_address: cardDetail.generated_address,
          created_at: new Date(),
          updated_at: new Date()
        });

        console.log(`已创建新的卡片详情记录`);
      }
    } catch (error) {
      console.error('保存卡片详情到数据库失败:', error);
      throw error;
    }
  }

  /**
   * 申请新卡
   * @param accountId Infini账户ID
   * @param cardType 卡片类型
   * @param price 开卡价格
   * @param discount 优惠金额
   * @returns 申请结果
   */
  async applyNewCard(accountId: string, cardType: number = 3, price?: number, discount?: number): Promise<ApiResponse> {
    try {
      console.log(`开始申请新卡，账户ID: ${accountId}, 卡片类型: ${cardType}`);

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
      const { cookie } = await this.infiniAccountService.getAccountCookie(accountId, '申请新卡失败，');

      if (!cookie) {
        return {
          success: false,
          message: '申请新卡失败，无法获取有效的登录凭证'
        };
      }

      // 记录开卡申请
      const [applicationId] = await db('infini_card_applications').insert({
        infini_account_id: accountId,
        card_type: cardType,
        price: price,
        discount: discount,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      });

      // 调用API创建卡
      const response = await httpClient.post(
        `${INFINI_API_BASE_URL}/card/create/intent`,
        { card_type: cardType },
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

      console.log('Infini 申请卡片API响应:', response.data);

      if (response.data.code === 0) {
        // 更新申请记录
        await db('infini_card_applications')
          .where('id', applicationId)
          .update({
            application_id: response.data.data.id,
            status: 'created',
            updated_at: new Date()
          });

        return {
          success: true,
          data: {
            applicationId,
            infiniApplicationId: response.data.data.id
          },
          message: '成功申请新卡'
        };
      } else {
        // 更新申请记录为失败
        await db('infini_card_applications')
          .where('id', applicationId)
          .update({
            status: 'failed',
            error_message: response.data.message || '未知错误',
            updated_at: new Date()
          });

        return {
          success: false,
          message: `申请新卡失败: ${response.data.message || '未知错误'}`
        };
      }
    } catch (error) {
      console.error('申请新卡失败:', error);
      return {
        success: false,
        message: `申请新卡失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 同步卡片信息
   * @param accountId Infini账户ID
   * @returns 同步结果
   */
  async syncCardInfo(accountId: string): Promise<ApiResponse> {
    try {
      console.log(`开始同步卡片信息，账户ID: ${accountId}`);

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

      // 调用获取卡片列表接口
      const listResponse = await this.infiniAccountService.getCardList(accountId);

      if (!listResponse.success) {
        return listResponse;
      }

      const cardItems = listResponse.data?.items || [];
      console.log(`获取到${cardItems.length}张卡片`);

      // 遍历卡片列表，保存到数据库
      for (const cardItem of cardItems) {
        await this.saveCardInfo(accountId, cardItem);
      }

      return {
        success: true,
        data: {
          count: cardItems.length
        },
        message: `成功同步${cardItems.length}张卡片信息`
      };
    } catch (error) {
      console.error('同步卡片信息失败:', error);
      return {
        success: false,
        message: `同步卡片信息失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 保存卡片信息到数据库
   * @param accountId Infini账户ID
   * @param cardInfo 卡片信息
   */
  private async saveCardInfo(accountId: string, cardInfo: any): Promise<void> {
    try {
      // 检查卡片是否已存在
      const existingCard = await db('infini_cards')
        .where({
          infini_account_id: accountId,
          card_id: cardInfo.card_id
        })
        .first();

      if (existingCard) {
        // 更新现有记录
        await db('infini_cards')
          .where('id', existingCard.id)
          .update({
            status: cardInfo.status,
            currency: cardInfo.currency,
            provider: cardInfo.provider,
            username: cardInfo.username,
            card_last_four_digits: cardInfo.card_last_four_digits,
            issue_type: cardInfo.issue_type,
            card_address: cardInfo.card_address,
            label: cardInfo.label,
            partner_cover: cardInfo.partner_cover,
            consumption_limit: cardInfo.consumption_limit,
            is_default: cardInfo.is_default,
            available_balance: cardInfo.available_balance,
            budget_card_type: cardInfo.budget_card_type,
            daily_consumption: cardInfo.daily_consumption,
            name: cardInfo.name,
            updated_at: new Date()
          });

        console.log(`已更新卡片记录，ID: ${existingCard.id}`);
      } else {
        // 创建新记录
        await db('infini_cards').insert({
          infini_account_id: accountId,
          card_id: cardInfo.card_id,
          status: cardInfo.status,
          currency: cardInfo.currency,
          provider: cardInfo.provider,
          username: cardInfo.username,
          card_last_four_digits: cardInfo.card_last_four_digits,
          issue_type: cardInfo.issue_type,
          card_address: cardInfo.card_address,
          label: cardInfo.label,
          partner_cover: cardInfo.partner_cover,
          consumption_limit: cardInfo.consumption_limit,
          is_default: cardInfo.is_default,
          available_balance: cardInfo.available_balance,
          budget_card_type: cardInfo.budget_card_type,
          daily_consumption: cardInfo.daily_consumption,
          name: cardInfo.name,
          created_at: new Date(),
          updated_at: new Date()
        });

        console.log(`已创建新的卡片记录，card_id: ${cardInfo.card_id}`);
      }
    } catch (error) {
      console.error('保存卡片信息到数据库失败:', error);
      throw error;
    }
  }

  /**
   * 获取账户的卡片列表
   * @param accountId Infini账户ID
   * @returns 本地卡片列表和详情
   */
  async getLocalCardList(accountId: string): Promise<ApiResponse> {
    try {
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

      // 查询本地卡片记录
      const cards = await db('infini_cards')
        .where('infini_account_id', accountId)
        .select('*');

      // 查询卡片详情
      const cardsWithDetails = await Promise.all(cards.map(async (card) => {
        const cardDetail = await db('infini_card_details')
          .where('card_id', card.id)
          .first();

        return {
          ...card,
          detail: cardDetail || null
        };
      }));

      return {
        success: true,
        data: cardsWithDetails,
        message: '成功获取本地卡片列表'
      };
    } catch (error) {
      console.error('获取本地卡片列表失败:', error);
      return {
        success: false,
        message: `获取本地卡片列表失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 获取卡片价格
   * @param accountId Infini账户ID
   * @param cardType 卡片类型
   * @returns 卡片价格信息
   */
  async getCardPrice(accountId: string, cardType: string = '3'): Promise<ApiResponse> {
    try {
      console.log(`开始获取卡片价格信息，账户ID: ${accountId}, 卡片类型: ${cardType}`);

      // 强制要求有效的accountId
      if (!accountId || accountId === '0') {
        console.error(`获取卡片价格信息失败: 未提供有效的账户ID`);
        return {
          success: false,
          message: '获取卡片价格信息失败：未提供有效的账户ID'
        };
      }

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
      const { cookie } = await this.infiniAccountService.getAccountCookie(accountId, '获取卡片价格信息失败，');

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
   * 获取可用卡类型
   * @param accountId Infini账户ID
   * @returns 可用卡类型信息
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
      const { cookie } = await this.infiniAccountService.getAccountCookie(accountId, '获取可用卡类型信息失败，');

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
   * 提交KYC基础信息
   * @param accountId Infini账户ID
   * @param kycData KYC基础数据
   * @returns 提交结果
   */
  async submitKycBasic(accountId: string, kycData: {
    first_name: string;
    last_name: string;
    phone_code: string;
    phone_number: string;
    birthday: string;
  }): Promise<ApiResponse> {
    try {
      console.log(`开始提交KYC基础信息，账户ID: ${accountId}`);

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
      const { cookie } = await this.infiniAccountService.getAccountCookie(accountId, '提交KYC基础信息失败，');

      if (!cookie) {
        console.error(`提交KYC基础信息失败: 无法获取账户${account.email}的有效登录凭证`);
        return {
          success: false,
          message: '提交KYC基础信息失败，无法获取有效的登录凭证'
        };
      }

      // 调用API提交KYC基础信息
      const response = await httpClient.post(
        `${INFINI_API_BASE_URL}/card/kyc/basic`,
        {
          first_name: kycData.first_name,
          last_name: kycData.last_name,
          phone_code: kycData.phone_code,
          phone_number: kycData.phone_number,
          birthday: kycData.birthday
        },
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

      console.log('Infini KYC基础信息API响应:', response.data);

      // 验证API响应
      if (response.data.code === 0) {
        console.log('成功提交KYC基础信息');
        return {
          success: true,
          data: response.data.data,
          message: '成功提交KYC基础信息'
        };
      } else {
        console.error(`Infini API返回错误: ${response.data.message || '未知错误'}`);
        return {
          success: false,
          message: `提交KYC基础信息失败: ${response.data.message || '未知错误'}`
        };
      }
    } catch (error) {
      console.error('提交KYC基础信息失败:', error);
      return {
        success: false,
        message: `提交KYC基础信息失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 获取账户的开卡申请记录
   * @param accountId Infini账户ID
   * @returns 开卡申请记录
   */
  async getCardApplications(accountId: string): Promise<ApiResponse> {
    try {
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

      // 查询开卡申请记录
      const applications = await db('infini_card_applications')
        .where('infini_account_id', accountId)
        .orderBy('created_at', 'desc')
        .select('*');

      // 关联卡片信息
      const applicationsWithCards = await Promise.all(applications.map(async (application) => {
        if (!application.card_id) {
          return application;
        }

        const card = await db('infini_cards')
          .where('id', application.card_id)
          .first();

        return {
          ...application,
          card: card || null
        };
      }));

      return {
        success: true,
        data: applicationsWithCards,
        message: '成功获取开卡申请记录'
      };
    } catch (error) {
      console.error('获取开卡申请记录失败:', error);
      return {
        success: false,
        message: `获取开卡申请记录失败: ${(error as Error).message}`
      };
    }
  }
}