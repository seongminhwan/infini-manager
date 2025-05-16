/**
 * KYC验证模态框
 * 用于自动完成Infini账户的KYC验证
 * 实现护照上传和验证流程
 */
import React, { useState, useEffect } from 'react';
import {
  Modal,
  Steps,
  Button,
  Form,
  Input,
  Upload,
  message,
  Typography,
  Space,
  Select,
  Row,
  Col,
  Card,
  Spin,
  Result
} from 'antd';
import {
  UploadOutlined,
  IdcardOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import api, { infiniAccountApi, kycImageApi, randomUserApi, apiBaseUrl } from '../services/api';

const { Title, Text } = Typography;
const { Step } = Steps;
const { Option } = Select;

// 国家代码选项
const COUNTRY_OPTIONS = [
  { value: 'CHN', label: '中国 (CHN)' },
  { value: 'USA', label: '美国 (USA)' },
  { value: 'GBR', label: '英国 (GBR)' },
  { value: 'JPN', label: '日本 (JPN)' },
  { value: 'KOR', label: '韩国 (KOR)' },
  { value: 'SGP', label: '新加坡 (SGP)' },
  { value: 'AUS', label: '澳大利亚 (AUS)' },
  { value: 'CAN', label: '加拿大 (CAN)' },
];

// 电话区号选项
const PHONE_CODE_OPTIONS = [
  { value: '+86', label: '+86 (中国)' },
  { value: '+1', label: '+1 (美国/加拿大)' },
  { value: '+44', label: '+44 (英国)' },
  { value: '+81', label: '+81 (日本)' },
  { value: '+82', label: '+82 (韩国)' },
  { value: '+65', label: '+65 (新加坡)' },
  { value: '+61', label: '+61 (澳大利亚)' },
];

// 组件接口定义
interface KycAuthModalProps {
  visible: boolean;
  onClose: () => void;
  accountId: string;
  email?: string;
  // 完成回调，用于通知父组件KYC验证已完成
  onComplete?: () => void;
}

/**
 * KYC验证模态框组件
 */
const KycAuthModal: React.FC<KycAuthModalProps> = ({
  visible,
  onClose,
  accountId,
  email,
  onComplete
}) => {
  // 表单实例
  const [form] = Form.useForm();
  
  // 步骤状态
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // 文件上传状态
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  
  // 随机KYC图片状态
  const [randomKycImage, setRandomKycImage] = useState<{id: string, base64: string} | null>(null);
  const [loadingRandomImage, setLoadingRandomImage] = useState<boolean>(false);
  
  // 处理步骤变更
  const handleStepChange = (step: number) => {
    setCurrentStep(step);
  };
  
  // 获取随机KYC图片
  const fetchRandomKycImage = async () => {
    try {
      // 清除之前的上传状态，确保需要重新上传
      setUploadedFileName('');
      setLoadingRandomImage(true);
      const response = await kycImageApi.getRandomKycImage();
      console.log('随机KYC图片API响应:', response);
      
      if (response.success && response.data) {
        // 打印图片数据以便调试
        console.log('图片ID:', response.data.id);
        console.log('图片数据字段:', Object.keys(response.data));
        
        setRandomKycImage({
          id: response.data.id,
          base64: response.data.img_base64 || response.data.base64 || ''
        });
        form.setFieldsValue({
          kycImageId: response.data.id
        });
        
        message.success('随机KYC图片获取成功，请点击"上传并继续"按钮');
      } else {
        message.error('获取随机KYC图片失败: ' + (response.message || '未知错误'));
      }
    } catch (error) {
      console.error('获取随机KYC图片错误:', error);
      message.error('获取随机KYC图片出错: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setLoadingRandomImage(false);
    }
  };
  
  // 上传文件前验证
  const beforeUpload = (file: File) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('只能上传图片文件!');
      return false;
    }
    
    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      message.error('图片大小不能超过5MB!');
      return false;
    }
    
    // 手动处理上传，返回false阻止默认上传行为
    return false;
  };
  
  // 自定义上传组件属性
  const uploadProps: UploadProps = {
    beforeUpload,
    fileList,
    onRemove: file => {
      setFileList(prev => prev.filter(item => item.uid !== file.uid));
    },
    onChange: info => {
      if (info.fileList.length > 0) {
        setFileList([info.fileList[info.fileList.length - 1]]);
      } else {
        setFileList([]);
      }
    },
    maxCount: 1,
    listType: "picture",
    accept: "image/*"
  };
  
  // 上传KYC图片
  const handleUploadKycImage = async () => {
    if (fileList.length === 0) {
      message.error('请选择要上传的KYC图片');
      return;
    }
    
    const file = fileList[0].originFileObj as File;
    setUploading(true);
    
    try {
      const response = await infiniAccountApi.uploadKycImage(accountId, file);
      if (response.success && response.data) {
        message.success('KYC图片上传成功');
        setUploadedFileName(response.data.file_name);
        form.setFieldsValue({
          fileName: response.data.file_name
        });
        // 上传成功后移动到下一步
        setCurrentStep(1);
      } else {
        message.error(response.message || '上传失败');
      }
    } catch (error) {
      console.error('上传KYC图片错误:', error);
      message.error('上传KYC图片出错');
    } finally {
      setUploading(false);
    }
  };
  
  // 随机用户数据状态
  const [randomUserData, setRandomUserData] = useState<any>(null);
  const [loadingRandomUser, setLoadingRandomUser] = useState<boolean>(false);
  
  // 在组件挂载和visible变化时，尝试获取关联的随机用户信息
  useEffect(() => {
    if (accountId && visible) {
      fetchAssociatedRandomUser();
    }
  }, [accountId, visible]);
  
  // 在currentStep变化时，如果进入第二步且已有随机用户数据，自动填充表单
  useEffect(() => {
    if (currentStep === 1 && randomUserData) {
      fillFormWithRandomUserData(randomUserData);
      message.success('已自动填充关联的随机用户信息');
    }
  }, [currentStep, randomUserData]); // 移除fillFormWithRandomUserData依赖，避免循环引用
  
  // 获取关联的随机用户信息
  const fetchAssociatedRandomUser = async () => {
    if (!accountId) return;
    
    try {
      // 先获取账户信息
      const accountResponse = await api.get(`${apiBaseUrl}/api/infini-accounts/${accountId}`);
      
      if (accountResponse.data.success && accountResponse.data.data) {
        const account = accountResponse.data.data;
        
        // 检查是否有关联的mock_user_id（随机用户ID）
        if (account.mock_user_id) {
          setLoadingRandomUser(true);
          
          // 获取随机用户信息
          try {
            const userResponse = await randomUserApi.getRandomUserById(account.mock_user_id.toString());
            
            if (userResponse.success && userResponse.data) {
              setRandomUserData(userResponse.data);
              console.log('已获取关联的随机用户信息，将在进入护照信息步骤时自动填充表单');
            }
          } catch (error) {
            console.error('获取随机用户信息失败:', error);
          } finally {
            setLoadingRandomUser(false);
          }
        }
      }
    } catch (error) {
      console.error('获取账户信息失败:', error);
    }
  };
  
  // 生成随机用户信息并填充表单
  const generateRandomUserData = async () => {
    try {
      setLoadingRandomUser(true);
      
      // 调用后端API生成随机用户
      const response = await randomUserApi.generateRandomUsers({ count: 1 });
      
      if (response.success && response.data && response.data.length > 0) {
        const userData = response.data[0];
        setRandomUserData(userData);
        
        // 填充表单
        fillFormWithRandomUserData(userData);
        message.success('已生成随机用户信息并填充表单');
      } else {
        message.error('生成随机用户信息失败');
      }
    } catch (error) {
      console.error('生成随机用户信息失败:', error);
      message.error('生成随机用户信息失败');
    } finally {
      setLoadingRandomUser(false);
    }
  };
  
  // 使用随机用户数据填充表单
  const fillFormWithRandomUserData = (userData: any) => {
    if (!userData) return;
    
    // 从电话号码中提取国际区号，如果没有提供则使用默认值
    let phoneCode = userData.phone_code || '+1';
    if (!phoneCode.startsWith('+')) {
      phoneCode = '+' + phoneCode;
    }
    
    // 电话号码可能需要处理，确保没有区号部分
    let phoneNumber = userData.phone || '';
    // 如果电话号码包含区号，去除区号部分
    if (phoneNumber.startsWith('+')) {
      const parts = phoneNumber.split(' ');
      if (parts.length > 1) {
        phoneNumber = parts.slice(1).join('');
      }
    }
    
    // 设置表单字段值
    form.setFieldsValue({
      firstName: userData.first_name,
      lastName: userData.last_name,
      country: userData.country || 'CHN', // 使用默认值，如果未提供
      passportNumber: userData.passport_no,
      phoneCode: phoneCode,
      phoneNumber: phoneNumber
    });
  };
  
  // 清空表单
  const clearForm = () => {
    form.resetFields();
    message.info('表单已清空');
  };
  
  // 处理护照信息提交
  const handleSubmitPassportInfo = async (values: any) => {
    if (!uploadedFileName && !randomKycImage) {
      message.error('请先上传KYC图片');
      setCurrentStep(0);
      return;
    }
    
    setLoading(true);
    setErrorMessage('');
    
    // 如果使用了随机KYC图片，将其ID发送给后端
    const fileName = uploadedFileName || values.fileName;
    
    try {
      const kycData = {
        phoneNumber: values.phoneNumber,
        phoneCode: values.phoneCode,
        firstName: values.firstName,
        lastName: values.lastName,
        country: values.country,
        passportNumber: values.passportNumber,
        fileName
      };
      
      try {
        // 使用api实例发送请求，以便捕获HTTP错误状态码
        const response = await api.post(
          `${apiBaseUrl}/api/infini-accounts/kyc/passport`,
          {
            accountId,
            ...kycData
          }
        );
        
        // 成功响应处理
        if (response.data.success || (response.data.code === 0)) {
          setSuccess(true);
          message.success('KYC验证信息提交成功');
          // 移动到成功步骤
          setCurrentStep(2);
          // 如果有完成回调，通知父组件KYC验证已完成
          if (onComplete) {
            onComplete();
          }
        } else {
          // 特殊处理 "Kyc already exist" 错误
          if (response.data.message && response.data.message.includes("Kyc already exist")) {
            setSuccess(true);
            message.info('当前账户已存在KYC信息，将进入下一步');
            // 移动到成功步骤
            setCurrentStep(2);
            // 如果有完成回调，通知父组件KYC验证已完成
            if (onComplete) {
              onComplete();
            }
          } else {
            setErrorMessage(response.data.message || '提交失败');
            message.error(response.data.message || '提交失败');
          }
        }
      } catch (axiosError: any) {
        console.error('提交KYC验证信息HTTP错误:', axiosError);
        
        // 检查是否包含响应数据
        const errorResponse = axiosError.response?.data;
        console.log('错误响应数据:', errorResponse);
        
        // 特殊处理500状态码的"Kyc already exist"错误
        if (errorResponse && 
            (errorResponse.message && errorResponse.message.includes("Kyc already exist") || 
             (typeof errorResponse === 'string' && errorResponse.includes("Kyc already exist")))) {
          
          setSuccess(true);
          message.info('当前账户已存在KYC信息，将进入下一步');
          // 移动到成功步骤
          setCurrentStep(2);
          // 如果有完成回调，通知父组件KYC验证已完成
          if (onComplete) {
            onComplete();
          }
          return;
        }
        
        // 其他HTTP错误处理
        const errorMsg = errorResponse?.message || axiosError.message || '提交KYC验证信息出错';
        setErrorMessage(errorMsg);
        message.error(errorMsg);
      }
    } catch (error: any) {
      // 处理其他可能的错误
      console.error('提交KYC验证信息错误:', error);
      
      // 检查是否为"Kyc already exist"错误
      if (error.message && error.message.includes("Kyc already exist")) {
        setSuccess(true);
        message.info('当前账户已存在KYC信息，将进入下一步');
        setCurrentStep(2);
        if (onComplete) {
          onComplete();
        }
      } else {
        setErrorMessage(error.message || '提交KYC验证信息出错');
        message.error('提交KYC验证信息出错');
      }
    } finally {
      setLoading(false);
    }
  };
  
  // 从第二步返回第一步
  const handlePrevStep = () => {
    // 清除上传状态，确保返回后需要重新上传
    setUploadedFileName('');
    setCurrentStep(0);
  };
  
  // 关闭模态框
  const handleClose = () => {
    // 重置状态
    setCurrentStep(0);
    setFileList([]);
    setUploadedFileName('');
    setRandomKycImage(null);
    setSuccess(false);
    setErrorMessage('');
    form.resetFields();
    onClose();
  };
  
  // 使用随机KYC图片
  const handleUseRandomKycImage = async () => {
    if (!randomKycImage) {
      message.error('请先获取随机KYC图片');
      return;
    }
    
    try {
      // 选择随机图片，但还需要用户点击上传按钮进行上传
      message.success('已选择随机KYC图片，请点击"上传并继续"');
      
      // 设置表单值，但不自动设置uploadedFileName，需要等待用户点击上传
      form.setFieldsValue({
        fileName: randomKycImage.id
      });
    } catch (error) {
      console.error('使用随机KYC图片错误:', error);
      message.error('使用随机KYC图片出错');
      setUploading(false);
    }
  };
  
  // 步骤内容
  const steps = [
    {
      title: '上传KYC图片',
      content: (
        <div style={{ marginTop: 24 }}>
          <Card bordered={false}>
            {/* 图片预览区域 */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              {uploading ? (
                <div style={{ padding: '60px 0' }}>
                  <Spin tip="正在上传KYC图片，预计需要15-20秒..." indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
                </div>
              ) : loadingRandomImage ? (
                <div style={{ padding: '60px 0' }}>
                  <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
                  <div style={{ marginTop: 12 }}>正在获取随机KYC图片...</div>
                </div>
              ) : randomKycImage && randomKycImage.base64 ? (
                <div>
                  <img 
                    src={randomKycImage.base64.startsWith('data:') 
                      ? randomKycImage.base64 
                      : `data:image/jpeg;base64,${randomKycImage.base64}`} 
                    alt="随机KYC图片" 
                    style={{ maxWidth: '100%', maxHeight: 280 }} 
                    onError={(e) => {
                      console.error('图片加载失败');
                      e.currentTarget.src = '/card/card_1.png';
                      e.currentTarget.alt = '备用KYC图片';
                    }}
                  />
                </div>
              ) : fileList.length > 0 ? (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ marginBottom: 8, color: '#666' }}>已选择图片：</div>
                  <Upload {...uploadProps} />
                </div>
              ) : (
                <div style={{ padding: '60px 0', background: '#f5f5f5', color: '#666', borderRadius: '8px' }}>
                  <div>请上传KYC图片或获取随机KYC图片</div>
                  <div style={{ fontSize: '12px', color: '#999', marginTop: 8 }}>支持JPG、PNG格式，文件大小不超过5MB</div>
                </div>
              )}
            </div>
            
            {/* 按钮区域 */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: 16 }}>
              <Upload {...uploadProps} showUploadList={false}>
                <Button 
                  icon={<UploadOutlined />} 
                  loading={uploading} 
                  disabled={loadingRandomImage}
                >
                  手动上传KYC图片
                </Button>
              </Upload>
              <Button 
                onClick={fetchRandomKycImage} 
                loading={loadingRandomImage}
                disabled={uploading}
              >
                获取随机KYC图片
              </Button>
            </div>
            
            <Form.Item name="kycImageId" hidden>
              <Input />
            </Form.Item>
          </Card>
        </div>
      )
    },
    {
      title: '填写护照信息',
      content: (
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 24 }}
          onFinish={handleSubmitPassportInfo}
        >
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="firstName"
                label="名字"
                rules={[{ required: true, message: '请输入名字' }]}
              >
                <Input placeholder="请输入名字" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="lastName"
                label="姓氏"
                rules={[{ required: true, message: '请输入姓氏' }]}
              >
                <Input placeholder="请输入姓氏" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="country"
                label="国家"
                rules={[{ required: true, message: '请选择国家' }]}
              >
                <Select placeholder="请选择国家">
                  {COUNTRY_OPTIONS.map(option => (
                    <Option key={option.value} value={option.value}>{option.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="passportNumber"
                label="护照号码"
                rules={[{ required: true, message: '请输入护照号码' }]}
              >
                <Input placeholder="请输入护照号码" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item
                name="phoneCode"
                label="电话区号"
                rules={[{ required: true, message: '请选择电话区号' }]}
              >
                <Select placeholder="请选择电话区号">
                  {PHONE_CODE_OPTIONS.map(option => (
                    <Option key={option.value} value={option.value}>{option.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item
                name="phoneNumber"
                label="电话号码"
                rules={[{ required: true, message: '请输入电话号码' }]}
              >
                <Input placeholder="请输入电话号码" />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item name="fileName" hidden>
            <Input />
          </Form.Item>
          
          <Form.Item>
            <Space style={{ width: '100%' }}>
              {/* 左侧放置工具按钮 */}
              <Space>
                <Button 
                  onClick={clearForm} 
                  icon={<CloseCircleOutlined />}
                  disabled={loading || loadingRandomUser}
                >
                  清空表单
                </Button>
                <Button 
                  onClick={generateRandomUserData} 
                  icon={<ReloadOutlined />}
                  loading={loadingRandomUser}
                  disabled={loading}
                >
                  生成随机用户信息
                </Button>
              </Space>
              
              {/* 右侧放置导航按钮，使用flex布局自动推到右侧 */}
              <div style={{ flex: 1 }}></div>
              <Button onClick={handlePrevStep}>上一步</Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                提交KYC信息
              </Button>
            </Space>
          </Form.Item>
        </Form>
      )
    },
    {
      title: '验证结果',
      content: (
        <Result
          status={success ? "success" : "error"}
          title={success ? "KYC验证信息提交成功！" : "KYC验证信息提交失败"}
          subTitle={success 
            ? "您的KYC验证信息已成功提交，请等待系统审核。" 
            : `提交失败: ${errorMessage || '未知错误'}`
          }
          extra={[
            <Button type="primary" key="close" onClick={handleClose}>
              完成
            </Button>
          ]}
        />
      )
    }
  ];
  
  // 处理下一步按钮点击
  const handleNextStep = () => {
    setCurrentStep(currentStep + 1);
  };
  
  // 使用随机KYC图片上传 - 使用现有API
  const handleUploadRandomKycImage = async () => {
    if (!randomKycImage) {
      message.error('请先获取随机KYC图片');
      return;
    }
    
    if (!randomKycImage.base64) {
      message.error('随机KYC图片数据无效');
      return;
    }
    
    setUploading(true);
    
    try {
      // 显示上传进度提示
      message.info('正在上传随机KYC图片，预计需要15-20秒...');
      
      // 从base64数据创建图片文件
      let imageData = randomKycImage.base64;
      
      // 如果base64字符串包含前缀(例如data:image/jpeg;base64,)，需要移除
      if (imageData.includes('base64,')) {
        imageData = imageData.split('base64,')[1];
      }
      
      // 将base64转换为二进制数据
      const byteCharacters = atob(imageData);
      const byteArrays = [];
      
      for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
      }
      
      // 创建图片Blob
      const blob = new Blob(byteArrays, { type: 'image/jpeg' });
      const imageFile = new File([blob], `kyc_image_${randomKycImage.id}.jpg`, { type: 'image/jpeg' });
      
      // 直接调用现有的uploadKycImage API
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('accountId', accountId);
      formData.append('randomKycId', randomKycImage.id); // 传递随机图片ID
      
      // 发送请求并解析响应
      const response = await api.post(
        `${apiBaseUrl}/api/infini-accounts/kyc/upload`, 
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      if (response.data.success) {
        // 上传成功，设置fileName
        setUploadedFileName(response.data.data?.file_name || randomKycImage.id);
        message.success('随机KYC图片上传成功');
        
        // 上传成功后移动到下一步
        setCurrentStep(1);
      } else {
        throw new Error(response.data.message || '上传失败');
      }
    } catch (error) {
      console.error('上传随机KYC图片错误:', error);
      message.error('上传随机KYC图片出错');
    } finally {
      setUploading(false);
    }
  };
  
  // 渲染Modal的footer
  const renderFooter = () => {
    // 仅在第一步时显示自定义footer
    if (currentStep === 0) {
      return (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {/* 本地上传图片 */}
          {fileList.length > 0 && (
            <Button
              type="primary"
              onClick={handleUploadKycImage}
              loading={uploading}
              style={{ marginRight: 8 }}
            >
              上传并继续
            </Button>
          )}
          
          {/* 随机KYC图片上传 */}
          {randomKycImage && !uploadedFileName && (
            <Button
              type="primary"
              onClick={handleUploadRandomKycImage}
              loading={uploading}
              style={{ marginRight: 8 }}
            >
              上传并继续
            </Button>
          )}
          
          {/* 只有成功上传后才显示下一步按钮 */}
          {uploadedFileName && (
            <Button
              type="primary"
              onClick={handleNextStep}
              disabled={uploading || loadingRandomImage}
            >
              下一步
            </Button>
          )}
        </div>
      );
    }
    return null; // 其他步骤使用组件内定义的按钮
  };

  return (
    <Modal
      title={
        <Space>
          <IdcardOutlined />
          <span>Infini账户KYC验证</span>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      width={800}
      footer={renderFooter()}
      maskClosable={false}
    >
      <Steps current={currentStep} onChange={handleStepChange} items={steps.map(item => ({ title: item.title }))} />
      
      <div className="steps-content">
        {steps[currentStep].content}
      </div>
    </Modal>
  );
};

export default KycAuthModal;