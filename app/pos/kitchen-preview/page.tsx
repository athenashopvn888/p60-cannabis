import KitchenApp from "../kitchen/KitchenApp";

export const dynamic = "force-dynamic";

export default async function KitchenPreviewPage({ searchParams }: { searchParams: Promise<{ screen?: string }> }) {
  const { screen } = await searchParams;
  const preview = screen === "refill" || screen === "confirm" || screen === "history" || screen === "sent" ? screen : "login";
  return <KitchenApp preview={preview} />;
}
