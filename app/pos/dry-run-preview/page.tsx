import { notFound } from "next/navigation";
import DryRunProof from "./DryRunProof";

export const dynamic = "force-dynamic";
export const metadata = { title: "PNYS Release 3 dry run", robots: { index: false, follow: false, nocache: true } };

export default async function DryRunPreviewPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  if (process.env.VERCEL_ENV === "production") notFound();
  const { step } = await searchParams;
  return <DryRunProof step={step ?? "login"} />;
}
