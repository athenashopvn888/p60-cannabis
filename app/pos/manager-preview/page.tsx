import ManagerApp from "../manager/ManagerApp";

type Props = { searchParams: Promise<{ screen?: string }> };

export default async function ManagerPreviewPage({ searchParams }: Props) {
  const value = (await searchParams).screen ?? "overview";
  const allowed = new Set(["login", "overview", "stock", "refills", "closings", "audit"]);
  const screen = allowed.has(value) ? value : "overview";
  return <ManagerApp preview={screen as "login" | "overview" | "stock" | "refills" | "closings" | "audit"} />;
}
