import ScatterRegression from './visuals/ScatterRegression.jsx';
import ConfusionMatrix from './visuals/ConfusionMatrix.jsx';
import LossCurve from './visuals/LossCurve.jsx';
import DataSplit from './visuals/DataSplit.jsx';

/** Renders config.visual ({ kind, ...params }) — see docs/INTERACTIVE_TYPES.md. Unknown / 'none' renders nothing. */
export default function Visual({ visual }) {
  if (!visual || !visual.kind || visual.kind === 'none') return null;
  switch (visual.kind) {
    case 'scatter-regression': return <ScatterRegression {...visual} />;
    case 'confusion-matrix': return <ConfusionMatrix {...visual} />;
    case 'loss-curve': return <LossCurve {...visual} />;
    case 'data-split': return <DataSplit {...visual} />;
    default: return null;
  }
}
