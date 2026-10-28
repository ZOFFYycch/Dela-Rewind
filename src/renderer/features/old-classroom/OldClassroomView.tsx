import { useEffect, useState } from 'react';
import { MonitorPlay, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { DesktopOnlyNotice } from '../../components/ui/desktop-only-notice';
import { PanelToggleButton } from '../../components/ui/panel-toggle';
import { Resizer } from '../../components/ui/resizer';
import { useViewportWidth } from '../../workbench/explorer-state';
import { cn } from '../../lib/utils';
import { useExperimental, useExperimentEnabled } from '../settings/experimental';
import { CourseList, CoursePicker } from './CourseList';
import { DownloadsPanel } from '../classroom/DownloadsPanel';
import { Player } from './Player';
import { useOldClassroom } from './store';
import { useWorkspaceStore } from '../../workspace/store';

export function OldClassroomView() {
  if (!window.dela) {
    return (
      <DesktopOnlyNotice
        description="旧版云录播的 LTI 启动与签名媒体地址只在主进程保存和使用，不会暴露给浏览器。"
        title="旧版课堂视频仅在 Dela 桌面端可用"
      />
    );
  }
  return <DesktopOldClassroomView />;
}

const SIDEBAR_DEFAULT_WIDTH = 300;
const SIDEBAR_MIN_WIDTH = 240;
const SIDEBAR_MAX_WIDTH = 360;
const widthStorageKey = 'dela.old-classroom.sidebarWidth';
const collapsedStorageKey = 'dela.old-classroom.sidebarCollapsed';

function DesktopOldClassroomView() {
  const phase = useOldClassroom((state) => state.phase);
  const coursesLoading = useOldClassroom((state) => state.coursesLoading);
  const init = useOldClassroom((state) => state.init);
  const refresh = useOldClassroom((state) => state.refresh);
  const canvasConnected = useWorkspaceStore((state) => state.canvas.connected);
  const canvasCourseCount = useWorkspaceStore((state) => state.canvas.courses.length);
  // 观看是常规功能；下载面板与下载按钮只在试验子项「课堂视频下载」开启时出现。
  const downloadEnabled = useExperimentEnabled('videoDownload');

  const [width, setWidth] = useState(() => {
    const stored = Number(localStorage.getItem(widthStorageKey));
    return Number.isFinite(stored) && stored >= SIDEBAR_MIN_WIDTH && stored <= SIDEBAR_MAX_WIDTH
      ? stored
      : SIDEBAR_DEFAULT_WIDTH;
  });
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(collapsedStorageKey) === '1',
  );
  const [resizing, setResizing] = useState(false);
  const viewportWidth = useViewportWidth();

  useEffect(() => {
    void init();
    void useExperimental.getState().load();
  }, [init]);

  // 宽度偏好防抖落盘；渲染宽度对窄视口钳制（与资料侧栏同款）。
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(widthStorageKey, String(width));
      } catch {
        /* localStorage 不可用时保持内存值。 */
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [width]);

  const toggleSidebar = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(collapsedStorageKey, value ? '0' : '1');
      } catch {
        /* 只影响下次启动的初始态。 */
      }
      return !value;
    });
  };

  // 视口钳制：目录渲染宽度不超过视口约 30%（下限 240），偏好值仍按原值持久化。
  const effectiveWidth = Math.min(width, Math.max(240, Math.round(viewportWidth * 0.3)));

  return (
    <div className="flex h-full min-h-0 bg-surface">
      {phase === 'loading' && (
        <div className="grid h-full flex-1 place-items-center text-13 text-ink-3">
          正在读取旧版课堂视频…
        </div>
      )}
      {phase === 'ready' && !canvasConnected && <CanvasHint />}
      {phase === 'ready' && canvasConnected && canvasCourseCount === 0 && <CanvasDataHint />}
      {phase === 'ready' && canvasConnected && canvasCourseCount > 0 && (
        <>
          <aside
            aria-label="课程与录像"
            className={cn(
              'flex min-h-0 shrink-0 flex-col overflow-hidden bg-inset transition-[width] duration-150 ease-out motion-reduce:transition-none',
              resizing && 'transition-none',
              collapsed && 'w-0',
            )}
            style={collapsed ? undefined : { width: effectiveWidth }}
          >
            <div
              className={cn(
                // 壳动内容不动：折叠动画中内容保持展开宽度、被外壳裁切并淡出。
                'flex min-h-0 flex-1 flex-col transition-opacity duration-150 motion-reduce:transition-none',
                collapsed && 'pointer-events-none opacity-0',
              )}
              style={collapsed ? undefined : { width: effectiveWidth }}
            >
              <div className="flex h-10 shrink-0 items-center gap-1 px-2">
                <PanelToggleButton
                  collapsed={collapsed}
                  controlsId="old-classroom-courses"
                  label="课程列表"
                  onToggle={toggleSidebar}
                />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink-2">
                  旧版课堂视频
                </span>
                <div className="flex shrink-0 items-center gap-0.5">
                  {downloadEnabled && <DownloadsPanel />}
                  <Button
                    aria-label="刷新课程"
                    className="hover:bg-hover-2"
                    disabled={coursesLoading}
                    onClick={() => void refresh()}
                    size="icon-xs"
                    title="刷新"
                    variant="ghost"
                  >
                    <RefreshCw className={cn('size-4', coursesLoading && 'animate-spin')} />
                  </Button>
                </div>
              </div>
              <CoursePicker />
              <div className="flex min-h-0 flex-1 flex-col" id="old-classroom-courses">
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <CourseList />
                </div>
              </div>
            </div>
          </aside>
          {!collapsed && (
            <Resizer
              className={cn('bg-transparent', collapsed && 'hidden')}
              label="调整课程列表宽度"
              max={SIDEBAR_MAX_WIDTH}
              min={SIDEBAR_MIN_WIDTH}
              onChange={setWidth}
              onResizingChange={setResizing}
              value={width}
            />
          )}
          <PlayerSection collapsed={collapsed} onExpandSidebar={toggleSidebar} />
        </>
      )}
    </div>
  );
}

