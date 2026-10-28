// @vitest-environment jsdom
// 新版课堂视频：只接 v.sjtu，按学期加载；没有跨学期自动回看，也不合并旧版录像。
import { beforeEach, expect, it, vi } from 'vitest';
import type { ClassroomVideo, VsjtuApi } from '../../../shared/vsjtu';
import { useClassroom } from './store';

const toast = vi.hoisted(() => vi.fn());
vi.mock('../../app/toasts', () => ({ showToast: toast }));

const vsjtu = {
  connect: vi.fn(),
  listTerms: vi.fn(),
  listCourses: vi.fn(),
  listVideos: vi.fn(async (): Promise<ClassroomVideo[]> => []),
  oldVideos: vi.fn(async (): Promise<ClassroomVideo[]> => []),
  streams: vi.fn(async () => []),
  oldStreams: vi.fn(async () => []),
  transcript: vi.fn(async () => null),
  exportTranscript: vi.fn(async () => ({ saved: false })),
  download: vi.fn(async () => {}),
  downloadOld: vi.fn(async () => {}),
  downloads: vi.fn(async () => []),
  cancelDownload: vi.fn(async () => {}),
  revealDownload: vi.fn(async () => {}),
  getDownloadDirectory: vi.fn(async () => ''),
  chooseDownloadDirectory: vi.fn(async () => ''),
  onDownload: vi.fn(() => () => {}),
} satisfies VsjtuApi;

beforeEach(() => {
  toast.mockClear();
  localStorage.removeItem('dela.classroom.term');
  vsjtu.connect.mockReset();
  vsjtu.listTerms
    .mockReset()
    .mockResolvedValue([{ id: 11, name: '2026-2027 Fall', current: true }]);
  vsjtu.listCourses.mockReset();
  vsjtu.listVideos.mockReset().mockResolvedValue([]);
  vsjtu.streams.mockReset().mockResolvedValue([]);
  vsjtu.download.mockReset();
  window.dela = { vsjtu } as unknown as typeof window.dela;
  useClassroom.setState({
    phase: 'connect',
    connectBusy: false,
    terms: [],
    selectedTermId: null,
    courses: [],
    coursesLoading: false,
    videos: {},
    videosLoading: {},
    videosError: {},
    selectedCourseId: null,
    selectedVideoId: null,
  });
});

it('登录未完成或抛错时弹错误 toast 并解除 busy', async () => {
  vsjtu.connect.mockResolvedValueOnce({ ok: false, error: '官方窗口已关闭' });
  await useClassroom.getState().connect();
  expect(toast).toHaveBeenCalledWith({
    variant: 'error',
    title: '登录未完成',
    description: '官方窗口已关闭',
  });
  vsjtu.connect.mockRejectedValueOnce(new Error('IPC 不可用'));
  await useClassroom.getState().connect();
  expect(toast).toHaveBeenLastCalledWith({
    variant: 'error',
    title: '登录未完成',
    description: 'IPC 不可用',
  });
  expect(useClassroom.getState().connectBusy).toBe(false);
  expect(useClassroom.getState().phase).toBe('connect');
});

it('登录成功后先停在获取课程列表阶段，完成后进入就绪', async () => {
  vsjtu.connect.mockResolvedValue({ ok: true });
  let resolveCourses: (courses: { id: number; code: string; name: string }[]) => void;
  vsjtu.listCourses.mockImplementation(() => new Promise((resolve) => (resolveCourses = resolve)));
  const done = useClassroom.getState().connect();
  await vi.waitFor(() => expect(useClassroom.getState().coursesLoading).toBe(true));
  expect(useClassroom.getState().connectBusy).toBe(false);
  expect(useClassroom.getState().phase).toBe('connect');
  resolveCourses!([]);
  await done;
  expect(useClassroom.getState().phase).toBe('ready');
  expect(useClassroom.getState().coursesLoading).toBe(false);
  expect(toast).not.toHaveBeenCalled();
});

