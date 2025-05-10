/**
 * KYC图片控制器
 * 处理KYC图片相关的请求
 */
import { Request, Response } from 'express';
import db from '../db/db';
import { ApiResponse } from '../types';

// KYC图片表名
const TABLE_NAME = 'kyc_images';

/**
 * 获取所有KYC图片
 */
export async function getAllKycImages(req: Request, res: Response): Promise<void> {
  try {
    const images = await db(TABLE_NAME).select('*');
    
    const response: ApiResponse = {
      success: true,
      message: '获取KYC图片列表成功',
      data: images
    };
    
    res.json(response);
  } catch (error) {
    console.error('获取KYC图片列表失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '获取KYC图片列表失败: ' + (error as Error).message
    };
    
    res.status(500).json(response);
  }
}

/**
 * 获取单个KYC图片
 */
export async function getKycImageById(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id);
  
  if (isNaN(id)) {
    const response: ApiResponse = {
      success: false,
      message: '无效的KYC图片ID'
    };
    
    res.status(400).json(response);
    return;
  }
  
  try {
    const image = await db(TABLE_NAME).where({ id }).first();
    
    if (!image) {
      const response: ApiResponse = {
        success: false,
        message: 'KYC图片不存在'
      };
      
      res.status(404).json(response);
      return;
    }
    
    const response: ApiResponse = {
      success: true,
      message: '获取KYC图片成功',
      data: image
    };
    
    res.json(response);
  } catch (error) {
    console.error('获取KYC图片失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '获取KYC图片失败: ' + (error as Error).message
    };
    
    res.status(500).json(response);
  }
}

/**
 * 根据标签查询KYC图片
 */
export async function getKycImagesByTags(req: Request, res: Response): Promise<void> {
  const tags = req.query.tags as string;
  
  if (!tags) {
    const response: ApiResponse = {
      success: false,
      message: '请提供至少一个标签'
    };
    
    res.status(400).json(response);
    return;
  }
  
  try {
    // 分割标签字符串为数组
    const tagList = tags.split(',').map(tag => tag.trim());
    
    // 构建查询条件
    const query = db(TABLE_NAME);
    
    // 对每个标签，添加一个LIKE条件
    // 使用OR连接，只要有一个标签匹配即返回结果
    tagList.forEach((tag, index) => {
      if (index === 0) {
        query.where('tags', 'like', `%${tag}%`);
      } else {
        query.orWhere('tags', 'like', `%${tag}%`);
      }
    });
    
    const images = await query.select('*');
    
    const response: ApiResponse = {
      success: true,
      message: '根据标签查询KYC图片成功',
      data: images
    };
    
    res.json(response);
  } catch (error) {
    console.error('根据标签查询KYC图片失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '根据标签查询KYC图片失败: ' + (error as Error).message
    };
    
    res.status(500).json(response);
  }
}

/**
 * 创建KYC图片
 */
export async function createKycImage(req: Request, res: Response): Promise<void> {
  const { img_base64, tags } = req.body;
  
  // 检查必要字段
  if (!img_base64) {
    const response: ApiResponse = {
      success: false,
      message: `缺少必要的KYC图片信息: img_base64`
    };
    
    res.status(400).json(response);
    return;
  }
  
  try {
    // 准备数据
    const data = {
      img_base64,
      tags: tags || '', // 如果tags为空，则设置为空字符串
    };
    
    // 插入数据
    const [id] = await db(TABLE_NAME).insert(data);
    
    // 获取刚插入的数据
    const newImage = await db(TABLE_NAME).where({ id }).first();
    
    const response: ApiResponse = {
      success: true,
      message: '创建KYC图片成功',
      data: newImage
    };
    
    res.status(201).json(response);
  } catch (error) {
    console.error('创建KYC图片失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '创建KYC图片失败: ' + (error as Error).message
    };
    
    res.status(500).json(response);
  }
}

/**
 * 更新KYC图片
 */
export async function updateKycImage(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id);
  const { img_base64, tags } = req.body;
  
  if (isNaN(id)) {
    const response: ApiResponse = {
      success: false,
      message: '无效的KYC图片ID'
    };
    
    res.status(400).json(response);
    return;
  }
  
  try {
    // 检查图片是否存在
    const existingImage = await db(TABLE_NAME).where({ id }).first();
    
    if (!existingImage) {
      const response: ApiResponse = {
        success: false,
        message: 'KYC图片不存在'
      };
      
      res.status(404).json(response);
      return;
    }
    
    // 准备更新数据
    const updateData: Record<string, any> = {};
    
    if (img_base64 !== undefined) updateData.img_base64 = img_base64;
    if (tags !== undefined) updateData.tags = tags;
    
    // 更新时间戳
    updateData.updated_at = db.fn.now();
    
    // 更新数据
    await db(TABLE_NAME).where({ id }).update(updateData);
    
    // 获取更新后的数据
    const updatedImage = await db(TABLE_NAME).where({ id }).first();
    
    const response: ApiResponse = {
      success: true,
      message: '更新KYC图片成功',
      data: updatedImage
    };
    
    res.json(response);
  } catch (error) {
    console.error('更新KYC图片失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '更新KYC图片失败: ' + (error as Error).message
    };
    
    res.status(500).json(response);
  }
}

/**
 * 删除KYC图片
 */
export async function deleteKycImage(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id);
  
  if (isNaN(id)) {
    const response: ApiResponse = {
      success: false,
      message: '无效的KYC图片ID'
    };
    
    res.status(400).json(response);
    return;
  }
  
  try {
    // 检查图片是否存在
    const existingImage = await db(TABLE_NAME).where({ id }).first();
    
    if (!existingImage) {
      const response: ApiResponse = {
        success: false,
        message: 'KYC图片不存在'
      };
      
      res.status(404).json(response);
      return;
    }
    
    // 删除图片
    await db(TABLE_NAME).where({ id }).delete();
    
    const response: ApiResponse = {
      success: true,
      message: '删除KYC图片成功'
    };
    
    res.json(response);
  } catch (error) {
    console.error('删除KYC图片失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '删除KYC图片失败: ' + (error as Error).message
    };
    
    res.status(500).json(response);
  }
}