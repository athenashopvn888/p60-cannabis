declare module "papaparse" {
  interface ParseConfig {
    header?: boolean;
    skipEmptyLines?: boolean | "greedy";
  }

  interface ParseResult<T> {
    data: T[];
  }

  interface PapaStatic {
    parse<T>(input: string, config?: ParseConfig): ParseResult<T>;
  }

  const Papa: PapaStatic;
  export default Papa;
}
