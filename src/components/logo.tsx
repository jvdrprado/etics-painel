/** Marca ETICS em SVG: as barras vermelhas com pontas inclinadas do logo oficial e o nome em preto (no original ele é branco). */
const BARRAS: [number, number][] = [[1.5, 5], [7.5, 13], [11.6, 24], [16.1, 13], [27.5, 5]]; // [x, altura], recriadas a partir do logo

export function Logo({ className = "" }: { className?: string }) {
  const c = 16, w = 2.6, s = 1.2;
  return (
    <svg viewBox="0 0 150 32" className={className} role="img" aria-label="ETICS">
      {BARRAS.map(([x, h]) => (
        <polygon key={x} fill="#ff3535" points={`${x},${c - h / 2 + s} ${x + w},${c - h / 2} ${x + w},${c + h / 2 - s} ${x},${c + h / 2}`} />
      ))}
      <text x="40" y="25" fontFamily="var(--font-inter), system-ui, sans-serif" fontWeight="800" fontSize="24" letterSpacing="2" fill="#131313">ETICS</text>
    </svg>
  );
}
