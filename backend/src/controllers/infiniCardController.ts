/**
 * Infini卡片控制器
 * 用于处理Infini卡片相关的请求
 */
import { Request, Response } from 'express';
import { InfiniCardService } from '../service/InfiniCardService';

const infiniCardService = new InfiniCardService();

/**
 * 获取卡片价格
 * @route GET /api/infini-cards/price/:cardType
 */
export const getCardPrice = async (req: Request, res: Response) => {
  try {
    const { accountId } = req.query;
    // 从路径参数获取cardType，如果不存在则从查询参数获取，默认为3
    const cardType = req.params.cardType || req.query.cardType || '3';

    // 验证accountId参数
    if (!accountId) {
      return res.status(400).json({
        success: false,
        message: '账户ID是必填参数'
      });
    }

    // 调用卡片价格获取接口
    const response = await infiniCardService.getCardPrice(accountId as string, cardType as string);

    return res.json(response);
  } catch (error) {
    console.error('获取卡片价格失败:', error);
    return res.status(500).json({
      success: false,
      message: `获取卡片价格失败: ${(error as Error).message}`
    });
  }
};

/**
 * 获取可用卡类型
 * @route GET /api/infini-cards/available-types
 */
export const getAvailableCardTypes = async (req: Request, res: Response) => {
  try {
    const { accountId } = req.query;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        message: '账户ID是必填参数'
      });
    }

    const response = await infiniCardService.getAvailableCardTypes(accountId as string);

    return res.json(response);
  } catch (error) {
    console.error('获取可用卡类型失败:', error);
    return res.status(500).json({
      success: false,
      message: `获取可用卡类型失败: ${(error as Error).message}`
    });
  }
};

/**
 * 申请新卡
 * @route POST /api/infini-cards/apply
 */
export const applyNewCard = async (req: Request, res: Response) => {
  try {
    const { accountId, cardType = 3, price, discount } = req.body;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        message: '账户ID是必填参数'
      });
    }

    const response = await infiniCardService.applyNewCard(
      accountId,
      Number(cardType),
      price ? Number(price) : undefined,
      discount ? Number(discount) : undefined
    );

    return res.json(response);
  } catch (error) {
    console.error('申请新卡失败:', error);
    return res.status(500).json({
      success: false,
      message: `申请新卡失败: ${(error as Error).message}`
    });
  }
};

/**
 * 获取卡片列表
 * @route GET /api/infini-cards/list
 */
export const getCardList = async (req: Request, res: Response) => {
  try {
    const { accountId } = req.query;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        message: '账户ID是必填参数'
      });
    }

    const response = await infiniCardService.getLocalCardList(accountId as string);

    return res.json(response);
  } catch (error) {
    console.error('获取卡片列表失败:', error);
    return res.status(500).json({
      success: false,
      message: `获取卡片列表失败: ${(error as Error).message}`
    });
  }
};

/**
 * 同步卡片信息
 * @route POST /api/infini-cards/sync
 */
export const syncCardInfo = async (req: Request, res: Response) => {
  try {
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        message: '账户ID是必填参数'
      });
    }

    const response = await infiniCardService.syncCardInfo(accountId);

    return res.json(response);
  } catch (error) {
    console.error('同步卡片信息失败:', error);
    return res.status(500).json({
      success: false,
      message: `同步卡片信息失败: ${(error as Error).message}`
    });
  }
};

/**
 * 获取卡片详情
 * @route GET /api/infini-cards/detail
 */
export const getCardDetail = async (req: Request, res: Response) => {
  try {
    const { accountId, cardId } = req.query;

    if (!accountId || !cardId) {
      return res.status(400).json({
        success: false,
        message: '账户ID和卡片ID均为必填参数'
      });
    }

    const response = await infiniCardService.getCardDetail(accountId as string, cardId as string);

    return res.json(response);
  } catch (error) {
    console.error('获取卡片详情失败:', error);
    return res.status(500).json({
      success: false,
      message: `获取卡片详情失败: ${(error as Error).message}`
    });
  }
};

/**
 * 获取开卡申请记录
 * @route GET /api/infini-cards/applications
 */
export const getCardApplications = async (req: Request, res: Response) => {
  try {
    const { accountId } = req.query;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        message: '账户ID是必填参数'
      });
    }

    const response = await infiniCardService.getCardApplications(accountId as string);

    return res.json(response);
  } catch (error) {
    console.error('获取开卡申请记录失败:', error);
    return res.status(500).json({
      success: false,
      message: `获取开卡申请记录失败: ${(error as Error).message}`
    });
  }
};

/**
 * 提交KYC基础信息
 * @route POST /api/infini-cards/kyc/basic
 */
export const submitKycBasic = async (req: Request, res: Response) => {
  try {
    const { accountId, kycData } = req.body;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        message: '账户ID是必填参数'
      });
    }

    if (!kycData || !kycData.first_name || !kycData.last_name || !kycData.phone_code || !kycData.phone_number || !kycData.birthday) {
      return res.status(400).json({
        success: false,
        message: 'KYC基础信息不完整'
      });
    }

    const response = await infiniCardService.submitKycBasic(accountId, kycData);

    return res.json(response);
  } catch (error) {
    console.error('提交KYC基础信息失败:', error);
    return res.status(500).json({
      success: false,
      message: `提交KYC基础信息失败: ${(error as Error).message}`
    });
  }
};