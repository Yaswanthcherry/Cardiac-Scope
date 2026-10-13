"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  Environment,
} from "@react-three/drei";

import { PatientPrediction, VESSELS } from "@/lib/types";
import { riskLabel, riskToHex } from "@/lib/utils";

type VesselKey3D = "lad" | "lcx" | "rca";

interface MarkerProps {
  shortLabel: string;
  position: [number, number, number];
  risk: number;
  pred: number;
  active: boolean;
  onClick: () => void;
}

function VesselMarker({
  shortLabel,
  position,
  risk,
  pred,
  active,
  onClick,
}: MarkerProps) {
  const color = riskToHex(risk);
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;

    const pulse =
      pred === 1
        ? 1 + Math.sin(clock.elapsedTime * 4) * 0.18
        : 1;

    const target = active ? 1.7 : hovered ? 1.4 : pulse;
    meshRef.current.scale.lerp(
      new THREE.Vector3(target, target, target),
      0.15
    );
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      <sphereGeometry args={[0.06, 20, 20]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={active ? 2.5 : hovered ? 1.8 : 0.7}
        roughness={0.2}
        metalness={0.1}
      />
    </mesh>
  );
}

interface HeartModelProps {
  prediction: PatientPrediction;
  activeVessel: VesselKey3D | null;
  onVesselClick: (key: VesselKey3D) => void;
}

function HeartModel({
  prediction,
  activeVessel,
  onVesselClick,
}: HeartModelProps) {
  const { scene } = useGLTF("/models/heart.glb");
  const groupRef = useRef<THREE.Group>(null);

  // Preserve the original GLB materials and textures.
  useEffect(() => {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.visible = true;
      }
    });

    scene.visible = true;
  }, [scene]);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15;
    }
  });

  // Approximate visual overlays, not segmented coronary arteries.
  const vesselPositions: Record<
    VesselKey3D,
    [number, number, number]
  > = {
    lad: [0.14, 0.22, 0.38],
    lcx: [-0.28, 0.06, 0.12],
    rca: [0.28, -0.12, 0.14],
  };

  return (
    <group ref={groupRef}>
      <primitive
        object={scene}
        scale={5}
        position={[0, 0.55, 0]}
      />

      {(["lad", "lcx", "rca"] as const).map((key) => {
        const vessel = VESSELS.find((item) => item.key === key);

        if (!vessel) return null;

        return (
          <VesselMarker
            key={key}
            shortLabel={vessel.shortLabel}
            position={vesselPositions[key]}
            risk={prediction.risk[key]}
            pred={prediction.prediction[key]}
            active={activeVessel === key}
            onClick={() => onVesselClick(key)}
          />
        );
      })}
    </group>
  );
}

useGLTF.preload("/models/heart.glb");

interface Props {
  prediction: PatientPrediction;
}

