import { AnimatePresence, motion } from "framer-motion";
import { useClientStore } from "../store/useClientStore";
import { PipelineCard } from "./PipelineCard";

function PipelineEmpty() {
  return (
    <div className="px-6 pb-7">
      <div className="relative">
        {/* Three ghost rows: the shape of what will land, not a spinner. */}
        <div aria-hidden="true" className="space-y-3">
          {[0.5, 0.28, 0.14].map((opacity, i) => (
            <div
              key={i}
              className="h-[124px] rounded-xl border border-dashed border-line bg-ink-2/40"
              style={{ opacity }}
            />
          ))}
        </div>
        <p className="pointer-events-none absolute inset-x-0 top-0 grid h-[124px] place-content-center text-[16px] font-medium text-fg-muted">
          No conversations yet
        </p>
      </div>

      <p className="mt-6 max-w-[34ch] text-[15px] leading-relaxed text-fg-faint">
        Sift ranks every client by likelihood to invest the moment a call or
        email lands. The board fills itself — nothing to set up.
      </p>
    </div>
  );
}

export function Pipeline() {
  const clients = useClientStore((s) => s.clients);
  const selectedId = useClientStore((s) => s.selectedId);
  const lastIngestedId = useClientStore((s) => s.lastIngestedId);
  const select = useClientStore((s) => s.select);

  return (
    <section
      aria-label="Client Pipeline"
      className="flex flex-col border-b border-line bg-ink-1 lg:min-h-0 lg:border-r lg:border-b-0"
    >
      <div className="flex shrink-0 items-baseline justify-between gap-3 px-6 pt-6 pb-4">
        <h2 className="text-[16px] font-semibold tracking-[0.08em] text-fg uppercase">
          Client Pipeline
        </h2>
        <p className="text-[14px] whitespace-nowrap text-fg-faint">
          Ranked by likelihood
        </p>
      </div>

      {clients.length === 0 ? (
        <PipelineEmpty />
      ) : (
        <motion.ul
          layout
          className="scroll-pane space-y-3 px-6 pt-1 pb-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
        >
          <AnimatePresence initial={false}>
            {clients.map((client, i) => (
              <PipelineCard
                key={client.id}
                client={client}
                rank={i + 1}
                selected={client.id === selectedId}
                isNew={client.id === lastIngestedId}
                onSelect={select}
              />
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </section>
  );
}
