/**
 * KYC图片管理页面
 * 提供KYC图片的上传、查看、标签管理和删除功能
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  message,
  Form,
  Input,
  Tag,
  Row,
  Col,
  Upload,
  Tooltip,
  Popconfirm,
  Alert,
  Typography,
  Spin,
  Image as AntImage,
  Divider,
  Select,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  UploadOutlined,
  TagsOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import { AxiosResponse, AxiosError } from 'axios';
import api, { apiBaseUrl } from '../../services/api';
import type { UploadChangeParam } from 'antd/es/upload';
import type { RcFile, UploadFile, UploadProps } from 'antd/es/upload/interface';

const { Title, Text } = Typography;
const { Option } = Select;

// 样式组件
const StyledCard = styled(Card)`
  margin-bottom: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.09);
  overflow: hidden;
`;

const TableContainer = styled.div`
  width: 100%;
  overflow-x: auto;
`;

const FormContainer = styled.div`
  padding: 20px;
  border-radius: 8px;
  background: #fff;
`;

const StyledTag = styled(Tag)`
  margin: 2px;
`;

const TagsContainer = styled.div`
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
`;

const ThumbnailImage = styled(AntImage)`
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 4px;
`;

// KYC图片接口
interface KycImage {
  id: number;
  img_base64: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

// 主组件
const KycImageManage: React.FC = () => {
  const [images, setImages] = useState<KycImage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [currentImage, setCurrentImage] = useState<KycImage | null>(null);
  const [form] = Form.useForm();
  const [previewVisible, setPreviewVisible] = useState<boolean>(false);
  const [previewImage, setPreviewImage] = useState<string>('');
  const [searchTags, setSearchTags] = useState<string>('');
  
  // 图片上传状态
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  
  // 使用导入的kycApiBaseUrl

  // 加载KYC图片列表
  const fetchImages = async (tags?: string) => {
    setLoading(true);
    try {
      let url = `${apiBaseUrl}/api/kyc-images`;
      
      // 如果有标签搜索，则使用搜索接口
      if (tags) {
        url = `${apiBaseUrl}/api/kyc-images/search?tags=${encodeURIComponent(tags)}`;
      }
      
      const response = await api.get(url);
      
      if (response.data.success) {
        setImages(response.data.data || []);
      } else {
        message.error('获取KYC图片列表失败: ' + response.data.message);
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      message.error('获取KYC图片列表失败: ' + axiosError.message);
      console.error('Failed to fetch KYC images:', error);
    } finally {
      setLoading(false);
    }
  };

  // 刷新数据
  const handleRefresh = () => {
    fetchImages(searchTags);
  };

  // 首次加载数据
  useEffect(() => {
    fetchImages();
  }, []);

  // 打开编辑模态窗
  const openEditModal = (record?: KycImage) => {
    setFileList([]);
    
    if (record) {
      // 编辑现有图片
      setCurrentImage(record);
      form.setFieldsValue({
        tags: record.tags,
      });
    } else {
      // 新建图片
      setCurrentImage(null);
      form.resetFields();
    }
    
    setModalVisible(true);
  };

  // 处理图片上传前的预处理
  const beforeUpload = (file: RcFile) => {
    const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
    if (!isJpgOrPng) {
      message.error('只能上传JPG/PNG格式的图片!');
      return false;
    }
    
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('图片大小不能超过10MB!');
      return false;
    }
    
    // 如果图片较大，显示提示
    if (file.size / 1024 / 1024 > 5) {
      message.info('较大的图片将被自动压缩以加快上传速度');
    }
    
    return false; // 阻止自动上传
  };

  // 处理图片选择变化
  const handleChange: UploadProps['onChange'] = (info: UploadChangeParam) => {
    setFileList([...info.fileList].slice(-1)); // 只保留最新选择的一张图片
  };

  // 转换图片为Base64并进行压缩
  const getBase64 = (file: RcFile): Promise<string> => {
    return new Promise((resolve, reject) => {
      // 对于非图片文件或小文件，使用普通的FileReader方法
      if (!file.type.startsWith('image/') || file.size < 500 * 1024) { // 小于500KB不压缩
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        return;
      }

      // 创建图片元素用于加载
      const img = new window.Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        // 创建canvas用于绘制压缩后的图片
        const canvas = document.createElement('canvas');
        
        // 计算压缩后的尺寸，保持宽高比 - 使用更小的尺寸限制
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 800;  // 最大宽度降低到800px
        const MAX_HEIGHT = 800; // 最大高度降低到800px
        
        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round(height * MAX_WIDTH / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round(width * MAX_HEIGHT / height);
            height = MAX_HEIGHT;
          }
        }
        
        // 设置canvas尺寸
        canvas.width = width;
        canvas.height = height;
        
        // 绘制图片到canvas
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法创建canvas上下文'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // 将canvas转换为base64，使用更激进的质量压缩
        // 对于大型图片，使用非常低的质量值
        let quality = 0.7; // 默认值降低到0.7
        if (file.size > 5 * 1024 * 1024) {
          quality = 0.3; // 超过5MB用0.3的质量（激进压缩）
        } else if (file.size > 2 * 1024 * 1024) {
          quality = 0.4; // 介于2-5MB用0.4的质量
        } else if (file.size > 1 * 1024 * 1024) {
          quality = 0.5; // 介于1-2MB用0.5的质量
        }
        
        // 直接使用一个let声明，避免重复声明
        let base64 = canvas.toDataURL(file.type, quality);
        let compressedSizeKb = Math.round(base64.length / 1.37 / 1024);
        
        // 如果压缩后仍然超过2MB，继续降低质量和分辨率
        if (compressedSizeKb > 2048) {
          // 再次降低分辨率
          const scaleFactor = Math.min(1, Math.sqrt(2048 / compressedSizeKb));
          width = Math.round(width * scaleFactor);
          height = Math.round(height * scaleFactor);
          
          // 重新绘制
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          
          // 使用最低质量
          base64 = canvas.toDataURL(file.type, 0.2);
          compressedSizeKb = Math.round(base64.length / 1.37 / 1024);
        }
        
        // 计算压缩比例并显示反馈
        const originalSizeKb = Math.round(file.size / 1024);
        const savingsPercent = Math.round((1 - (compressedSizeKb / originalSizeKb)) * 100);
        
        message.success(`图片已压缩: ${originalSizeKb}KB → ${compressedSizeKb}KB (节省${savingsPercent}%)
分辨率: ${width}x${height}, 质量: ${Math.round(quality * 100)}%`);
        
        // 清理资源
        URL.revokeObjectURL(img.src);
        
        resolve(base64);
      };
      
      img.onerror = () => {
        reject(new Error('加载图片失败'));
      };
    });
  };

  // 预览图片 - 使用未压缩的原始图片预览
  const handlePreview = async (file: UploadFile) => {
    if (!file.url && !file.preview) {
      try {
        // 预览时不进行压缩，使用原始图片
        const reader = new FileReader();
        reader.readAsDataURL(file.originFileObj as RcFile);
        reader.onload = () => {
          file.preview = reader.result as string;
          setPreviewImage(file.preview);
          setPreviewVisible(true);
        };
      } catch (error) {
        console.error('预览图片失败:', error);
        message.error('预览图片失败');
      }
      return;
    }
    
    setPreviewImage(file.url || (file.preview as string));
    setPreviewVisible(true);
  };

  // 表单提交处理
  const handleSubmit = async (values: any) => {
    if (currentImage) {
      // 更新现有图片
      try {
        const updateData: any = {
          tags: values.tags,
        };
        
        // 如果选择了新图片，则转换为base64并更新
        if (fileList.length > 0 && fileList[0].originFileObj) {
          message.loading('正在处理图片，请稍候...', 0.5);
          updateData.img_base64 = await getBase64(fileList[0].originFileObj as RcFile);
        }
        
        await api.put(`${apiBaseUrl}/api/kyc-images/${currentImage.id}`, updateData);
        message.success('KYC图片更新成功');
        setModalVisible(false);
        fetchImages(searchTags);
      } catch (error) {
        console.error('更新KYC图片失败:', error);
        message.error('更新KYC图片失败: ' + (error as Error).message);
      }
    } else {
      // 创建新图片
      if (fileList.length === 0) {
        message.error('请选择图片');
        return;
      }
      
      setUploading(true);
      message.loading('正在处理并上传图片，请稍候...', 0.5);
      
      try {
        // 将文件转换为base64，同时进行压缩
        const base64 = await getBase64(fileList[0].originFileObj as RcFile);
        
        // 检查压缩后的数据大小
        const sizeInMB = base64.length / 1024 / 1024 / 1.37; // 转换成MB
        if (sizeInMB > 10) {
          message.error(`压缩后图片仍然过大(${sizeInMB.toFixed(2)}MB)，请选择较小的图片或降低图片质量`);
          setUploading(false);
          return;
        }
        
        // 创建新图片
        await api.post(`${apiBaseUrl}/api/kyc-images`, {
          img_base64: base64,
          tags: values.tags || '',
        });
        
        message.success('KYC图片上传成功');
        setModalVisible(false);
        fetchImages(searchTags);
        setFileList([]);
      } catch (error) {
        console.error('上传KYC图片失败:', error);
        // 提供更明确的错误信息，特别是413错误
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 413) {
          Modal.error({
            title: '图片大小超出限制',
            content: (
              <>
                <p>即使经过压缩，图片仍然过大，服务器拒绝接收。</p>
                <p>请尝试以下解决方案：</p>
                <ol>
                  <li>选择较小的原始图片</li>
                  <li>使用外部工具压缩图片后再上传</li>
                  <li>降低图片分辨率后再上传</li>
                </ol>
                <p>建议上传前将图片大小控制在2MB以下</p>
              </>
            ),
            okText: '我知道了'
          });
        } else {
          message.error('上传KYC图片失败: ' + (axiosError.message || '未知错误'));
        }
      } finally {
        setUploading(false);
      }
    }
  };

  // 删除图片
  const handleDelete = async (id: number) => {
    try {
      await api.delete(`${apiBaseUrl}/api/kyc-images/${id}`);
      message.success('KYC图片删除成功');
      fetchImages(searchTags);
    } catch (error) {
      message.error('删除KYC图片失败: ' + (error as Error).message);
    }
  };

  // 处理搜索
  const handleSearch = () => {
    fetchImages(searchTags);
  };

  // 将标签字符串转换为数组
  const tagsToArray = (tags: string): string[] => {
    if (!tags) return [];
    return tags.split(',').map(tag => tag.trim()).filter(tag => tag);
  };

  // 表格列定义
  const columns = [
    {
      title: '缩略图',
      dataIndex: 'img_base64',
      key: 'img_base64',
      width: 100,
      render: (base64: string) => (
        <ThumbnailImage
          src={base64}
          alt="KYC图片"
          preview={{
            mask: <div style={{ color: 'white' }}>预览</div>,
          }}
        />
      ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string) => (
        <TagsContainer>
          {tagsToArray(tags).map(tag => (
            <StyledTag color="blue" key={tag}>
              {tag}
            </StyledTag>
          ))}
        </TagsContainer>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: KycImage) => (
        <Space size="small">
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => openEditModal(record)}
          />
          
          <Popconfirm
            title="确定要删除这个KYC图片吗?"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
            icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
          >
            <Button 
              type="text" 
              danger 
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <StyledCard
        title={
          <Space>
            <TagsOutlined />
            <span>KYC图片管理</span>
          </Space>
        }
        extra={
          <Space>
            <Input
              placeholder="输入标签搜索"
              value={searchTags}
              onChange={e => setSearchTags(e.target.value)}
              style={{ width: 200 }}
              suffix={
                <Tooltip title="多个标签用逗号分隔">
                  <InfoCircleOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                </Tooltip>
              }
              onPressEnter={handleSearch}
            />
            <Button
              icon={<SearchOutlined />}
              onClick={handleSearch}
            >
              搜索
            </Button>
            <Button
              onClick={handleRefresh}
              icon={<InfoCircleOutlined />}
            >
              刷新
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => openEditModal()}
            >
              上传KYC图片
            </Button>
          </Space>
        }
        bordered={false}
      >
        <TableContainer>
          <Table
            columns={columns}
            dataSource={images}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1000 }}
          />
        </TableContainer>
      </StyledCard>

      {/* 图片编辑/上传模态窗 */}
      <Modal
        title={currentImage ? '编辑KYC图片' : '上传KYC图片'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        <FormContainer>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
          >
            {!currentImage && (
              <Form.Item
                name="image"
                label="选择图片"
                rules={[{ required: true, message: '请选择图片' }]}
                extra="支持JPG/PNG格式，大图片将自动压缩以适应系统限制"
              >
                <Upload
                  listType="picture-card"
                  fileList={fileList}
                  beforeUpload={beforeUpload}
                  onChange={handleChange}
                  onPreview={handlePreview}
                  maxCount={1}
                >
                  {fileList.length < 1 && (
                    <div>
                      <PlusOutlined />
                      <div style={{ marginTop: 8 }}>上传</div>
                    </div>
                  )}
                </Upload>
              </Form.Item>
            )}
            
            {currentImage && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Text strong>当前图片：</Text>
                  <div style={{ marginTop: 8 }}>
                    <AntImage
                      src={currentImage.img_base64}
                      alt="KYC图片"
                      style={{ width: 100, height: 100 }}
                    />
                  </div>
                </div>
                
                <Form.Item
                  name="newImage"
                  label="更新图片（可选）"
                  extra="支持JPG/PNG格式，大图片将自动压缩以适应系统限制"
                >
                  <Upload
                    listType="picture-card"
                    fileList={fileList}
                    beforeUpload={beforeUpload}
                    onChange={handleChange}
                    onPreview={handlePreview}
                    maxCount={1}
                  >
                    {fileList.length < 1 && (
                      <div>
                        <PlusOutlined />
                        <div style={{ marginTop: 8 }}>上传</div>
                      </div>
                    )}
                  </Upload>
                </Form.Item>
              </>
            )}
            
            <Form.Item
              name="tags"
              label="图片标签"
              tooltip="多个标签用逗号分隔，例如：身份证,护照,驾照"
            >
              <Input placeholder="输入标签，多个标签用逗号分隔" />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={uploading}>
                  {currentImage ? '保存修改' : '上传图片'}
                </Button>
                <Button onClick={() => setModalVisible(false)}>
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </FormContainer>
      </Modal>

      {/* 图片预览模态窗 */}
      <Modal
        open={previewVisible}
        footer={null}
        onCancel={() => setPreviewVisible(false)}
      >
        <img 
          alt="预览" 
          style={{ width: '100%' }} 
          src={previewImage} 
        />
      </Modal>
    </div>
  );
};

export default KycImageManage;