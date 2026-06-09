"""
P60 Cannabis — Product Update Script
===================================
Drop your ONHAND CSV into the p60-cannabis folder as "onhand.csv" and run:

    python update_products.py

This reads the CSV, generates flowers.json + items.json, and optionally
triggers a Vercel redeploy.

CSV Expected Columns (same format as your other stores):
  SKU, Name, Tier/Category, Type, THC, Price3g, Price5g, Price14g, Price28g,
  Sale3g, Sale5g, Sale14g, Sale28g, MG, Image, PromoImage, IsHot, IsSale

For items (edibles, vapes, etc):
  SKU, Name, Category, Type, THC, MG, Price, Image, PromoImage
"""

import csv
import json
import re
import os
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FLOWERS_OUT = os.path.join(SCRIPT_DIR, "app", "lib", "flowers.json")
ITEMS_OUT = os.path.join(SCRIPT_DIR, "app", "lib", "items.json")

# Flower tiers
FLOWER_TIERS = {"EXOTIC", "PREMIUM", "AAA+", "AA", "BUDGET"}

# Item categories
ITEM_CATEGORIES = {
    "EDIBLES", "VAPE PENS", "VAPE DISPOSABLE", "CONCENTRATES",
    "PREROLLS", "ADD ONS", "CIGARETTES", "MAGIC & OTHERS"
}


def slugify(name: str) -> str:
    """Convert product name to URL-friendly slug."""
    s = name.lower().strip()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"[\s-]+", "-", s)
    return s.strip("-")


def parse_price(val: str):
    """Parse price string to int or None."""
    if not val or val.strip() in ("", "-", "N/A", "0"):
        return None
    try:
        return int(float(val.strip().replace("$", "").replace(",", "")))
    except ValueError:
        return None


def make_price_point(regular, sale):
    """Create a PricePoint dict or None."""
    reg = parse_price(regular)
    if reg is None:
        return None
    sal = parse_price(sale)
    return {"regular": reg, "sale": sal}


def detect_type(type_str: str) -> str:
    """Normalize strain type."""
    t = type_str.strip().upper()
    if t.startswith("I") or "INDICA" in t:
        return "indica"
    if t.startswith("S") or "SATIVA" in t:
        return "sativa"
    return "hybrid"


def process_csv(csv_path: str):
    """Read CSV and split into flowers + items."""
    flowers = []
    items = []

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)

        # Normalize header keys (strip whitespace, lowercase)
        if reader.fieldnames:
            reader.fieldnames = [h.strip() for h in reader.fieldnames]

        for row in reader:
            # Try to detect if this is a flower or item
            sku = row.get("SKU", "").strip()
            name = row.get("Name", "").strip()
            tier_or_cat = row.get("Tier", row.get("Category", row.get("Tier/Category", ""))).strip().upper()

            if not sku or not name:
                continue

            if tier_or_cat in FLOWER_TIERS:
                # This is a flower
                flower = {
                    "sku": sku,
                    "name": name,
                    "slug": slugify(name),
                    "tier": tier_or_cat,
                    "type": detect_type(row.get("Type", "hybrid")),
                    "isHot": row.get("IsHot", "").strip().upper() in ("TRUE", "YES", "1", "Y"),
                    "isSale": row.get("IsSale", "").strip().upper() in ("TRUE", "YES", "1", "Y"),
                    "thc": row.get("THC", "").strip() or "30%",
                    "price3g": make_price_point(row.get("Price3g", ""), row.get("Sale3g", "")),
                    "price5g": make_price_point(row.get("Price5g", ""), row.get("Sale5g", "")),
                    "price14g": make_price_point(row.get("Price14g", ""), row.get("Sale14g", "")),
                    "price28g": make_price_point(row.get("Price28g", ""), row.get("Sale28g", "")),
                    "image": row.get("Image", "").strip(),
                    "promoImage": row.get("PromoImage", "").strip() or None,
                }

                # Auto-detect isSale if any sale price exists
                if not flower["isSale"]:
                    for key in ("price3g", "price5g", "price14g", "price28g"):
                        pp = flower[key]
                        if pp and pp["sale"] is not None:
                            flower["isSale"] = True
                            break

                flowers.append(flower)

            else:
                # This is an item (edible, vape, preroll, etc)
                item = {
                    "sku": sku,
                    "name": name,
                    "slug": slugify(name),
                    "category": tier_or_cat or "ADD ONS",
                    "type": row.get("Type", "").strip(),
                    "thc": row.get("THC", "").strip(),
                    "mg": row.get("MG", "").strip(),
                    "price": row.get("Price", row.get("Price3g", "")).strip(),
                    "image": row.get("Image", "").strip(),
                    "promoImage": row.get("PromoImage", "").strip() or None,
                }
                items.append(item)

    return flowers, items


