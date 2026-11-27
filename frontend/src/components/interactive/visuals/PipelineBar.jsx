// Live pipeline diagram drawn from config.stages: a chevron lights up as soon as any step of that stage is in the sequence.
export const STAGE_COLORS = ['#1f6688', '#2a9d8f', '#4f7be0', '#e29a2b', '#d9526b', '#0aa862', '#7a63c9', '#2f8fbf'];
export const stageColor = (stages, id) => {
  const i = (stages || []).findIndex((s) => s.id === id);
  return STAGE_COLORS[(i < 0 ? 0 : i) % STAGE_COLORS.length];
};

export default function PipelineBar({ stages = [], items = [], placedIds = [] }) {
  if (!stages.length) return null;
  const placed = new Set(placedIds);
  return (
    <ol className="ix-pipe" aria-label="Pipeline progress">
      {stages.map((s, i) => {
        const inStage = items.filter((it) => it.stage === s.id);
        const done = inStage.filter((it) => placed.has(it.id)).length;
        const on = done > 0;
        return (
          <li key={s.id} className={`ix-stage ${on ? 'on' : ''} ${i === 0 ? 'first' : ''}`} style={{ '--c': STAGE_COLORS[i % STAGE_COLORS.length] }}>
            <span className="ix-stage-name">{s.label}</span>
            {inStage.length > 0 && <span className="ix-stage-count">{done}/{inStage.length}</span>}
          </li>
        );
      })}
    </ol>
  );
}
