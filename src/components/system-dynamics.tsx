"use client";

import { Eyebrow } from "@/components/ui/eyebrow";

const SYSTEM_NODES = [
  {
    role: "The Peacemaker",
    dynamic: "Absorbs unspoken tension before others notice it; loses track of personal boundaries.",
    shift: "Notice the reflex to smooth things over before anyone asks you to.",
  },
  {
    role: "The Anchor",
    dynamic: "Expected to remain steady during turmoil; rarely given room to be uncertain.",
    shift: "Give yourself permission to pause before offering the solution.",
  },
];

export function SystemDynamics() {
  return (
    <div className="glass-panel rounded-panel p-6 text-left md:p-8">
      <Eyebrow scale="sm" className="mb-3 text-center">Inherited roles & unwritten rules</Eyebrow>
      <div className="grid gap-3 sm:grid-cols-2">
        {SYSTEM_NODES.map((node) => (
          <div key={node.role} className="rounded-md border border-border/60 bg-background/40 p-4">
            <p className="font-display text-base font-normal text-foreground">{node.role}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{node.dynamic}</p>
            <p className="mt-2 border-t border-border/40 pt-2 text-xs italic text-foreground/80">{node.shift}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground/70">
        Mapping dynamics in the room without blame or villains.
      </p>
    </div>
  );
}
