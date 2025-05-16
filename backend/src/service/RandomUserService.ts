/**
 * 随机用户信息生成服务
 * 用于生成随机的用户信息，包括邮箱、密码、姓名、护照号等
 */
import db from '../db/db';
import { ApiResponse, RandomUser, RandomUserGenerateRequest } from '../types';

export class RandomUserService {
  // 中文姓氏列表（常见姓氏的拼音）
  private lastNames = [
    'Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Huang', 'Zhao', 'Wu', 'Zhou',
    'Sun', 'Ma', 'Zhu', 'Hu', 'Guo', 'Lin', 'He', 'Gao', 'Luo', 'Zheng',
    'Liang', 'Xie', 'Song', 'Tang', 'Xu', 'Han', 'Feng', 'Deng', 'Cao', 'Peng',
    'Xiao', 'Tian', 'Hao', 'Fang', 'Pan', 'Jiang', 'Yu', 'Dong', 'Shi', 'Cheng'
  ];
  
  // 中文名字列表（常见名字的拼音）
  private femaleFirstNames = [
    'Xue', 'Hong', 'Ying', 'Mei', 'Yan', 'Jing', 'Wei', 'Min', 'Li', 'Fang',
    'Na', 'Juan', 'Yun', 'Hui', 'Yu', 'Ting', 'Xin', 'Jie', 'Qing', 'Lan',
    'Chun', 'Hua', 'Xia', 'Dan', 'Yue', 'Wen', 'Zhen', 'Ping', 'Lei', 'Xiang'
  ];
  
  private maleFirstNames = [
    'Jian', 'Wei', 'Jun', 'Ming', 'Hao', 'Yong', 'Gang', 'Chao', 'Peng', 'Bo',
    'Lei', 'Tao', 'Bin', 'Dong', 'Yang', 'Hua', 'Feng', 'Yi', 'Jie', 'Qiang',
    'Hui', 'Ning', 'Xu', 'Long', 'Cheng', 'Kang', 'Tian', 'Bing', 'Zhong', 'Wu'
  ];
  
  // 数字和字母组合
  private numbers = '0123456789';
  private lowerCaseLetters = 'abcdefghijklmnopqrstuvwxyz';
  private upperCaseLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  private specialChars = '!@#$%^&*()-_=+[]{}|;:,.<>?';
  
  /**
   * 生成符合条件的随机密码
   * - 随机密码包含大小写字母、数字和特殊字符
   * - 长度为16-24位之间
   */
  private generateRandomPassword(): string {
    // 随机长度 (16-24)
    const length = Math.floor(Math.random() * 9) + 16;
    
    // 确保至少包含一个大写字母、一个小写字母、一个数字和一个特殊字符
    let password = '';
    password += this.upperCaseLetters.charAt(Math.floor(Math.random() * this.upperCaseLetters.length));
    password += this.lowerCaseLetters.charAt(Math.floor(Math.random() * this.lowerCaseLetters.length));
    password += this.numbers.charAt(Math.floor(Math.random() * this.numbers.length));
    password += this.specialChars.charAt(Math.floor(Math.random() * this.specialChars.length));
    
    // 填充剩余长度
    const allChars = this.upperCaseLetters + this.lowerCaseLetters + this.numbers + this.specialChars;
    for (let i = 4; i < length; i++) {
      password += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }
    
    // 打乱密码字符顺序
    return password.split('').sort(() => 0.5 - Math.random()).join('');
  }
  
