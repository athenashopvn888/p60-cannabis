import { SheetUnavailable } from "./errors.ts";
import { buildStockClosingReport, type StockClosingReportInput } from "./stockClosingReport.ts";

type EmailPayload = {
  row_id?: string;
  to?: string;
  cc?: string;
  subject?: string;
  body?: string;
  attachment_name?: string;
  attachment_report_json?: string;
};

export function accountantEmailWebhookConfigured() {
  return Boolean(process.env.PNY_EMAIL_WEBHOOK_URL && process.env.PNY_EMAIL_WEBHOOK_SECRET);
}

export async function deliverAccountantEmail(payload: EmailPayload) {
  const url = process.env.PNY_EMAIL_WEBHOOK_URL;
  const secret = process.env.PNY_EMAIL_WEBHOOK_SECRET;
  if (!url || !secret) throw new SheetUnavailable("The accountant email sender is not configured.");
  let attachmentBase64 = "";
  if (payload.attachment_report_json) {
    let report: StockClosingReportInput;
    try {
      report = JSON.parse(payload.attachment_report_json) as StockClosingReportInput;
    } catch {
      throw new SheetUnavailable("The closing report attachment data is invalid.");
    }
    attachmentBase64 = (await buildStockClosingReport(report)).toString("base64");
  }
  const email = { ...payload };
  delete email.attachment_report_json;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...email,
      secret,
      attachment_base64: attachmentBase64,
      attachment_mime: attachmentBase64 ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "",
    }),
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new SheetUnavailable(`Accountant email sender failed (${response.status}): ${text.slice(0, 160)}`);
  let result: { ok?: boolean; error?: string } = {};
  try {
    result = JSON.parse(text) as { ok?: boolean; error?: string };
  } catch {
    throw new SheetUnavailable("Accountant email sender returned an invalid response.");
  }
  if (!result.ok) throw new SheetUnavailable(result.error || "Accountant email sender rejected the message.");
}
