import { useEffect, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from './ui/button';
import { PanelToggleButton } from './ui/panel-toggle';
import { Resizer } from './ui/resizer';
import { cn } from '../lib/utils';

export interface LevelNavItem<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
}

const DEFAULT_WIDTH = 200;
const MIN_WIDTH = 200;
const MAX_WIDTH = 360;

/**
 * 可递归的页面层级壳：顶部栏与左栏同色成一体，右侧内容为圆角区域。
 * 左栏收起后导航图标进入顶部栏；每层独立收起、独立宽度。
 */
export function LevelShell<T extends string>({
  title,
  icon: LevelIcon,
  items,
  active,
  onSelect,
  storageKey,
  children,
}: {
  title: string;
  icon: LucideIcon;
  items: LevelNavItem<T>[];
  active: T;
  onSelect: (id: T) => void;
  storageKey: string;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(storageKey) === '1');
  const [width, setWidth] = useState(() => {
    const stored = Number(localStorage.getItem(`${storageKey}.width`));
    return Number.isFinite(stored) && stored >= MIN_WIDTH && stored <= MAX_WIDTH
      ? stored
      : DEFAULT_WIDTH;
  });
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, collapsed ? '1' : '0');
    } catch {
      /* localStorage 不可用时只影响下次启动的初始态 */
    }
  }, [collapsed, storageKey]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(`${storageKey}.width`, String(width));
      } catch {
        /* 只影响下次启动的宽度 */
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [storageKey, width]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-page">
      <div className="flex h-10 shrink-0 items-center gap-1 px-2">
        <PanelToggleButton
          collapsed={collapsed}
          controlsId={storageKey}
          label={title}
          onToggle={() => setCollapsed((value) => !value)}
        />
        <LevelIcon className="ml-1 size-4 shrink-0 text-ink-2" />
        <span className="min-w-0 truncate text-xs font-medium text-ink-2">{title}</span>
        {collapsed && (
          <div className="ml-2 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  aria-current={active === item.id ? 'page' : undefined}
                  aria-label={item.label}
                  className={cn('shrink-0', active === item.id && 'bg-hover-2 text-ink')}
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  size="icon-xs"
                  title={item.label}
                  variant="ghost"
                >
                  <Icon className="size-4" />
                </Button>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex min-h-0 flex-1">
        <div
          className={cn(
            'shrink-0 overflow-hidden transition-[width] duration-200 ease-(--ease-out-strong) motion-reduce:transition-none',
            resizing && 'transition-none',
          )}
          id={storageKey}
          style={{ width: collapsed ? 0 : width }}
        >
          <aside className="flex h-full flex-col p-2" style={{ width }}>
            <nav className="flex flex-col gap-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    aria-current={active === item.id ? 'page' : undefined}
                    className={cn(
                      'flex h-9 items-center gap-2 rounded-control px-2 text-left text-13 text-ink-2 transition-colors hover:bg-hover-2 hover:text-ink',
                      active === item.id && 'bg-hover-2 font-medium text-ink',
                    )}
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                    type="button"
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
        {!collapsed && (
          <Resizer
            className="bg-transparent"
            label={`调整${title}宽度`}
            max={MAX_WIDTH}
            min={MIN_WIDTH}
            onChange={setWidth}
            onResizingChange={setResizing}
            value={width}
          />
        )}
        <div className="mt-1 mr-1.5 min-w-0 flex-1">
          <div className="h-full min-h-0 overflow-hidden rounded-t-window bg-surface shadow-hairline">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
