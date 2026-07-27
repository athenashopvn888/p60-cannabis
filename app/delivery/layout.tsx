import "./delivery.css";

export default function DeliveryLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="p60-delivery-route">{children}</div>;
}
