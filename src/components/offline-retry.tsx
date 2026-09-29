"use client";

import { useEffect, useState } from "react";

/**
 * The one action on the offline shell: retry the connection. Deliberately a
 * full reload rather than a fetch ping — reloading the failed navigation is
 * what actually gets the user back into the app. The secondary line appears
 * only once the browser reports the network is back, so a person standing
 * still in a subway never wonders whether it's their turn yet.
 *
 * Touch target ≥ 44×44px (WCAG 2.5.8 / Apple HIG).
 */
export function OfflineRetry() {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <div className="mt-10 flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="btn-focal min-h-[48px] min-w-[200px] rounded-md px-8 py-3 text-sm font-semibold"
      >
        Retry connection
      </button>
      {online && (
        <p className="text-xs text-muted-foreground" role="status">
          Signal is back — tap retry.
        </p>
      )}
    </div>
  );
}
