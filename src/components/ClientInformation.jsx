import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MapPin, Quote } from "lucide-react";
import { SourceTile } from "./SourceTile";

const SOURCE_ORDER = ["call", "email", "meeting", "docs"];

function Fact({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] font-medium tracking-[0.1em] text-fg-faint uppercase">
        {label}
      </dt>
      <dd className="mt-1.5 truncate text-[17px] font-medium text-fg">
        {value}
      </dd>
    </div>
  );
}

export function ClientInformation({ client }) {
  const [openSource, setOpenSource] = useState(client.primarySource);

  useEffect(
    () => setOpenSource(client.primarySource),
    [client.id, client.primarySource],
  );

  const source = client.sources[openSource];

  return (
    <section
      aria-label="Client Information"
      className="scroll-pane border-b border-line px-6 py-6 sm:px-8 lg:flex lg:min-h-0 lg:flex-col lg:overflow-y-auto"
    >
      <div className="flex flex-wrap items-start gap-5">
        <span
          className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border border-brown-600/60 bg-brown-800 text-[19px] font-semibold text-brown-400"
          aria-hidden="true"
        >
          {client.initials}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
            <h2 className="text-[26px] leading-tight font-semibold tracking-[-0.02em] text-fg">
              {client.name}
            </h2>
            <span className="rounded-full border border-cherry/40 bg-brown-900 px-2.5 py-1 text-[12px] font-semibold tracking-[0.08em] text-cherry-bright uppercase">
              {client.stage}
            </span>
          </div>
          <p className="mt-1.5 text-[17px] text-fg-muted">
            {client.role} · {client.company}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-fg-faint">
            <MapPin size={15} strokeWidth={1.75} className="shrink-0" />
            {client.location}
            <span aria-hidden="true">·</span>
            {client.capturedAt}
            {client.email && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-fg-muted">{client.email}</span>
              </>
            )}
          </p>
        </div>

        <dl className="flex shrink-0 gap-x-12 sm:ml-auto">
          <Fact label="Ticket" value={client.ticket} />
          <Fact label="Owner" value={client.owner} />
        </dl>
      </div>

      <div className="mt-6">
        <h3 className="text-[12px] font-medium tracking-[0.1em] text-fg-faint uppercase">
          Data sources
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SOURCE_ORDER.map((key) => (
            <SourceTile
              key={key}
              sourceKey={key}
              source={client.sources[key]}
              active={openSource === key}
              onSelect={setOpenSource}
            />
          ))}
        </div>
      </div>

      <div className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
        <AnimatePresence mode="wait" initial={false}>
          {source && (
            <motion.blockquote
              key={`${client.id}-${openSource}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className={[
                "scroll-pane mt-5 overflow-y-auto rounded-lg p-5 lg:min-h-0 lg:flex-1",
                source.live
                  ? "animate-pulse-ring border border-cherry bg-brown-900"
                  : "border border-line bg-ink-2",
              ].join(" ")}
            >
              <div className="mb-4 flex items-center gap-2.5 border-b border-line pb-3">
                <Quote
                  size={16}
                  strokeWidth={1.75}
                  className="shrink-0 text-brown-400"
                  aria-hidden="true"
                />
                <span className="text-[13px] font-medium tracking-[0.08em] text-fg-muted uppercase">
                  {source.label}
                </span>
                <span className="truncate text-[13px] text-fg-faint">
                  {source.from
                    ? `${source.from} · ${source.meta}`
                    : source.meta}
                </span>
              </div>
              {source.excerpt ? (
                <p className="max-w-[68ch] text-[18px] leading-relaxed text-fg">
                  {source.excerpt}
                  {source.live && (
                    <span
                      className="ml-1 inline-block h-[1.1em] w-[2px] translate-y-[0.15em] animate-pulse bg-cherry-bright"
                      aria-hidden="true"
                    />
                  )}
                </p>
              ) : (
                <p className="text-[18px] leading-relaxed text-fg-faint italic">
                  {source.live
                    ? "Listening — start speaking…"
                    : "No transcript yet."}
                </p>
              )}
            </motion.blockquote>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
