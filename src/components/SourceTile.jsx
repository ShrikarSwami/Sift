import { Phone, Mail, Users, FileText, ExternalLink } from "lucide-react";

const ICONS = { call: Phone, email: Mail, meeting: Users, docs: FileText };
const LABELS = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  docs: "Docs",
};

/**
 * A data source Sift can read from. Present sources are selectable; absent ones
 * stay in the row as disabled tiles so the reader can see what is missing —
 * that gap is itself information about the relationship.
 *
 * A source may carry an `action` (an external hand-off, e.g. opening the thread
 * in Gmail). It renders as its own button layered above the tile, so the two
 * click targets never nest.
 */
export function SourceTile({ sourceKey, source, active, onSelect }) {
  const Icon = ICONS[sourceKey];
  const available = Boolean(source);
  const action = source?.action;
  const live = Boolean(source?.live);

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        disabled={!available}
        onClick={() => onSelect(sourceKey)}
        aria-pressed={available ? active : undefined}
        className={[
          "group flex w-full min-w-0 flex-col gap-2.5 rounded-lg border p-4 text-left transition-all duration-150 ease-out",
          !available &&
            "cursor-not-allowed border-dashed border-line bg-transparent",
          available &&
            !active &&
            "cursor-pointer border-line bg-ink-2 hover:border-line-strong hover:bg-ink-3",
          available &&
            active &&
            !live &&
            "cursor-pointer border-cherry/60 bg-brown-900",
          live &&
            "cursor-pointer animate-pulse-ring border-cherry bg-cherry-dim/40",
        ]
          .filter(Boolean)
          .join(" ")}
        style={
          live
            ? undefined
            : available && active
              ? { boxShadow: "0 5px 18px -7px rgba(210, 4, 45, 0.5)" }
              : undefined
        }
      >
        <div
          className={["flex items-center gap-2.5", action && "pr-9"]
            .filter(Boolean)
            .join(" ")}
        >
          <Icon
            size={18}
            strokeWidth={1.75}
            className={
              !available
                ? "shrink-0 text-fg-faint/50"
                : active
                  ? "shrink-0 text-cherry-bright"
                  : "shrink-0 text-brown-400 group-hover:text-fg-muted"
            }
          />
          <span
            className={[
              "truncate text-[15px] font-medium",
              !available
                ? "text-fg-faint/60"
                : active
                  ? "text-fg"
                  : "text-fg-muted",
            ].join(" ")}
          >
            {LABELS[sourceKey]}
          </span>
          {live && (
            <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded bg-cherry px-1.5 py-0.5 text-[10px] font-bold tracking-[0.12em] text-white uppercase">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              Rec
            </span>
          )}
        </div>
        <span
          className={[
            "truncate text-[14px]",
            available ? "text-fg-faint" : "text-fg-faint/50",
          ].join(" ")}
        >
          {available ? source.meta : "Not connected"}
        </span>
      </button>

      {action && (
        <button
          type="button"
          onClick={() =>
            window.open(action.url, "_blank", "noopener,noreferrer")
          }
          title={action.label}
          aria-label={action.label}
          className="absolute top-3 right-3 grid h-8 w-8 cursor-pointer place-items-center rounded-md border border-line-strong bg-ink-3 text-fg-muted transition-colors duration-150 ease-out hover:border-cherry/60 hover:bg-cherry-dim/40 hover:text-fg"
        >
          <ExternalLink size={15} strokeWidth={1.9} />
        </button>
      )}
    </div>
  );
}
