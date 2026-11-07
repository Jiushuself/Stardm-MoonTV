'use client';

import { usePathname } from 'next/navigation';
import { memo } from 'react';

import MobileBottomNav from './MobileBottomNav';
import MobileHeader from './MobileHeader';
import TopNav from './TopNav';

/**
 * 条件导航栏组件
 * 根据当前路径决定是否显示导航栏
 * 在登录、警告等特殊页面不显示导航栏
 */
const ConditionalNav = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();

  // 不显示导航栏的路径列表
  const hideNavPaths = ['/login', '/warning'];

  // 检查当前路径是否需要隐藏导航栏
  const shouldHideNav = hideNavPaths.some((path) => pathname.startsWith(path));

  // 登录、警告页保持全宽，不为侧边导航预留空间。
  if (shouldHideNav) {
    return <>{children}</>;
  }

  return (
    <div className='min-h-screen md:pl-[var(--sidebar-width)]'>
      {/* 导航留在根布局，切换页面时保持状态。 */}
      <MobileHeader showBackButton={false} />
      <TopNav />

      {children}

      <div className='md:hidden'>
        <MobileBottomNav />
      </div>
    </div>
  );
};

// 使用 React.memo 优化，避免不必要的重新渲染
export default memo(ConditionalNav);
