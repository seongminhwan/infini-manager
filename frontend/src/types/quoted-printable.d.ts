declare module 'quoted-printable' {
  export function decode(input: string): string;
  export function encode(input: string): string;
  // 根据实际库的导出情况，可以添加更多具体的类型声明
  // 但对于解决 TS7016，仅 declare module 'quoted-printable'; 也是可以的
  // 这里我们提供一个更具体的声明，假设它导出了 decode 和 encode 函数
}