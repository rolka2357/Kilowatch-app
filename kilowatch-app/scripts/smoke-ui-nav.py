import subprocess
import re
import time

TMP = r"C:\Users\lenovo\AppData\Local\Temp\kw-nav.xml"


def sh(*args):
    return subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace")


def dump():
    sh("adb", "shell", "uiautomator", "dump", "/sdcard/ui.xml")
    sh("adb", "pull", "/sdcard/ui.xml", TMP)
    with open(TMP, "r", encoding="utf-8") as f:
        return f.read()


def tap_text(label):
    xml = dump()
    variants = [label, label.replace("&", "&amp;")]
    for lab in variants:
        patterns = [
            rf'text="{re.escape(lab)}"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',
            rf'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*text="{re.escape(lab)}"',
        ]
        for pat in patterns:
            m = re.search(pat, xml)
            if m:
                x = (int(m.group(1)) + int(m.group(3))) // 2
                y = (int(m.group(2)) + int(m.group(4))) // 2
                print(f"TAP {lab} -> {x},{y}")
                sh("adb", "shell", "input", "tap", str(x), str(y))
                time.sleep(1.8)
                return True
    print("MISS", label)
    return False


def main():
    sh("adb", "logcat", "-c")
    sh("adb", "shell", "am", "force-stop", "com.kilowatch.app")
    time.sleep(1)
    sh(
        "adb",
        "shell",
        "monkey",
        "-p",
        "com.kilowatch.app",
        "-c",
        "android.intent.category.LAUNCHER",
        "1",
    )
    time.sleep(7)

    for t in ["Analytics", "Kilosave", "Settings"]:
        tap_text(t)
        time.sleep(0.4)

    for t in ["Account", "Security", "Help", "About", "People", "Electricity Rates"]:
        if not tap_text(t):
            sh("adb", "shell", "input", "swipe", "540", "1600", "540", "900")
            time.sleep(1)
            tap_text(t)
        time.sleep(0.6)
        sh("adb", "shell", "input", "keyevent", "4")
        time.sleep(1.0)

    tap_text("Appliances")
    time.sleep(1.5)
    tap_text("Karol Room")
    time.sleep(2)
    sh("adb", "shell", "input", "keyevent", "4")
    time.sleep(1)

    out = sh("adb", "logcat", "-d", "-t", "500")
    lines = [
        ln
        for ln in (out.stdout or "").splitlines()
        if "ReactNativeJS" in ln
        and any(k in ln for k in ("ERROR", "TypeError", "ReferenceError", "Invariant", "Fatal"))
    ]
    print("JS_ERRORS", len(lines))
    for ln in lines[:40]:
        print(ln)
    print("SMOKE_DONE")


if __name__ == "__main__":
    main()
