import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { useMemo } from "react";
import { ROOM_LABELS, type Concern, type HomeProfile, type RoomType } from "@nooksure/shared";
import { DOOR, STATUS_COLORS, STATUS_LABELS, buildRoomScene, type Box, type IssueStatus, type RoomScene } from "./sceneModel";

const WALL = "#d9d4c7";
const FLOOR = "#c9bfae";
const WALL_T = 0.08;

export const UNSUPPORTED_MESSAGE = "3D view isn't supported on this device.";

function Mesh({ b, onSelect }: { b: Box; onSelect?: () => void }) {
  const click = onSelect
    ? (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect();
      }
    : undefined;
  return (
    <mesh
      position={b.position}
      onClick={click}
      onPointerOver={onSelect ? () => (document.body.style.cursor = "pointer") : undefined}
      onPointerOut={onSelect ? () => (document.body.style.cursor = "") : undefined}
    >
      <boxGeometry args={b.size} />
      <meshStandardMaterial color={b.color} roughness={0.85} />
    </mesh>
  );
}

function Shell({ scene }: { scene: RoomScene }) {
  const { width: w, depth: d, wallHeight: h } = scene;
  const doorFront = DOOR.z + DOOR.width / 2; // door gap spans [DOOR.z - w/2, DOOR.z + w/2]
  const doorBack = DOOR.z - DOOR.width / 2;
  const leftBackLen = doorBack + d / 2;
  const leftFrontLen = d / 2 - doorFront;
  const wall = (key: string, position: [number, number, number], size: [number, number, number]) => (
    <Mesh key={key} b={{ key, position, size, color: WALL }} />
  );
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={FLOOR} roughness={1} />
      </mesh>
      {wall("back", [0, h / 2, -d / 2], [w, h, WALL_T])}
      {wall("right", [w / 2, h / 2, 0], [WALL_T, h, d])}
      {wall("left-back", [-w / 2, h / 2, -d / 2 + leftBackLen / 2], [WALL_T, h, leftBackLen])}
      {wall("left-front", [-w / 2, h / 2, d / 2 - leftFrontLen / 2], [WALL_T, h, leftFrontLen])}
      {wall("lintel", [-w / 2, h - 0.25, DOOR.z], [WALL_T, 0.5, DOOR.width])}
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
  room: RoomType;
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
  const roomName = ROOM_LABELS[room];
  const select = (c: Concern) => onSelect?.(c);

  return (
    <figure className="room3d">
      {webgl ? (
        <div
          className="room3d-canvas"
          role="img"
          aria-label={`Illustrative 3D view of the ${roomName.toLowerCase()} with ${scene.issues.length} highlighted issues. The same issues are listed below.`}
        >
          <Canvas
            frameloop="demand"
            dpr={[1, 1.5]}
            camera={{ position: [0, 4.6, 7.2], fov: 45, near: 0.1, far: 50 }}
            gl={{ antialias: true, powerPreference: "low-power" }}
          >
            <color attach="background" args={["#eef1ee"]} />
            <hemisphereLight args={["#ffffff", "#b9ad98", 0.9]} />
            <ambientLight intensity={0.35} />
            <directionalLight position={[3, 6, 4]} intensity={0.8} />

            <Shell scene={scene} />
            {scene.furniture.map((b) => (
              <Mesh key={b.key} b={b} />
            ))}
            {scene.issues.map((issue) => (
              <group key={issue.concern}>
                {issue.boxes.map((b) => (
                  <Mesh key={b.key} b={b} onSelect={() => select(issue.concern)} />
                ))}
                <Html position={issue.labelAt} center zIndexRange={[20, 0]}>
                  {/* Mouse/touch shortcut only; keyboard users use the list below. */}
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    className={`room3d-label status-${issue.status}${selected === issue.concern ? " selected" : ""}`}
                    onClick={() => select(issue.concern)}
                  >
                    {issue.label}
                  </button>
                </Html>
              </group>
            ))}

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
          {webgl && " Drag to rotate, scroll or pinch to zoom."} Furniture positions are examples, not your home.
        </p>
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
      </figcaption>
    </figure>
  );
}
