/**
 * 随机用户信息生成控制器
 * 用于处理随机用户信息生成的API请求和响应
 */
import { Request, Response } from 'express';
import { RandomUserService } from '../service/RandomUserService';
import { RandomUserGenerateRequest } from '../types';

// 创建RandomUserService实例
const randomUserService = new RandomUserService();

/**
 * 生成随机用户信息
 */
export const generateRandomUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const params = req.body as RandomUserGenerateRequest;
    
    const response = await randomUserService.generateRandomUsers(params);
    
    if (response.success) {
      res.status(201).json(response);
    } else {
      res.status(400).json(response);
    }
  } catch (error) {
    console.error('生成随机用户信息失败:', error);
    res.status(500).json({
      success: false,
      message: `生成随机用户信息失败: ${(error as Error).message}`
    });
  }
};

/**
 * 获取已生成的随机用户信息列表
 */
export const getRandomUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const response = await randomUserService.getRandomUsers();
    
    if (response.success) {
      res.json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('获取随机用户信息列表失败:', error);
    res.status(500).json({
      success: false,
      message: `获取随机用户信息列表失败: ${(error as Error).message}`
    });
  }
};

/**
 * 获取单个随机用户信息
 */
export const getRandomUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const response = await randomUserService.getRandomUserById(id);
    
    if (response.success) {
      res.json(response);
    } else if (response.message === '找不到指定的随机用户信息') {
      res.status(404).json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('获取随机用户信息失败:', error);
    res.status(500).json({
      success: false,
      message: `获取随机用户信息失败: ${(error as Error).message}`
    });
  }
};

/**
 * 删除随机用户信息
 */
export const deleteRandomUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const response = await randomUserService.deleteRandomUser(id);
    
    if (response.success) {
      res.json(response);
    } else if (response.message === '找不到指定的随机用户信息') {
      res.status(404).json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('删除随机用户信息失败:', error);
    res.status(500).json({
      success: false,
      message: `删除随机用户信息失败: ${(error as Error).message}`
    });
  }
};

/**
 * 获取姓名黑名单列表
 */
export const getNameBlacklist = async (req: Request, res: Response): Promise<void> => {
  try {
    const response = await randomUserService.getNameBlacklist();
    
    if (response.success) {
      res.json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('获取姓名黑名单列表失败:', error);
    res.status(500).json({
      success: false,
      message: `获取姓名黑名单列表失败: ${(error as Error).message}`
    });
  }
};

/**
 * 添加姓名到黑名单
 */
export const addNameToBlacklist = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, reason } = req.body;
    
    if (!name) {
      res.status(400).json({
        success: false,
        message: '姓名是必填项'
      });
      return;
    }
    
    const response = await randomUserService.addNameToBlacklist(name, reason);
    
    if (response.success) {
      res.status(201).json(response);
    } else if (response.message === '该姓名已经在黑名单中') {
      res.status(400).json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('添加姓名到黑名单失败:', error);
    res.status(500).json({
      success: false,
      message: `添加姓名到黑名单失败: ${(error as Error).message}`
    });
  }
};

/**
 * 从黑名单中删除姓名
 */
export const removeNameFromBlacklist = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const response = await randomUserService.removeNameFromBlacklist(id);
    
    if (response.success) {
      res.json(response);
    } else if (response.message === '找不到指定的黑名单记录') {
      res.status(404).json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('从黑名单中删除姓名失败:', error);
    res.status(500).json({
      success: false,
      message: `从黑名单中删除姓名失败: ${(error as Error).message}`
    });
  }
};