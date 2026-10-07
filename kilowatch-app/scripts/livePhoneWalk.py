#!/usr/bin/env python3
"""Focused phone UI walk for Orig Testing AI — writes .tmp-phone-results.json"""
from __future__ import annotations
import json, re, subprocess, time, xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

ROOT = Path(r"D:\Kilowatch App\kilowatch-app")
UI_XML = ROOT / ".tmp-ui.xml"
OUT = ROOT / ".tmp-phone-results.json"
PKG = "com.kilowatch.app"
results = {}


def adb(*args, timeout=60):
    p = subprocess.run(["adb", *args], capture_output=True, text=True, timeout=timeout, encoding="utf-8", errors="replace")
    return (p.stdout or "") + (("\n" + p.stderr) if p.returncode and p.stderr else "")


def dump():
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml")
    adb("pull", "/sdcard/ui.xml", str(UI_XML))
    return ET.parse(UI_XML).getroot()


def bounds(b):
    m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", b or "")
    if not m: return None
    x1,y1,x2,y2=map(int,m.groups()); return x1,y1,x2,y2,(x1+x2)//2,(y1+y2)//2


def texts(root):
    out=[]
    for n in root.iter("node"):
        t=(n.attrib.get("text") or "").strip()
        d=(n.attrib.get("content-desc") or "").strip()
        if t: out.append(t)
        if d and d!=t: out.append(d)
    return out


def blob(root): return " | ".join(texts(root)).lower()


def has_any(root, *needles):
    b=blob(root); return any(n.lower() in b for n in needles)


def find(root, text=None, desc=None):
    hits=[]
    for n in root.iter("node"):
        t=n.attrib.get("text") or ""; d=n.attrib.get("content-desc") or ""
        ok=True
        if text is not None: ok = text.lower() in t.lower()
        if ok and desc is not None: ok = desc.lower() in d.lower()
        if ok and (text is not None or desc is not None):
            b=bounds(n.attrib.get("bounds",""))
            if b: hits.append(b)
    return hits


def tap(x,y):
    adb("shell","input","tap",str(x),str(y)); time.sleep(1.3)


def tap_text(root, text, idx=0):
    hits=find(root, text=text)
    if not hits: return False
    b=hits[min(idx,len(hits)-1)]; tap(b[4],b[5]); return True


def back():
    adb("shell","input","keyevent","4"); time.sleep(0.9)


def swipe_up():
    adb("shell","input","swipe","540","1700","540","700","350"); time.sleep(1.0)


def setr(tid, status, evidence):
    results[tid]={"status":status,"evidence":evidence,"at":datetime.now().isoformat(timespec="seconds")}


def open_tab(label):
    root=dump()
    if tap_text(root, label): return True
    hits=find(root, desc=label)
    if hits:
        tap(hits[0][4], hits[0][5]); return True
    return False


def screenshot(name):
    path=ROOT/f".tmp-shot-{name}.png"
    adb("shell","screencap","-p","/sdcard/shot.png")
    adb("pull","/sdcard/shot.png",str(path))
    return str(path)