it('启动只查当前学期，不会自动回看其他学期', async () => {
  vsjtu.listTerms.mockResolvedValue([
    { id: 11, name: '2026-2027 Fall', current: true },
    { id: 10, name: '2025-2026 Spring', current: false },
    { id: 9, name: '2025-2026 Fall', current: false },
  ]);
  vsjtu.listCourses.mockResolvedValue([]);
  useClassroom.setState({ phase: 'loading', courses: [], terms: [] });
  await useClassroom.getState().refresh();
  expect(vsjtu.listCourses.mock.calls.map(([termId]) => termId)).toEqual([11]);
  expect(useClassroom.getState().selectedTermId).toBe(11);
  expect(useClassroom.getState().courses).toEqual([]);
});

it('优先恢复上次选中的学期，只加载它', async () => {
  localStorage.setItem('dela.classroom.term', '10');
  vsjtu.listTerms.mockResolvedValue([
    { id: 11, name: '2026-2027 Fall', current: true },
    { id: 10, name: '2025-2026 Spring', current: false },
  ]);
  vsjtu.listCourses.mockResolvedValue([{ id: 1, code: 'ME', name: '毕业设计' }]);
  useClassroom.setState({ phase: 'loading', courses: [], terms: [] });
  await useClassroom.getState().refresh();
  expect(vsjtu.listCourses).toHaveBeenCalledTimes(1);
  expect(vsjtu.listCourses).toHaveBeenCalledWith(10);
  expect(useClassroom.getState()).toMatchObject({
    selectedTermId: 10,
    courses: [{ id: 1, code: 'ME', name: '毕业设计' }],
  });
});

it('手动切换学期只加载选中的学期', async () => {
  useClassroom.setState({
    phase: 'ready',
    terms: [
      { id: 11, name: '2026-2027 Fall', current: true },
      { id: 10, name: '2025-2026 Spring', current: false },
    ],
    selectedTermId: 11,
    courses: [{ id: 1, code: 'CS', name: '本学期课程' }],
    selectedCourseId: 1,
    selectedVideoId: 99,
  });
  vsjtu.listCourses.mockResolvedValue([{ id: 2, code: 'ME', name: '往期课程' }]);
  useClassroom.getState().selectTerm(10);
  await vi.waitFor(() =>
    expect(useClassroom.getState().courses).toEqual([{ id: 2, code: 'ME', name: '往期课程' }]),
  );
  expect(vsjtu.listCourses).toHaveBeenCalledTimes(1);
  expect(vsjtu.listCourses).toHaveBeenCalledWith(10);
  expect(localStorage.getItem('dela.classroom.term')).toBe('10');
});

it('成功空录像作为已加载结果保存，再次展开不重复请求', async () => {
  useClassroom.setState({ phase: 'ready', courses: [{ id: 1, code: 'CS', name: '课程一' }] });
  await useClassroom.getState().ensureVideos(1);
  await useClassroom.getState().ensureVideos(1);
  expect(useClassroom.getState()).toMatchObject({
    phase: 'ready',
    videos: { 1: [] },
    videosLoading: { 1: false },
    videosError: { 1: '' },
  });
  expect(vsjtu.listVideos).toHaveBeenCalledTimes(1);
  expect(toast).not.toHaveBeenCalled();
});

it('切换课程清空当前节次，交错完成的录像请求仍正确缓存且不自动播放', async () => {
  let first!: (videos: []) => void;
  vsjtu.listVideos.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        first = resolve;
      }),
  );
  useClassroom.setState({
    courses: [
      { id: 1, code: 'CS1', name: '课程一' },
      { id: 2, code: 'CS2', name: '课程二' },
      { id: 3, code: 'CS3', name: '课程三' },
    ],
    selectedCourseId: 1,
    selectedVideoId: 11,
  });
  useClassroom.getState().selectCourse(2);
  expect(useClassroom.getState().selectedVideoId).toBeNull();
  useClassroom.getState().selectCourse(3);
  await vi.waitFor(() => expect(useClassroom.getState().videos[3]).toEqual([]));
  first([]);
  await vi.waitFor(() => expect(useClassroom.getState().videosLoading[2]).toBe(false));
  expect(useClassroom.getState().selectedCourseId).toBe(3);
  useClassroom.getState().selectCourse(2);
  expect(vsjtu.listVideos).toHaveBeenCalledTimes(2);
});
