import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Environment, Html, Lightformer, OrbitControls, RoundedBox, useGLTF } from "@react-three/drei";
import { Component, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { FURNITURE_LABELS, type Concern, type HomeProfile, type RoomId } from "@nooksure/shared";
import { computeOverlays, type Overlays } from "./overlays";
import {
  DOOR,
  GARDEN_PATH,
  GARDEN_STEPS_DEPTH,
  STATUS_COLORS,
  STATUS_LABELS,
  MODELS,
  buildRoomScene,
  fitModel,
  type Box,
  type IssueStatus,
  type ModelId,
  type RoomScene,
} from "./sceneModel";

const WALL = "#e7e1d6";
const WALL_SIDE = "#ded7ca";
const SKIRTING = "#f6f3ee";
const WALL_T = 0.08;

export const UNSUPPORTED_MESSAGE = "3D view isn't supported on this device.";

// Served from /public/models (see MODELS in sceneModel.ts).
const modelUrl = (id: ModelId) => `${import.meta.env.BASE_URL}${MODELS[id]!.file}`;

/** Wood-plank floor drawn on a canvas at runtime — no image download. */
function usePlankCanvas() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    const g = c.getContext("2d");
    if (!g) return null;
    const planks = 6;
    const h = c.height / planks;
    for (let i = 0; i < planks; i++) {
      const tone = 196 + ((i * 37) % 5) * 5;
      g.fillStyle = `rgb(${tone}, ${tone - 30}, ${tone - 62})`;
      g.fillRect(0, i * h, c.width, h);
      // Stagger the plank ends.
      g.fillStyle = "rgba(90, 60, 30, 0.25)";
      g.fillRect(((i * 211) % 512), i * h, 2, h);
      g.fillRect(0, i * h, c.width, 2);
    }
    return c;
  }, []);
}

const REPEAT_WRAPPING = 1000; // THREE.RepeatWrapping (R3F disposes the texture on unmount)

interface MeshProps {
  b: Box;
  onSelect?: () => void;
  /** Glow colour when hovered or selected (issue objects only). */
  glow?: string;
  highlighted?: boolean;
}

function Mesh({ b, onSelect, glow, highlighted = false }: MeshProps) {
  const [hovered, setHovered] = useState(false);
  const lit = Boolean(glow) && (highlighted || hovered);
  const material = (
    <meshStandardMaterial
      color={b.color}
      roughness={b.opacity !== undefined ? 0.1 : 0.78}
      metalness={0}
      transparent={b.opacity !== undefined}
      opacity={b.opacity ?? 1}
      emissive={lit ? glow : "#000000"}
      emissiveIntensity={lit ? (highlighted ? 0.55 : 0.3) : 0}
    />
  );
  const handlers = onSelect
    ? {
        onClick: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onSelect();
        },
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        },
        onPointerOut: () => {
          setHovered(false);
          document.body.style.cursor = "";
        },
      }
    : {};
  // RoundedBox needs a radius smaller than half the thinnest side.
  const radius = b.radius ? Math.min(b.radius, Math.min(...b.size) / 2 - 0.002) : 0;
  return radius > 0.004 ? (
    <RoundedBox args={b.size} radius={radius} smoothness={3} position={b.position} {...handlers}>
      {material}
    </RoundedBox>
  ) : (
    <mesh position={b.position} {...handlers}>
      <boxGeometry args={b.size} />
      {material}
    </mesh>
  );
}

/** A model scaled uniformly to fit its layout box, turned by rotationY, standing on the floor. */
function FittedModel({ b, id, onReady }: { b: Box; id: ModelId; onReady?: () => void }) {
  // useDraco=false: these files aren't Draco-compressed, so never fetch a decoder from a CDN.
  const { scene } = useGLTF(modelUrl(id), false);
  const object = useMemo(() => scene.clone(true), [scene]);
  useEffect(() => onReady?.(), [object, onReady]);

  const fit = fitModel(b, id);
  return <primitive object={object} position={fit.position} rotation={[0, fit.rotationY, 0]} scale={fit.scale} />;
}

