/**
 * 可调整列宽的表头组件
 */
import React, { useRef, useCallback, useEffect } from 'react';
import { Resizable } from 'react-resizable';
import { ResizeCallbackData } from 'react-resizable';
import 'react-resizable/css/styles.css';

interface ResizableTitleProps {
  onResize: (e: React.SyntheticEvent<Element>, data: ResizeCallbackData) => void;
  width?: number;
  [x: string]: any;
}

/**
 * 可调整列宽的表头组件
 * 支持鼠标拖拽调整列宽，优化性能和用户体验
 */
const ResizableTitle: React.FC<ResizableTitleProps> = ({ onResize, width, ...restProps }) => {
  // 使用useRef避免不必要的重渲染
  const resizingRef = useRef(false);
  const handleRef = useRef<HTMLDivElement>(null);
  const resizeTimeoutRef = useRef<number | null>(null);

  // 使用有效的宽度值，确保resize功能始终可用
  const actualWidth = width || 100;

  // 使用useCallback优化事件处理函数，减少重渲染
  const handleResize = useCallback(
    (e: React.SyntheticEvent<Element>, data: ResizeCallbackData) => {
      e.preventDefault();

      // 使用节流减少resize回调频率
      if (resizeTimeoutRef.current !== null) {
        window.clearTimeout(resizeTimeoutRef.current);
      }

      // 直接操作DOM更新视觉指示器
      if (handleRef.current) {
        handleRef.current.style.opacity = '1';
        handleRef.current.style.backgroundColor = '#1890ff';
      }

      // 节流处理resize回调，降低状态更新频率
      resizeTimeoutRef.current = window.setTimeout(() => {
        onResize(e, data);
        resizeTimeoutRef.current = null;
      }, 10);
    },
    [onResize]
  );

  // 使用useCallback优化事件处理函数，使用useRef而不是useState跟踪状态
  const handleResizeStart = useCallback(() => {
    resizingRef.current = true;
    if (handleRef.current) {
      handleRef.current.style.opacity = '1';
      handleRef.current.style.backgroundColor = '#1890ff';
    }
    // 添加辅助类到body来改变全局鼠标样式，提升用户体验
    document.body.classList.add('resizing-columns');
  }, []);

  const handleResizeStop = useCallback(() => {
    resizingRef.current = false;
    if (handleRef.current) {
      handleRef.current.style.opacity = '0';
    }
    // 移除辅助类
    document.body.classList.remove('resizing-columns');

    // 清除可能存在的超时计时器
    if (resizeTimeoutRef.current !== null) {
      window.clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = null;
    }
  }, []);

  // 鼠标进入和离开事件处理函数，直接操作DOM避免状态更新
  const handleMouseEnter = useCallback(() => {
    if (!resizingRef.current && handleRef.current) {
      handleRef.current.style.opacity = '0.6';
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (!resizingRef.current && handleRef.current) {
      handleRef.current.style.opacity = '0';
    }
  }, []);

  // 组件卸载时清理超时计时器
  useEffect(() => {
    return () => {
      if (resizeTimeoutRef.current !== null) {
        window.clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []);

  return (
    <Resizable
      width={actualWidth}
      height={0}
      handle={
        <div
          className="react-resizable-handle"
          onClick={e => e.stopPropagation()}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            position: 'absolute',
            right: -15, // 扩大偏移值，确保触发区域跨越表头单元格边界
            top: 0,
            bottom: 0,
            width: 30, // 增加宽度到30px，进一步扩大可触发区域
            zIndex: 100, // 提高z-index确保可点击
            cursor: 'col-resize',
          }}
        >
          {/* 视觉指示器，使用ref直接操作而不是依赖重渲染 */}
          <div
            ref={handleRef}
            style={{
              position: 'absolute',
              right: 15, // 居中显示在拖拽把手中
              top: 0,
              bottom: 0,
              width: 3, // 增加线宽到3px，增强视觉反馈
              backgroundColor: 'rgba(24, 144, 255, 0.6)', // 初始颜色
              opacity: 0, // 默认隐藏
              transition: 'opacity 0.15s, background-color 0.15s', // 加快过渡速度
              borderRadius: 1.5, // 圆角边缘
            }}
          />
        </div>
      }
      onResize={handleResize}
      onResizeStart={handleResizeStart}
      onResizeStop={handleResizeStop}
      draggableOpts={{
        enableUserSelectHack: false,
        // 更大的网格值减少状态更新频率，提高性能
        grid: [10, 0], // 水平方向每次移动10px，进一步减少计算次数
        // 优化Draggable选项
        offsetParent: document.body, // 使用body作为偏移父元素，提高性能
        scale: 1, // 固定缩放比例
      }}
    >
      <th
        {...restProps}
        style={{
          ...restProps.style,
          position: 'relative',
          userSelect: 'none', // 防止文本选择干扰拖拽
          cursor: 'default', // 确保基本光标正确
          transition: 'width 0.05s ease-out', // 添加宽度变化的平滑过渡
        }}
      />
    </Resizable>
  );
};

export default ResizableTitle;