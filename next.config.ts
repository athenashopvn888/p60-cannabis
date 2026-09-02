import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "p60cannabis.com" },
      { protocol: "https", hostname: "kennedyloudcannabis.com" },
      { protocol: "https", hostname: "stclaircannabis.com" },
      { protocol: "https", hostname: "pub-eb3e1fe18a43477eabc885cfb791d97c.r2.dev" },
      { protocol: "https", hostname: "milestone-1-demo.vercel.app" },
      { protocol: "https", hostname: "athena-cannabis-images.vercel.app", pathname: "/products/delivery/v1/**" },
    ],
  },
  async redirects() {
    return [
      { source: "/blog", destination: "/resources", permanent: true },
      { source: "/blog/:path*", destination: "/resources", permanent: true },
      { source: "/exotic", destination: "/exotic-weed", permanent: true },
      { source: "/premium", destination: "/premium-weed", permanent: true },
      { source: "/aaa", destination: "/aaa-weed", permanent: true },
      { source: "/aa", destination: "/aa-weed", permanent: true },
      { source: "/budget", destination: "/budget-weed", permanent: true },
      { source: "/delivery", destination: "/weed-delivery-york", permanent: true },
      { source: "/resources/flower-guides", destination: "/resources/weed-flower-guides", permanent: true },
      { source: "/resources/flower-guides/aa-vs-aaa-vs-premium-vs-exotic", destination: "/resources/weed-flower-guides/aa-vs-aaa-vs-premium-vs-exotic", permanent: true },
      { source: "/resources/flower-guides/budget-vs-premium-flower", destination: "/resources/weed-flower-guides/budget-vs-premium-flower", permanent: true },
      { source: "/edibles", destination: "/items/edibles", permanent: true },
      { source: "/vapes", destination: "/items/vapes", permanent: true },
      { source: "/product-category/vape-pen", destination: "/items/vapes", permanent: true },
      { source: "/vape-disposables", destination: "/items/vape-disposables", permanent: true },
      { source: "/concentrates", destination: "/items/concentrates", permanent: true },
      { source: "/product-category/concentrates", destination: "/items/concentrates", permanent: true },
      { source: "/prerolls", destination: "/items/prerolls", permanent: true },
      { source: "/product-category/pre-rolls", destination: "/items/prerolls", permanent: true },
      { source: "/add-ons", destination: "/items/add-ons", permanent: true },
      { source: "/cigarettes", destination: "/items/cigarettes", permanent: true },
      { source: "/magic", destination: "/items/magic", permanent: true },
      { source: "/blog/p60-cannabis-category-menu-cheat-sheet", destination: "/resources/cannabis-101/how-to-read-a-cannabis-menu", permanent: true },
      { source: "/blog/p60-cannabis-flower-tier-guide", destination: "/resources/weed-flower-guides/aa-vs-aaa-vs-premium-vs-exotic", permanent: true },
      { source: "/blog/p60-cannabis-local-visit-guide-adults-19", destination: "/resources/local-guides/weed-dispensary-in-york", permanent: true },
    ];
  },
};

export default nextConfig;
