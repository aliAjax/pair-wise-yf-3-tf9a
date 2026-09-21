import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  BlindDraft,
  BlindRound,
  Confidence,
} from '../utils/blindTest';
import type { SmellType } from '../utils/constants';

interface BlindTestStore {
  /** memoryId -> 未提交作答，跨刷新保留 */
  drafts: Record<string, BlindDraft>;
  /** 已提交（锁定）的历轮结果 */
  rounds: BlindRound[];
  /** 用户点过「再来一组」的轮次：结果仍在统计中，但当前对照台回到作答态 */
  dismissedRoundIds: string[];

  setGuess: (memoryId: string, guess: SmellType) => void;
  setConfidence: (memoryId: string, confidence: Confidence) => void;
  /** trio 变化时清掉已不在台上的旧草稿（原序草稿按 id 保留） */
  pruneDrafts: (validIds: string[]) => void;
  clearDrafts: (ids: string[]) => void;
  addRound: (round: BlindRound) => void;
  dismissRound: (roundId: string) => void;
}

export const useBlindTestStore = create<BlindTestStore>()(
  persist(
    (set) => ({
      drafts: {},
      rounds: [],
      dismissedRoundIds: [],

      setGuess: (memoryId, guess) =>
        set((s) => ({
          drafts: {
            ...s.drafts,
            [memoryId]: {
              guess,
              confidence: s.drafts[memoryId]?.confidence ?? '',
            },
          },
        })),

      setConfidence: (memoryId, confidence) =>
        set((s) => ({
          drafts: {
            ...s.drafts,
            [memoryId]: {
              guess: s.drafts[memoryId]?.guess ?? '',
              confidence,
            },
          },
        })),

      pruneDrafts: (validIds) =>
        set((s) => {
          const next: Record<string, BlindDraft> = {};
          for (const id of validIds) {
            if (s.drafts[id]) next[id] = s.drafts[id];
          }
          return { drafts: next };
        }),

      clearDrafts: (ids) =>
        set((s) => {
          const next = { ...s.drafts };
          for (const id of ids) delete next[id];
          return { drafts: next };
        }),

      addRound: (round) => set((s) => ({ rounds: [...s.rounds, round] })),

      dismissRound: (roundId) =>
        set((s) =>
          s.dismissedRoundIds.includes(roundId)
            ? s
            : { dismissedRoundIds: [...s.dismissedRoundIds, roundId] },
        ),
    }),
    {
      name: 'scent-blind-test-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
