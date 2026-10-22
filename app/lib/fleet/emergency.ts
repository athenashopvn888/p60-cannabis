export const EDGE_CONFIG_ENV = "EDGE_CONFIG";

/** Edge Config contentMode="coded" turns every sheet feature off, articles included. */
export async function readEmergencyCoded(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const connection = process.env[EDGE_CONFIG_ENV];
  if (!connection) return false;
  try {
    const url = new URL(connection);
    const token = url.searchParams.get("token");
    url.searchParams.delete("token");
    const itemUrl = `${url.origin}${url.pathname.replace(/\/$/, "")}/item/contentMode`;
    const response = await fetchImpl(itemUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    if (!response.ok) return false;
    const body = await response.json();
    return body === "coded" || body?.value === "coded";
  } catch {
    return false;
  }
}
