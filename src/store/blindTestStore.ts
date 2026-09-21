import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SmellMemory, SmellType } from '../utils/constants';
import {
  type BlindRound,
  type Confidence,
  createBlindRound,
  detectIntegrityIssue,
  emptyGuess,
  isRoundComplete,
} from '../utils/blindTest';

export interface BlindStats {
  /** 完成并仍有效的局数 */
  playedRounds: number;
  /** 有效局的累计命中数 */
  totalHits: number;
  /** 因档案变动作废的局数 */
  voidedRounds: number;
}

interface BlindStore {
  round: BlindRound | null;
  stats: BlindStats;
  startRound: (memories: SmellMemory[]) => void;
  setGuess: (id: string, patch: Partial<{ smell_type: SmellType | ''; confidence: Confidence | '' }>) => void;
  submit: (memories: SmellMemory[]) => void;
  /**
   * 与档案数据同步：
   * - 答题中的候选被移除 / 改类型 / 改意向 → 立即重选开局
   * - 已锁定结果被波及 → 立即作废并移出统计
   */
  syncWithMemories: (memories: SmellMemory[]) => void;
}

const initialStats: BlindStats = {
  playedRounds: 0,
  totalHits: 0,
  voidedRounds: 0,
};

export const useBlindStore = create<BlindStore>()(
  persist(
    (set, get) => ({
      round: null,
      stats: initialStats,

      startRound: (memories) => {
        const fresh = createBlindRound(memories);
        set({ round: fresh });
      },

      setGuess: (id, patch) => {
        const round = get().round;
        if (!round || round.status !== 'answering') return;
        set({
          round: {
            ...round,
            guesses: {
              ...round.guesses,
              [id]: { ...(round.guesses[id] ?? emptyGuess()), ...patch },
            },
          },
        });
      },

      submit: (memories) => {
        const round = get().round;
        if (!round || round.status !== 'answering') return;
        // 提交前再稽核一次：任一缺失不能提交，候选被动过也不能锁定
        if (!isRoundComplete(round)) return;
        if (detectIntegrityIssue(round, memories)) {
          const fresh = createBlindRound(memories);
          set({ round: fresh });
          return;
        }
        // 锁定瞬间记下谜底与命中数，此后结果与统计只认快照
        const answers = round.ids.map((id) => {
          const mem = memories.find((m) => m.id === id)!;
          return { id, smell_type: mem.smell_type };
        });
        const locked: BlindRound = {
          ...round,
          answers,
          status: 'locked',
          lockedAt: new Date().toISOString(),
          hits: answers.reduce((acc, a) => {
            const g = round.guesses[a.id];
            return g && g.smell_type === a.smell_type ? acc + 1 : acc;
          }, 0),
        };
        set({
          round: locked,
          stats: {
            ...get().stats,
            playedRounds: get().stats.playedRounds + 1,
            totalHits: get().stats.totalHits + locked.hits,
          },
        });
      },

      syncWithMemories: (memories) => {
        const round = get().round;
        if (!round || round.status === 'voided') return;

        const issue = detectIntegrityIssue(round, memories);
        if (!issue) return;

        if (round.status === 'locked') {
          // 已锁定的结果立即作废并移出统计
          set({
            round: {
              ...round,
              status: 'voided',
              voidReason: issue.reason,
              changedIds: issue.changedIds,
              voidedAt: new Date().toISOString(),
            },
            stats: {
              ...get().stats,
              // 移出统计：直接扣减锁定瞬间记录的命中数（此时档案可能已被删改）
              playedRounds: Math.max(0, get().stats.playedRounds - 1),
              totalHits: Math.max(0, get().stats.totalHits - round.hits),
              voidedRounds: get().stats.voidedRounds + 1,
            },
          });
          return;
        }

        // 答题中：原局直接废弃，按当前档案重新选样（原序作废重开）
        set({ round: createBlindRound(memories) });
      },
    }),
    {
      name: 'scent-blind-test-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
