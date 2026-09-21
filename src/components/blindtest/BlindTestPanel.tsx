import { useEffect, useMemo, useState } from 'react';
import { FlaskConical, Lock, RefreshCw, AlertTriangle, Target, ListChecks, Ban } from 'lucide-react';
import { useBlindStore } from '../../store/blindTestStore';
import { isBlindEligible, isRoundComplete, VOID_REASON_TEXT } from '../../utils/blindTest';
import type { SmellMemory } from '../../utils/constants';
import BlindTestCard from './BlindTestCard';

interface Props {
  memories: SmellMemory[];
}

export default function BlindTestPanel({ memories }: Props) {
  const round = useBlindStore((s) => s.round);
  const stats = useBlindStore((s) => s.stats);
  const startRound = useBlindStore((s) => s.startRound);
  const setGuess = useBlindStore((s) => s.setGuess);
  const submit = useBlindStore((s) => s.submit);
  const syncWithMemories = useBlindStore((s) => s.syncWithMemories);
  const [justStarted, setJustStarted] = useState(false);

  const eligibleCount = useMemo(
    () => memories.filter(isBlindEligible).length,
    [memories],
  );

  // 本地数据同步：记录被删 / 改类型 / 改意向时，立即重开或作废本次结果
  useEffect(() => {
    syncWithMemories(memories);
  }, [memories, syncWithMemories]);

  // 无局（或上一局作废后）且候选充足时自动开局；候选不足则等待
  useEffect(() => {
    if (!round || round.status === 'voided') {
      if (eligibleCount >= 3 && distinctTypes(memories) >= 3) {
        startRound(memories);
        setJustStarted(true);
      }
    }
  }, [round, eligibleCount, memories, startRound]);

  // 答题中候选前提被破坏（如仅剩不足 3 种类型）时，由 sync 重开；
  // 重开可能为 null（候选不足），此时展示空状态
  const memById = useMemo(() => new Map(memories.map((m) => [m.id, m])), [memories]);

  const enoughCandidates = eligibleCount >= 3 && distinctTypes(memories) >= 3;

  const complete = round ? isRoundComplete(round) : false;
  const answered =
    round?.ids.filter((id) => {
      const g = round.guesses[id];
      return g && g.smell_type !== '' && g.confidence !== '';
    }).length ?? 0;

  return (
    <section className="container max-w-6xl mb-8">
      <div className="bg-paper-50/70 backdrop-blur rounded-2xl border border-lavender-300/50 shadow-paper overflow-hidden">
        {/* 标题栏 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-5 py-4 border-b border-paper-200/80">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-lavender-300/30 border border-lavender-300/50 flex items-center justify-center text-lavender-600">
              <FlaskConical className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-hand text-2xl text-lavender-600 leading-none">三人盲测对照台</h2>
              <p className="text-xs text-ink-700/55 mt-1">
                三缕想再闻的气味，按封存时间从早到晚排列；类型、地点与来源已遮蔽，凭记忆文字与感官线索判断
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-moss-100 text-moss-600 text-xs font-semibold border border-moss-200">
              <Target className="w-3.5 h-3.5" />
              累计命中 {stats.totalHits}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-paper-200/80 text-ink-700/75 text-xs font-semibold border border-paper-300">
              <ListChecks className="w-3.5 h-3.5" />
              有效局 {stats.playedRounds}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brick-400/10 text-brick-600 text-xs font-semibold border border-brick-400/25">
              <Ban className="w-3.5 h-3.5" />
              作废 {stats.voidedRounds}
            </span>
          </div>
        </div>

        {/* 候选不足 */}
        {!enoughCandidates && (!round || round.status === 'voided') && (
          <div className="px-6 py-12 text-center">
            <div className="text-5xl mb-3 select-none opacity-70">🔍</div>
            <h3 className="font-serif text-xl text-ink-800 mb-2">暂时凑不齐三种气味</h3>
            <p className="text-sm text-ink-700/60 max-w-lg mx-auto">
              盲测需要 3 条标记了「想再闻」、且气味类型互不相同的记忆。
              当前符合条件的候选有 <b className="text-lavender-600">{eligibleCount}</b> 条，
              覆盖 <b className="text-lavender-600">{distinctTypes(memories)}</b> 种类型。
              去封存或编辑几篇档案后，这里会自动开局。
            </p>
          </div>
        )}

        {/* 作废横幅 */}
        {round?.status === 'voided' && (
          <div className="mx-5 mt-4 p-4 rounded-xl bg-brick-400/10 border border-brick-400/40 flex flex-col sm:flex-row sm:items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-brick-500 shrink-0" />
            <div className="flex-1 text-sm text-brick-600">
              <b>本次结果已作废并移出统计：</b>
              {VOID_REASON_TEXT[round.voidReason ?? 'deleted']}。
              盲测必须建立在未被改动的档案上，请用新的一轮重新验证嗅觉。
            </div>
            {enoughCandidates && (
              <button
                onClick={() => {
                  startRound(memories);
                  setJustStarted(true);
                }}
                className="btn-primary !py-2 !px-4 text-sm shrink-0"
              >
                <RefreshCw className="w-4 h-4" />
                开始新一局
              </button>
            )}
          </div>
        )}

        {/* 盲样卡：只要有局就展示；候选不足仅影响“下一局”的自动开局 */}
        {round && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
              {round.ids.map((id, i) => (
                <BlindTestCard
                  key={`${round.startedAt}-${id}`}
                  slotIndex={i}
                  memory={memById.get(id)}
                  round={round}
                  onSetGuess={setGuess}
                />
              ))}
            </div>

            {/* 底栏：提交 / 结果 */}
            {round.status === 'answering' ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-t border-paper-200/80 bg-paper-100/50">
                <p className="text-xs text-ink-700/55">
                  每张卡都必须选择气味类型和信心等级，已完成
                  <b className="text-lavender-600 mx-1">{answered}/3</b>
                  {justStarted && ' · 顺序自封存最早的一缕开始'}
                </p>
                <button
                  onClick={() => {
                    submit(memories);
                    setJustStarted(false);
                  }}
                  disabled={!complete}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium transition-all duration-200 ${
                    complete
                      ? 'bg-lavender-500 hover:bg-lavender-600 text-paper-50 shadow-paper hover:-translate-y-0.5'
                      : 'bg-paper-200/70 text-ink-700/40 cursor-not-allowed'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  {complete ? '提交并锁定结果' : `还差 ${3 - answered} 张卡未答完`}
                </button>
              </div>
            ) : round.status === 'locked' ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-t border-moss-200/60 bg-moss-100/40">
                <p className="text-sm text-moss-600 inline-flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  本轮命中
                  <b className="text-lg font-serif">{round.hits}</b> / 3
                  <span className="text-xs text-ink-700/50">
                    （结果已锁定；改动这 3 条记录的类型或意向、删除记录，都会让本次结果立即作废）
                  </span>
                </p>
                <button
                  onClick={() => {
                    startRound(memories);
                    setJustStarted(true);
                  }}
                  className="btn-secondary !py-2 !px-4 text-sm shrink-0"
                >
                  <RefreshCw className="w-4 h-4" />
                  再来一局
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

/** 「想再闻」候选覆盖的气味类型数 */
function distinctTypes(memories: SmellMemory[]): number {
  return new Set(memories.filter(isBlindEligible).map((m) => m.smell_type)).size;
}
