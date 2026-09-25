import { TopBar } from "./components/TopBar";
import { Pipeline } from "./components/Pipeline";
import { Inspector } from "./components/Inspector";
import { DebugCorner } from "./components/DebugCorner";
import { Toasts } from "./components/Toasts";
import { useDemoKeys, useRemoteWarmup, useHotMic } from "./hooks/useDemoKeys";

export default function App() {
  useHotMic();
  useDemoKeys();
  useRemoteWarmup();

  return (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] bg-ink-0">
      <TopBar />
      {/*
        Strict two-pane split at 30 / 70, each pane scrolling independently.
        Below lg the split collapses into one document-scroll column — a fixed
        38% pane on a phone would leave both halves unusable.
      */}
      <main className="scroll-pane min-h-0 overflow-y-auto lg:grid lg:grid-cols-[30%_70%] lg:overflow-hidden">
        <Pipeline />
        <Inspector />
      </main>
      <Toasts />
      <DebugCorner />
    </div>
  );
}
