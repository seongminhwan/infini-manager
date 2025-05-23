import React, { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Button, Select, Space, message, Spin } from 'antd';
import { infiniAccountApi, transferApi } from '../services/api';

interface TransferFormProps {
  sourceAccountId: number;           // 当前账户 id
  mode: 'in' | 'out';               // 转入(到当前账户) / 转出(从当前账户)
  onFinished: (success: boolean) => void; // 提交成功或取消
}

const { Option } = Select;

const TransferForm: React.FC<TransferFormProps> = ({ sourceAccountId, mode, onFinished }) => {
  const [form] = Form.useForm();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loadingAcc, setLoadingAcc] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoadingAcc(true);
      try {
        const res = await infiniAccountApi.getAllInfiniAccounts?.(); // 该函数在 api 中存在
        if(res?.success){
          setAccounts(res.data.filter((a:any)=>a.id!==sourceAccountId));
        }
      } catch(e){
        console.error('加载账户失败',e);
      } finally{
        setLoadingAcc(false);
      }
    };
    fetch();
  }, [sourceAccountId]);

  const handleSubmit = async (values:any)=>{
    const { targetAccountId, amount, remarks } = values;
    if(!targetAccountId){ message.error('请选择目标账户'); return; }
    try{
      setSubmitting(true);
      let finalSourceId = sourceAccountId.toString();
      let finalTargetId = targetAccountId.toString();
      if(mode==='in'){
        // 转入：资金从 target -> current
        finalSourceId = targetAccountId.toString();
        finalTargetId = sourceAccountId.toString();
      }
      const resp = await transferApi.executeInternalTransfer(
        finalSourceId,
        'inner',
        finalTargetId,
        amount.toString(),
        'manual',
        false,
        remarks,
        false
      );
      if(resp.success){
        message.success('转账成功');
        onFinished(true);
      }else{
        message.error(resp.message||'转账失败');
      }
    }catch(e:any){
      message.error(e.message||'转账失败');
    }finally{
      setSubmitting(false);
    }
  };

  return (
    <Spin spinning={loadingAcc}>
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item label="目标账户" name="targetAccountId" rules={[{required:true,message:'请选择目标账户'}]}>
          <Select showSearch placeholder="选择邮箱/UID" optionFilterProp="label">
            {accounts.map(acc=> (
              <Option key={acc.id} value={acc.id} label={acc.email}>{acc.email} (UID:{acc.uid||'-'})</Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item label="金额" name="amount" rules={[{required:true,message:'请输入金额'}]}>
          <InputNumber min={0.000001} precision={6} style={{width:'100%'}} />
        </Form.Item>
        <Form.Item label="备注" name="remarks">
          <Input placeholder="备注" />
        </Form.Item>
        <Space>
          <Button htmlType="submit" type="primary" loading={submitting}>确认</Button>
          <Button onClick={()=>onFinished(false)}>取消</Button>
        </Space>
      </Form>
    </Spin>
  );
};

export default TransferForm; 