import 'react';
// React 18 的类型尚未声明浏览器原生 Popover 属性；保留小写 DOM 属性名。
declare module 'react' {
  interface HTMLAttributes<T> {
    popover?: 'auto' | 'manual' | '';
  }
  interface ButtonHTMLAttributes<T> {
    popovertarget?: string;
  }
}
