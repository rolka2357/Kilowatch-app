import subprocess
import sys
from pathlib import Path

name = sys.argv[1] if len(sys.argv) > 1 else "shot"
out = Path(r"d:\Kilowatch App\docs\test-screenshots") / f"{name}.png"
subprocess.run(["adb", "shell", "screencap", "-p", "/sdcard/shot.png"], check=True)
subprocess.run(["adb", "pull", "/sdcard/shot.png", str(out)], check=True)
print(f"saved {out} ({out.stat().st_size} bytes)")