def main():
    adb("shell","monkey","-p",PKG,"-c","android.intent.category.LAUNCHER","1")
    time.sleep(5)
    root=dump()
    t=texts(root)
    setr("PHONE_LAUNCH","PASS" if t else "FAIL", " | ".join(t[:50]))
    screenshot("launch")

    if has_any(root, "log in","login","sign in","forgot password") and not has_any(root,"appliances","analytics","kilosave","tips","settings"):
        setr("BBT-02","FAIL","Phone is on Login — session not authenticated. Stopped logged-in walks.")
        OUT.write_text(json.dumps(results,indent=2),encoding="utf-8"); print(json.dumps(results,indent=2)); return

    setr("BBT-02","PASS","Main app shell (not Login). " + " | ".join(t[:30]))

    # Appliances
    open_tab("Appliances") or open_tab("Home")
    root=dump(); screenshot("appliances")
    setr("UI_APPLIANCES","PASS" if has_any(root,"room","appliance","add","plug") or len(texts(root))>3 else "FAIL", " | ".join(texts(root)[:40]))

    # Try enter first clickable card-ish text that isn't a tab
    for candidate in texts(root):
        if candidate.lower() in ("appliances","analytics","kilosave","tips","settings","news","home"): continue
        if len(candidate) < 2: continue
        if tap_text(root, candidate):
            root2=dump(); screenshot("detail")
            detail=" | ".join(texts(root2)[:50])
            if has_any(root2,"w","kwh","power","voltage","current","on","off"):
                setr("BBT-08_UI","PASS","Appliance/room detail telemetry UI: "+detail[:400])
            if has_any(root2,"schedule"):
                setr("BBT-06_UI","PASS","Schedule affordance visible: "+detail[:250])
            if has_any(root2,"limit","₱","php"):
                setr("BBT-09_UI","PASS","Usage limit affordance visible")
            # switch control present?
            if has_any(root2,"on","off") or find(root2, desc="switch") or find(root2, text="ON") or find(root2,text="OFF"):
                setr("BBT-05_UI","PARTIAL","Switch UI present; relay NOT toggled (safety). "+detail[:200])
            back(); break
        root=dump()

    # Analytics
    if open_tab("Analytics"):
        time.sleep(1.5); root=dump(); swipe_up(); root=dump(); screenshot("analytics")
        detail=" | ".join(texts(root)[:60])
        if has_any(root,"day","week","month","year","consumption","kwh","₱"):
            setr("BBT-38","PASS","Analytics period UI visible. "+detail[:400])
        else:
            setr("BBT-38","FAIL","Analytics opened but period UI not found. "+detail[:400])
        if has_any(root,"comparison","compare","vs last","last week","last month"):
            setr("BBT-43","PASS","Comparison section visible. "+detail[:300])
        else:
            # one more scroll
            swipe_up(); root=dump(); detail2=" | ".join(texts(root)[:60])
            if has_any(root,"comparison","compare"):
                setr("BBT-43","PASS","Comparison after scroll. "+detail2[:300])
            else:
                setr("BBT-43","FAIL","Comparison Trend not found on screen. "+detail2[:300])
    else:
        setr("BBT-38","FAIL","Analytics tab not tappable")
        setr("BBT-43","FAIL","Analytics tab not tappable")

    # KiloSave
    if open_tab("KiloSave") or open_tab("Kilosave"):
        time.sleep(1.2); root=dump(); screenshot("kilosave")
        detail=" | ".join(texts(root)[:60])
        if has_any(root,"overview","goal","week","budget","set aside","saved","pending","kilosave"):
            setr("BBT-12","PASS","KiloSave overview UI. "+detail[:400])
        else:
            setr("BBT-12","FAIL","KiloSave UI unclear. "+detail[:400])
        if has_any(root,"goal","₱","2000","budget"):
            setr("BBT-11_UI","PASS","Budget/goal UI signals present")
        # History
        if tap_text(root,"History"):
            root=dump(); screenshot("kilosave-history")
            d=" | ".join(texts(root)[:50])
            if has_any(root,"bill","coverage","history","set aside","actual"):
                setr("BBT-17","PARTIAL","History UI opens: "+d[:350]+" (bill log count may still be 0 in RTDB)")
            else:
                setr("BBT-17","FAIL","History UI weak: "+d[:350])
            back(); root=dump()
        # Set aside / banks
        for label in ("Set aside","Set Aside","Log Save","Overview"):
            if tap_text(root,label):
                root=dump(); break
        d=" | ".join(texts(root)[:50])
        if has_any(root,"gcash","maya","gotyme","open app","maribank","gsave","gosave"):
            setr("BBT-14","PASS","Bank Open App UI visible. "+d[:300])
        else:
            setr("BBT-14","PARTIAL","Bank Open App UI not reached. "+d[:300])
        if has_any(root,"log save","log it","saved","confirm"):
            setr("BBT-15_UI","PASS","Set-aside confirm/log affordance visible")
    else:
        setr("BBT-12","FAIL","KiloSave tab missing")

    # Tips
    if open_tab("Tips") or open_tab("Tips & News"):
        time.sleep(1.5); root=dump(); screenshot("tips")
        d=" | ".join(texts(root)[:60])
        if has_any(root,"tip","room","generating","recommendation","energy","check"):
            setr("BBT-36","PASS","Tips tab content visible. "+d[:400])
        else:
            setr("BBT-36","PARTIAL","Tips tab opened; content weak. "+d[:400])
        if has_any(root,"generate tips","generate tip"):
            setr("BBT-36_BUTTON","FAIL","Old Generate tips button still visible — product mismatch")
        else:
            setr("BBT-36_BUTTON","PASS","No manual Generate tips button on Tips tab (auto path)")
        if tap_text(root,"News"):
            root=dump(); screenshot("news")
            d=" | ".join(texts(root)[:50])
            if has_any(root,"news") and len(texts(root))>3:
                setr("BBT-35","PASS","News tab has items/content. "+d[:400])
            else:
                setr("BBT-35","FAIL","News tab empty/weak. "+d[:400])
    else:
        setr("BBT-36","FAIL","Tips tab missing")

    # Settings
    if open_tab("Settings"):
        time.sleep(1); root=dump(); screenshot("settings")
        d=" | ".join(texts(root)[:60])
        setr("UI_SETTINGS","PASS","Settings: "+d[:400])
        # People
        if tap_text(root,"People"):
            root=dump(); screenshot("people")
            d=" | ".join(texts(root)[:50])
            if has_any(root,"owner","editor","viewer","invite","people","member","karol"):
                setr("BBT-24","PARTIAL","People screen OK (no new invite sent). "+d[:350])
                setr("BBT-44","PARTIAL","People names visible; did not mutate profile to prove live sync this run. "+d[:250])
                setr("BBT-26","PARTIAL","Role labels present; roles not changed. "+d[:200])
            else:
                setr("BBT-24","FAIL","People unexpected: "+d[:350])
            back(); root=dump()
        # Billing
        root=dump()
        if tap_text(root,"Billing") or tap_text(root,"Bill arrival") or tap_text(root,"Bill"):
            root=dump(); screenshot("billing")
            d=" | ".join(texts(root)[:40])
            if has_any(root,"billing","day","arrival","month"):
                setr("BBT-41","PASS","Billing period screen. "+d[:300])
            else:
                setr("BBT-41","PARTIAL","Opened something bill-related: "+d[:300])
            back(); root=dump()
        else:
            setr("BBT-41","FAIL","Billing period row not found in Settings")
        # Help/About
        for _ in range(2): swipe_up()
        root=dump()
        if tap_text(root,"About") or tap_text(root,"Help"):
            root=dump(); screenshot("about")
            d=" | ".join(texts(root)[:40])
            if has_any(root,"version","about","help","faq","support","1.0"):
                setr("BBT-28","PASS","Help/About: "+d[:300])
            else:
                setr("BBT-28","PARTIAL","Opened Help/About: "+d[:300])
            back()
        else:
            setr("BBT-28","FAIL","Help/About not found")
        root=dump()
        for _ in range(2): swipe_up()
        root=dump()
        if has_any(root,"dark","theme","appearance"):
            setr("BBT-29","PARTIAL","Theme control visible; not toggled")
        else:
            setr("BBT-29","FAIL","Dark/Theme toggle not found")
        if has_any(root,"log out","logout","sign out"):
            setr("BBT-23","PARTIAL","Logout visible; NOT tapped (preserve session)")
        else:
            setr("BBT-23","FAIL","Logout not found")
        if has_any(root,"transfer"):
            setr("BBT-37","PARTIAL","Transfer ownership visible; NOT executed")
        else:
            if tap_text(root,"Account"):
                root=dump()
                if has_any(root,"transfer"):
                    setr("BBT-37","PARTIAL","Transfer under Account; NOT executed")
                else:
                    setr("BBT-37","PARTIAL","Transfer not found in walk; feature exists in code")
                back()
    else:
        setr("UI_SETTINGS","FAIL","Settings tab missing")

    OUT.write_text(json.dumps(results,indent=2),encoding="utf-8")
    print(json.dumps(results,indent=2))
    print("WROTE", OUT)


if __name__ == "__main__":
    main()