export default function HeartViewer({ prediction }: Props) {
  const [activeVessel, setActiveVessel] =
    useState<VesselKey3D | null>(null);

  const selectedVessel = activeVessel
    ? VESSELS.find((vessel) => vessel.key === activeVessel)
    : null;

  const selectedRisk = activeVessel
    ? prediction.risk[activeVessel]
    : null;

  const selectedPrediction = activeVessel
    ? prediction.prediction[activeVessel]
    : null;

  const handleVesselClick = (key: VesselKey3D) => {
    setActiveVessel((current) => (current === key ? null : key));
  };

  return (
    <div
      className="relative w-full"
      style={{ height: "100%", minHeight: 420 }}
    >
      <Canvas
        camera={{ position: [0, 0, 3.5], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
        style={{
          width: "100%",
          height: "100%",
          background: "transparent",
        }}
      >
        <ambientLight intensity={1.5} />

        <directionalLight
          position={[3, 5, 5]}
          intensity={2}
        />

        <directionalLight
          position={[-4, 2, -3]}
          intensity={1.2}
          color="#93c5fd"
        />

        <pointLight
          position={[0, 2, 3]}
          intensity={1.5}
          color="#ffffff"
        />

        <Suspense fallback={null}>
          <HeartModel
            prediction={prediction}
            activeVessel={activeVessel}
            onVesselClick={handleVesselClick}
          />
          <Environment preset="night" />
        </Suspense>

        <OrbitControls
          enablePan={false}
          minDistance={2}
          maxDistance={6}
          autoRotate={false}
          dampingFactor={0.05}
          enableDamping
        />
      </Canvas>

      {/* Interaction hints */}
      <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-3 whitespace-nowrap text-[10px] text-slate-400">
        <span>🖱 Drag to rotate</span>
        <span>🔍 Scroll to zoom</span>
        <span>📌 Click markers</span>
      </div>

      {/* Vessel risk legend */}
      <div className="pointer-events-none absolute right-3 top-10 space-y-1.5">
        {VESSELS.filter((vessel) => vessel.key !== "cad").map(
          (vessel) => {
            const key = vessel.key as VesselKey3D;
            const risk = prediction.risk[key];
            const color = riskToHex(risk);
            const pred = prediction.prediction[key];

            return (
              <div
                key={vessel.key}
                className="flex items-center gap-2 rounded-lg px-2 py-1"
                style={{
                  background: "rgba(0,0,0,0.55)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: color,
                    boxShadow: `0 0 5px ${color}`,
                  }}
                />

                <span className="text-[11px] font-semibold text-slate-300">
                  {vessel.shortLabel}
                </span>

                <span
                  className="font-mono text-[11px]"
                  style={{ color }}
                >
                  {(risk * 100).toFixed(0)}%
                </span>

                {pred === 1 && (
                  <span className="text-[9px] font-bold text-red-400">
                    +
                  </span>
                )}
              </div>
            );
          }
        )}
      </div>

      {/* Anatomical overlay disclaimer */}
      <div className="pointer-events-none absolute bottom-7 left-3 max-w-[150px] text-[9px] leading-tight text-slate-400">
        Vessel markers are approximate anatomical overlays, not imaging-derived.
      </div>

      {/* Selected vessel details: regular React DOM, outside Canvas */}
      {selectedVessel &&
        selectedRisk !== null &&
        selectedPrediction !== null && (
          <div
            className="absolute left-3 top-10 rounded-xl border px-3 py-2.5 text-xs shadow-xl"
            style={{
              background: "#0a0f1ef0",
              borderColor: `${riskToHex(selectedRisk)}50`,
              backdropFilter: "blur(10px)",
              minWidth: 160,
            }}
          >
            <button
              type="button"
              aria-label="Close vessel details"
              className="absolute right-2 top-1.5 text-xs text-slate-400 hover:text-white"
              onClick={() => setActiveVessel(null)}
            >
              ✕
            </button>

            <p className="mb-1 pr-5 font-bold text-white">
              {selectedVessel.label}
            </p>

            <p className="mb-2 text-[10px] leading-tight text-slate-400">
              {selectedVessel.description}
            </p>

            <div className="mb-1 flex items-center gap-2">
              <span className="text-slate-400">Risk:</span>

              <span
                className="font-mono font-bold"
                style={{ color: riskToHex(selectedRisk) }}
              >
                {(selectedRisk * 100).toFixed(1)}%
              </span>

              <span
                className={`rounded px-1 py-0.5 text-[9px] font-semibold ${
                  selectedPrediction === 1
                    ? "bg-red-500/20 text-red-400"
                    : "bg-green-500/20 text-green-400"
                }`}
              >
                {selectedPrediction === 1 ? "POSITIVE" : "NEGATIVE"}
              </span>
            </div>

            <p className="text-[9px] text-slate-500">
              {selectedVessel.location}
            </p>

            <p className="mt-1 text-[9px] text-slate-400">
              {riskLabel(selectedRisk)} risk according to the model.
            </p>
          </div>
        )}
    </div>
  );
}