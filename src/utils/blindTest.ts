import type { SmellMemory, SmellType } from './constants';

/** 盲测信心等级 */
export type Confidence = 'high' | 'medium' | 'low';

/** answering: 答题中；locked: 已提交锁定；voided: 锁定后因档案变动作废 */
export type BlindStatus = 'answering' | 'locked' | 'voided';

/** 作废原因：记录被移除 / 类型被修改 / 「想再闻」意向被改变 */
export type VoidReason = 'deleted' | 'type-changed' | 'intent-changed';

export interface BlindGuess {
  smell_type: SmellType | '';
  confidence: Confidence | '';
}

export interface BlindSelection {
  id: string;
  smell_type: SmellType;
}

export interface BlindRound {
  /** 三张盲样对应的记忆 id，顺序即封存时间从早到晚，开局后不再变化 */
  ids: string[];
  /** 开局时的类型快照，用于答题阶段稽核候选是否被动过 */
  selections: BlindSelection[];
  startedAt: string;
  guesses: Record<string, BlindGuess>;
  status: BlindStatus;
  lockedAt: string | null;
  /** 锁定瞬间的类型快照，作为判定谜底，之后只认它 */
  answers: BlindSelection[];
  hits: number;
  voidReason: VoidReason | null;
  voidedAt: string | null;
  /** 触发作废的具体记录 id */
  changedIds: string[];
}

export const CONFIDENCE_LEVELS: { value: Confidence; label: string; emoji: string }[] = [
  { value: 'high', label: '很确定', emoji: '🎯' },
  { value: 'medium', label: '有点把握', emoji: '🍃' },
  { value: 'low', label: '全靠直觉', emoji: '🎲' },
];

/** 三个盲位的代号，仅用于顺序展示，不携带任何线索 */
export const BLIND_SLOT_NAMES = ['甲', '乙', '丙'];

export const VOID_REASON_TEXT: Record<VoidReason, string> = {
  deleted: '有盲样记录被移除',
  'type-changed': '有盲样记录的气味类型被修改',
  'intent-changed': '有盲样记录的「想再闻」意向被改变',
};

export function emptyGuess(): BlindGuess {
  return { smell_type: '', confidence: '' };
}

/** 进入候选池的唯一条件：标记了「想再次闻到」 */
export function isBlindEligible(m: SmellMemory): boolean {
  return m.want_again === true;
}

/**
 * 选样规则：在「想再闻」的记忆里，按封存时间从早到晚遍历，
 * 依次取出三种互不相同的气味类型，凑满三张为止。
 * 同时刻时以 id 兜底，保证顺序稳定。
 */
export function pickBlindCandidates(memories: SmellMemory[]): SmellMemory[] {
  const sorted = [...memories].sort((a, b) => {
    const byTime = a.created_at.localeCompare(b.created_at);
    if (byTime !== 0) return byTime;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const chosen: SmellMemory[] = [];
  const usedTypes = new Set<SmellType>();
  for (const m of sorted) {
    if (!isBlindEligible(m)) continue;
    if (usedTypes.has(m.smell_type)) continue;
    usedTypes.add(m.smell_type);
    chosen.push(m);
    if (chosen.length === 3) break;
  }
  return chosen;
}

export function isGuessComplete(g: BlindGuess | undefined): boolean {
  return !!g && g.smell_type !== '' && g.confidence !== '';
}

/** 提交前校验：三张卡的气味类型与信心等级缺一不可 */
export function isRoundComplete(round: BlindRound): boolean {
  return (
    round.ids.length === 3 &&
    round.ids.every((id) => isGuessComplete(round.guesses[id]))
  );
}

export function createBlindRound(memories: SmellMemory[]): BlindRound | null {
  const candidates = pickBlindCandidates(memories);
  if (candidates.length < 3) return null;
  return {
    ids: candidates.map((m) => m.id),
    selections: candidates.map((m) => ({ id: m.id, smell_type: m.smell_type })),
    startedAt: new Date().toISOString(),
    guesses: {},
    status: 'answering',
    lockedAt: null,
    answers: [],
    hits: 0,
    voidReason: null,
    voidedAt: null,
    changedIds: [],
  };
}

export interface IntegrityIssue {
  reason: VoidReason;
  changedIds: string[];
}

/**
 * 稽核当前局是否仍有效。
 * - 答题中：与开局快照比对（候选被删 / 改类型 / 取消想再闻 → 选样前提被破坏）
 * - 锁定后：与锁定瞬间的谜底比对（结果立即作废）
 * 优先级：移除 > 类型变更 > 意向变更。
 */
export function detectIntegrityIssue(
  round: Pick<BlindRound, 'selections' | 'answers' | 'status'>,
  memories: SmellMemory[],
): IntegrityIssue | null {
  const byId = new Map(memories.map((m) => [m.id, m]));
  const baseline = round.status === 'locked' ? round.answers : round.selections;

  const deleted: string[] = [];
  const typeChanged: string[] = [];
  const intentChanged: string[] = [];

  for (const base of baseline) {
    const m = byId.get(base.id);
    if (!m) {
      deleted.push(base.id);
      continue;
    }
    if (m.smell_type !== base.smell_type) typeChanged.push(base.id);
    if (!m.want_again) intentChanged.push(base.id);
  }

  if (deleted.length) return { reason: 'deleted', changedIds: deleted };
  if (typeChanged.length) return { reason: 'type-changed', changedIds: typeChanged };
  if (intentChanged.length) return { reason: 'intent-changed', changedIds: intentChanged };
  return null;
}

/** 命中数 = 猜测类型与谜底类型一致的张数（信心等级只记录，不计分） */
export function scoreRound(round: BlindRound, memories: SmellMemory[]): number {
  const byId = new Map(memories.map((m) => [m.id, m]));
  return round.ids.reduce((acc, id) => {
    const m = byId.get(id);
    const g = round.guesses[id];
    if (m && g && g.smell_type !== '' && m.smell_type === g.smell_type) {
      return acc + 1;
    }
    return acc;
  }, 0);
}