function PlayerSection({
  collapsed,
  onExpandSidebar,
}: {
  collapsed: boolean;
  onExpandSidebar: () => void;
}) {
  const course = useOldClassroom((state) =>
    state.courses.find((value) => value.id === state.selectedCourseId),
  );
  const video = useOldClassroom((state) =>
    state.videos[state.selectedCourseId ?? -1]?.find((value) => value.id === state.selectedVideoId),
  );

  if (!course || !video) {
    return (
      <section className="relative grid min-w-0 flex-1 place-items-center">
        {collapsed && (
          <div className="absolute left-2 top-2">
            <PanelToggleButton collapsed label="课程列表" onToggle={onExpandSidebar} />
          </div>
        )}
        <div className="flex flex-col items-center gap-2 text-13 text-ink-3">
          <MonitorPlay aria-hidden className="size-7 opacity-45" />
          <p>从左侧选择一场录像开始观看</p>
          <p className="text-xs text-ink-3/80">支持跳转、拖拽进度、音量与倍速，也可下载</p>
        </div>
      </section>
    );
  }
  // key 随场次变化：换场次重挂播放器，内部播放态全部重置。
  return (
    <section className="min-w-0 flex-1" key={video.id}>
      <Player
        collapsedSidebar={collapsed}
        course={course}
        onExpandSidebar={onExpandSidebar}
        video={video}
      />
    </section>
  );
}

function CanvasDataHint() {
  return (
    <div className="grid flex-1 place-items-center p-6">
      <section className="grid w-full max-w-[30rem] justify-items-start gap-3 rounded-card border border-line bg-surface p-6 shadow-hairline">
        <div className="grid size-10 place-items-center rounded-card bg-hover-2">
          <MonitorPlay className="size-5" />
        </div>
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold tracking-tight">还没有 Canvas 课程</h2>
          <p className="text-13 leading-relaxed text-ink-3">
            旧版课堂视频复用资料页的 Canvas 课程数据。请先打开「资料」页刷新/同步一次课程，
            再回到这里。
          </p>
        </div>
      </section>
    </div>
  );
}

function CanvasHint() {
  return (
    <div className="grid flex-1 place-items-center p-6">
      <section className="grid w-full max-w-[30rem] justify-items-start gap-3 rounded-card border border-line bg-surface p-6 shadow-hairline">
        <div className="grid size-10 place-items-center rounded-card bg-hover-2">
          <MonitorPlay className="size-5" />
        </div>
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold tracking-tight">先连接 Canvas</h2>
          <p className="text-13 leading-relaxed text-ink-3">
            旧版课堂视频按 Canvas 课程组织，需要先连接 Canvas 令牌；连接后这里会列出 Canvas
            的全部学期与课程。
          </p>
        </div>
      </section>
    </div>
  );
}
