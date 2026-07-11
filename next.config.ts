import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "p60cannabis.com" },
      { protocol: "https", hostname: "kennedyloudcannabis.com" },
      { protocol: "https", hostname: "stclaircannabis.com" },
    ],
  },
  async redirects() {
    return [
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
      { source: "/blog/p60-cannabis-flower-tier-guide", destination: "/resources/flower-guides/aa-vs-aaa-vs-premium-vs-exotic", permanent: true },
      { source: "/blog/p60-cannabis-local-visit-guide-adults-19", destination: "/resources/local-guides/weed-dispensary-in-york", permanent: true },
    ];
  },
};

export default nextConfig;
