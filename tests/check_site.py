"""Check local HTML structure and links without a browser."""

from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: set[str] = set()
        self.links: list[str] = []
        self.headings: list[str] = []
        self.title_count = 0
        self.description_count = 0
        self.csp_count = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if identifier := values.get("id"):
            assert identifier not in self.ids, f"duplicate ID: {identifier}"
            self.ids.add(identifier)
        if tag in ("a", "link", "script"):
            url = values.get("href") or values.get("src") or ""
            if url.startswith("./"):
                self.links.append(url.split("#", 1)[0])
        if tag == "h1":
            self.headings.append("h1")
        if tag == "title":
            self.title_count += 1
        if tag == "meta" and values.get("name") == "description":
            self.description_count += 1
        if tag == "meta" and values.get("http-equiv") == "Content-Security-Policy":
            self.csp_count += 1


for path in sorted(ROOT.glob("*.html")):
    page = Page()
    page.feed(path.read_text(encoding="utf-8"))
    assert page.title_count == 1, path
    assert len(page.headings) == 1, path
    assert page.csp_count == 1, path
    if path.name != "privacy.html":
        assert page.description_count == 1, path
    for link in page.links:
        assert (path.parent / link).exists(), f"{path.name}: missing {link}"
    print(f"{path.name}: OK")
