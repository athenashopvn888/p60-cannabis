import type { Metadata } from "next";
import GamesContent from "./GamesContent";

export const metadata: Metadata = {
  title: "Cannabis Arcade Games — P60 Cannabis | York",
  description: "Play free online cannabis-themed games like Flappy Bud and Snake Munchies while you wait at P60 Cannabis.",
  alternates: {
    canonical: "https://p60cannabis.com/games",
  },
};

export default function GamesPage() {
  return <GamesContent />;
}
