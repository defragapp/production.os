export default function BaselineLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-14">
      <div className="h-10 w-64 animate-pulse rounded-md bg-muted" />
      <div className="h-5 w-96 max-w-full animate-pulse rounded-md bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}
