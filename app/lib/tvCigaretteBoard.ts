/** TV2 card list for the live cigarette flag. Off keeps this store's current board: the card is removed. */
export function visibleTv2Cards<T extends { id: string }>(cards: readonly T[], showCigarettes: boolean): T[] {
  return showCigarettes ? [...cards] : cards.filter((card) => card.id !== "CIGARETTES");
}
