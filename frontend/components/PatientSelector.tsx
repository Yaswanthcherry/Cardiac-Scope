"use client";

import { useMemo, useState } from "react";
import { PatientSummary } from "@/lib/types";
import { pct, riskBgClass, riskColor } from "@/lib/utils";

interface Props {
  patients: PatientSummary[];
  selectedId: number;
  onSelect: (id: number) => void;
}

export default function PatientSelector({ patients, selectedId, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [filterCAD, setFilterCAD] = useState<"all" | "positive" | "negative">("all");

  const filtered = useMemo(() => {
    return patients.filter((p) => {
      const matchSearch =
        search === "" || String(p.patient_id).includes(search.trim());
      const matchCAD =
        filterCAD === "all" ||
        (filterCAD === "positive" && p.cad_pred === 1) ||
        (filterCAD === "negative" && p.cad_pred === 0);
      return matchSearch && matchCAD;
    });
  }, [patients, search, filterCAD]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/5">
        <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-3">
          Patients
          <span className="ml-2 text-xs font-normal text-slate-500">
            ({filtered.length} / {patients.length})
          </span>
        </h2>

        {/* Search */}
        <input
          type="text"
          placeholder="Search by ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 mb-2"
        />

        {/* CAD filter */}
        <div className="flex gap-1">
          {(["all", "positive", "negative"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterCAD(f)}
              className={`flex-1 text-xs py-1 rounded-md capitalize font-medium transition-all ${
                filterCAD === f
                  ? "bg-blue-600/30 text-blue-300 border border-blue-500/40"
                  : "text-slate-500 hover:text-slate-300 border border-transparent hover:border-white/10"
              }`}
            >
              {f === "all" ? "All" : f === "positive" ? "CAD+" : "CAD−"}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {filtered.map((p) => {
          const isSelected = p.patient_id === selectedId;
          const color = riskColor(p.cad_risk);
          return (
            <button
              key={p.patient_id}
              onClick={() => onSelect(p.patient_id)}
              className={`w-full text-left rounded-lg px-3 py-2.5 transition-all group ${
                isSelected
                  ? "bg-blue-600/20 border border-blue-500/40"
                  : "hover:bg-white/5 border border-transparent"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Risk dot */}
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span
                    className={`text-sm font-medium ${
                      isSelected ? "text-blue-200" : "text-slate-300"
                    }`}
                  >
                    Patient #{p.patient_id}
                  </span>
                </div>
                <span className={`text-xs font-mono ${riskBgClass(p.cad_risk)} px-1.5 py-0.5 rounded`}>
                  {pct(p.cad_risk)}
                </span>
              </div>
              {/* Mini vessel bars */}
              <div className="flex gap-1 mt-1.5">
                {(["lad", "lcx", "rca"] as const).map((v) => (
                  <div key={v} className="flex-1">
                    <div className="text-[9px] text-slate-600 mb-0.5 uppercase">{v}</div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${p[`${v}_risk` as keyof PatientSummary] as number * 100}%`,
                          backgroundColor: riskColor(p[`${v}_risk` as keyof PatientSummary] as number),
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-slate-600 text-sm text-center py-8">No patients match</p>
        )}
      </div>
    </div>
  );
}
