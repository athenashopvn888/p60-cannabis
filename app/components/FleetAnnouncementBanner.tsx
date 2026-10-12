import Link from "next/link";


export default function FleetAnnouncementBanner() {
  return (
    <aside
      data-fleet-homepage-announcement=""
      aria-label="Store announcements"
      style={{ width: "100%", position: "relative", zIndex: 50 }}
    >
<Link href="/items/cigarettes" data-cig-mix-banner="" aria-label="Shop the 2 packs for $5 mix and match cigarette offer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/banners/native-cigarette-offer-20260822.webp"
          alt="2 packs for $5 mix and match and $25 carton cigarette offer at P60 Cannabis."
          style={{ display: "block", width: "100%", height: "auto" }}
        />
      </Link>
</aside>
  );
}
