// 新版课堂视频页状态：只接 v.sjtu，按学期浏览课程/录像/画面 + 下载任务镜像。
// 学期/课程/录像数据只经 window.dela.vsjtu 进入；请求守卫丢弃过期响应。
import { create } from 'zustand';
import { showToast } from '../../app/toasts';
import type {
  ClassroomVideo,
  VideoCourse,
  VideoDownload,
  VideoStream,
  VideoTerm,
} from '../../../shared/vsjtu';
import { errorText } from '../../workspace/store';
import { lectureFileName } from './player-format';

export type ClassroomPhase = 'loading' | 'connect' | 'ready';

/** 上次选中的学期：只影响默认选中，不触发其他学期的查询。 */
const TERM_STORAGE_KEY = 'dela.classroom.term';

function rememberedTermId(): number | null {
  try {
    const value = Number(localStorage.getItem(TERM_STORAGE_KEY));
    return Number.isInteger(value) && value !== 0 ? value : null;
  } catch {
    return null;
  }
}

function rememberTerm(id: number): void {
  try {
    localStorage.setItem(TERM_STORAGE_KEY, String(id));
  } catch {
    /* localStorage 不可用时只影响默认选中 */
  }
}

interface ClassroomState {
  phase: ClassroomPhase;
  connectBusy: boolean;
  terms: VideoTerm[];
  selectedTermId: number | null;
  courses: VideoCourse[];
  coursesLoading: boolean;
  videos: Record<number, ClassroomVideo[]>;
  videosLoading: Record<number, boolean>;
  videosError: Record<number, string>;
  selectedCourseId: number | null;
  selectedVideoId: number | null;
  seekRequest: { videoId: number; seconds: number } | null;
  playbackTime: number;
  seekTo: (videoId: number, seconds: number) => void;
  streams: Record<number, VideoStream[]>;
  /** 正在加载画面列表的 videoId（同时只有一个在途）。 */
  streamsLoading: number | null;
  streamsError: Record<number, string>;
  downloads: Record<string, VideoDownload>;
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  connect: () => Promise<void>;
  selectTerm: (termId: number) => void;
  selectCourse: (courseId: number) => void;
  ensureVideos: (courseId: number) => Promise<void>;
  selectVideo: (courseId: number, videoId: number) => void;
  ensureStreams: (videoId: number) => Promise<VideoStream[] | null>;
  download: (courseName: string, video: ClassroomVideo, view: number) => Promise<void>;
  cancelDownload: (id: string) => void;
  revealDownload: (id: string) => void;
}

let coursesRequest = 0;
let videosRequest = 0;
let streamsRequest = 0;
let downloadSubscribed = false;

