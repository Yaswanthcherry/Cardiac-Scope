"use client";

interface Props {
  patientId: number;
  totalPatients: number;
}

export default function Header({ patientId, totalPatients }: Props) {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#0a0f1e]/80 backdrop-blur-sm sticky top-0 z-30">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-red-900/40">
          ♥
        </div>
        <div>
          <h1 className="text-base font-bold text-white tracking-tight leading-none">
            Cardio<span className="text-blue-400">Scope</span>
          </h1>
          <p className="text-[10px] text-slate-600 leading-none mt-0.5">
            Cardiovascular Risk Visualization
          </p>
        </div>
      </div>

      {/* Center: current patient */}
      <div className="hidden md:flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5 border border-white/8">
        <span className="text-xs text-slate-500">Viewing</span>
        <span className="text-xs font-bold text-blue-400">Patient #{patientId}</span>
        <span className="text-xs text-slate-600">of {totalPatients}</span>
      </div>

      {/* Right: disclaimer badge */}
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-1.5 bg-amber-950/50 border border-amber-500/20 rounded-lg px-3 py-1.5">
          <span className="text-amber-400 text-xs">⚠</span>
          <span className="text-amber-400/80 text-[10px] font-medium">
            Educational / Decision-Support Only
          </span>
        </div>
      </div>
    </header>
  );
}
