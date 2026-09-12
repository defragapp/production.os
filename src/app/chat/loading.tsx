export default function ChatLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-10">
      <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
      <div className="flex flex-1 flex-col justify-end gap-4">
        <div className="h-14 w-3/5 animate-pulse rounded-2xl bg-muted" />
        <div className="ml-auto h-14 w-2/5 animate-pulse rounded-2xl bg-muted" />
        <div className="h-14 w-1/2 animate-pulse rounded-2xl bg-muted" />
      </div>
      <div className="h-12 w-full animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
