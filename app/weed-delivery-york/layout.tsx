import "../delivery/delivery.css";

export default function WeedDeliveryLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="p60-delivery-route">{children}</div>;
}