def main():
    csv_path = os.path.join(SCRIPT_DIR, "onhand.csv")

    if not os.path.exists(csv_path):
        print("=" * 60)
        print("  P60 Cannabis — Product Updater")
        print("=" * 60)
        print()
        print(f"  Drop your ONHAND CSV as: {csv_path}")
        print()
        print("  Expected columns for FLOWERS:")
        print("    SKU, Name, Tier, Type, THC, Price3g, Price5g, Price14g, Price28g,")
        print("    Sale3g, Sale5g, Sale14g, Sale28g, Image, PromoImage, IsHot, IsSale")
        print()
        print("  Expected columns for ITEMS:")
        print("    SKU, Name, Category, Type, THC, MG, Price, Image, PromoImage")
        print()
        print("  Tier values:     EXOTIC, PREMIUM, AAA+, AA, BUDGET")
        print("  Category values: EDIBLES, VAPE PENS, VAPE DISPOSABLE, CONCENTRATES,")
        print("                   PREROLLS, ADD ONS, CIGARETTES, MAGIC & OTHERS")
        print()

        # Offer to generate a template CSV
        print("  Generating template CSV for you...")
        template_path = os.path.join(SCRIPT_DIR, "onhand_template.csv")
        with open(template_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "SKU", "Name", "Tier", "Type", "THC",
                "Price3g", "Price5g", "Price14g", "Price28g",
                "Sale3g", "Sale5g", "Sale14g", "Sale28g",
                "MG", "Price", "Image", "PromoImage", "IsHot", "IsSale"
            ])
            # Example flower
            writer.writerow([
                "500", "PINK GODFATHER", "EXOTIC", "indica", "36%",
                "40", "60", "140", "",
                "", "", "", "",
                "", "", "https://example.com/img.jpg", "", "", ""
            ])
            # Example item
            writer.writerow([
                "961", "DUMMY BEARS 200MG", "EDIBLES", "", "",
                "", "", "", "",
                "", "", "", "",
                "200mg", "$20", "https://example.com/img.jpg", "", "", ""
            ])
        print(f"  [OK] Template saved: {template_path}")
        print()
        print("  Fill it out, rename to onhand.csv, and re-run this script!")
        return

    print("=" * 60)
    print("  P60 Cannabis — Product Updater")
    print("=" * 60)
    print()

    flowers, items = process_csv(csv_path)

    print(f"  [OK] Parsed {len(flowers)} flowers + {len(items)} items")

    # Flower breakdown by tier
    tier_counts = {}
    for f in flowers:
        tier_counts[f["tier"]] = tier_counts.get(f["tier"], 0) + 1
    for tier, count in sorted(tier_counts.items()):
        print(f"    {tier}: {count} strains")

    # Item breakdown by category
    cat_counts = {}
    for i in items:
        cat_counts[i["category"]] = cat_counts.get(i["category"], 0) + 1
    for cat, count in sorted(cat_counts.items()):
        print(f"    {cat}: {count} items")

    # Write JSONs
    with open(FLOWERS_OUT, "w", encoding="utf-8") as f:
        json.dump(flowers, f, indent=2, ensure_ascii=False)
    print(f"\n  [OK] Written: {FLOWERS_OUT}")

    with open(ITEMS_OUT, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2, ensure_ascii=False)
    print(f"  [OK] Written: {ITEMS_OUT}")

    # Ask about deploy
    print()
    ans = input("  Deploy to Vercel now? (y/n): ").strip().lower()
    if ans in ("y", "yes"):
        print("\n  Building & deploying...")
        subprocess.run(
            ["powershell", "-Command",
             "Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; vercel --prod --yes"],
            cwd=SCRIPT_DIR
        )
        print("\n  [OK] Deployed! Check https://p60cannabis.com")
    else:
        print("\n  To deploy manually, run:")
        print("    vercel --prod --yes")

    print("\n  Done!")


if __name__ == "__main__":
    main()
