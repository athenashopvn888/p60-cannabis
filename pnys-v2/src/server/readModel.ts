import { assertCloseParity, calculateClose, type CloseInput, type CloseResult } from "@/src/domain/close";
import { queryOne, withV2Transaction } from "./db";

type StoredClose = {
  shift_id: string;
  version: number;
  input_json: CloseInput;
  result_json: CloseResult;
};

export async function loadLatestClose(storeCode: string) {
  const normalized = storeCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,12}$/.test(normalized)) throw new Error("INVALID_STORE_CODE");
  return withV2Transaction(
    { actorId: "v2-preview-reader", actorKind: "HUMAN_MASTER", storeCode: normalized },
    async (client) => {
      const row = await queryOne<StoredClose>(client, `
        select shift_id, version, input_json, result_json
          from pos_v2.close_versions
         where store_code = $1
         order by created_at desc, version desc
         limit 1
      `, [normalized]);
      const recalculated = calculateClose(row.input_json);
      assertCloseParity(row.result_json, recalculated);
      return { shiftId: row.shift_id, version: row.version, input: row.input_json, result: row.result_json };
    },
  );
}
