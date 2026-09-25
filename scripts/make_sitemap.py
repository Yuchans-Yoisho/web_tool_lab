#!/usr/bin/env python3
"""Generate sitemap.xml once the final public base URL is known."""

import argparse
from pathlib import Path
from urllib.parse import urlsplit
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
PAGES = ("", "roulette.html", "amidaku.html", "dice.html")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("base_url", help="Example: https://example.com/tool/")
    args = parser.parse_args()
    parsed = urlsplit(args.base_url)
    if parsed.scheme != "https" or not parsed.netloc or parsed.query or parsed.fragment:
        parser.error("公開 URL は https:// で始まり、クエリや # を含まないものを指定してください。")
    base = args.base_url.rstrip("/") + "/"
    urlset = ET.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
    for page in PAGES:
        url = ET.SubElement(urlset, "url")
        ET.SubElement(url, "loc").text = base + page
    ET.indent(urlset)
    output = ROOT / "sitemap.xml"
    ET.ElementTree(urlset).write(output, encoding="utf-8", xml_declaration=True)
    print(output)


if __name__ == "__main__":
    main()
