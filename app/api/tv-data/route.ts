import { NextResponse } from "next/server";
import { allFlowers, allItems } from "../../lib/products";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "flowers";

  if (type === "items") {
    return NextResponse.json(allItems);
  }

  return NextResponse.json(allFlowers);
}
