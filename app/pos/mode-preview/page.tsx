import ModeProof from "./ModeProof";

type Props = { searchParams: Promise<{ surface?: string; mode?: string }> };

export default async function ModePreviewPage({ searchParams }: Props) {
  const params = await searchParams;
  const surface = params.surface === "closing" || params.surface === "menu" ? params.surface : "sell";
  const mode = params.mode === "no-weed" ? "no-weed" : "weed";
  return <ModeProof surface={surface} mode={mode} />;
}
