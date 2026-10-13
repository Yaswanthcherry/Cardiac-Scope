"use client";

import { useEffect, useRef } from "react";
import { PatientPrediction, VESSELS } from "@/lib/types";
import { pct, riskLabel, riskToHex } from "@/lib/utils";

interface Props {
  data: PatientPrediction;
}

function RiskArc({
  risk,
  color,
  size = 80,
}: {
  risk: number;
  color: string;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 6;
    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;
    const filled = startAngle + (endAngle - startAngle) * risk;

    // Track
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.stroke();

    // Fill
    if (risk > 0) {
      const gradient = ctx.createLinearGradient(0, 0, size, size);
      gradient.addColorStop(0, color + "cc");
      gradient.addColorStop(1, color);
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, filled);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    // Center text
    ctx.fillStyle = color;
    ctx.font = `bold ${size * 0.22}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${Math.round(risk * 100)}%`, cx, cy);
  }, [risk, color, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
}

export default function RiskCards({ data }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {VESSELS.map((vessel) => {
        const risk = data.risk[vessel.key];
        const pred = data.prediction[vessel.key];
        const color = riskToHex(risk);
        const label = riskLabel(risk);

        return (
          <div
            key={vessel.key}
            className="relative bg-[#0d1530] rounded-2xl p-4 border border-white/5 overflow-hidden group hover:border-white/10 transition-all"
            style={{
              boxShadow: `0 0 20px ${color}18, inset 0 1px 0 rgba(255,255,255,0.04)`,
            }}
          >
            {/* Background glow */}
            <div
              className="absolute inset-0 opacity-5 rounded-2xl"
              style={{ background: `radial-gradient(circle at 50% 0%, ${color}, transparent 70%)` }}
            />

            {/* Vessel badge */}
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: color + "20",
                  color: color,
                  border: `1px solid ${color}40`,
                }}
              >
                {vessel.shortLabel}
              </span>
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  pred === 1
                    ? "bg-red-500/15 text-red-400 border border-red-500/30"
                    : "bg-green-500/15 text-green-400 border border-green-500/30"
                }`}
              >
                {pred === 1 ? "POSITIVE" : "NEGATIVE"}
              </span>
            </div>

            {/* Arc gauge */}
            <div className="flex justify-center mb-3">
              <RiskArc risk={risk} color={color} size={84} />
            </div>

            {/* Labels */}
            <div className="text-center">
              <p className="text-xs text-slate-400 leading-tight">{vessel.description}</p>
              <p
                className="text-xs font-semibold mt-1 uppercase tracking-wider"
                style={{ color }}
              >
                {label} RISK
              </p>
            </div>

            {/* Progress bar */}
            <div className="mt-3 h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: pct(risk), backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
