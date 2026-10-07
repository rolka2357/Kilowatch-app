import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

path = Path(r"d:\Kilowatch App\docs\test-screenshots\ui.xml")
t = path.read_text(encoding="utf-8")

# Include nodes with text, content-desc, or class that look tappable
pattern = re.compile(
    r'<node[^>]*?(?:text="([^"]*)")?[^>]*?(?:content-desc="([^"]*)")?[^>]*?class="([^"]*)"[^>]*?clickable="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',
    re.DOTALL,
)

# Simpler: all nodes with bounds
nodes = re.findall(
    r'<node ([^>]*)>',
    t,
)

def attr(s, name):
    m = re.search(rf'{name}="([^"]*)"', s)
    return m.group(1) if m else ""

for attrs in nodes:
    text = attr(attrs, "text")
    desc = attr(attrs, "content-desc")
    clickable = attr(attrs, "clickable")
    bounds = attr(attrs, "bounds")
    m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds)
    if not m:
        continue
    a, b, c, d = m.groups()
    label = text or desc
    if not label and clickable != "true":
        continue
    extra = " *" if clickable == "true" else ""
    print(f"{a:>4} {b:>4} {c:>4} {d:>4}{extra} | {label or '(clickable)'}")
