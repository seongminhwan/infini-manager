/**
 * 随机用户信息生成服务
 * 用于生成随机的用户信息，包括邮箱、密码、姓名、护照号等
 */
import db from '../db/db';
import { ApiResponse, RandomUser, RandomUserGenerateRequest } from '../types';

export class RandomUserService {
  // 中文姓氏列表（常见姓氏的拼音）
  private chineseLastNames = [
    'Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Huang', 'Zhao', 'Wu', 'Zhou',
    'Sun', 'Ma', 'Zhu', 'Hu', 'Guo', 'Lin', 'He', 'Gao', 'Luo', 'Zheng',
    'Liang', 'Xie', 'Song', 'Tang', 'Xu', 'Han', 'Feng', 'Deng', 'Cao', 'Peng',
    'Xiao', 'Tian', 'Hao', 'Fang', 'Pan', 'Jiang', 'Yu', 'Dong', 'Shi', 'Cheng'
  ];
  
  // 中文名字列表（常见名字的拼音）
  private chineseFemaleFirstNames = [
    'Xue', 'Hong', 'Ying', 'Mei', 'Yan', 'Jing', 'Wei', 'Min', 'Li', 'Fang',
    'Na', 'Juan', 'Yun', 'Hui', 'Yu', 'Ting', 'Xin', 'Jie', 'Qing', 'Lan',
    'Chun', 'Hua', 'Xia', 'Dan', 'Yue', 'Wen', 'Zhen', 'Ping', 'Lei', 'Xiang'
  ];
  
  private chineseMaleFirstNames = [
    'Jian', 'Wei', 'Jun', 'Ming', 'Hao', 'Yong', 'Gang', 'Chao', 'Peng', 'Bo',
    'Lei', 'Tao', 'Bin', 'Dong', 'Yang', 'Hua', 'Feng', 'Yi', 'Jie', 'Qiang',
    'Hui', 'Ning', 'Xu', 'Long', 'Cheng', 'Kang', 'Tian', 'Bing', 'Zhong', 'Wu'
  ];

  // 日本姓氏和名字
  private japaneseLastNames = [
    'Tanaka', 'Suzuki', 'Yamamoto', 'Watanabe', 'Ito', 'Nakamura', 'Kobayashi', 'Sato', 'Kato', 'Yoshida',
    'Yamada', 'Sasaki', 'Yamaguchi', 'Matsumoto', 'Inoue', 'Kimura', 'Hayashi', 'Shimizu', 'Yamazaki', 'Mori',
    'Abe', 'Ikeda', 'Hashimoto', 'Ishikawa', 'Fujiwara', 'Ogawa', 'Goto', 'Okada', 'Hasegawa', 'Murakami'
  ];

  private japaneseFemaleFirstNames = [
    'Akiko', 'Yuki', 'Sachiko', 'Hanako', 'Emiko', 'Keiko', 'Noriko', 'Hiroko', 'Takako', 'Naoko',
    'Masako', 'Tomoko', 'Yoko', 'Michiko', 'Kazuko', 'Mariko', 'Junko', 'Reiko', 'Kumiko', 'Mayumi',
    'Rie', 'Miki', 'Ayako', 'Chie', 'Emi', 'Mie', 'Kumi', 'Yuka', 'Mika', 'Ai'
  ];

  private japaneseMaleFirstNames = [
    'Hiroshi', 'Takeshi', 'Akira', 'Satoshi', 'Kazuo', 'Kenji', 'Taro', 'Jiro', 'Masashi', 'Yoshio',
    'Koji', 'Takeo', 'Minoru', 'Makoto', 'Shinji', 'Katsumi', 'Osamu', 'Tsutomu', 'Masaki', 'Naoki',
    'Hideki', 'Tomohiro', 'Daisuke', 'Ryuji', 'Yusuke', 'Takuya', 'Kenta', 'Daiki', 'Ryo', 'Sho'
  ];

  // 韩国姓氏和名字
  private koreanLastNames = [
    'Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon', 'Jang', 'Lim',
    'Han', 'Oh', 'Seo', 'Shin', 'Kwon', 'Hwang', 'Ahn', 'Song', 'Jeon', 'Hong',
    'Moon', 'Ko', 'Yang', 'Baek', 'Heo', 'Yoo', 'Noh', 'Sim', 'Won', 'Nam'
  ];

  private koreanFemaleFirstNames = [
    'MinJung', 'SooJin', 'HyeJin', 'JiHye', 'EunJung', 'SooYeon', 'HyeYoung', 'JiYoung', 'MinKyung', 'SunHee',
    'YooJin', 'HyeRi', 'JiEun', 'SooMin', 'HyeJeong', 'JiHyun', 'MinJi', 'SooJeong', 'EunHye', 'YeonJoo',
    'HyeIn', 'JiSoo', 'MinSeo', 'SooYoung', 'EunSeo', 'YooJeong', 'HyeWon', 'JiWon', 'MinJoo', 'SooHyun'
  ];

