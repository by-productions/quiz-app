// Shared molecular-network backdrop for the gynaeco-oncology forum —
// faint connected nodes drifting over a deep-navy field (matches the poster).
const NODES: [number, number, number][] = [
  [80, 120, 6], [230, 60, 4], [380, 160, 5], [520, 80, 3], [680, 150, 6],
  [820, 90, 4], [930, 200, 5], [140, 300, 4], [300, 340, 6], [470, 300, 4],
  [640, 360, 5], [790, 320, 4], [900, 430, 6], [60, 480, 5], [220, 540, 4],
  [400, 500, 6], [560, 560, 4], [720, 520, 5], [860, 600, 4], [120, 680, 6],
  [300, 740, 4], [480, 700, 5], [650, 760, 4], [820, 720, 6], [940, 820, 4],
  [200, 900, 5], [420, 880, 4], [600, 940, 6], [780, 900, 4], [520, 380, 3],
];

// Connect nodes that are reasonably close, so the mesh reads as a network.
const LINES: [number, number][] = [];
for (let i = 0; i < NODES.length; i++) {
  for (let j = i + 1; j < NODES.length; j++) {
    const dx = NODES[i][0] - NODES[j][0];
    const dy = NODES[i][1] - NODES[j][1];
    if (Math.hypot(dx, dy) < 210) LINES.push([i, j]);
  }
}

export default function EventBackground() {
  return (
    <div className="event-bg" aria-hidden>
      <svg
        className="mesh"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        {LINES.map(([a, b], k) => (
          <line
            key={k}
            x1={NODES[a][0]}
            y1={NODES[a][1]}
            x2={NODES[b][0]}
            y2={NODES[b][1]}
            stroke="#4a7fd6"
            strokeWidth="0.8"
            opacity="0.16"
          />
        ))}
        {NODES.map(([x, y, r], k) => (
          <circle key={k} cx={x} cy={y} r={r} fill="#5b8ee0" opacity="0.35" />
        ))}
      </svg>
    </div>
  );
}
