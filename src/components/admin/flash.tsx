export async function Flash({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  return (
    <>
      {error && (
        <p className="msg error" role="alert">
          {error}
        </p>
      )}
      {ok && (
        <p className="msg ok" role="status">
          {ok}
        </p>
      )}
    </>
  );
}
