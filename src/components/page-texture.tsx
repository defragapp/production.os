/**
 * Fixed texture layers — film grain + corner vignette — shared by every
 * public marketing surface so the whole site carries the same
 * "photographed stage" finish instead of flat black. Purely decorative and
 * inert; z-indexes sit under the nav (z-50).
 */
export function PageTexture() {
  return (
    <>
      <div className="vignette-overlay" aria-hidden="true" />
      <div className="grain-overlay" aria-hidden="true" />
    </>
  );
}