/** If a model can't load (missing file, old browser), keep the simple box instead. */
class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Furniture({ b, onModelReady }: { b: Box; onModelReady?: () => void }) {
  if (b.model) {
    const box = <Mesh b={b} />;
    return (
      <ModelBoundary fallback={box}>
        <Suspense fallback={box}>
          <FittedModel b={b} id={b.model} onReady={onModelReady} />
        </Suspense>
      </ModelBoundary>
    );
  }
  return <Mesh b={b} />;
}

/** Grass drawn on a canvas at runtime — no image download. */
function useGrassCanvas() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    if (!g) return null;
    g.fillStyle = "#7fa865";
    g.fillRect(0, 0, 256, 256);
    // Deterministic speckle so the grass has some texture.
    for (let i = 0; i < 1400; i++) {
      const x = (i * 73) % 256;
      const y = (i * 151 + (i >> 3) * 17) % 256;
      g.fillStyle = i % 3 === 0 ? "#6b9655" : i % 3 === 1 ? "#8cb571" : "#76a05e";
      g.fillRect(x, y, 2, 3);
    }
    return c;
  }, []);
}

/** Garden: open area with grass, a paved path, the house wall with a door, and steps if there are any. */
function OutdoorShell({ scene }: { scene: RoomScene }) {
  const { width: w, depth: d, wallHeight: h } = scene;
  const grass = useGrassCanvas();
  const steps = scene.outdoor?.steps ?? false;
  const doorW = 1.0;
  const doorH = 2.0;
  const wallZ = -d / 2;
  const part = (key: string, position: [number, number, number], size: [number, number, number], color: string, radius = 0) => (
    <Mesh key={key} b={{ key, position, size, color, radius }} />
  );
  const pathStart = wallZ + (steps ? GARDEN_STEPS_DEPTH : 0.04);
  const pathLen = d / 2 - pathStart;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={grass ? "#ffffff" : "#7fa865"} roughness={1}>
          {grass && <canvasTexture attach="map" args={[grass]} colorSpace="srgb" wrapS={1000} wrapT={1000} repeat-x={w} repeat-y={d} />}
        </meshStandardMaterial>
      </mesh>
      {/* Paved path from the door to the front */}
      {part("path", [GARDEN_PATH.x, 0.006, pathStart + pathLen / 2], [GARDEN_PATH.width, 0.012, pathLen], "#c9c3b8")}
      {/* House wall with door and two windows */}
      {part("house-left", [-(w / 4 + doorW / 4), h / 2, wallZ], [w / 2 - doorW / 2, h, 0.12], "#d8c7b2")}
      {part("house-right", [w / 4 + doorW / 4, h / 2, wallZ], [w / 2 - doorW / 2, h, 0.12], "#d8c7b2")}
      {part("house-lintel", [0, (h + doorH) / 2, wallZ], [doorW, h - doorH, 0.12], "#d8c7b2")}
      {part("door", [0, doorH / 2 + (steps ? 0.45 : 0), wallZ + 0.01], [doorW - 0.08, doorH - (steps ? 0.45 : 0), 0.06], "#7a5a43")}
      {part("window-l", [-1.8, 1.55, wallZ + 0.07], [1.0, 0.8, 0.03], "#dbeef5")}
      {part("window-r", [1.8, 1.55, wallZ + 0.07], [1.0, 0.8, 0.03], "#dbeef5")}
      {steps &&
        [0, 1, 2].map((i) => {
          // Three steps down from the door, each 0.15 high and 0.2 deep.
          const height = 0.15 * (3 - i);
          return part(`step-${i}`, [0, height / 2, wallZ + 0.06 + 0.2 * i + 0.1], [1.2, height, 0.2], "#bdb6aa", 0.01);
        })}
    </group>
  );
}

