import Svg, { Line } from 'react-native-svg';

// Connector line colors. `parentChild` and `secondary` echo the app's current
// primary/secondaryText theme values (kept as static rgba here since this SVG
// layer draws outside the themed-styles system); `spouse` is a deliberate
// warm accent, distinct from both, matching the rewards ACCENT palette's style.
const COLORS = {
  parentChild: 'rgba(46, 107, 79, 0.35)',
  spouse: 'rgba(214, 130, 110, 0.55)',
  secondary: 'rgba(140, 144, 134, 0.4)',
};

export default function TreeConnectors({ connectors, width, height, color }) {
  if (!width || !height) return null;

  return (
    <Svg
      width={width}
      height={height}
      style={{ position: 'absolute', top: 0, left: 0 }}
      pointerEvents="none"
    >
      {connectors.map((c, i) => (
        <Line
          key={i}
          x1={c.x1}
          y1={c.y1}
          x2={c.x2}
          y2={c.y2}
          stroke={color || COLORS[c.kind] || COLORS.secondary}
          strokeWidth={c.kind === 'spouse' ? 3 : 2}
          strokeDasharray={c.kind === 'secondary' ? '5,6' : undefined}
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}
