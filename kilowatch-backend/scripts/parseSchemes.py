import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8", errors="replace")

# Print scheme lines and nearby activity names
lines = text.splitlines()
for i, line in enumerate(lines):
    if "Scheme:" in line or "scheme=" in line.lower():
        start = max(0, i - 8)
        end = min(len(lines), i + 4)
        print("\n---")
        for j in range(start, end):
            print(f"{j}: {lines[j]}")
