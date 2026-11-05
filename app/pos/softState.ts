/** A real 401 replaces the till. Any other failure leaves the signed-in screen up. */
export async function readTillState(apiBase: string): Promise<
  { keep: true; message: string } | { keep: false; data: Record<string, unknown> }
> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}/state`, { cache: "no-store", credentials: "same-origin" });
  } catch {
    return { keep: true, message: "The till could not be reached. Try again." };
  }
  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    return { keep: true, message: "The till could not be reached. Try again." };
  }
  if (!response.ok && response.status !== 401) {
    const message = typeof data.error === "string" ? data.error : "The till could not be reached. Try again.";
    const code = typeof data.code === "string" ? data.code : "";
    return { keep: true, message: code ? `${message} (${code})` : message };
  }
  return { keep: false, data };
}
