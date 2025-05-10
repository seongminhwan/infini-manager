/**
 * Infini卡片路由配置
 * 用于处理Infini卡片相关的请求
 */
import express from 'express';
import * as infiniCardController from '../controllers/infiniCardController';

const router = express.Router();

// 获取卡片价格 - 同时支持两种路径格式
router.get('/price', infiniCardController.getCardPrice);
router.get('/price/:cardType', infiniCardController.getCardPrice);

// 获取可用卡类型
router.get('/available-types', infiniCardController.getAvailableCardTypes);

// 申请新卡
router.post('/apply', infiniCardController.applyNewCard);

// 获取卡片列表
router.get('/list', infiniCardController.getCardList);

// 同步卡片信息
router.post('/sync', infiniCardController.syncCardInfo);

// 获取卡片详情
router.get('/detail', infiniCardController.getCardDetail);

// 获取开卡申请记录
router.get('/applications', infiniCardController.getCardApplications);

// 提交KYC基础信息
router.post('/kyc/basic', infiniCardController.submitKycBasic);

export default router;