  private koreanMaleFirstNames = [
    'MinJoon', 'JiHoon', 'SungMin', 'HyunWoo', 'DongHyun', 'SooHyun', 'JinWoo', 'MinWoo', 'SungHoon', 'HyunJin',
    'JaeHyun', 'SangHoon', 'TaeHyung', 'JunHo', 'MinHo', 'SungWoo', 'HyeonJun', 'DongWon', 'JiHwan', 'SungJin',
    'MinSoo', 'HyunSoo', 'JinHyuk', 'SangWoo', 'TaeMin', 'JunSeo', 'MinKyu', 'SungHyun', 'HyunWook', 'DongMin'
  ];

  // 美国姓氏和名字
  private americanLastNames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
    'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
    'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'
  ];

  private americanFemaleFirstNames = [
    'Emma', 'Olivia', 'Ava', 'Isabella', 'Sophia', 'Charlotte', 'Mia', 'Amelia', 'Harper', 'Evelyn',
    'Abigail', 'Emily', 'Elizabeth', 'Mila', 'Ella', 'Avery', 'Sofia', 'Camila', 'Aria', 'Scarlett',
    'Victoria', 'Madison', 'Luna', 'Grace', 'Chloe', 'Penelope', 'Layla', 'Riley', 'Zoey', 'Nora'
  ];

  private americanMaleFirstNames = [
    'Liam', 'Noah', 'Oliver', 'Elijah', 'William', 'James', 'Benjamin', 'Lucas', 'Henry', 'Alexander',
    'Mason', 'Michael', 'Ethan', 'Daniel', 'Jacob', 'Logan', 'Jackson', 'Levi', 'Sebastian', 'Mateo',
    'Jack', 'Owen', 'Theodore', 'Aiden', 'Samuel', 'Joseph', 'John', 'David', 'Wyatt', 'Matthew'
  ];

  // 保持原有的属性名用于向后兼容
  private get lastNames() { return this.chineseLastNames; }
  private get femaleFirstNames() { return this.chineseFemaleFirstNames; }
  private get maleFirstNames() { return this.chineseMaleFirstNames; }
  
  // 数字和字母组合
  private numbers = '0123456789';
  private lowerCaseLetters = 'abcdefghijklmnopqrstuvwxyz';
  private upperCaseLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  private specialChars = '!@#$%^&*()-_=+[]{}|;:,.<>?';

  /**
   * 获取系统配置
   */
  private async getSystemConfig(key: string): Promise<string> {
    try {
      const config = await db('user_configs')
        .where({ key })
        .first();
      
      if (config && config.value) {
        try {
          // 尝试解析JSON
          return JSON.parse(config.value);
        } catch (e) {
          // 如果不是JSON，直接返回字符串值
          return config.value;
        }
      }
      
      // 返回默认值
      if (key === 'random_user_generation_country') {
        return 'china';
      }
      
      return '';
    } catch (error) {
      console.error(`获取系统配置失败 [${key}]:`, error);
      // 返回默认值
      if (key === 'random_user_generation_country') {
        return 'china';
      }
      return '';
    }
  }

  /**
   * 获取指定国家的姓名列表
   */
  private getNamesByCountry(country: string): {
    lastNames: string[];
    femaleFirstNames: string[];
    maleFirstNames: string[];
  } {
    switch (country) {
      case 'japan':
        return {
          lastNames: this.japaneseLastNames,
          femaleFirstNames: this.japaneseFemaleFirstNames,
          maleFirstNames: this.japaneseMaleFirstNames
        };
      case 'korea':
        return {
          lastNames: this.koreanLastNames,
          femaleFirstNames: this.koreanFemaleFirstNames,
          maleFirstNames: this.koreanMaleFirstNames
        };
      case 'usa':
        return {
          lastNames: this.americanLastNames,
          femaleFirstNames: this.americanFemaleFirstNames,
          maleFirstNames: this.americanMaleFirstNames
        };
      case 'china':
      default:
        return {
          lastNames: this.chineseLastNames,
          femaleFirstNames: this.chineseFemaleFirstNames,
          maleFirstNames: this.chineseMaleFirstNames
        };
    }
  }

  /**
   * 随机选择一个国家
   */
  private getRandomCountry(): string {
    const countries = ['china', 'japan', 'korea', 'usa'];
    return countries[Math.floor(Math.random() * countries.length)];
  }
  
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
   * 生成随机姓名（根据配置的国家）
   * - 格式为：姓, 名（英文逗号和空格分隔）
   * - 例如：Zhang, Yutong
   */
  private async generateRandomName(): Promise<{lastName: string, firstName: string}> {
    // 获取系统配置的国家
    let countryConfig = await this.getSystemConfig('random_user_generation_country');
    
    // 如果配置为随机，则随机选择一个国家
    if (countryConfig === 'random') {
      countryConfig = this.getRandomCountry();
    }
    
    // 获取对应国家的姓名列表
    const { lastNames, femaleFirstNames, maleFirstNames } = this.getNamesByCountry(countryConfig);
    
    // 获取黑名单姓名
    const blacklist = await db('name_blacklist')
      .select('name');
    
    const blacklistNames = new Set(blacklist.map(item => item.name.toLowerCase()));
    
    // 尝试最多20次生成不在黑名单中且不重复的姓名
    for (let attempt = 0; attempt < 20; attempt++) {
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      
      // 随机决定是男性还是女性名
      const isMale = Math.random() > 0.5;
      const firstNameList = isMale ? maleFirstNames : femaleFirstNames;
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
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
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
   * 生成随机美国手机号
   * - 格式为：+1 xxxxxxxxx（10位数字）
   * - 使用555作为中间三位数，这是电影和测试常用的号码段
   * - 第一个三位数（区号）使用常见的美国区号
   */
  private async generateAmericanPhone(): Promise<string> {
    // 尝试最多20次生成不重复的手机号
    for (let attempt = 0; attempt < 20; attempt++) {
      // 常见的美国区号列表（避免特殊号段）
      const areaCodes = [
        '201', '202', '203', '205', '206', '207', '208', '209', '210',
        '212', '213', '214', '215', '216', '217', '218', '219', '224',
        '225', '228', '229', '231', '234', '239', '240', '248', '251',
        '252', '253', '254', '256', '260', '262', '267', '269', '270',
        '276', '281', '301', '302', '303', '304', '305', '307', '308',
        '309', '310', '312', '313', '314', '315', '316', '317', '318',
        '319', '320', '321', '323', '330', '331', '334', '336', '337',
        '339', '347', '351', '352', '360', '361', '386', '401', '402',
        '404', '405', '406', '407', '408', '409', '410', '412', '413',
        '414', '415', '417', '419', '423', '424', '425', '430', '432',
        '434', '435', '440', '443', '458', '469', '470', '475', '478',
        '479', '480', '484', '501', '502', '503', '504', '505', '507',
        '508', '509', '510', '512', '513', '515', '516', '517', '518',
        '520', '530', '540', '541', '551', '559', '561', '562', '563',
        '564', '567', '570', '571', '573', '574', '575', '580', '585',
        '586', '601', '602', '603', '605', '606', '607', '608', '609',
        '610', '612', '614', '615', '616', '617', '618', '619', '620',
        '623', '626', '628', '629', '630', '631', '636', '641', '646',
        '650', '651', '660', '661', '662', '667', '669', '678', '682',
        '701', '702', '703', '704', '706', '707', '708', '712', '713',
        '714', '715', '716', '717', '718', '719', '720', '724', '725',
        '727', '731', '732', '734', '737', '740', '743', '747', '754',
        '757', '760', '762', '763', '765', '770', '772', '773', '774',
        '775', '781', '785', '786', '801', '802', '803', '804', '805',
        '806', '808', '810', '812', '813', '814', '815', '816', '817',
        '818', '828', '830', '831', '832', '843', '845', '847', '848',
        '850', '856', '857', '858', '859', '860', '862', '863', '864',
        '865', '870', '872', '878', '901', '903', '904', '906', '907',
        '908', '909', '910', '912', '913', '914', '915', '916', '917',
        '918', '919', '920', '925', '928', '929', '931', '936', '937',
        '940', '941', '947', '949', '951', '952', '954', '956', '959',
        '970', '971', '972', '973', '978', '979', '980', '984', '985'
      ];
      
      const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)];
      
      // 中间三位固定使用555（测试号段）
      const middleThree = '555';
      
      // 生成最后四位数字
      let lastFour = '';
      for (let i = 0; i < 4; i++) {
        lastFour += this.numbers.charAt(Math.floor(Math.random() * this.numbers.length));
      }
      
      // 美国格式手机号：+1 xxxxxxxxx
      const phone = `+1 ${areaCode}${middleThree}${lastFour}`;
      
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
    return `+1 2015550${unique}`;
  }

  /**
   * 生成随机中国手机号（已废弃，统一使用美国格式）
   * - 格式为：+86 1xx xxxx xxxx（11位数字）
   * - 使用不会分配给用户的号段（如14x、16x、19x等）
   */
  private async generateChinesePhone(): Promise<string> {
    // 统一使用美国手机号格式
    return await this.generateAmericanPhone();
  }

  /**
   * 生成随机美国手机号（主要方法）
   * - 格式为：(xxx) xxx-xxxx
   * - 使用555作为中间三位数，这是电影和测试常用的号码段
   */
  private async generatePhone(): Promise<string> {
    // 统一使用美国手机号格式
    return await this.generateAmericanPhone();
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
    // 统一使用美国手机号格式
    const phone = await this.generateAmericanPhone();
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