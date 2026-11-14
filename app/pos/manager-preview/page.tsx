import ManagerApp from "../manager/ManagerApp";

type Props = { searchParams: Promise<{ screen?: string; mode?: string }> };

export default async function ManagerPreviewPage({ searchParams }: Props) {
  const params = await searchParams;
  const value = params.screen ?? "overview";
  const allowed = new Set(["login", "overview", "stock", "refills", "closings", "customers", "audit"]);
  const screen = allowed.has(value) ? value : "overview";
  return <ManagerApp preview={screen as "login" | "overview" | "stock" | "refills" | "closings" | "customers" | "audit"} previewMode={params.mode === "no-weed" ? "no-weed" : "weed"} />;
}
