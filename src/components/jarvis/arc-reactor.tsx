export function ArcReactor({ active }: { active: boolean }) {
  return (
    <div className="relative mx-auto flex aspect-square w-full max-w-[240px] items-center justify-center" aria-hidden="true">
      {/* Outer decorative ring */}
      <div className="absolute inset-0 rounded-full border border-cyan-500/20" />
      <div className="reactor-ring absolute inset-[6%] rounded-full border border-dashed border-cyan-500/30" />

      {/* Rotating segmented ring */}
      <div className="reactor-ring-fast absolute inset-[14%] rounded-full">
        <div
          className="h-full w-full rounded-full border-[10px] border-transparent"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, rgba(6,182,212,0.9) 40deg, transparent 80deg, transparent 120deg, rgba(6,182,212,0.6) 160deg, transparent 200deg, transparent 240deg, rgba(6,182,212,0.8) 280deg, transparent 320deg)",
            WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 10px), #000 calc(100% - 10px))",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 10px), #000 calc(100% - 10px))",
          }}
        />
      </div>

      {/* Static inner ring */}
      <div className="absolute inset-[26%] rounded-full border-2 border-cyan-400/40" />

      {/* Core */}
      <div className={`reactor-core absolute inset-[34%] rounded-full ${active ? "" : "opacity-50"}`}
        style={{
          background:
            "radial-gradient(circle at 40% 35%, #e0feff 0%, #67e8f9 35%, #06b6d4 62%, #083344 100%)",
        }}
      />

      {/* Trionic coil dots */}
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <div
          key={deg}
          className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-cyan-300/80"
          style={{ transform: `rotate(${deg}deg) translateY(-192%)`, boxShadow: "0 0 8px rgba(6,182,212,0.8)" }}
        />
      ))}
    </div>
  );
}