function Shell({ scene }: { scene: RoomScene }) {
  const { width: w, depth: d, wallHeight: h } = scene;
  const planks = usePlankCanvas();
  const doorFront = DOOR.z + DOOR.width / 2; // door gap spans [DOOR.z - w/2, DOOR.z + w/2]
  const doorBack = DOOR.z - DOOR.width / 2;
  const leftBackLen = doorBack + d / 2;
  const leftFrontLen = d / 2 - doorFront;
  const part = (key: string, position: [number, number, number], size: [number, number, number], color: string) => (
    <Mesh key={key} b={{ key, position, size, color }} />
  );
  const skirt = 0.1;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={planks ? "#ffffff" : "#c9bfae"} roughness={0.9}>
          {planks && (
            <canvasTexture
              attach="map"
              args={[planks]}
              colorSpace="srgb"
              wrapS={REPEAT_WRAPPING}
              wrapT={REPEAT_WRAPPING}
              repeat-x={w / 2}
              repeat-y={d / 2}
              anisotropy={4}
            />
          )}
        </meshStandardMaterial>
      </mesh>
      {part("back", [0, h / 2, -d / 2], [w, h, WALL_T], WALL)}
      {scene.attachedDoor ? (
        // Right wall with a doorway to the attached bathroom.
        (() => {
          const { z, width } = scene.attachedDoor;
          const backLen = z - width / 2 + d / 2;
          const frontLen = d / 2 - (z + width / 2);
          return (
            <>
              {part("right-back", [w / 2, h / 2, -d / 2 + backLen / 2], [WALL_T, h, backLen], WALL_SIDE)}
              {part("right-front", [w / 2, h / 2, d / 2 - frontLen / 2], [WALL_T, h, frontLen], WALL_SIDE)}
              {part("right-lintel", [w / 2, h - 0.25, z], [WALL_T, 0.5, width], WALL_SIDE)}
              {part("attached-door-frame", [w / 2 - 0.05, 1.05, z], [0.02, 2.1, width + 0.1], SKIRTING)}
            </>
          );
        })()
      ) : (
        part("right", [w / 2, h / 2, 0], [WALL_T, h, d], WALL_SIDE)
      )}
      {part("left-back", [-w / 2, h / 2, -d / 2 + leftBackLen / 2], [WALL_T, h, leftBackLen], WALL_SIDE)}
      {part("left-front", [-w / 2, h / 2, d / 2 - leftFrontLen / 2], [WALL_T, h, leftFrontLen], WALL_SIDE)}
      {part("lintel", [-w / 2, h - 0.25, DOOR.z], [WALL_T, 0.5, DOOR.width], WALL_SIDE)}
      {/* Skirting boards */}
      {part("skirt-back", [0, skirt / 2, -d / 2 + WALL_T / 2 + 0.01], [w - WALL_T, skirt, 0.02], SKIRTING)}
      {part("skirt-right", [w / 2 - WALL_T / 2 - 0.01, skirt / 2, 0], [0.02, skirt, d], SKIRTING)}
      {part("skirt-left-back", [-w / 2 + WALL_T / 2 + 0.01, skirt / 2, -d / 2 + leftBackLen / 2], [0.02, skirt, leftBackLen], SKIRTING)}
      {part("skirt-left-front", [-w / 2 + WALL_T / 2 + 0.01, skirt / 2, d / 2 - leftFrontLen / 2], [0.02, skirt, leftFrontLen], SKIRTING)}
      {/* Window on the back wall: frame + softly glowing pane */}
      {part("window-frame", [0.45, 1.7, -d / 2 + WALL_T / 2 + 0.005], [1.3, 0.95, 0.03], SKIRTING)}
      <mesh position={[0.45, 1.7, -d / 2 + WALL_T / 2 + 0.025]}>
        <planeGeometry args={[1.16, 0.81]} />
        <meshStandardMaterial color="#dbeef5" emissive="#dbeef5" emissiveIntensity={0.6} roughness={0.2} />
      </mesh>
      {part("window-mullion", [0.45, 1.7, -d / 2 + WALL_T / 2 + 0.03], [0.03, 0.81, 0.01], SKIRTING)}
    </group>
  );
}

type OverlayId = "turning" | "path" | "grab" | "nonSlip" | "night";

const OVERLAY_TOGGLES: { id: OverlayId; label: string; available: (o: Overlays, s: RoomScene) => boolean }[] = [
  { id: "turning", label: "Turning circle", available: (_o, s) => !s.outdoor },
  { id: "path", label: "Walking path", available: () => true },
  { id: "grab", label: "Grab bar zones", available: (o) => o.grabZones.length > 0 },
  { id: "nonSlip", label: "Non-slip zones", available: (o) => o.nonSlipZones.length > 0 },
  { id: "night", label: "Night-light path", available: (o) => o.nightLights.length > 0 },
];

