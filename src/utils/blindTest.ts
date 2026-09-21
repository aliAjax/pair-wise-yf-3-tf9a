import type { SmellMemory, SmellType } from './constants';
import { generateId } from './helpers';

/** 盲测信心等级 */
export type Confidence = 'guess' | 'likely' | 'sure';

/** 每次对照的卡片数量：三人盲测 */
export const BLIND_CARD_COUNT = 3;

export const CONFIDENCE_LEVELS: { value: Confidence; label: string; emoji: string }[] = [
  { value: 'guess', label: '凭感觉', emoji: '🎲' },
  { value: 'likely', label: '比较确定', emoji: '🤔' },
  { value: 'sure', label: '非常确定', emoji: '🎯' },
];

export function getConfidenceInfo(c: Confidence) {
  return CONFIDENCE_LEVELS.find((x) => x.value === c)!;
}

/** 一张卡的未提交作答：气味类型与信心等级任一都可为空，二者齐备方可提交 */
export interface BlindDraft {
  guess: SmellType | '';
  confidence: Confidence | '';
}

export const EMPTY_DRAFT: BlindDraft = { guess: '', confidence: '' };

export function isDraftComplete(d: BlindDraft | undefined): boolean {
  return !!d && d.guess !== '' && d.confidence !== '';
}

export interface BlindAnswer {
  memoryId: string;
  guess: SmellType;
  confidence: Confidence;
  /** 提交当时的真实类型，供日后比对「是否改过类型」 */
  actualType: SmellType;
  /** 提交当时判定是否命中 */
  correct: boolean;
}

export interface BlindRound {
  id: string;
  submittedAt: string;
  /** 三张卡的记忆 id，顺序固定为封存时间从早到晚，永不重排 */
  trioIds: string[];
  answers: BlindAnswer[];
}

/** 作废原因：记录被移除 / 改了类型 / 改了意向（取消想再闻） */
export type VoidReason = 'removed' | 'typeChanged' | 'intentChanged';

export const VOID_REASON_LABELS: Record<VoidReason, string> = {
  removed: '记忆已删除',
  typeChanged: '类型已修改',
  intentChanged: '已取消想再闻',
};

/**
 * 筛选对照台用的三缕气味：
 * 1. 仅取「想再次闻到」的记忆；
 * 2. 每种气味类型只保留封存最早的一条（保证三条类型互不相同）；
 * 3. 按封存时间从早到晚取前三，顺序即展示顺序，不再变动。
 */
export function pickBlindTrio(memories: SmellMemory[]): SmellMemory[] {
  const chronological = memories
    .filter((m) => m.want_again)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const earliestByType = new Map<SmellType, SmellMemory>();
  for (const m of chronological) {
    if (!earliestByType.has(m.smell_type)) {
      earliestByType.set(m.smell_type, m);
    }
  }

  return [...earliestByType.values()]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, BLIND_CARD_COUNT);
}

/** 当前可参与对照的不同气味类型数（空状态提示用） */
export function countEligibleTypes(memories: SmellMemory[]): number {
  return new Set(memories.filter((m) => m.want_again).map((m) => m.smell_type)).size;
}

export function getAnswerVoidReason(
  answer: BlindAnswer,
  memory: SmellMemory | undefined,
): VoidReason | null {
  if (!memory) return 'removed';
  if (memory.smell_type !== answer.actualType) return 'typeChanged';
  if (!memory.want_again) return 'intentChanged';
  return null;
}

export interface RoundStatus {
  voided: boolean;
  /** memoryId -> 作废原因 */
  reasons: Record<string, VoidReason>;
}

export function getRoundStatus(round: BlindRound, memories: SmellMemory[]): RoundStatus {
  const byId = new Map(memories.map((m) => [m.id, m]));
  const reasons: Record<string, VoidReason> = {};
  for (const answer of round.answers) {
    const reason = getAnswerVoidReason(answer, byId.get(answer.memoryId));
    if (reason) reasons[answer.memoryId] = reason;
  }
  return { voided: Object.keys(reasons).length > 0, reasons };
}

export function sameTrio(idsA: string[], idsB: string[]): boolean {
  return idsA.length === idsB.length && idsA.every((id, i) => id === idsB[i]);
}

/** 由三张卡与当前作答构建一轮已提交结果 */
export function buildRound(
  trio: SmellMemory[],
  drafts: Record<string, BlindDraft>,
): BlindRound {
  const answers: BlindAnswer[] = trio.map((m) => {
    const draft = drafts[m.id];
    const guess = draft?.guess;
    const confidence = draft?.confidence;
    if (!guess || !confidence) {
      throw new Error('每张盲测卡都必须选择气味类型和信心等级');
    }
    return {
      memoryId: m.id,
      guess,
      confidence,
      actualType: m.smell_type,
      correct: guess === m.smell_type,
    };
  });

  return {
    id: generateId(),
    submittedAt: new Date().toISOString(),
    trioIds: trio.map((m) => m.id),
    answers,
  };
}

export interface BlindStats {
  /** 有效（未作废）轮次 */
  validRounds: number;
  /** 有效轮次中的作答题数 */
  totalAnswered: number;
  /** 有效轮次中的命中题数 */
  totalHits: number;
  /** 命中率 0~1 */
  hitRate: number;
}

/** 统计只计入有效轮次；被选记录删除、改类型或改意向的轮次立即移出统计 */
export function getBlindStats(rounds: BlindRound[], memories: SmellMemory[]): BlindStats {
  let validRounds = 0;
  let totalAnswered = 0;
  let totalHits = 0;

  for (const round of rounds) {
    if (getRoundStatus(round, memories).voided) continue;
    validRounds += 1;
    totalAnswered += round.answers.length;
    totalHits += round.answers.filter((a) => a.correct).length;
  }

  return {
    validRounds,
    totalAnswered,
    totalHits,
    hitRate: totalAnswered === 0 ? 0 : totalHits / totalAnswered,
  };
}
