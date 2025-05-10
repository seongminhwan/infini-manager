/**
 * 配置控制器
 * 用于管理系统通用配置项
 */
import { Request, Response } from 'express';
import db from '../db/db';

/**
 * 获取所有配置
 */
export const getAllConfigs = async (req: Request, res: Response): Promise<void> => {
  try {
    const configs = await db('user_configs')
      .select('*')
      .orderBy('key');
    
    res.json({
      success: true,
      data: configs,
      message: '获取所有配置成功'
    });
  } catch (error) {
    console.error('获取所有配置失败:', error);
    res.status(500).json({
      success: false,
      message: `获取所有配置失败: ${(error as Error).message}`
    });
  }
};

/**
 * 获取单个配置
 */
export const getConfigByKey = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    
    const config = await db('user_configs')
      .where({ key })
      .first();
    
    if (!config) {
      res.status(404).json({
        success: false,
        message: `未找到指定键名的配置: ${key}`
      });
      return;
    }
    
    res.json({
      success: true,
      data: config,
      message: '获取配置成功'
    });
  } catch (error) {
    console.error('获取配置失败:', error);
    res.status(500).json({
      success: false,
      message: `获取配置失败: ${(error as Error).message}`
    });
  }
};

/**
 * 创建或更新配置
 */
export const upsertConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key, value, description } = req.body;
    
    if (!key || value === undefined) {
      res.status(400).json({
        success: false,
        message: '键名(key)和值(value)是必填项'
      });
      return;
    }
    
    // 检查配置是否已存在
    const existingConfig = await db('user_configs')
      .where({ key })
      .first();
    
    // 准备更新或插入的数据
    const configData = {
      key,
      value: typeof value === 'object' ? JSON.stringify(value) : value,
      description,
      updated_at: new Date()
    };
    
    if (existingConfig) {
      // 更新现有配置
      await db('user_configs')
        .where({ key })
        .update(configData);
      
      res.json({
        success: true,
        message: `配置 ${key} 更新成功`
      });
    } else {
      // 创建新配置
      await db('user_configs').insert({
        ...configData,
        created_at: new Date()
      });
      
      res.status(201).json({
        success: true,
        message: `配置 ${key} 创建成功`
      });
    }
  } catch (error) {
    console.error('创建/更新配置失败:', error);
    res.status(500).json({
      success: false,
      message: `创建/更新配置失败: ${(error as Error).message}`
    });
  }
};

/**
 * 删除配置
 */
export const deleteConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    
    // 检查配置是否存在
    const existingConfig = await db('user_configs')
      .where({ key })
      .first();
    
    if (!existingConfig) {
      res.status(404).json({
        success: false,
        message: `未找到指定键名的配置: ${key}`
      });
      return;
    }
    
    // 删除配置
    await db('user_configs')
      .where({ key })
      .delete();
    
    res.json({
      success: true,
      message: `配置 ${key} 删除成功`
    });
  } catch (error) {
    console.error('删除配置失败:', error);
    res.status(500).json({
      success: false,
      message: `删除配置失败: ${(error as Error).message}`
    });
  }
};