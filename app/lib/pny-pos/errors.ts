export class PosError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "PosError";
    this.status = status;
    this.code = code;
  }
}

export class SheetUnavailable extends Error {
  code = "SHEET_UNAVAILABLE";
  constructor(message = "Inventory sheet is unreachable.") {
    super(message);
    this.name = "SheetUnavailable";
  }
}
