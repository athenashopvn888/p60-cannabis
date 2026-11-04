export class PosError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "PosError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class SheetUnavailable extends Error {
  code = "SHEET_UNAVAILABLE";
  httpStatus: number | null;

  constructor(message = "Inventory sheet is unreachable.", httpStatus: number | null = null) {
    super(message);
    this.name = "SheetUnavailable";
    this.httpStatus = httpStatus;
  }
}
