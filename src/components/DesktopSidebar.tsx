'use client';

import {
  type DragEndEvent,
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { type LucideIcon, GripVertical } from 'lucide-react';
import Link from 'next/link';

interface SidebarItem {
  href: string;
  label: string;
  icon: LucideIcon;
  isHome: boolean;
}

interface DesktopSidebarProps {
  siteName: string;
  items: SidebarItem[];
  activePath: string;
  onNavigate: (href: string) => void;
  onReorder: (order: string[]) => void;
}

export function isSidebarItemActive(item: SidebarItem, activePath: string) {
  const current = new URL(activePath, 'http://localhost');
  const target = new URL(item.href, 'http://localhost');

  if (item.href === '/watch-room') {
    return (
      current.pathname === '/watch-room' ||
      current.pathname.startsWith('/watch-room/')
    );
  }

  const type = target.searchParams.get('type');
  return (
    current.pathname === target.pathname &&
    (!type || current.searchParams.get('type') === type)
  );
}

function SortableSidebarItem({
  item,
  active,
  onNavigate,
}: {
  item: SidebarItem;
  active: boolean;
  onNavigate: (href: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.href });
  const Icon = item.icon;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative rounded-xl ${
        isDragging ? 'z-10 bg-white shadow-lg dark:bg-gray-900' : ''
      }`}
    >
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        data-active={active}
        onClick={() => {
          if (!active) onNavigate(item.href);
        }}
        className='flex min-h-[46px] items-center gap-3 rounded-xl py-3 pl-4 pr-10 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-green-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-green-500 data-[active=true]:bg-green-500/10 data-[active=true]:text-green-700 motion-reduce:transition-none dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-green-400 dark:data-[active=true]:text-green-400'
      >
        <Icon className='h-5 w-5 shrink-0' aria-hidden />
        <span className='truncate'>{item.label}</span>
      </Link>
      <button
        ref={setActivatorNodeRef}
        type='button'
        {...attributes}
        {...listeners}
        aria-label={`调整${item.label}的位置`}
        title='长按拖动调整顺序，也可按空格键后用方向键调整'
        className='absolute right-1.5 top-1/2 flex h-8 w-7 -translate-y-1/2 touch-none items-center justify-center rounded-md text-gray-400 opacity-0 transition-opacity hover:bg-gray-200/70 hover:text-gray-600 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-500 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none dark:hover:bg-gray-700 dark:hover:text-gray-200'
      >
        <GripVertical className='h-4 w-4' aria-hidden />
      </button>
    </li>
  );
}

export default function DesktopSidebar({
  siteName,
  items,
  activePath,
  onNavigate,
  onReorder,
}: DesktopSidebarProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => item.href === active.id);
    const to = items.findIndex((item) => item.href === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to).map((item) => item.href));
  };

  return (
    <aside
      aria-label='侧边导航'
      className='desktop-sidebar fixed inset-y-0 left-0 z-50 hidden w-[var(--sidebar-width)] flex-col border-r border-gray-200/70 bg-white/95 backdrop-blur-xl md:flex dark:border-gray-800 dark:bg-gray-900/95'
    >
      <div className='flex min-h-[var(--nav-h)] shrink-0 items-center border-b border-gray-200/50 px-6 dark:border-gray-800'>
        <Link
          href='/'
          onClick={() => {
            if (activePath !== '/') onNavigate('/');
          }}
          className='truncate rounded text-xl font-bold tracking-tight text-green-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-green-500 dark:text-green-400'
          title={siteName}
        >
          {siteName}
        </Link>
      </div>
      <nav
        aria-label='主要分类导航'
        className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-5'
      >
        <DndContext
          id='desktop-navigation'
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((item) => item.href)}
            strategy={verticalListSortingStrategy}
          >
            <ul className='space-y-1'>
              {items.map((item) => (
                <SortableSidebarItem
                  key={item.href}
                  item={item}
                  active={isSidebarItemActive(item, activePath)}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </nav>
    </aside>
  );
}
