import { AnimatePresence, motion } from "framer-motion";
import { useSelectedClient } from "../store/useClientStore";
import { ClientInformation } from "./ClientInformation";
import { ScoreDashboard } from "./ScoreDashboard";

function InspectorEmpty() {
  return (
    <div className="grid place-content-center px-8 py-24 text-center lg:h-full lg:py-0">
      <svg
        width="56"
        height="56"
        viewBox="0 0 44 44"
        fill="none"
        strokeWidth="1.25"
        strokeLinecap="round"
        className="mx-auto"
        aria-hidden="true"
      >
        <path
          d="M6 8h32L26 22v13l-8 5V22L6 8Z"
          stroke="var(--color-brown-600)"
        />
        <path d="M14 13h16" stroke="var(--color-line-strong)" />
      </svg>
      <h2 className="mt-6 text-[19px] font-semibold text-fg">
        Nothing selected
      </h2>
      <p className="mx-auto mt-3 max-w-[42ch] text-[16px] leading-relaxed text-fg-muted">
        Pick a client from the pipeline to see their profile, the conversations
        Sift read, and how the three conviction scores were reached.
      </p>
    </div>
  );
}

export function Inspector() {
  const client = useSelectedClient();

  if (!client) {
    return (
      <section aria-label="Client Inspector" className="bg-ink-0 lg:min-h-0">
        <InspectorEmpty />
      </section>
    );
  }

  return (
    <section
      aria-label="Client Inspector"
      className="bg-ink-0 lg:grid lg:min-h-0 lg:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      <ClientInformation client={client} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={client.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="lg:grid lg:min-h-0"
        >
          <ScoreDashboard client={client} />
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
