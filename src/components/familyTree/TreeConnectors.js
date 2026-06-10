import Svg, { Line } from 'react-native-svg';

const COLORS = {
  parentChild: 'rgba(74, 108, 247, 0.35)',
  spouse: 'rgba(214, 130, 110, 0.55)',
  secondary: 'rgba(139, 147, 168, 0.4)',
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
