/**
 * Infini卡片路由配置
 * 用于处理Infini卡片相关的请求
 */
import express from 'express';
import { createBusinessContextMiddleware } from '../utils/BusinessContextExample';
import * as infiniCardController from '../controllers/infiniCardController';

const router = express.Router();

// 为所有卡片路由设置业务上下文
router.use(createBusinessContextMiddleware('card', 'general'));

// 获取卡片价格 - 同时支持两种路径格式
router.get('/price', 
  createBusinessContextMiddleware('card', 'get_price'),
  infiniCardController.getCardPrice
);
router.get('/price/:cardType', 
  createBusinessContextMiddleware('card', 'get_price'),
  infiniCardController.getCardPrice
);

// 获取可用卡类型
router.get('/available-types', 
  createBusinessContextMiddleware('card', 'get_available_types'),
  infiniCardController.getAvailableCardTypes
);

// 申请新卡
router.post('/apply', 
  createBusinessContextMiddleware('card', 'apply', (req) => ({
    cardType: req.body.cardType,
    accountId: req.body.accountId
  })),
  infiniCardController.applyNewCard
);

// 获取卡片列表
router.get('/list', 
  createBusinessContextMiddleware('card', 'get_list'),
  infiniCardController.getCardList
);

// 同步卡片信息
router.post('/sync', 
  createBusinessContextMiddleware('card', 'sync'),
  infiniCardController.syncCardInfo
);

// 获取卡片详情
router.get('/detail', 
  createBusinessContextMiddleware('card', 'get_detail'),
  infiniCardController.getCardDetail
);

// 获取开卡申请记录
router.get('/applications', 
  createBusinessContextMiddleware('card', 'get_applications'),
  infiniCardController.getCardApplications
);

// 提交KYC基础信息
router.post('/kyc/basic', 
  createBusinessContextMiddleware('card', 'submit_kyc'),
  infiniCardController.submitKycBasic
);

export default router;