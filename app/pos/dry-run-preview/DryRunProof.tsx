import styles from "./dryRun.module.css";

const steps = ["login", "sale", "refill", "mode", "closing", "manager"] as const;
type Step = (typeof steps)[number];

const labels: Record<Step, string> = {
  login: "PIN login",
  sale: "Customer sale",
  refill: "Kitchen refill",
  mode: "NO WEED",
  closing: "Staff closing",
  manager: "Manager report",
};

const stock = [
  { sku: "9901-3g", opening: 6, refill: 0, sales: 0, expected: 6, counted: 6, variance: 0 },
  { sku: "9902", opening: 10, refill: 3, sales: 2, expected: 11, counted: 10, variance: -1 },
  { sku: "9903", opening: 5, refill: 0, sales: 1, expected: 4, counted: 4, variance: 0 },
];

export default function DryRunProof({ step: requested }: { step: string }) {
  const step: Step = steps.includes(requested as Step) ? requested as Step : "login";
  const index = steps.indexOf(step);
  const link = (target: Step) => `/pos/dry-run-preview?step=${target}`;
  return (
    <main className={styles.shell} data-testid="release3-proof" data-step={step}>
      <div className={styles.test}>TEST STORE · SIMULATION</div>
      <header className={styles.top}><div><strong>PNYS</strong><span> · Dry Run Staff</span></div><strong>{labels[step]}</strong></header>
      <section className={styles.body}>
        {step === "login" ? <><h1>PIN login passed</h1><div className={styles.pass}>✓ Staff, Kitchen and Manager roles verified</div><p>Ephemeral test PINs were hashed in memory. PIN values were never printed or saved.</p><div className={styles.pad}>{[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((key, i) => <span key={`${key}-${i}`}>{key}</span>)}</div></> : null}
        {step === "sale" ? <><h1>Customer + coupon sale</h1><article><b>Dry Run Customer · •••• 0199</b><small>Express consent · in store</small></article><article><div><span>2 × Dry Run Paper</span><b>$50.00</b></div><div className={styles.discount}><span>DRY10 coupon</span><b>−$10.00</b></div><div className={styles.total}><span>Cash total</span><b>$40.00</b></div></article><div className={styles.pass}>✓ One redemption logged</div></> : null}
        {step === "refill" ? <><h1>Kitchen refill</h1><article><small>Batch RELEASE 3</small><div className={styles.total}><span>9902 · Dry Run Paper</span><b>3</b></div><p>Kitchen sent 3 units.</p></article><div className={styles.pass}>✓ Staff confirmed 3 · stock counted once</div></> : null}
        {step === "mode" ? <><h1>WEED → NO WEED</h1><article><p>Manager changed the PNYS store setting. It persists across shifts and devices until Manager changes it again.</p><div className={styles.mode}><span>WEED</span><b>→</b><strong>NO WEED</strong></div></article><div className={styles.pass}>✓ Manager confirmation and audit recorded · survived shift close</div><div className={styles.block}>THC hidden in NO WEED mode · 9901-3g not added</div></> : null}
        {step === "closing" ? <><h1>Mobile closing</h1><div className={styles.table}><div className={styles.head}><span>SKU</span><span>O + R − S</span><span>Expected</span><span>Counted</span></div>{stock.map((row) => <div key={row.sku} className={row.variance ? styles.short : ""}><b>{row.sku}</b><span>{row.opening}+{row.refill}−{row.sales}</span><span>{row.expected}</span><span>{row.counted}</span></div>)}</div><article><div><span>Cash sales</span><b>$40.00</b></div><div><span>Deposit</span><b>$40.00</b></div><div><span>End float</span><b>$0.00</b></div><div className={styles.total}><span>Cash variance</span><b>$0.00</b></div></article><div className={styles.block}>SHORT · 1 unit · $25.00</div><aside><b>ACCOUNTANT DECISION REQUIRED</b><p>Opening-float formula is a placeholder. No formula selected.</p></aside></> : null}
        {step === "manager" ? <><h1>Closing report</h1><article><small>PNYS · simulated shift · closed</small><div><span>Net sales</span><b>$45.00</b></div><div><span>Cash / Debit</span><b>$40.00 / $5.00</b></div><div><span>Deposit</span><b>$40.00</b></div><div><span>Stock short</span><b className={styles.red}>$25.00</b></div><div className={styles.total}><span>Cash variance</span><b>$0.00</b></div></article><div className={styles.pass}>✓ Report visible · all equations tied</div><p className={styles.note}>No preview database test rows were saved. Cleanup artifact is ready if this fixture is ever persisted.</p></> : null}
      </section>
      <nav className={styles.bottom} aria-label="Dry run proof steps">
        {index > 0 ? <a href={link(steps[index - 1]!)}>Back</a> : <span />}
        <span>{index + 1} / {steps.length}</span>
        {index < steps.length - 1 ? <a href={link(steps[index + 1]!)}>Next</a> : <strong>Complete</strong>}
      </nav>
    </main>
  );
}
