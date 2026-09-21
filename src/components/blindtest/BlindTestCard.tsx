import { EyeOff, Check, X, AlertTriangle } from 'lucide-react';
import type { SmellMemory, SmellType } from '../../utils/constants';
import { SMELL_TYPES, getSeasonInfo, getEmotionInfo, getSmellTypeInfo } from '../../utils/constants';
import { formatDate } from '../../utils/helpers';
import {
  type BlindRound,
  type Confidence,
  BLIND_SLOT_NAMES,
  CONFIDENCE_LEVELS,
} from '../../utils/blindTest';

interface Props {
  slotIndex: number;
  memory: SmellMemory | undefined;
  round: BlindRound;
  onSetGuess: (id: string, patch: Partial<{ smell_type: SmellType | ''; confidence: Confidence | '' }>) => void;
}

function Clues({ memory }: { memory: SmellMemory }) {
  const season = getSeasonInfo(memory.season);
  const emotion = getEmotionInfo(memory.emotion);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <span className={`scent-tag ${emotion.bg} ${emotion.text}`}>
          {emotion.emoji} {emotion.label}
        </span>
        <span className="scent-tag bg-ochre-100 text-ochre-600">
          {season.emoji} {season.label}
        </span>
        <span className="scent-tag bg-paper-200 text-ink-700/70">
          🕯️ 封存于 {formatDate(memory.created_at).slice(0, 10)}
        </span>
        <span
          className="scent-tag text-paper-50"
          style={{ backgroundColor: memory.color_association }}
        >
          联想色
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between text-[11px] text-ink-700/60 mb-1">
            <span>强度</span>
            <span className="font-semibold text-ochre-600">{memory.intensity}/10</span>
          </div>
          <div className="h-1.5 bg-paper-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${memory.intensity * 10}%`,
                background: 'linear-gradient(90deg, #D4B487 0%, #8B5A2B 60%, #5C3A1D 100%)',
              }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-[11px] text-ink-700/60 mb-1">
            <span>湿度感</span>
            <span className="font-semibold text-moss-600">
              {memory.humidity <= 3 ? '偏干' : memory.humidity <= 6 ? '适中' : '偏湿'}
            </span>
          </div>
          <div className="h-1.5 bg-paper-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${memory.humidity * 10}%`,
                background: 'linear-gradient(90deg, #CFDBD3 0%, #7DA08C 60%, #3D5A4A 100%)',
              }}
            />
          </div>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-paper-100/70 border border-paper-200/80">
        <div className="font-hand text-base text-ochre-600 mb-1">关联记忆</div>
        <p className="font-serif text-[13px] leading-relaxed text-ink-800/85 whitespace-pre-wrap line-clamp-6">
          {memory.memory_text}
        </p>
      </div>
    </div>
  );
}