  /**
   * 生成随机邮箱前缀
   * - 使用字母、数字组合
   * - 长度为6-12位之间
   */
  private async generateEmailPrefix(): Promise<string> {
    // 尝试最多20次生成不重复的邮箱前缀
    for (let attempt = 0; attempt < 20; attempt++) {
      const length = Math.floor(Math.random() * 7) + 6; // 6-12位
      const chars = this.lowerCaseLetters + this.numbers;
      
      let prefix = '';
      // 确保第一个字符是字母
      prefix += this.lowerCaseLetters.charAt(Math.floor(Math.random() * this.lowerCaseLetters.length));
      
      // 生成其余字符
      for (let i = 1; i < length; i++) {
        prefix += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      // 检查是否已存在
      const exists = await db('random_users')
        .where('email_prefix', prefix)
        .first();
      
      if (!exists) {
        return prefix;
      }
    }
    
    // 如果尝试多次后仍无法生成不重复的值，则使用时间戳结合随机数
    return `user${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }
  
  /**
   * 生成随机中文姓名（拼音形式）
   * - 格式为：姓, 名（英文逗号和空格分隔）
   * - 例如：Zhang, Yutong
   */
  private async generateRandomName(): Promise<{lastName: string, firstName: string}> {
    // 获取黑名单姓名
    const blacklist = await db('name_blacklist')
      .select('name');
    
    const blacklistNames = new Set(blacklist.map(item => item.name.toLowerCase()));
    
    // 尝试最多20次生成不在黑名单中且不重复的姓名
    for (let attempt = 0; attempt < 20; attempt++) {
      const lastName = this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
      
      // 随机决定是男性还是女性名
      const isMale = Math.random() > 0.5;
      const firstNameList = isMale ? this.maleFirstNames : this.femaleFirstNames;
      const firstName = firstNameList[Math.floor(Math.random() * firstNameList.length)];
      
      // 检查是否在黑名单中
      const fullName = `${lastName}, ${firstName}`.toLowerCase();
      if (blacklistNames.has(fullName)) {
        continue;
      }
      
      // 检查是否已存在
      const exists = await db('random_users')
        .where({
          last_name: lastName,
          first_name: firstName
        })
        .first();
      
      if (!exists) {
        return { lastName, firstName };
      }
    }
    
    // 如果尝试多次后仍无法生成符合条件的姓名，则使用时间戳生成唯一姓名
    const timestamp = Date.now().toString();
    const lastName = this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
    return {
      lastName,
      firstName: `Unique${timestamp.substring(timestamp.length - 5)}`
    };
  }
  
  /**
   * 生成随机9位护照号
   */
  private async generatePassportNo(): Promise<string> {
    // 尝试最多20次生成不重复的护照号
    for (let attempt = 0; attempt < 20; attempt++) {
      let passportNo = '';
      for (let i = 0; i < 9; i++) {
        passportNo += this.numbers.charAt(Math.floor(Math.random() * this.numbers.length));
      }
      
      // 检查是否已存在
      const exists = await db('random_users')
        .where('passport_no', passportNo)
        .first();
      
      if (!exists) {
        return passportNo;
      }
    }
    
    // 如果尝试多次后仍无法生成不重复的护照号，则使用时间戳
    const timestamp = Date.now().toString();
    return timestamp.substring(timestamp.length - 9);
  }
  
  /**
   * 生成随机中国手机号
   * - 格式为：1xx xxxx xxxx（11位数字）
   * - 使用不会分配给用户的号段（如14x、16x、19x等）
   */
  private async generateChinesePhone(): Promise<string> {
    // 尝试最多20次生成不重复的手机号
    for (let attempt = 0; attempt < 20; attempt++) {
      // 使用不常见或未分配的号段前缀
      // 14x: 物联网专用号段
      // 16x: 部分未分配号段
      // 19x: 部分未分配号段
      const unusedPrefixes = ['144', '146', '148', '149', '164', '165', '167', '191', '192', '196', '197', '198', '199'];
      const prefix = unusedPrefixes[Math.floor(Math.random() * unusedPrefixes.length)];
      
      // 生成剩余8位数字
      let remainingDigits = '';
      for (let i = 0; i < 8; i++) {
        remainingDigits += this.numbers.charAt(Math.floor(Math.random() * this.numbers.length));
      }
      
      // 中国格式手机号：+86 1xx xxxx xxxx
      const phone = `+86 ${prefix}${remainingDigits}`;
      
      // 检查是否已存在
      const exists = await db('random_users')
        .where('phone', phone)
        .first();
      
      if (!exists) {
        return phone;
      }
    }
    
    // 如果尝试多次后仍无法生成不重复的手机号，则使用时间戳
    const timestamp = Date.now().toString();
    const unique = timestamp.substring(timestamp.length - 8);
    return `+86 144${unique}`;
  }

  /**
   * 生成随机美国手机号
   * - 格式为：(xxx) xxx-xxxx
   * - 使用555作为中间三位数，这是电影和测试常用的号码段
   */
  private async generatePhone(): Promise<string> {
    // 尝试最多20次生成不重复的手机号
    for (let attempt = 0; attempt < 20; attempt++) {
      // 生成区号（不使用特殊区号和保留区号）
      let areaCode = '';
      do {
        areaCode = '';
        for (let i = 0; i < 3; i++) {
          areaCode += this.numbers.charAt(Math.floor(Math.random() * this.numbers.length));
        }
      } while (
        areaCode === '000' || areaCode === '911' || 
        areaCode.startsWith('0') || areaCode.startsWith('1')
      );
      
      // 后四位
      let lastFour = '';
      for (let i = 0; i < 4; i++) {
        lastFour += this.numbers.charAt(Math.floor(Math.random() * this.numbers.length));
      }
      
      // 美国格式手机号：(xxx) 555-xxxx
      const phone = `(${areaCode}) 555-${lastFour}`;
      
      // 检查是否已存在
      const exists = await db('random_users')
        .where('phone', phone)
        .first();
      
      if (!exists) {
        return phone;
      }
    }
    
    // 如果尝试多次后仍无法生成不重复的手机号，则使用时间戳
    const timestamp = Date.now().toString();
    const unique = timestamp.substring(timestamp.length - 4);
    return `(888) 555-${unique}`;
  }
  
  /**
   * 生成随机出生日期（1988-1997年间）
   * - 返回结构：{ year, month, day }
   */
  private generateBirthDate(): { year: number, month: number, day: number } {
    // 随机年份 (1988-1997)
    const year = Math.floor(Math.random() * 10) + 1988;
    
    // 随机月份 (1-12)
    const month = Math.floor(Math.random() * 12) + 1;
    
    // 根据月份确定天数范围
    let maxDays = 31;
    if (month === 4 || month === 6 || month === 9 || month === 11) {
      maxDays = 30;
    } else if (month === 2) {
      // 检查是否是闰年
      maxDays = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28;
    }
    
    // 随机日期 (1-maxDays)
    const day = Math.floor(Math.random() * maxDays) + 1;
    
    return { year, month, day };
  }
  
  /**
   * 生成随机用户信息
   * @param emailSuffix 可选的邮箱后缀
   */
  private async generateRandomUser(emailSuffix?: string): Promise<RandomUser> {
    // 生成各项随机信息
    const emailPrefix = await this.generateEmailPrefix();
    const password = this.generateRandomPassword();
    const { lastName, firstName } = await this.generateRandomName();
    const passportNo = await this.generatePassportNo();
    // 暂时使用中国手机号代替美国手机号
    const phone = await this.generateChinesePhone();
    const { year, month, day } = this.generateBirthDate();
    
    // 如果提供了邮箱后缀，则生成完整邮箱
    const fullEmail = emailSuffix ? `${emailPrefix}@${emailSuffix}` : undefined;
    
    // 构建随机用户数据
    const randomUser: RandomUser = {
      email_prefix: emailPrefix,
      full_email: fullEmail,
      password,
      last_name: lastName,
      first_name: firstName,
      passport_no: passportNo,
      phone,
      birth_year: year,
      birth_month: month,
      birth_day: day
    };
    
    // 显式删除id属性，确保数据库自动分配ID
    delete (randomUser as any).id;
    
    return randomUser;
  }
  
  /**
   * 生成随机用户信息并保存到数据库
   * @param params 生成参数，可以指定邮箱后缀和生成数量
   */
  async generateRandomUsers(params: RandomUserGenerateRequest = {}): Promise<ApiResponse> {
    try {
      const { email_suffix, count = 1 } = params;
      
      if (count <= 0 || count > 100) {
        return {
          success: false,
          message: '生成数量必须在1-100之间'
        };
      }
      
      const generatedUsers: RandomUser[] = [];
      
      // 批量生成用户信息
      for (let i = 0; i < count; i++) {
        const randomUser = await this.generateRandomUser(email_suffix);
        
        // 保存到数据库
        const [id] = await db('random_users').insert(randomUser);
        
        // 查询刚刚插入的记录
        const savedUser = await db('random_users')
          .where('id', id)
          .first();
        
        generatedUsers.push(savedUser);
      }
      
      return {
        success: true,
        message: `成功生成${count}条随机用户信息`,
        data: generatedUsers
      };
    } catch (error) {
      console.error('生成随机用户信息失败:', error);
      return {
        success: false,
        message: `生成随机用户信息失败: ${(error as Error).message}`
      };
    }
  }
  
  /**
   * 获取已生成的随机用户信息列表
   */
  async getRandomUsers(): Promise<ApiResponse> {
    try {
      const users = await db('random_users')
        .select('*')
        .orderBy('created_at', 'desc');
      
      return {
        success: true,
        data: users
      };
    } catch (error) {
      console.error('获取随机用户信息列表失败:', error);
      return {
        success: false,
        message: `获取随机用户信息列表失败: ${(error as Error).message}`
      };
    }
  }
  
  /**
   * 获取单个随机用户信息
   */
  async getRandomUserById(id: string): Promise<ApiResponse> {
    try {
      const user = await db('random_users')
        .where('id', id)
        .first();
      
      if (!user) {
        return {
          success: false,
          message: '找不到指定的随机用户信息'
        };
      }
      
      return {
        success: true,
        data: user
      };
    } catch (error) {
      console.error('获取随机用户信息失败:', error);
      return {
        success: false,
        message: `获取随机用户信息失败: ${(error as Error).message}`
      };
    }
  }
  
  /**
   * 删除随机用户信息
   */
  async deleteRandomUser(id: string): Promise<ApiResponse> {
    try {
      const user = await db('random_users')
        .where('id', id)
        .first();
      
      if (!user) {
        return {
          success: false,
          message: '找不到指定的随机用户信息'
        };
      }
      
      await db('random_users')
        .where('id', id)
        .delete();
      
      return {
        success: true,
        message: '随机用户信息删除成功'
      };
    } catch (error) {
      console.error('删除随机用户信息失败:', error);
      return {
        success: false,
        message: `删除随机用户信息失败: ${(error as Error).message}`
      };
    }
  }
  
  /**
   * 获取姓名黑名单列表
   */
  async getNameBlacklist(): Promise<ApiResponse> {
    try {
      const blacklist = await db('name_blacklist')
        .select('*')
        .orderBy('created_at', 'desc');
      
      return {
        success: true,
        data: blacklist
      };
    } catch (error) {
      console.error('获取姓名黑名单列表失败:', error);
      return {
        success: false,
        message: `获取姓名黑名单列表失败: ${(error as Error).message}`
      };
    }
  }
  
  /**
   * 添加姓名到黑名单
   */
  async addNameToBlacklist(name: string, reason?: string): Promise<ApiResponse> {
    try {
      if (!name) {
        return {
          success: false,
          message: '姓名是必填项'
        };
      }
      
      // 检查是否已存在
      const exists = await db('name_blacklist')
        .where('name', name)
        .first();
      
      if (exists) {
        return {
          success: false,
          message: '该姓名已经在黑名单中'
        };
      }
      
      // 添加到黑名单
      const [id] = await db('name_blacklist').insert({
        name,
        reason
      });
      
      const blacklistItem = await db('name_blacklist')
        .where('id', id)
        .first();
      
      return {
        success: true,
        message: '成功添加姓名到黑名单',
        data: blacklistItem
      };
    } catch (error) {
      console.error('添加姓名到黑名单失败:', error);
      return {
        success: false,
        message: `添加姓名到黑名单失败: ${(error as Error).message}`
      };
    }
  }
  
  /**
   * 从黑名单中删除姓名
   */
  async removeNameFromBlacklist(id: string): Promise<ApiResponse> {
    try {
      const blacklistItem = await db('name_blacklist')
        .where('id', id)
        .first();
      
      if (!blacklistItem) {
        return {
          success: false,
          message: '找不到指定的黑名单记录'
        };
      }
      
      await db('name_blacklist')
        .where('id', id)
        .delete();
      
      return {
        success: true,
        message: '成功从黑名单中删除姓名'
      };
    } catch (error) {
      console.error('从黑名单中删除姓名失败:', error);
      return {
        success: false,
        message: `从黑名单中删除姓名失败: ${(error as Error).message}`
      };
    }
  }
}