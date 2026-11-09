// 旧版课堂视频页状态：只接 Canvas 课程 + 旧版云录播（LTI），与新版 v.sjtu 完全独立。
// 打开页面只读本地 Canvas 课程缓存；选中课程后才向旧系统拉录像。
import { create } from 'zustand';
import { showToast } from '../../app/toasts';
import { compareCanvasTerms, type CanvasCourse } from '../../../shared/canvas';
import type {
  ClassroomVideo,
  VideoCourse,
  VideoDownload,
  VideoStream,
  VideoTerm,
} from '../../../shared/vsjtu';
import { errorText, useWorkspaceStore } from '../../workspace/store';
import { lectureFileName } from '../classroom/player-format';

export type OldClassroomPhase = 'loading' | 'ready';

const TERM_STORAGE_KEY = 'dela.old-classroom.term';

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

function syntheticTermId(name: string): number {
  let hash = 5381;
  for (let index = 0; index < name.length; index++)
    hash = ((hash << 5) + hash + name.charCodeAt(index)) | 0;
  return -((Math.abs(hash) % 2_000_000_000) + 1);
}

function canvasCourses(): CanvasCourse[] {
  return useWorkspaceStore
    .getState()
    .canvas.courses.filter((course) => course.term && course.term !== '未标注学期');
}

function termsOf(courses: CanvasCourse[]): VideoTerm[] {
  return [...new Set(courses.map((course) => course.term))]
    .sort((a, b) => compareCanvasTerms(a, b))
    .map((name) => ({ id: syntheticTermId(name), name, current: false }));
}

function coursesOf(termName: string): VideoCourse[] {
  return canvasCourses()
    .filter((course) => course.term === termName)
    .map((course) => ({
      id: -course.id,
      code: course.code,
      name: course.name,
      oldCourseId: course.id,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

interface OldClassroomState {
  phase: OldClassroomPhase;
  terms: VideoTerm[];
  selectedTermId: number | null;
  courses: VideoCourse[];
  coursesLoading: boolean;
  videos: Record<number, ClassroomVideo[]>;
  videosLoading: Record<number, boolean>;
  videosError: Record<number, string>;
  /** 旧版录像 id → Canvas 课程 id。 */
  videoCourseIds: Record<number, number>;
  selectedCourseId: number | null;
  selectedVideoId: number | null;
  seekRequest: { videoId: number; seconds: number } | null;
  playbackTime: number;
  seekTo: (videoId: number, seconds: number) => void;
  streams: Record<number, VideoStream[]>;
  streamsLoading: number | null;
  streamsError: Record<number, string>;
  downloads: Record<string, VideoDownload>;
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  selectTerm: (termId: number) => void;
  selectCourse: (courseId: number) => void;
  ensureVideos: (courseId: number) => Promise<void>;
  selectVideo: (courseId: number, videoId: number) => void;
  ensureStreams: (videoId: number) => Promise<VideoStream[] | null>;
  download: (courseName: string, video: ClassroomVideo, view: number) => Promise<void>;
  cancelDownload: (id: string) => void;
  revealDownload: (id: string) => void;
}

let videosRequest = 0;
let streamsRequest = 0;
let downloadSubscribed = false;

export const useOldClassroom = create<OldClassroomState>((set, get) => ({
  phase: 'loading',
  terms: [],
  selectedTermId: null,
  courses: [],
  coursesLoading: false,
  videos: {},
  videosLoading: {},
  videosError: {},
  videoCourseIds: {},
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
    await get().refresh();
  },

  refresh: async () => {
    const all = canvasCourses();
    const terms = termsOf(all);
    const remembered = rememberedTermId();
    const selected = terms.find((term) => term.id === remembered) ?? terms[0] ?? null;
    if (!selected) {
      set({
        phase: 'ready',
        terms,
        selectedTermId: null,
        courses: [],
        coursesLoading: false,
        selectedCourseId: null,
        selectedVideoId: null,
      });
      return;
    }
    rememberTerm(selected.id);
    const courses = coursesOf(selected.name);
    set({
      phase: 'ready',
      terms,
      selectedTermId: selected.id,
      courses,
      coursesLoading: false,
    });
    const target = courses[0]?.id ?? null;
    if (target === null) set({ selectedCourseId: null, selectedVideoId: null });
    else get().selectCourse(target);
  },

  selectTerm: (termId) => {
    if (get().selectedTermId === termId) return;
    const term = get().terms.find((item) => item.id === termId);
    if (!term) return;
    rememberTerm(termId);
    videosRequest++;
    streamsRequest++;
    const courses = coursesOf(term.name);
    set({
      selectedTermId: termId,
      courses,
      coursesLoading: false,
      videos: {},
      videosLoading: {},
      videosError: {},
      videoCourseIds: {},
      streams: {},
      streamsLoading: null,
      streamsError: {},
      selectedCourseId: null,
      selectedVideoId: null,
      seekRequest: null,
      playbackTime: 0,
    });
    const target = courses[0]?.id ?? null;
    if (target !== null) get().selectCourse(target);
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
    const course = get().courses.find((item) => item.id === courseId);
    const canvasCourseId = course?.oldCourseId ?? (courseId < 0 ? -courseId : null);
    if (!canvasCourseId) return;
    const request = videosRequest;
    set({
      videosLoading: { ...get().videosLoading, [courseId]: true },
      videosError: { ...get().videosError, [courseId]: '' },
    });
    try {
      const videos = await window.dela!.vsjtu.oldVideos(canvasCourseId);
      if (request !== videosRequest) return;
      const videoCourseIds = { ...get().videoCourseIds };
      for (const video of videos) videoCourseIds[video.id] = canvasCourseId;
      set({
        videos: { ...get().videos, [courseId]: videos },
        videoCourseIds,
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
      const canvasCourseId = get().videoCourseIds[videoId];
      if (!canvasCourseId) throw new Error('旧版录像缺少课程信息，请重新选择课程');
      const streams = await window.dela!.vsjtu.oldStreams(canvasCourseId, videoId);
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
      const canvasCourseId = get().videoCourseIds[video.id];
      if (!canvasCourseId) throw new Error('旧版录像缺少课程信息，请重新选择课程');
      await window.dela!.vsjtu.downloadOld(
        canvasCourseId,
        video.id,
        view,
        lectureFileName(courseName, video),
      );
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

function subscribeDownloads(
  set: (partial: Partial<OldClassroomState>) => void,
  get: () => OldClassroomState,
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
