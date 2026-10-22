import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Float, Lightformer, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { MODELS, type Vec3 } from "../room3d/sceneModel";

/**
 * Decorative hero scene: a small cut-away living room built from the same verified
 * furniture models as the planner's 3D view. Sways gently, floats and follows the
 * mouse a little; with reduced motion it's a still picture that renders once.
 */

interface Piece {
  id: string;
  at: Vec3;
  /** Turn about the vertical axis (models face +z). */
  rot?: number;
  scale?: number;
}

const QUARTER = Math.PI / 2;
const PIECES: Piece[] = [
  { id: "sofa", at: [0, 0, -0.95] },
  { id: "throw-pillows", at: [0, 0.4, -0.9], scale: 0.82 },
  { id: "coffee-table", at: [0, 0, 0.1], rot: QUARTER },
  { id: "vase", at: [0.22, 0.39, 0.1] },
  { id: "armchair", at: [1.18, 0, 0.15], rot: -QUARTER, scale: 0.95 },
  { id: "side-table", at: [-1.15, 0, -1.08], scale: 0.9 },
  { id: "potted-plant", at: [1.2, 0, -1.08], scale: 0.8 },
];

const url = (id: string) => `${import.meta.env.BASE_URL}${MODELS[id]!.file}`;

function Model({ id, at, rot = 0, scale = 1 }: Piece) {
  // These files aren't Draco-compressed: never fetch a decoder.
  const { scene } = useGLTF(url(id), false);
  const object = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={object} position={at} rotation={[0, rot, 0]} scale={scale} />;
}

const WALL = "#e4e9e3";
const W = 3.4; // floor width (x)
const D = 3.0; // floor depth (z)
const H = 1.8; // wall height: low, so the cut-away reads as a diorama

function Room() {
  return (
    <group>
      {/* Floor slab, back wall and left wall: a cut-away corner. */}
      <mesh position={[0, -0.06, 0]}>
        <boxGeometry args={[W, 0.12, D]} />
        <meshStandardMaterial color="#c9a27e" roughness={0.85} />
      </mesh>
      <mesh position={[0, H / 2, -D / 2 - 0.04]}>
        <boxGeometry args={[W, H, 0.08]} />
        <meshStandardMaterial color={WALL} roughness={0.95} />
      </mesh>
      <mesh position={[-W / 2 - 0.04, H / 2, -0.04]}>
        <boxGeometry args={[0.08, H, D + 0.08]} />
        <meshStandardMaterial color={WALL} roughness={0.95} />
      </mesh>
      {/* Framed window on the left wall, softly glowing. */}
      <mesh position={[-W / 2 + 0.01, 1.1, 0.25]}>
        <boxGeometry args={[0.03, 0.78, 1.08]} />
        <meshStandardMaterial color="#f6f3ee" roughness={0.6} />
      </mesh>
      <mesh position={[-W / 2 + 0.03, 1.1, 0.25]} rotation={[0, QUARTER, 0]}>
        <planeGeometry args={[0.96, 0.66]} />
        <meshStandardMaterial color="#dbeef5" emissive="#dbeef5" emissiveIntensity={0.7} />
      </mesh>
      {/* Rug in the brand green. */}
      <mesh position={[0, 0.006, 0.05]}>
        <boxGeometry args={[2.0, 0.012, 1.35]} />
        <meshStandardMaterial color="#2c7a66" roughness={1} />
      </mesh>
      {PIECES.map((p) => (
        <Model key={p.id} {...p} />
      ))}
    </group>
  );
}

/** Slow side-to-side turn of the whole room. */
function Sway({ still, children }: { still: boolean; children: React.ReactNode }) {
  // Structural type: the repo has two @types/three copies, so avoid naming three's classes.
  const group = useRef<{ rotation: { y: number } } | null>(null);
  useFrame(({ clock }) => {
    if (still || !group.current) return;
    group.current.rotation.y = -0.45 + Math.sin(clock.elapsedTime * 0.22) * 0.28;
  });
  return (
    <group
      ref={(g) => {
        group.current = g;
      }}
      rotation={[0, -0.45, 0]}
    >
      {children}
    </group>
  );
}

const CAMERA: Vec3 = [4.7, 3.4, 6.5];
const LOOK: Vec3 = [0.3, 0.5, -0.25];

/** Camera eases toward the mouse position anywhere on the page (a small parallax). */
function Parallax({ still }: { still: boolean }) {
  const camera = useThree((s) => s.camera);
  const pointer = useRef({ x: 0, y: 0 });
  useEffect(() => {
    if (still) return;
    const onMove = (e: PointerEvent) => {
      pointer.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 };
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [still]);
  useFrame(() => {
    if (!still) {
      const p = camera.position;
      p.x += (CAMERA[0] + pointer.current.x * 0.45 - p.x) * 0.04;
      p.y += (CAMERA[1] - pointer.current.y * 0.3 - p.y) * 0.04;
    }
    camera.lookAt(...LOOK);
  });
  return null;
}

export default function HeroScene({ still, active }: { still: boolean; active: boolean }) {
  return (
    <Canvas
      // Renders continuously only while on screen and animating; a still picture otherwise.
      frameloop={still ? "demand" : active ? "always" : "never"}
      dpr={[1, 1.5]}
      camera={{ position: CAMERA, fov: 30, near: 0.1, far: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
    >
      <hemisphereLight args={["#ffffff", "#9fb8a8", 0.7]} />
      <directionalLight position={[3, 5, 3]} intensity={1.1} color="#fff4e6" />
      <directionalLight position={[-3, 2, 4]} intensity={0.3} color="#dfeee8" />
      {/* Soft reflections rendered locally (no HDR download). */}
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={1.5} position={[0, 4, 2]} scale={[8, 3, 1]} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={0.5} position={[-5, 2, 0]} scale={[3, 3, 1]} rotation-y={Math.PI / 2} />
      </Environment>
      <Parallax still={still} />
      <Suspense fallback={null}>
        {still ? (
          <group rotation={[0, -0.45, 0]}>
            <Room />
          </group>
        ) : (
          <Float speed={1.1} rotationIntensity={0.08} floatIntensity={0.35} floatingRange={[-0.04, 0.06]}>
            <Sway still={still}>
              <Room />
            </Sway>
          </Float>
        )}
      </Suspense>
    </Canvas>
  );
}