export const useClassroom = create<ClassroomState>((set, get) => ({
  phase: 'loading',
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
  seekRequest: null,
  playbackTime: 0,
  seekTo: (videoId, seconds) => {
    if (get().selectedVideoId === videoId && Number.isFinite(seconds) && seconds >= 0)
      set({ seekRequest: { videoId, seconds } });
  },
  streams: {},
  streamsLoading: null,
  streamsError: {},
  downloads: {},

  init: async () => {
    subscribeDownloads(set, get);
    if (get().courses.length > 0) {
      set({ phase: 'ready' });
      return;
    }
    await get().refresh();
  },

  refresh: async () => {
    const request = ++coursesRequest;
    set({ coursesLoading: true });
    try {
      const terms = await window.dela!.vsjtu.listTerms();
      if (request !== coursesRequest) return;
      const remembered = rememberedTermId();
      const selected =
        terms.find((term) => term.id === remembered) ??
        terms.find((term) => term.current) ??
        terms[0];
      if (!selected) {
        set({ phase: 'ready', terms, selectedTermId: null, courses: [], coursesLoading: false });
        set({ selectedCourseId: null, selectedVideoId: null });
        return;
      }
      rememberTerm(selected.id);
      const courses = await window.dela!.vsjtu.listCourses(selected.id);
      if (request !== coursesRequest) return;
      set({
        phase: 'ready',
        terms,
        selectedTermId: selected.id,
        courses,
        coursesLoading: false,
      });
      const { selectedCourseId } = get();
      const target = courses.some((course) => course.id === selectedCourseId)
        ? selectedCourseId
        : (courses[0]?.id ?? null);
      if (target === null) {
        set({ selectedCourseId: null, selectedVideoId: null });
        return;
      }
      get().selectCourse(target);
    } catch (error) {
      if (request !== coursesRequest) return;
      set(
        get().courses.length === 0
          ? { phase: 'connect', coursesLoading: false }
          : { coursesLoading: false },
      );
      showToast({ variant: 'error', title: '课程加载失败', description: errorText(error) });
    }
  },

  connect: async () => {
    set({ connectBusy: true });
    try {
      const result = await window.dela!.vsjtu.connect();
      if (!result.ok) {
        set({ connectBusy: false });
        showToast({ variant: 'error', title: '登录未完成', description: result.error });
        return;
      }
    } catch (error) {
      set({ connectBusy: false });
      showToast({ variant: 'error', title: '登录未完成', description: errorText(error) });
      return;
    }
    videosRequest++;
    streamsRequest++;
    set({
      connectBusy: false,
      terms: [],
      selectedTermId: null,
      courses: [],
      videos: {},
      videosLoading: {},
      videosError: {},
      streams: {},
      streamsLoading: null,
      streamsError: {},
      selectedCourseId: null,
      selectedVideoId: null,
    });
    await get().refresh();
  },

  selectTerm: (termId) => {
    if (get().selectedTermId === termId) return;
    const term = get().terms.find((item) => item.id === termId);
    if (!term) return;
    rememberTerm(termId);
    const request = ++coursesRequest;
    videosRequest++;
    streamsRequest++;
    set({
      selectedTermId: termId,
      courses: [],
      coursesLoading: true,
      videos: {},
      videosLoading: {},
      videosError: {},
      streams: {},
      streamsLoading: null,
      streamsError: {},
      selectedCourseId: null,
      selectedVideoId: null,
      seekRequest: null,
      playbackTime: 0,
    });
    void (async () => {
      try {
        const courses = await window.dela!.vsjtu.listCourses(termId);
        if (request !== coursesRequest) return;
        set({ courses, coursesLoading: false });
        const target = courses[0]?.id ?? null;
        if (target === null) set({ selectedCourseId: null, selectedVideoId: null });
        else get().selectCourse(target);
      } catch (error) {
        if (request !== coursesRequest) return;
        set({ coursesLoading: false });
        showToast({ variant: 'error', title: '课程加载失败', description: errorText(error) });
      }
    })();
  },

  selectCourse: (courseId) => {
    if (get().selectedCourseId !== courseId)
      set({
        selectedCourseId: courseId,
        selectedVideoId: null,
        seekRequest: null,
        playbackTime: 0,
      });
    void get().ensureVideos(courseId);
  },

  ensureVideos: async (courseId) => {
    if (get().videos[courseId] || get().videosLoading[courseId]) return;
    const request = videosRequest;
    set({
      videosLoading: { ...get().videosLoading, [courseId]: true },
      videosError: { ...get().videosError, [courseId]: '' },
    });
    try {
      const videos = await window.dela!.vsjtu.listVideos(courseId);
      if (request !== videosRequest) return;
      set({
        videos: { ...get().videos, [courseId]: videos },
        videosLoading: { ...get().videosLoading, [courseId]: false },
      });
    } catch (error) {
      if (request !== videosRequest) return;
      set({
        videosLoading: { ...get().videosLoading, [courseId]: false },
        videosError: { ...get().videosError, [courseId]: errorText(error) },
      });
    }
  },

  selectVideo: (courseId, videoId) => {
    set({
      selectedCourseId: courseId,
      selectedVideoId: videoId,
      seekRequest: null,
      playbackTime: 0,
    });
    void get().ensureStreams(videoId);
  },

  ensureStreams: async (videoId) => {
    const cached = get().streams[videoId];
    if (cached) return cached;
    const request = ++streamsRequest;
    set({
      streamsLoading: videoId,
      streamsError: { ...get().streamsError, [videoId]: '' },
    });
    try {
      const streams = await window.dela!.vsjtu.streams(videoId);
      if (request !== streamsRequest) return get().streams[videoId] ?? null;
      set({ streams: { ...get().streams, [videoId]: streams }, streamsLoading: null });
      return streams;
    } catch (error) {
      if (request !== streamsRequest) return null;
      set({
        streamsLoading: null,
        streamsError: { ...get().streamsError, [videoId]: errorText(error) },
      });
      return null;
    }
  },

  download: async (courseName, video, view) => {
    try {
      await window.dela!.vsjtu.download(video.id, view, lectureFileName(courseName, video));
    } catch (error) {
      showToast({ variant: 'error', title: '下载启动失败', description: errorText(error) });
    }
  },

  cancelDownload: (id) => {
    void window.dela!.vsjtu.cancelDownload(id).catch(() => {});
  },

  revealDownload: (id) => {
    void window.dela!.vsjtu.revealDownload(id).catch(() => {});
  },
}));

/** 订阅下载进度并拉取本次运行已存在的任务；整个应用只订阅一次。 */
function subscribeDownloads(
  set: (partial: Partial<ClassroomState>) => void,
  get: () => ClassroomState,
): void {
  if (downloadSubscribed) return;
  downloadSubscribed = true;
  void window
    .dela!.vsjtu.downloads()
    .then((list) => {
      set({ downloads: Object.fromEntries(list.map((download) => [download.id, download])) });
    })
    .catch(() => {});
  window.dela!.vsjtu.onDownload((info) => {
    const previous = get().downloads[info.id];
    if (info.state !== previous?.state) {
      if (info.state === 'completed')
        showToast({ variant: 'success', title: '下载完成', description: info.name });
      else if (info.state === 'interrupted')
        showToast({ variant: 'error', title: '下载中断', description: `${info.name}，请重新下载` });
    }
    set({ downloads: { ...get().downloads, [info.id]: info } });
  });
}
