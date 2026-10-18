import { Component, Suspense, lazy, type ComponentProps, type ReactNode } from "react";

// three.js + R3F load only when the 3D view is first shown, keeping the main bundle small.
const RoomView3D = lazy(() => import("./RoomView3D"));

// Kept here (not imported from RoomView3D) so this file never pulls three.js into the main bundle.
const UNSUPPORTED = "3D view isn't supported on this device.";

class ViewErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="room3d-fallback" role="status">
        {UNSUPPORTED} Your checklist below has everything.
      </p>
    ) : (
      this.props.children
    );
  }
}

export function LazyRoomView3D(props: ComponentProps<typeof RoomView3D>) {
  return (
    <ViewErrorBoundary>
      <Suspense fallback={<p className="hint room3d-loading">Loading 3D view…</p>}>
        <RoomView3D {...props} />
      </Suspense>
    </ViewErrorBoundary>
  );
}
