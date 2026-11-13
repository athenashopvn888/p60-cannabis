export async function startClosingWithRecovery(
  start: (signal: AbortSignal) => Promise<void>,
  recover: () => Promise<boolean>,
  timeoutMs = 12_000,
) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    await start(controller.signal);
    return { recovered: false };
  } catch (error) {
    if (await recover()) return { recovered: true };
    if (timedOut) throw new Error("The close start timed out and could not be confirmed. Try again.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