/** Overlays are drawn in code: flat, static shapes (no animation). */
function OverlayMeshes({ overlays, shown, showLabels }: { overlays: Overlays; shown: Record<OverlayId, boolean>; showLabels: boolean }) {
  const { turningCircle: tc, walkingPath: wp } = overlays;
  const dx = wp.to[0] - wp.from[0];
  const dz = wp.to[1] - wp.from[1];
  const len = Math.hypot(dx, dz);
  const blocked = wp.blockedBy.length > 0;
  return (
    <group>
      {shown.turning && tc && (
        <group position={[tc.center[0], 0.016, tc.center[1]]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh>
            <circleGeometry args={[tc.radius, 48]} />
            <meshBasicMaterial color="#2f6f9e" transparent opacity={0.18} toneMapped={false} depthWrite={false} />
          </mesh>
          <mesh>
            <ringGeometry args={[tc.radius - 0.04, tc.radius, 64]} />
            <meshBasicMaterial color="#2f6f9e" transparent opacity={0.8} toneMapped={false} />
          </mesh>
        </group>
      )}
      {shown.path && (
        <mesh position={[(wp.from[0] + wp.to[0]) / 2, 0.014, (wp.from[1] + wp.to[1]) / 2]} rotation={[-Math.PI / 2, 0, -Math.atan2(dz, dx)]}>
          <planeGeometry args={[len, wp.width]} />
          <meshBasicMaterial color={blocked ? "#e0a030" : "#3a9a5b"} transparent opacity={0.32} toneMapped={false} depthWrite={false} />
        </mesh>
      )}
      {shown.grab &&
        overlays.grabZones.map((z) => (
          <group key={z.key}>
            <mesh position={z.position}>
              <boxGeometry args={z.size} />
              <meshBasicMaterial color="#d64545" transparent opacity={0.4} toneMapped={false} />
            </mesh>
            {showLabels && (
              <Html position={[z.position[0], z.position[1] + z.size[1] / 2 + 0.2, z.position[2]]} center zIndexRange={[19, 0]}>
                <span className="room3d-label kind-overlay" aria-hidden="true">
                  {z.label}
                </span>
              </Html>
            )}
          </group>
        ))}
      {shown.nonSlip &&
        overlays.nonSlipZones.map((z) => (
          <mesh key={z.key} position={z.position}>
            <boxGeometry args={z.size} />
            <meshBasicMaterial color="#2f6f9e" transparent opacity={0.35} toneMapped={false} depthWrite={false} />
          </mesh>
        ))}
      {shown.night &&
        overlays.nightLights.map((p, i) => (
          <mesh key={i} position={p}>
            <boxGeometry args={[0.07, 0.07, 0.07]} />
            <meshStandardMaterial color="#ffd27a" emissive="#ffc04d" emissiveIntensity={1.2} />
          </mesh>
        ))}
    </group>
  );
}

export function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Props {
  room: RoomId;
  profile: HomeProfile;
  done: readonly string[];
  selected?: Concern | null;
  onSelect?(concern: Concern): void;
}

/** Interactive illustrative 3D view of one room with the plan's issues highlighted. */
export default function RoomView3D({ room, profile, done, selected = null, onSelect }: Props) {
  const scene = useMemo(() => buildRoomScene(room, profile, done), [room, profile, done]);
  const webgl = useMemo(hasWebGL, []);
  const reducedMotion = useMemo(prefersReducedMotion, []);
  const roomName = scene.label; // e.g. "Living room + entrance"
  const select = (c: Concern) => onSelect?.(c);
  const [showLabels, setShowLabels] = useState(true);
  const overlays = useMemo(() => computeOverlays(scene), [scene]);
  const [shown, setShown] = useState<Record<OverlayId, boolean>>({ turning: false, path: false, grab: false, nonSlip: false, night: false });
  const friendly = (key: string) => {
    const b = scene.furniture.find((x) => x.key === key);
    return (b?.item ? FURNITURE_LABELS[b.item].label : key.replace(/[-_]\d*$/, "").replace(/[-_]/g, " ")).toLowerCase();
  };
  // Contact shadows are baked once; re-bake when a model finishes loading so it gets a shadow too.
  const [modelsLoaded, setModelsLoaded] = useState(0);
  const onModelReady = useCallback(() => setModelsLoaded((n) => n + 1), []);

  return (
    <figure className="room3d">
      {webgl ? (
        <div
          className="room3d-canvas"
          role="img"
          aria-label={`Illustrative 3D view of the ${roomName.toLowerCase()} with ${scene.issues.length} highlighted issues. The same issues are listed below.`}
        >
          <span className="room3d-chip" aria-hidden="true">
            {roomName}
          </span>
          <Canvas
            frameloop="demand"
            dpr={[1, 1.5]}
            camera={{ position: [0.4, 4.4, 7.4], fov: 42, near: 0.1, far: 50 }}
            gl={{ antialias: true, powerPreference: "low-power" }}
          >
            <color attach="background" args={[scene.outdoor ? "#e3eef5" : "#f3f1ec"]} />
            <fog attach="fog" args={[scene.outdoor ? "#e3eef5" : "#f3f1ec", 12, 22]} />
            <hemisphereLight args={["#ffffff", "#c8b9a2", 0.55]} />
            <directionalLight position={[3.5, 6, 4]} intensity={1.05} color="#fff6ea" />
            <directionalLight position={[-4, 3, 2]} intensity={0.25} color="#dfe8ff" />
            {/* Soft studio reflections, rendered once locally (no HDR download). */}
            <Environment resolution={64} frames={1}>
              <Lightformer form="rect" intensity={1.6} position={[0, 4, 2]} scale={[8, 3, 1]} rotation-x={Math.PI / 2} />
              <Lightformer form="rect" intensity={0.6} position={[-5, 2, 0]} scale={[3, 3, 1]} rotation-y={Math.PI / 2} />
              <Lightformer form="rect" intensity={0.6} position={[5, 2, 0]} scale={[3, 3, 1]} rotation-y={-Math.PI / 2} />
            </Environment>

            {scene.outdoor ? <OutdoorShell scene={scene} /> : <Shell scene={scene} />}
            {scene.furniture.map((b) => (
              <Furniture key={b.key} b={b} onModelReady={onModelReady} />
            ))}
            {scene.issues.map((issue) => {
              const isSelected = selected === issue.concern;
              const color = STATUS_COLORS[issue.status];
              return (
                <group key={issue.concern}>
                  {issue.boxes.map((b) => (
                    <Mesh key={b.key} b={b} glow={color} highlighted={isSelected} onSelect={() => select(issue.concern)} />
                  ))}
                  {/* Floor ring marking the issue */}
                  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[issue.labelAt[0], 0.012, issue.labelAt[2]]}>
                    <ringGeometry args={[isSelected ? 0.34 : 0.3, isSelected ? 0.44 : 0.38, 40]} />
                    <meshBasicMaterial color={color} transparent opacity={isSelected ? 0.85 : 0.5} toneMapped={false} />
                  </mesh>
                </group>
              );
            })}
            {/* In-scene labels: fixed pixel size, so they stay readable while rotating and zooming. */}
            {showLabels &&
              scene.labels.map((l) => (
                <Html key={l.id} position={l.at} center zIndexRange={[20, 0]}>
                  {/* Mouse/touch shortcut only; keyboard and screen-reader users use the label list below. */}
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    className={`room3d-label kind-${l.kind} status-${l.status}${selected === l.concern ? " selected" : ""}`}
                    onClick={() => l.concern && select(l.concern)}
                  >
                    <span className="room3d-dot" style={{ background: STATUS_COLORS[l.status] }} />
                    {l.text}
                  </button>
                </Html>
              ))}

            <OverlayMeshes overlays={overlays} shown={shown} showLabels={showLabels} />

            {/* Soft grounding shadow, baked once per room. */}
            <ContactShadows
              key={`${room}-${modelsLoaded}`}
              position={[0, 0.006, 0]}
              scale={[scene.width, scene.depth]}
              resolution={512}
              blur={2.6}
              opacity={0.38}
              far={2.6}
              frames={1}
            />

            <OrbitControls
              makeDefault
              target={[0, 0.8, 0]}
              enablePan={false}
              enableDamping={!reducedMotion} // no coasting motion when reduced motion is requested
              autoRotate={false}
              minDistance={4}
              maxDistance={11}
              minPolarAngle={0.2}
              maxPolarAngle={Math.PI / 2 - 0.12} // stay above the floor
            />
          </Canvas>
        </div>
      ) : (
        <p className="room3d-fallback" role="status">
          {UNSUPPORTED_MESSAGE} Your checklist below has everything.
        </p>
      )}

      <figcaption>
        <p className="room3d-note">
          <strong>Illustrative layout, not to scale.</strong>
          {webgl && " Drag to rotate, scroll or pinch to zoom."}{" "}
          {scene.fromAnswers
            ? "Shows the furniture you told us about, in example positions."
            : "Furniture positions are examples, not your home."}
        </p>
        {webgl && (
          <div className="room3d-toolbar" role="group" aria-label="3D view options">
            {scene.labels.length > 0 && (
              <button type="button" className="button small" aria-pressed={showLabels} onClick={() => setShowLabels((v) => !v)}>
                {showLabels ? "Hide labels" : "Show labels"}
              </button>
            )}
            {OVERLAY_TOGGLES.filter((o) => o.available(overlays, scene)).map((o) => (
              <button
                key={o.id}
                type="button"
                className="button small"
                aria-pressed={shown[o.id]}
                onClick={() => setShown((s) => ({ ...s, [o.id]: !s[o.id] }))}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
        <ul className="room3d-legend" aria-label="Colour key">
          {(Object.keys(STATUS_LABELS) as IssueStatus[]).map((s) => (
            <li key={s}>
              <span className="swatch" style={{ background: STATUS_COLORS[s] }} aria-hidden="true" />
              {STATUS_LABELS[s]}
            </li>
          ))}
        </ul>
        {scene.issues.length === 0 ? (
          <p className="hint">No issues were noted for the {roomName.toLowerCase()}.</p>
        ) : (
          <ul className="room3d-issues" aria-label={`Issues in the ${roomName.toLowerCase()}`}>
            {scene.issues.map((i) => (
              <li key={i.concern}>
                <button
                  type="button"
                  className="room3d-issue"
                  aria-pressed={selected === i.concern}
                  onClick={() => select(i.concern)}
                >
                  <span className="swatch" style={{ background: STATUS_COLORS[i.status] }} aria-hidden="true" />
                  {i.label} — {STATUS_LABELS[i.status]}
                </button>
              </li>
            ))}
          </ul>
        )}
        {scene.labels.length > 0 && (
          <details className="room3d-label-list">
            <summary>All labels in this view ({scene.labels.length + 1})</summary>
            <ul aria-label="All labels in this view">
              <li>Room: {roomName}</li>
              {scene.labels.map((l) => (
                <li key={l.id}>
                  {l.concern ? (
                    <button type="button" className="link-button" onClick={() => select(l.concern!)}>
                      {l.text}
                    </button>
                  ) : (
                    l.text
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
        <div className="room3d-check">
          <h4>Accessibility check (illustrative)</h4>
          <ul aria-label="Accessibility check" aria-live="polite">
            {!scene.outdoor && (
              <li>
                {overlays.turningCircle
                  ? "A clear 1.5 m wheelchair turning space fits in this layout."
                  : "No clear 1.5 m turning space in this layout — moving furniture could make room."}
              </li>
            )}
            <li>
              {overlays.walkingPath.blockedBy.length === 0
                ? "The walking route from the door is clear."
                : `The walking route from the door passes: ${overlays.walkingPath.blockedBy.map(friendly).join(", ")}.`}
            </li>
            {overlays.grabZones.length > 0 && <li>{overlays.grabZones.length} grab bar / handrail zone(s) — to be installed by a professional.</li>}
            {overlays.nonSlipZones.length > 0 && <li>Non-slip zones: {overlays.nonSlipZones.map((z) => z.label.replace("Non-slip zone: ", "")).join(", ")}.</li>}
            {overlays.nightLights.length > 0 && <li>Night-light route from the bed to the {scene.attachedDoor ? "attached bathroom" : "door"}.</li>}
          </ul>
        </div>
      </figcaption>
    </figure>
  );
}
