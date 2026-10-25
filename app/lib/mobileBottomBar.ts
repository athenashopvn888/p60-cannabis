/** In-store displays keep the public action bar off the screen. */
export function hideMobileBottomBar(pathname: string | null | undefined): boolean {
  const path = (pathname ?? "/").split("?")[0].replace(/\/+$/, "") || "/";
  return path === "/tv" || path === "/tv2";
}
