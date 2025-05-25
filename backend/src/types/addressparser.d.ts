/**
 * addressparser库的类型定义
 */
declare module 'addressparser' {
  /**
   * 邮件地址信息
   */
  interface Address {
    /**
     * 邮件地址
     */
    address: string;
    /**
     * 邮件发送者/接收者名称
     */
    name?: string;
    /**
     * 邮件组名称
     */
    group?: string[];
  }

  /**
   * 解析邮件地址字符串
   * @param addressStr 邮件地址字符串，如 "Name <email@example.com>"
   * @returns 解析后的地址对象数组
   */
  function addressparser(addressStr: string): Address[];

  export = addressparser;
}