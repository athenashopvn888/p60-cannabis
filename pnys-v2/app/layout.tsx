import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "PNYS v2 Preview",
  description: "Isolated fleet POS v2 preview",
  robots: { index: false, follow: false },
};

const nav = [
  ["/v2/admin", "Corrections"],
  ["/v2/close", "Close parity"],
  ["/v2/email", "Email + XLS"],
  ["/v2/carryover", "Carryover"],
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="topbar">
            <div className="brand">ACD01 · PNYS v2</div>
            <div className="testBadge">ISOLATED TEST STORE · NO LIVE DATA</div>
          </header>
          <main className="main">
            <nav className="tabs" aria-label="PNYS v2 preview screens">
              {nav.map(([href, label]) => <Link className="tab" href={href} key={href}>{label}</Link>)}
            </nav>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
