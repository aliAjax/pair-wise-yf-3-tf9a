import { useEffect, useMemo, useState } from 'react';
import { FlaskConical, Send, RotateCcw, Trophy, EyeOff, History } from 'lucide-react';
import BlindCard from './BlindCard';
import { useMemoryStore } from '../../store/memoryStore';
import { useBlindTestStore } from '../../store/blindTestStore';
import { formatDate } from '../../utils/helpers';
import {
  pickBlindTrio,
  countEligibleTypes,
  buildRound,
  sameTrio,
  isDraftComplete,
  getRoundStatus,
  getBlindStats,
  VOID_REASON_LABELS,
} from '../../utils/blindTest';

export default function BlindTestPanel() {
  const memories = useMemoryStore((s) => s.memories);
  const {
    drafts,
    rounds,
    dismissedRoundIds,
    setGuess,
    setConfidence,
    pruneDrafts,
    clearDrafts,
    addRound,
    dismissRound,
  } = useBlindTestStore();

  // 筛选：想再闻 × 三种不同类型，按封存时间从早到晚固定排序
  const trio = useMemo(() => pickBlindTrio(memories), [memories]);
  const eligibleTypes = useMemo(() => countEligibleTypes(memories), [memories]);
  const trioIds = useMemo(() => trio.map((m) => m.id), [trio]);

  // 本地数据同步：台上的卡发生变化时，清掉已不在台上的草稿；原序草稿按 id 保留
  useEffect(() => {
    pruneDrafts(trioIds);
  }, [trioIds, pruneDrafts]);

  // 当前台上已提交且未「再来一组」的轮次
  const activeRound = useMemo(
    () =>
      [...rounds]
        .reverse()
        .find(
          (r) =>
            sameTrio(r.trioIds, trioIds) && !dismissedRoundIds.includes(r.id),
        ),
    [rounds, trioIds, dismissedRoundIds],
  );

  const activeStatus = useMemo(
    () => (activeRound ? getRoundStatus(activeRound, memories) : null),
    [activeRound, memories],
  );

  // 作废（被选记录删除 / 改类型 / 改意向）→ 立即解锁、移出统计
  const locked = !!activeRound && !activeStatus?.voided;

  const stats = useMemo(() => getBlindStats(rounds, memories), [rounds, memories]);

  const missingCount = trio.filter((m) => !isDraftComplete(drafts[m.id])).length;
  const canSubmit = trio.length === 3 && missingCount === 0;

  const [justSubmitted, setJustSubmitted] = useState(false);
  useEffect(() => {
    if (!justSubmitted) return;
    const t = setTimeout(() => setJustSubmitted(false), 4000);
    return () => clearTimeout(t);
  }, [justSubmitted, activeRound]);

  const hits = activeRound
    ? activeRound.answers.filter((a) => a.correct).length
    : 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const round = buildRound(trio, drafts);
    addRound(round);
    setJustSubmitted(true);
  };

  // 再来一组：当前轮次保留在统计里，台上回到作答态
  const handleRetry = () => {
    if (activeRound) {
      dismissRound(activeRound.id);
      clearDrafts(activeRound.trioIds);
    }
  };

  const historyRounds = useMemo(() => [...rounds].reverse().slice(0, 5), [rounds]);
  const statusById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getRoundStatus>>();
    for (const r of historyRounds) map.set(r.id, getRoundStatus(r, memories));
    return map;
  }, [historyRounds, memories]);

  return (
    <section className="mb-8">
      <div className="bg-paper-50/70 backdrop-blur rounded-2xl border border-paper-300 shadow-paper p-4 md:p-6">
        {/* 标题行 + 统计 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h2 className="font-hand text-2xl text-ochre-600 flex items-center gap-2">
              <FlaskConical className="w-5 h-5" />
              三人盲测对照台
            </h2>
            <p className="text-xs text-ink-700/50 mt-0.5">
              三缕不同类型、想再次闻到的气味 · 类型 / 地点 / 来源已遮蔽 · 按封存时间从早到晚排列
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-moss-100 text-moss-600 text-xs font-medium border border-moss-200">
              <Trophy className="w-3.5 h-3.5" />
              有效 {stats.validRounds} 轮 · 命中 {stats.totalHits}/{stats.totalAnswered}
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-paper-200/80 text-ink-700/70 text-xs font-medium border border-paper-300">
              命中率 {Math.round(stats.hitRate * 100)}%
            </span>
          </div>
        </div>

        {trio.length < 3 ? (
          <div className="bg-paper-100/60 rounded-2xl border-2 border-dashed border-paper-400 py-12 px-6 text-center">
            <div className="text-5xl mb-3 select-none">🌫️</div>
            <h3 className="font-serif text-xl text-ink-800 mb-1.5">
              还凑不齐三缕不同的气味
            </h3>
            <p className="text-sm text-ink-700/60 max-w-md mx-auto">
              对照台需要 3 种不同气味类型、且标记为「想再闻」的记忆。
              当前只有 <b className="text-ochre-600">{eligibleTypes}</b> 种——去封存或编辑几段气味，补上另外的类型吧。
            </p>
          </div>
        ) : (
          <>
            {/* 锁定结果横幅 */}
            {locked && activeRound && (
              <div
                className={`mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl px-4 py-3.5 border animate-fadeInUp ${
                  hits === 3
                    ? 'bg-moss-50 border-moss-200'
                    : hits > 0
                      ? 'bg-ochre-50 border-ochre-200'
                      : 'bg-paper-100/70 border-paper-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl select-none">
                    {hits === 3 ? '🏆' : hits > 0 ? '🔍' : '🫧'}
                  </span>
                  <div>
                    <p className="font-serif text-lg text-ink-800">
                      本轮命中 <b className="text-ochre-600">{hits}</b> / 3
                      {hits === 3 && <span className="text-moss-600 ml-2">三种气味都被你认出来了！</span>}
                    </p>
                    <p className="text-xs text-ink-700/50">
                      结果已锁定 · {formatDate(activeRound.submittedAt)} 提交
                    </p>
                  </div>
                </div>
                <button onClick={handleRetry} className="btn-secondary self-start sm:self-auto">
                  <RotateCcw className="w-4 h-4 mr-1.5" />
                  再来一组
                </button>
              </div>
            )}

            {/* 作废横幅：本轮结果立即作废并移出统计，可重新作答 */}
            {activeRound && activeStatus?.voided && (
              <div className="mb-4 flex items-start gap-3 rounded-2xl px-4 py-3 border border-brick-400/40 bg-brick-500/5 animate-fadeInUp">
                <EyeOff className="w-5 h-5 text-brick-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-brick-600">
                    上一轮结果已作废，已移出统计
                  </p>
                  <p className="text-xs text-ink-700/60 mt-0.5">
                    {Object.values(activeStatus.reasons)
                      .map((r) => VOID_REASON_LABELS[r])
                      .join('、')}
                    ，修正数据后可重新作答；原序不变。
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {trio.map((m, idx) => {
                // 轮次作废后立即解锁：表单以上次作答预填，可直接修改后重新提交
                const answer = locked
                  ? activeRound?.answers.find((a) => a.memoryId === m.id)
                  : undefined;
                return (
                  <BlindCard
                    key={m.id}
                    memory={m}
                    index={idx}
                    draft={drafts[m.id]}
                    answer={answer}
                    voidReason={answer ? (activeStatus?.reasons[m.id] ?? null) : null}
                    onGuessChange={(v) => setGuess(m.id, v)}
                    onConfidenceChange={(v) => setConfidence(m.id, v)}
                  />
                );
              })}
            </div>

            {/* 提交栏：每张卡的类型与信心都必选，缺一不可提交 */}
            {!locked && (
              <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-paper-200">
                <p className="text-xs text-ink-700/55">
                  {missingCount > 0
                    ? <>还有 <b className="text-brick-500">{missingCount}</b> 张卡未选齐「气味类型 + 信心等级」，全部选好才能提交</>
                    : '三张卡均已作答，提交后将锁定结果并揭晓真实类型、地点与来源'}
                </p>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 self-start sm:self-auto ${
                    canSubmit
                      ? 'bg-ochre-500 hover:bg-ochre-600 text-paper-50 shadow-paper hover:-translate-y-0.5'
                      : 'bg-paper-200/60 text-ink-700/40 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  提交盲测
                </button>
              </div>
            )}
          </>
        )}

        {/* 历史轮次（含已作废记录，作废轮不计入上方计数） */}
        {historyRounds.length > 0 && (
          <div className="mt-5 pt-4 border-t border-paper-200">
            <h3 className="flex items-center gap-1.5 text-xs font-medium text-ink-700/50 mb-2">
              <History className="w-3.5 h-3.5" />
              最近 {historyRounds.length} 轮记录
            </h3>
            <ul className="flex flex-wrap gap-2">
              {historyRounds.map((r) => {
                const status = statusById.get(r.id)!;
                const rHits = r.answers.filter((a) => a.correct).length;
                return (
                  <li
                    key={r.id}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border ${
                      status.voided
                        ? 'bg-brick-500/5 border-brick-400/30 text-brick-600'
                        : 'bg-paper-100/70 border-paper-300 text-ink-700/70'
                    }`}
                  >
                    {status.voided ? (
                      <EyeOff className="w-3 h-3" />
                    ) : (
                      <Trophy className="w-3 h-3 text-moss-500" />
                    )}
                    {formatDate(r.submittedAt)}
                    <span className="font-semibold">
                      {status.voided ? '已作废' : `${rHits}/3`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