export default function BlindTestCard({ slotIndex, memory, round, onSetGuess }: Props) {
  const id = round.ids[slotIndex];
  const guess = round.guesses[id] ?? { smell_type: '', confidence: '' };
  const answering = round.status === 'answering';
  const isVoided = round.status === 'voided';
  const answer = round.answers.find((a) => a.id === id);
  const changed = round.changedIds.includes(id);
  const hit = answer ? guess.smell_type === answer.smell_type : false;

  const slotBadge = (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-lavender-300/30 text-lavender-600 text-xs font-semibold border border-lavender-300/50">
      {answering ? <EyeOff className="w-3.5 h-3.5" /> : null}
      盲样 · {BLIND_SLOT_NAMES[slotIndex]}
    </span>
  );

  return (
    <article
      className={`relative bg-paper-50 rounded-2xl border shadow-card overflow-hidden transition-all duration-300 animate-fadeInUp ${
        isVoided ? 'border-brick-400/60 opacity-90' : changed ? 'border-brick-400/70' : 'border-paper-300'
      }`}
      style={{ animationDelay: `${slotIndex * 80}ms` }}
    >
      {/* 顶部：答题中只用中性色条，不能暴露类型/颜色线索 */}
      <div
        className="h-1.5 w-full"
        style={{
          backgroundColor: answering
            ? '#CBB993'
            : memory
              ? memory.color_association
              : answer
                ? getSmellTypeInfo(answer.smell_type).color
                : '#CBB993',
        }}
      />

      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          {slotBadge}
          {!answering && answer && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                isVoided
                  ? 'bg-paper-200 text-ink-700/60'
                  : hit
                    ? 'bg-moss-100 text-moss-600'
                    : 'bg-brick-400/15 text-brick-600'
              }`}
            >
              {isVoided ? (
                <><AlertTriangle className="w-3.5 h-3.5" /> 已作废</>
              ) : hit ? (
                <><Check className="w-3.5 h-3.5" /> 命中</>
              ) : (
                <><X className="w-3.5 h-3.5" /> 未中</>
              )}
            </span>
          )}
        </div>

        {memory ? (
          answering ? (
            <Clues memory={memory} />
          ) : (
            <div className="space-y-3">
              {/* 揭晓：类型 / 地点 / 来源 全部对照展示 */}
              <div>
                <h3 className="font-serif text-lg font-semibold text-ink-800 leading-tight">
                  {memory.location}
                </h3>
                <p className="text-sm text-ink-700/70 mt-0.5">{memory.source_guess || '（未记录来源）'}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-moss-100/60 border border-moss-200">
                  <div className="text-[11px] text-moss-600/80 mb-1">谜底类型</div>
                  {(() => {
                    const t = getSmellTypeInfo(answer?.smell_type ?? memory.smell_type);
                    return (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-paper-50"
                        style={{ backgroundColor: t.color }}
                      >
                        {t.emoji} {t.label}
                      </span>
                    );
                  })()}
                </div>
                <div className="p-2.5 rounded-xl bg-paper-100 border border-paper-200">
                  <div className="text-[11px] text-ink-700/50 mb-1">你的判断</div>
                  {guess.smell_type ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-paper-50"
                      style={{ backgroundColor: getSmellTypeInfo(guess.smell_type as SmellType).color }}
                    >
                      {getSmellTypeInfo(guess.smell_type as SmellType).emoji}
                      {getSmellTypeInfo(guess.smell_type as SmellType).label}
                      {hit ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-700/40">未作答</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-ink-700/60">
                <span>当时的信心：</span>
                {guess.confidence
                  ? (() => {
                      const c = CONFIDENCE_LEVELS.find((x) => x.value === guess.confidence);
                      return <span className="font-medium text-ink-800">{c?.emoji} {c?.label}</span>;
                    })()
                  : <span className="text-ink-700/40">未选择</span>}
              </div>

              <Clues memory={memory} />
            </div>
          )
        ) : (
          <div className="py-8 text-center text-sm text-ink-700/50">
            <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-brick-500" />
            这条记忆已从档案中移除
            {answer && (
              <div className="mt-2 text-xs">
                谜底是
                <span
                  className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-full text-paper-50"
                  style={{ backgroundColor: getSmellTypeInfo(answer.smell_type).color }}
                >
                  {getSmellTypeInfo(answer.smell_type).emoji}
                  {getSmellTypeInfo(answer.smell_type).label}
                </span>
              </div>
            )}
          </div>
        )}

        {answering && (
          <div className="space-y-3 pt-3 border-t border-paper-200">
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1.5">
                气味类型 <span className="text-brick-500">*</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {SMELL_TYPES.map((t) => {
                  const active = guess.smell_type === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => onSetGuess(id, { smell_type: t.value })}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 inline-flex items-center gap-1 ${
                        active
                          ? 'text-paper-50 shadow-sm scale-[1.03]'
                          : 'bg-paper-100 text-ink-700/75 hover:bg-paper-200 border border-paper-200'
                      }`}
                      style={active ? { backgroundColor: t.color } : undefined}
                    >
                      <span>{t.emoji}</span>
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1.5">
                信心等级 <span className="text-brick-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {CONFIDENCE_LEVELS.map((c) => {
                  const active = guess.confidence === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => onSetGuess(id, { confidence: c.value as Confidence })}
                      className={`py-2 rounded-lg text-xs font-medium transition-all duration-150 inline-flex items-center justify-center gap-1 ${
                        active
                          ? 'bg-lavender-500 text-paper-50 shadow-sm scale-[1.02]'
                          : 'bg-paper-100 text-ink-700/75 hover:bg-paper-200 border border-paper-200'
                      }`}
                    >
                      <span>{c.emoji}</span>
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
