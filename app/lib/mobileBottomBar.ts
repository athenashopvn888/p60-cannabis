/** In-store displays and the staff till / QR menu keep the public action bar off the screen. */
export function hideMobileBottomBar(pathname: string | null | undefined): boolean {
  const path = (pathname ?? "/").split("?")[0].replace(/\/+$/, "") || "/";
  return path === "/tv" || path === "/tv2" || path === "/pos" || path.startsWith("/pos/") || path === "/pos2" || path.startsWith("/pos2/") || path === "/menu" || path.startsWith("/menu/") || path === "/menu2" || path.startsWith("/menu2/") || path === "/kitchen" || path.startsWith("/kitchen/");
}
