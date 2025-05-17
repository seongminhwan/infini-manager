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
      // 先从数据库中获取卡片详情
      const cardDetail = await db('infini_cards')
        .where('card_id', cardId)
        .first();

      if (cardDetail) {
        console.log(`从数据库获取卡片详情: ${cardDetail.card_no}`);
        // 从数据库获取卡片详情
        const cd= await db('infini_card_details')
          .where('card_id', cardDetail.id)
          .first();

        if(cd){
          return {
            success: true,
            data: {
              ...cardDetail,
              ...cd
            },
            message: '成功获取卡片详情'
          };
        }

      
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
      const needVerificationCode = account.google_2fa_is_bound === 1;
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
      // const response = await httpClient.get(
      //   `${INFINI_API_BASE_URL}/card/create_card/available`,
      //   {
      //     headers: {
      //       'Cookie': cookie,
      //       'accept': 'application/json, text/plain, */*',
      //       'accept-language': 'en',
      //       'cache-control': 'no-cache',
      //       'origin': 'https://app.infini.money',
      //       'pragma': 'no-cache',
      //       'priority': 'u=1, i',
      //       'referer': 'https://app.infini.money/',
      //       'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
      //       'sec-ch-ua-mobile': '?0',
      //       'sec-ch-ua-platform': '"macOS"',
      //       'sec-fetch-dest': 'empty',
      //       'sec-fetch-mode': 'cors',
      //       'sec-fetch-site': 'same-site',
      //       'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
      //     }
      //   }
      // );

        // 转换card_status对象的key为数字数组
        const cardTypes = [3,2]

        return {
          success: true,
          data: {
            cardTypes,
            rawData: '{"card_status":{}}'
          },
          message: '成功获取可用卡类型信息'
        };
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

  /**
   * 获取卡片流水记录
   * @param accountId Infini账户ID
   * @param cardId 卡片ID (API卡片ID)
   * @param startTime 开始时间戳（毫秒）
   * @param endTime 结束时间戳（毫秒）
   * @param page 页码，默认为1
   * @param size 每页记录数，默认为20
   * @returns 流水记录结果
   */
  async getCardStatements(
    accountId: string,
    cardId: string,
    startTime: number,
    endTime: number,
    page: number = 1,
    size: number = 20
  ): Promise<ApiResponse> {
    try {
      console.log(`开始获取卡片流水记录，账户ID: ${accountId}, 卡片ID: ${cardId}, 时间范围: ${startTime} - ${endTime}`);

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

      // 查找卡片
      const card = await db('infini_cards')
        .where({
          infini_account_id: accountId,
          card_id: cardId
        })
        .first();

      if (!card) {
        return {
          success: false,
          message: '找不到指定的卡片'
        };
      }

      // 获取有效Cookie
      const { cookie } = await this.infiniAccountService.getAccountCookie(accountId, '获取卡片流水记录失败，');

      if (!cookie) {
        return {
          success: false,
          message: '获取卡片流水记录失败，无法获取有效的登录凭证'
        };
      }

      // 调用API获取卡片流水记录
      const response = await httpClient.post(
        `${INFINI_API_BASE_URL}/user/statement/record`,
        {
          page,
          size,
          start_time: startTime,
          end_time: endTime,
          card_id: cardId
        },
        {
          headers: {
            'Cookie': cookie,
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
            'Referer': 'https://app.infini.money/',
            'Origin': 'https://app.infini.money',
            'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'Priority': 'u=1, i'
          }
        }
      );

      console.log('Infini 卡片流水记录API响应:', response.data);

      if (response.data.code === 0) {
        // API调用成功，保存流水记录到数据库
        const statementData = response.data.data;
        const items = statementData.items || [];
        
        console.log(`获取到${items.length}条流水记录，总计${statementData.total}条`);

        // 保存流水记录到数据库
        await this.saveCardStatements(card.id, items);
        
        // 更新卡片的流水同步信息
        let updateData: any = {
          last_statement_sync_at: new Date()
        };
        
        // 如果是第一页，记录起始时间
        if (page === 1) {
          updateData.statement_last_sync_end_time = endTime;
          
          // 仅当没有记录过第一次同步开始时间时才更新
          if (!card.statement_first_sync_start_time) {
            updateData.statement_first_sync_start_time = startTime;
          }
        }
        
        await db('infini_cards')
          .where('id', card.id)
          .update(updateData);

        // 从数据库获取已保存的流水记录，包括元数据
        const savedStatements = await this.getLocalCardStatements(card.id, page, size);

        return {
          success: true,
          data: {
            total: statementData.total,
            items: savedStatements.data.statements,
            page,
            size,
            card_id: cardId,
            pagination: savedStatements.data.pagination
          },
          message: '成功获取卡片流水记录'
        };
      } else {
        return {
          success: false,
          message: `获取卡片流水记录失败: ${response.data.message || '未知错误'}`
        };
      }
    } catch (error) {
      console.error('获取卡片流水记录失败:', error);
      return {
        success: false,
        message: `获取卡片流水记录失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 保存卡片流水记录到数据库
   * @param cardId 本地卡片ID
   * @param statements 流水记录数组
   */
  private async saveCardStatements(cardId: number, statements: any[]): Promise<void> {
    try {
      console.log(`开始保存${statements.length}条流水记录到数据库，卡片ID: ${cardId}`);

      // 使用事务确保数据完整性
      await db.transaction(async (trx) => {
        for (const statement of statements) {
          // 检查流水记录是否已存在
          const existingStatement = await trx('infini_card_statements')
            .where({
              card_id: cardId,
              statement_id: statement.id.toString()
            })
            .first();

          let statementId: number;

          if (existingStatement) {
            // 更新现有记录
            await trx('infini_card_statements')
              .where('id', existingStatement.id)
              .update({
                tx_id: statement.tx_id,
                field: statement.field,
                change_type: statement.change_type,
                change: statement.change,
                status: statement.status,
                pre_balance: statement.pre_balance,
                balance: statement.balance,
                created_at_timestamp: statement.created_at,
                updated_at: new Date()
              });
            
            statementId = existingStatement.id;
            console.log(`更新流水记录，ID: ${statementId}`);
          } else {
            // 创建新记录
            const [newStatementId] = await trx('infini_card_statements').insert({
              card_id: cardId,
              statement_id: statement.id.toString(),
              tx_id: statement.tx_id,
              field: statement.field,
              change_type: statement.change_type,
              change: statement.change,
              status: statement.status,
              pre_balance: statement.pre_balance,
              balance: statement.balance,
              created_at_timestamp: statement.created_at,
              created_at: new Date(),
              updated_at: new Date()
            });
            
            statementId = newStatementId;
            console.log(`创建新流水记录，ID: ${statementId}`);
          }

          // 处理元数据
          if (statement.metadata && typeof statement.metadata === 'object') {
            // 先删除现有元数据
            await trx('infini_card_statement_metadata')
              .where('statement_id', statementId)
              .delete();
            
            // 保存新元数据
            const metadataEntries = Object.entries(statement.metadata);
            for (const [key, value] of metadataEntries) {
              await trx('infini_card_statement_metadata').insert({
                statement_id: statementId,
                meta_key: key,
                meta_value: typeof value === 'object' ? JSON.stringify(value) : String(value),
                created_at: new Date(),
                updated_at: new Date()
              });
            }
            
            console.log(`为流水记录 ${statementId} 保存了 ${metadataEntries.length} 个元数据项`);
          }
        }
      });

      console.log(`成功保存所有流水记录到数据库`);
    } catch (error) {
      console.error('保存卡片流水记录到数据库失败:', error);
      throw error;
    }
  }

  /**
   * 获取本地卡片流水记录
   * @param cardId 本地卡片ID
   * @param page 页码，默认为1
   * @param pageSize 每页记录数，默认为20
   * @returns 本地流水记录结果
   */
  async getLocalCardStatements(
    cardId: number | string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<ApiResponse> {
    try {
      // 查询总记录数
      const countResult = await db('infini_card_statements')
        .where('card_id', cardId)
        .count('id as total')
        .first();
      
      const total = countResult ? parseInt(countResult.total as string, 10) : 0;
      
      // 获取分页数据
      const offset = (page - 1) * pageSize;
      const statements = await db('infini_card_statements')
        .where('card_id', cardId)
        .orderBy('created_at_timestamp', 'desc')
        .limit(pageSize)
        .offset(offset);
      
      // 获取关联的元数据
      const statementsWithMetadata = await Promise.all(statements.map(async (statement) => {
        const metadata = await db('infini_card_statement_metadata')
          .where('statement_id', statement.id)
          .select('meta_key', 'meta_value');
        
        // 将元数据转换为对象格式
        const metadataObj: Record<string, any> = {};
        metadata.forEach(item => {
          try {
            // 尝试将JSON字符串解析为对象
            metadataObj[item.meta_key] = JSON.parse(item.meta_value);
          } catch (e) {
            // 如果解析失败，直接使用原始值
            metadataObj[item.meta_key] = item.meta_value;
          }
        });
        
        return {
          ...statement,
          metadata: metadataObj
        };
      }));
      
      return {
        success: true,
        data: {
          statements: statementsWithMetadata,
          pagination: {
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
          }
        },
        message: '成功获取本地卡片流水记录'
      };
    } catch (error) {
      console.error('获取本地卡片流水记录失败:', error);
      return {
        success: false,
        message: `获取本地卡片流水记录失败: ${(error as Error).message}`
      };
    }
  }
}