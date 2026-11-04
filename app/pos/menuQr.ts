import { encode } from "uqr";

export const CUSTOMER_MENU_URL = "https://www.p60cannabis.com/menu";

export function customerMenuQr() {
  return encode(CUSTOMER_MENU_URL, { ecc: "M", border: 4 });
}
