import type { SmellMemory } from '../../utils/constants';
import { SMELL_TYPES, getSeasonInfo, getEmotionInfo, getSmellTypeInfo } from '../../utils/constants';
import { formatDate, contrastTextColor } from '../../utils/helpers';
import { CONFIDENCE_LEVELS, getConfidenceInfo, VOID_REASON_LABELS } from '../../utils/blindTest';
import type { BlindDraft, BlindAnswer, VoidReason, Confidence } from '../../utils/blindTest';
import { Check, X, Lock, EyeOff, MapPin, Sparkles } from 'lucide-react';

interface Props {
  memory: SmellMemory;
  index: number;
  draft: BlindDraft | undefined;
  answer: BlindAnswer | undefined;
  voidReason: VoidReason | null;
  onGuessChange: (value: SmellMemory['smell_type']) => void;
  onConfidenceChange: (value: Confidence) => void;
}

const ORDINAL_MARKS = ['壹', '贰', '叁'];

export default function BlindCard({
  memory,
  index,
  draft,
  answer,
  voidReason,
  onGuessChange,
  onConfidenceChange,
}: Props) {
  const season = getSeasonInfo(memory.season);
  const emotion = getEmotionInfo(memory.emotion);
  const locked = !!answer;
  const actual = getSmellTypeInfo(memory.smell_type);

  return (
    <article
      className="relative bg-paper-50 rounded-2xl border border-paper-300 shadow-card overflow-hidden animate-fadeInUp"
      style={{ animationDelay: `${Math.min(index * 80, 400)}ms` }}
    >
      <div className="flex">
        <div
          className="w-2 shrink-0"
          style={{ backgroundColor: memory.color_association }}
        />

        <div className="flex-1 min-w-0 p-4">
          {/* 卡头：序号 + 封存时间，地点与来源一律遮蔽 */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-ochre-500 text-paper-50 font-serif text-sm font-bold shadow-sm">
                  {ORDINAL_MARKS[index] ?? index + 1}
                </span>
                <h3 className="font-serif text-lg font-semibold text-ink-800">
                  盲测卡 {index + 1}
                </h3>
                {locked && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-ink-700/50">
                    <Lock className="w-3 h-3" /> 已锁定
                  </span>
                )}
              </div>
              <p className="text-[11px] text-ink-700/50 mt-1">
                封存于 {formatDate(memory.created_at)}
              </p>
            </div>
            <div
              className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center shadow-sm border-2 border-paper-50"
              style={{
                backgroundColor: memory.color_association,
                color: contrastTextColor(memory.color_association),
              }}
              title="颜色联想（不泄露气味类型）"
            >
              <span className="text-xs font-bold">色</span>
            </div>
          </div>

          {/* 回忆正文 + 不涉类型/地点/来源的线索 */}
          <div className="p-3.5 rounded-xl bg-paper-100/70 border border-paper-200/80 mb-3">
            <p className="font-serif text-sm leading-relaxed text-ink-800 line-clamp-5">
              {memory.memory_text}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            <span className={`scent-tag ${emotion.bg} ${emotion.text}`}>
              {emotion.emoji} {emotion.label}
            </span>
            <span className="scent-tag bg-ochre-100 text-ochre-600">
              {season.emoji} {season.label}
            </span>
            <span className="scent-tag bg-paper-200 text-ink-700/70">
              强度 {memory.intensity}/10
            </span>
            <span className="scent-tag bg-paper-200 text-ink-700/70">
              湿度 {memory.humidity}/10
            </span>
          </div>

          {/* 作答区 */}
          {!locked ? (
            <div className="space-y-3 pt-3 border-t border-paper-200/80">
              <div>
                <label className="block text-[11px] font-medium text-ochre-600 mb-1.5">
                  气味类型 <span className="text-brick-500">*</span>
                </label>
                <select
                  value={draft?.guess ?? ''}
                  onChange={(e) => onGuessChange(e.target.value as SmellMemory['smell_type'])}
                  className="scent-select text-sm py-2"
                >
                  <option value="">请选择气味类型…</option>
                  {SMELL_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.emoji} {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-ochre-600 mb-1.5">
                  信心等级 <span className="text-brick-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {CONFIDENCE_LEVELS.map((c) => {
                    const active = draft?.confidence === c.value;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => onConfidenceChange(c.value)}
                        className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all duration-200 ${
                          active
                            ? 'bg-ochre-500 text-paper-50 border-ochre-600 shadow-sm'
                            : 'bg-paper-50 text-ink-700/70 border-paper-300 hover:bg-paper-100 hover:border-paper-400'
                        }`}
                      >
                        <span className="mr-0.5">{c.emoji}</span>
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 pt-3 border-t border-paper-200/80">
              {/* 判定 + 作答 */}
              <div
                className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 border ${
                  answer.correct
                    ? 'bg-moss-50 border-moss-200'
                    : 'bg-brick-500/5 border-brick-400/40'
                }`}
              >
                <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                  {answer.correct ? (
                    <>
                      <Check className="w-4 h-4 text-moss-500" />
                      <span className="text-moss-600">命中</span>
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4 text-brick-500" />
                      <span className="text-brick-600">偏差</span>
                    </>
                  )}
                </span>
                <span className="text-xs text-ink-700/70">
                  你的判断：
                  <b className={answer.correct ? 'text-moss-600' : 'text-brick-600'}>
                    {getSmellTypeInfo(answer.guess).emoji} {getSmellTypeInfo(answer.guess).label}
                  </b>
                  <span className="mx-1.5 text-ink-700/30">·</span>
                  {getConfidenceInfo(answer.confidence).emoji}
                  {getConfidenceInfo(answer.confidence).label}
                </span>
              </div>

              {/* 揭晓：类型 / 地点 / 来源 */}
              <div className="rounded-xl bg-paper-100/70 border border-paper-200/80 px-3 py-2.5 space-y-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className="scent-tag text-paper-50"
                    style={{ backgroundColor: actual.color }}
                  >
                    {actual.emoji} {actual.label}
                  </span>
                  <span className="text-[11px] text-ink-700/50">真实类型</span>
                </div>
                <p className="text-sm text-ink-800 flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-ochre-400" />
                  <span>{memory.location}</span>
                </p>
                <p className="text-sm text-ink-800 flex items-start gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-ochre-400" />
                  <span>{memory.source_guess}</span>
                </p>
              </div>

              {/* 该卡所在轮次已作废的原因 */}
              {voidReason && (
                <p className="inline-flex items-center gap-1.5 text-xs text-brick-600 bg-brick-500/10 rounded-lg px-2.5 py-1.5">
                  <EyeOff className="w-3.5 h-3.5" />
                  本次结果已作废并移出统计：{VOID_REASON_LABELS[voidReason]}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
