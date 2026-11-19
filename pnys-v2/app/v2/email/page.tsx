import Link from "next/link";
import { buildCloseReportBundle } from "@/src/domain/report";
import { loadLatestClose } from "@/src/server/readModel";
import { OutboxReview } from "./OutboxReview";

export const dynamic = "force-dynamic";

export default async function EmailPage() {
  const { input, result } = await loadLatestClose("ACD01");
  const report = buildCloseReportBundle(input, result);
  return (
    <div className="stack">
      <section className="card">
        <div className="eyebrow">Approved-send outbox · preview only</div>
        <h1>Email + XLS parity</h1>
        <p className="notice warning">No email is sent automatically. A Master Admin must press Send after reviewing the same stored result used by the close screen and XLS.</p>
        <div className="grid grid2">
          <div className="metric"><span>Subject</span><strong style={{ fontSize: "1rem" }}>{report.subject}</strong></div>
          <div className="metric"><span>Parity hash</span><strong style={{ fontSize: "1rem" }}>{report.parityHash.slice(0, 16)}</strong></div>
        </div>
      </section>
      <section className="card">
        <h2>Actual plain-text body</h2>
        <div className="emailPreview">{report.body}</div>
      </section>
      <section className="card">
        <h2>Accountant workbook</h2>
        <p>{report.xlsFileName}</p>
        <div className="buttonRow">
          <Link className="button buttonPrimary" href="/api/v2/reports/acd01/xlsx">Download actual XLSX</Link>
          <button className="button buttonSecondary" disabled>Send (preview disabled)</button>
        </div>
      </section>
      <OutboxReview />
    </div>
  );
}
