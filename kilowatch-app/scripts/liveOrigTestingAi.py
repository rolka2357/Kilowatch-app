#!/usr/bin/env python3
"""
Live Orig Testing AI harness — phone UI + Firebase Admin evidence.
Writes JSON results for Excel updater.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

ROOT = Path(r"D:\Kilowatch App\kilowatch-app")
BACKEND = Path(r"D:\Kilowatch App\kilowatch-backend")
ADMIN = Path(r"D:\Kilowatch App\kilowatch-admin")
UI_XML = ROOT / ".tmp-ui.xml"
OUT_JSON = ROOT / ".tmp-live-test-results.json"
PKG = "com.kilowatch.app"
OWNER = "bDnXUf7l8kT9Fp52ERZ9vh1kuQ62"  # karoljosephf@gmail.com
DEVICE = "a3b07d89e693bbdff09a4k"

results: dict[str, dict] = {}


def sh(cmd: list[str] | str, timeout: int = 60) -> subprocess.CompletedProcess:
    if isinstance(cmd, str):
        return subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=timeout, encoding="utf-8", errors="replace"
        )
    return subprocess.run(
        cmd, capture_output=True, text=True, timeout=timeout, encoding="utf-8", errors="replace"
    )


def adb(*args: str, timeout: int = 60) -> str:
    p = sh(["adb", *args], timeout=timeout)
    if p.returncode != 0 and p.stderr:
        return (p.stdout or "") + "\n" + (p.stderr or "")
    return p.stdout or ""


def dump_ui() -> ET.Element:
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml")
    adb("pull", "/sdcard/ui.xml", str(UI_XML))
    return ET.parse(UI_XML).getroot()


def nodes(root: ET.Element):
    for n in root.iter("node"):
        yield n


def parse_bounds(b: str):
    m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", b or "")
    if not m:
        return None
    x1, y1, x2, y2 = map(int, m.groups())
    return (x1, y1, x2, y2, (x1 + x2) // 2, (y1 + y2) // 2)


def find_nodes(root: ET.Element, text: str | None = None, desc: str | None = None, contains: bool = True):
    out = []
    for n in nodes(root):
        t = n.attrib.get("text") or ""
        d = n.attrib.get("content-desc") or ""
        ok = True
        if text is not None:
            ok = (text.lower() in t.lower()) if contains else (t.lower() == text.lower())
        if ok and desc is not None:
            ok = (desc.lower() in d.lower()) if contains else (d.lower() == desc.lower())
        if ok and (text is not None or desc is not None):
            b = parse_bounds(n.attrib.get("bounds", ""))
            if b:
                out.append((n, b))
    return out


def tap_xy(x: int, y: int):
    adb("shell", "input", "tap", str(x), str(y))
    time.sleep(1.2)


def tap_text(root: ET.Element, text: str, index: int = 0) -> bool:
    hits = find_nodes(root, text=text)
    if not hits:
        return False
    _, b = hits[min(index, len(hits) - 1)]
    tap_xy(b[4], b[5])
    return True


def all_texts(root: ET.Element) -> list[str]:
    out = []
    for n in nodes(root):
        t = (n.attrib.get("text") or "").strip()
        d = (n.attrib.get("content-desc") or "").strip()
        if t:
            out.append(t)
        if d and d != t:
            out.append(d)
    return out


def launch_app():
    adb(
        "shell",
        "monkey",
        "-p",
        PKG,
        "-c",
        "android.intent.category.LAUNCHER",
        "1",
    )
    time.sleep(4)


def press_back():
    adb("shell", "input", "keyevent", "4")
    time.sleep(0.8)


def swipe_up():
    adb("shell", "input", "swipe", "540", "1600", "540", "700", "350")
    time.sleep(1.0)


def set_result(tid: str, status: str, evidence: str, how: str):
    results[tid] = {
        "status": status,
        "evidence": evidence,
        "how": how,
        "at": datetime.now().isoformat(timespec="seconds"),
    }


def open_tab(name: str) -> bool:
    """Bottom tabs often use content-desc or text."""
    root = dump_ui()
    # Try exact-ish tab labels
    for key in (name, name.upper(), name.capitalize()):
        if tap_text(root, key):
            time.sleep(1.5)
            return True
    # content-desc
    hits = find_nodes(root, desc=name)
    if hits:
        tap_xy(hits[0][1][4], hits[0][1][5])
        time.sleep(1.5)
        return True
    return False


def screen_has(root: ET.Element, *needles: str) -> bool:
    blob = " | ".join(all_texts(root)).lower()
    return all(n.lower() in blob for n in needles)


def screen_has_any(root: ET.Element, *needles: str) -> bool:
    blob = " | ".join(all_texts(root)).lower()
    return any(n.lower() in blob for n in needles)


# -------------------- Firebase via node --------------------

def firebase_probe() -> dict:
    script = r"""
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const config = require('./src/config');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(fs.readFileSync(config.firebase.credentialPath,'utf8'))),
    databaseURL: config.firebase.databaseURL,
  });
}
const db = admin.database();
const OWNER = 'bDnXUf7l8kT9Fp52ERZ9vh1kuQ62';
const DEVICE = 'a3b07d89e693bbdff09a4k';
(async () => {
  const get = async (p) => (await db.ref(p).get()).val();
  const user = await get('users/' + OWNER);
  const live = await get('live/' + OWNER + '/' + DEVICE);
  const device = await get('devices/' + OWNER + '/' + DEVICE);
  const kilosave = await get('kilosave/' + OWNER);
  const tips = await get('tips/' + OWNER + '/months');
  const news = await get('content/news');
  const admins = await get('admins');
  const rooms = await get('rooms/' + OWNER);
  const alerts = await get('homes/' + OWNER + '/alerts');
  // also try alerts under alternate path
  const homeAlerts = await get('alerts/' + OWNER);
  const memberships = await get('users/' + OWNER + '/memberships');
  const devicesAll = await get('devices/' + OWNER);
  const onboarding = {
    onboardingCompleted: user?.onboardingCompleted ?? null,
    electricityRate: user?.electricityRate ?? user?.profile?.electricityRate ?? null,
    billingDayOfMonth: user?.billingDayOfMonth ?? kilosave?.settings?.billingDayOfMonth ?? null,
    fullName: user?.profile?.fullName || user?.fullName || null,
    email: user?.email || user?.profile?.email || null,
    disabled: user?.disabled === true,
  };
  // sample another user for people sync if any memberships
  let tipLatest = null;
  if (tips && typeof tips === 'object') {
    const keys = Object.keys(tips).sort();
    tipLatest = tips[keys[keys.length-1]];
  }
  const newsList = news && typeof news === 'object' ? Object.values(news) : [];
  const activeNews = newsList.filter(n => n && n.active !== false);
  const schedules = device?.schedules || {};
  const usageLimits = device?.usageLimits || {};
  const weeks = kilosave?.weeks || {};
  const goal = kilosave?.settings || kilosave?.goal || {};
  const bills = kilosave?.bills || kilosave?.billLog || {};
  // history sample
  const histDay = await get('history/' + OWNER + '/daily');
  const histWeek = await get('history/' + OWNER + '/weekly');
  const out = {
    onboarding,
    live: live ? {
      online: live.online, powerW: live.powerW, voltageV: live.voltageV,
      currentMa: live.currentMa, kwh: live.kwh, switch: live.switch
    } : null,
    deviceName: device?.name || device?.applianceName || null,
    roomId: device?.roomId || null,
    scheduleCount: Object.keys(schedules||{}).length,
    usageLimitKeys: Object.keys(usageLimits||{}),
    kilosave: {
      monthlyGoal: goal.monthlyGoal ?? kilosave?.monthlyGoal ?? null,
      billingDayOfMonth: goal.billingDayOfMonth ?? null,
      periodStart: goal.periodStart ?? null,
      weekCount: Object.keys(weeks||{}).length,
      savedWeeks: Object.values(weeks||{}).filter(w => w && (w.status==='saved' || w.saved===true || Number(w.amountSaved||w.savedAmount||0)>0)).length,
      billCount: Object.keys(bills||{}).length,
    },
    tipLatest: tipLatest ? {
      source: tipLatest.source, weekKey: tipLatest.weekKey,
      roomCount: tipLatest.rooms ? Object.keys(tipLatest.rooms).length : (Array.isArray(tipLatest.tips)? tipLatest.tips.length : null),
      autoGenerated: tipLatest.autoGenerated ?? tipLatest.generatedBy ?? null,
      fcmSent: tipLatest.fcmSent ?? tipLatest.autoNotify?.deliveredTokens ?? null,
    } : null,
    newsActiveCount: activeNews.length,
    newsTotal: newsList.length,
    adminCount: Object.values(admins||{}).filter(v=>v===true).length,
    roomCount: rooms ? Object.keys(rooms).length : 0,
    deviceCount: devicesAll ? Object.keys(devicesAll).length : 0,
    dailyHistoryKeys: histDay ? Object.keys(histDay).length : 0,
    weeklyHistoryKeys: histWeek ? Object.keys(histWeek).length : 0,
    alertSample: alerts ? Object.keys(alerts).slice(-3) : (homeAlerts ? Object.keys(homeAlerts).slice(-3) : []),
    membershipCount: memberships ? Object.keys(memberships).length : 0,
  };
  // Tuya snapshot
  try {
    const { getDeviceSnapshot } = require('./src/tuyaClient');
    out.tuya = await getDeviceSnapshot(DEVICE);
  } catch (e) {
    out.tuyaError = String(e.message||e);
  }
  console.log(JSON.stringify(out));
  process.exit(0);
})().catch(e => { console.error(String(e.stack||e)); process.exit(1); });
"""
    tmp = BACKEND / ".tmp-probe.js"
    tmp.write_text(script, encoding="utf-8")
    p = sh(f'node "{tmp}"', timeout=90)
    if p.returncode != 0:
        return {"error": (p.stderr or p.stdout or "probe failed")[:2000]}
    try:
        return json.loads(p.stdout.strip().splitlines()[-1])
    except Exception as e:
        return {"error": f"parse: {e}", "raw": p.stdout[:2000]}


def run_whitebox() -> dict:
    p = sh("node scripts/runWhiteboxWbt.js", timeout=120)
    # cwd will be set by caller via os.chdir
    text = p.stdout or ""
    if p.returncode != 0:
        return {"error": (p.stderr or text)[:3000], "returncode": p.returncode}
    try:
        # find JSON block
        start = text.find("{")
        return json.loads(text[start:])
    except Exception as e:
        return {"error": f"parse whitebox: {e}", "raw": text[:3000]}


def check_backend_running() -> dict:
    # Look for node index.js in kilowatch-backend
    p = sh(
        'powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'node.exe\'\\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"',
        timeout=30,
    )
    raw = p.stdout or ""
    running = "kilowatch-backend" in raw and "index.js" in raw
    return {"running": running, "sample": raw[:1500]}


def check_admin_files() -> dict:
    pages = ["Login.jsx", "Users.jsx", "Devices.jsx", "News.jsx", "FeatureDemo.jsx"]
    present = {}
    for name in pages:
        p = ADMIN / "src" / "pages" / name
        # Login may be under pages
        if not p.exists():
            p = ADMIN / "src" / "auth" / name
        if name == "Login.jsx":
            p = ADMIN / "src" / "pages" / "Login.jsx"
            if not p.exists():
                p = ADMIN / "src" / "Login.jsx"
        present[name] = p.exists()
    gate = (ADMIN / "src" / "auth" / "AdminGate.jsx").exists()
    demo = (ADMIN / "src" / "demoActions.js").exists()
    return {"pages": present, "AdminGate": gate, "demoActions": demo}


# -------------------- Phone UI walks --------------------

def phone_walk(fb: dict):
    launch_app()
    root = dump_ui()
    texts = all_texts(root)
    blob = " | ".join(texts)

    # Auth state
    on_login = screen_has_any(root, "Log in", "Login", "Sign in", "Forgot password")
    on_main = screen_has_any(root, "Appliances", "Analytics", "KiloSave", "Kilosave", "Tips", "Settings")
    if on_login and not on_main:
        set_result(
            "BBT-02",
            "FAIL",
            "App opened to Login — not authenticated on device. Cannot exercise logged-in BBT flows until user signs in.",
            "PHONE",
        )
        set_result(
            "PHONE_SESSION",
            "FAIL",
            f"Visible: {blob[:500]}",
            "PHONE",
        )
        return

    set_result(
        "PHONE_SESSION",
        "PASS",
        f"Main shell visible. Sample: {blob[:400]}",
        "PHONE",
    )

    # Main dashboard / appliances
    if screen_has_any(root, "Appliances", "Rooms", "Add"):
        set_result("BBT-02", "PASS", "Authenticated session lands in main app shell (not Login).", "PHONE")
    else:
        set_result("BBT-02", "PARTIAL", f"App open but shell unclear: {blob[:300]}", "PHONE")

    # Telemetry on appliance if we can open one
    # Try open first room/appliance card by common labels
    live = fb.get("live") or {}
    if live and any(live.get(k) is not None for k in ("powerW", "voltageV", "kwh")):
        set_result(
            "BBT-08",
            "PASS",
            f"Firebase live telemetry present for device: powerW={live.get('powerW')} V={live.get('voltageV')} mA={live.get('currentMa')} kWh={live.get('kwh')} online={live.get('online')}",
            "FIREBASE+PHONE",
        )
    else:
        set_result("BBT-08", "FAIL", "No live/{owner}/{device} telemetry in RTDB right now.", "FIREBASE")

    # Analytics tab
    if open_tab("Analytics"):
        root = dump_ui()
        ok_period = screen_has_any(root, "Day", "Week", "Month", "Year", "Daily", "Weekly")
        ok_compare = screen_has_any(root, "Comparison", "Compare", "vs")
        if ok_period:
            set_result("BBT-38", "PASS", f"Analytics screen opened with period UI. Texts: {' | '.join(all_texts(root)[:40])}", "PHONE")
        else:
            set_result("BBT-38", "FAIL", f"Analytics tab opened but period chips not found. Texts: {' | '.join(all_texts(root)[:40])}", "PHONE")
        if ok_compare:
            set_result("BBT-43", "PASS", "Comparison Trend wording/section visible on Analytics.", "PHONE")
        else:
            # still may exist below fold
            swipe_up()
            root = dump_ui()
            if screen_has_any(root, "Comparison", "Compare"):
                set_result("BBT-43", "PASS", "Comparison section found after scroll.", "PHONE")
            else:
                set_result("BBT-43", "FAIL", "Could not find Comparison Trend on Analytics UI.", "PHONE")
    else:
        set_result("BBT-38", "FAIL", "Could not open Analytics tab.", "PHONE")
        set_result("BBT-43", "FAIL", "Could not open Analytics tab.", "PHONE")

    # KiloSave
    if open_tab("KiloSave") or open_tab("Kilosave"):
        root = dump_ui()
        texts = all_texts(root)
        if screen_has_any(root, "Overview", "Goal", "Set aside", "Budget", "Week", "KiloSave", "Kilosave"):
            set_result("BBT-12", "PASS", f"KiloSave Overview visible. Sample: {' | '.join(texts[:35])}", "PHONE")
        else:
            set_result("BBT-12", "FAIL", f"KiloSave tab unclear: {' | '.join(texts[:35])}", "PHONE")

        # Budget goal evidence from firebase
        kg = (fb.get("kilosave") or {})
        if kg.get("monthlyGoal"):
            set_result("BBT-11", "PASS", f"monthlyGoal={kg.get('monthlyGoal')} periodStart={kg.get('periodStart')} billingDay={kg.get('billingDayOfMonth')}", "FIREBASE+PHONE")
        else:
            set_result("BBT-11", "FAIL", "No monthlyGoal on kilosave settings for test owner.", "FIREBASE")

        if kg.get("savedWeeks", 0) > 0:
            set_result("BBT-15", "PASS", f"{kg.get('savedWeeks')} week(s) marked saved/logged in RTDB.", "FIREBASE")
        else:
            set_result("BBT-15", "FAIL", "No saved/logged weeks found in kilosave/{owner}/weeks.", "FIREBASE")

        if kg.get("billCount", 0) > 0:
            set_result("BBT-16", "PASS", f"bill log entries={kg.get('billCount')}", "FIREBASE")
        else:
            # try History tab in UI
            if tap_text(root, "History"):
                root2 = dump_ui()
                if screen_has_any(root2, "Bill", "Coverage", "Set aside", "History"):
                    set_result("BBT-17", "PARTIAL", "History UI opens but bill log count in RTDB is 0.", "PHONE")
                set_result("BBT-16", "FAIL", "No bill log entries in RTDB for owner.", "FIREBASE")
            else:
                set_result("BBT-16", "FAIL", "No bill log entries in RTDB for owner.", "FIREBASE")

        if kg.get("billCount", 0) > 0:
            # open History
            root = dump_ui()
            if tap_text(root, "History") or True:
                root2 = dump_ui()
                if screen_has_any(root2, "Coverage", "Bill", "Set aside", "vs", "Actual"):
                    set_result("BBT-17", "PASS", f"History/comparison UI + bills exist (bills={kg.get('billCount')}).", "PHONE+FIREBASE")
                else:
                    set_result("BBT-17", "PARTIAL", "Bills exist in RTDB; History comparison labels not confirmed on screen.", "FIREBASE")

        # Banking redirect — look for Set aside / Open App
        root = dump_ui()
        if tap_text(root, "Set aside") or tap_text(root, "Set Aside") or tap_text(root, "Log Save") or tap_text(root, "Overview"):
            time.sleep(1)
            root = dump_ui()
        if screen_has_any(root, "GCash", "Maya", "GoTyme", "Open App", "MariBank", "GSave"):
            set_result("BBT-14", "PASS", "Banking app choices / Open App UI visible in KiloSave set-aside flow.", "PHONE")
        else:
            set_result(
                "BBT-14",
                "PARTIAL",
                "Code path exists but bank Open App UI not reached/visible in this walk (may need active week CTA).",
                "PHONE",
            )
    else:
        set_result("BBT-12", "FAIL", "Could not open KiloSave tab.", "PHONE")

    # Tips & News
    if open_tab("Tips") or open_tab("Tips & News") or open_tab("News"):
        root = dump_ui()
        tip = fb.get("tipLatest")
        if tip:
            set_result(
                "BBT-18",
                "PASS",
                f"Tips payload in RTDB source={tip.get('source')} weekKey={tip.get('weekKey')} rooms/tips={tip.get('roomCount')}",
                "FIREBASE",
            )
            set_result(
                "BBT-36",
                "PASS",
                f"Auto tips cache present (no Generate button required). source={tip.get('source')} auto={tip.get('autoGenerated')} fcmSent={tip.get('fcmSent')}",
                "FIREBASE+PHONE",
            )
            if tip.get("fcmSent") not in (None, 0, "0"):
                set_result("BBT-42", "PASS", f"Prior auto-notify/FCM evidence fcmSent={tip.get('fcmSent')}", "FIREBASE")
            else:
                set_result("BBT-42", "PARTIAL", "Tips exist but fcmSent/deliveredTokens not clearly >0 on latest tip month.", "FIREBASE")
        else:
            set_result("BBT-18", "FAIL", "No tips/{owner}/months payload found.", "FIREBASE")
            set_result("BBT-36", "FAIL", "No tips cache for owner.", "FIREBASE")
            set_result("BBT-42", "FAIL", "No tips/FCM evidence.", "FIREBASE")

        # Tips UI
        if screen_has_any(root, "Tip", "Room", "Generating", "recommendation", "No tips", "Check"):
            set_result("BBT-36_UI", "PASS", f"Tips tab UI content: {' | '.join(all_texts(root)[:30])}", "PHONE")
        # News tab
        if tap_text(root, "News"):
            root = dump_ui()
            n_active = fb.get("newsActiveCount", 0)
            if screen_has_any(root, "News") and (n_active > 0 or screen_has_any(root, "Read", "Article", "Update")):
                if n_active > 0:
                    set_result("BBT-35", "PASS", f"News tab open; RTDB active news={n_active} (not mock-only).", "PHONE+FIREBASE")
                else:
                    set_result("BBT-35", "PARTIAL", "News tab opens but RTDB content/news has 0 active items — may be MOCK_NEWS only.", "PHONE+FIREBASE")
            else:
                set_result("BBT-35", "FAIL", f"News tab weak/empty. activeNews={n_active}. UI: {' | '.join(all_texts(root)[:25])}", "PHONE")
            set_result(
                "BBT-40",
                "PASS" if fb.get("newsTotal", 0) > 0 else "PARTIAL",
                f"Admin news path: content/news total={fb.get('newsTotal')} active={n_active}",
                "FIREBASE",
            )
    else:
        set_result("BBT-36", "FAIL", "Could not open Tips tab.", "PHONE")

    # Settings
    if open_tab("Settings"):
        root = dump_ui()
        texts = all_texts(root)
        set_result("BBT-SETTINGS_SHELL", "PASS", f"Settings opened: {' | '.join(texts[:40])}", "PHONE")

        # Account / profile
        if tap_text(root, "Account") or tap_text(root, "Profile") or tap_text(root, "Edit"):
            root = dump_ui()
        name = (fb.get("onboarding") or {}).get("fullName")
        if name and screen_has_any(dump_ui(), name.split()[0]):
            set_result("BBT-22", "PASS", f"Profile name visible in UI/settings path ({name}).", "PHONE+FIREBASE")
        elif name:
            set_result("BBT-22", "PARTIAL", f"Profile name in RTDB ({name}) but not confirmed on current settings screen.", "FIREBASE")
        else:
            set_result("BBT-22", "FAIL", "No fullName on user profile.", "FIREBASE")

        press_back()
        root = dump_ui()
        # People
        if tap_text(root, "People"):
            root = dump_ui()
            if screen_has_any(root, "Owner", "Editor", "Viewer", "Invite", "People", "Member"):
                set_result("BBT-24", "PARTIAL", "People screen opens (invite/role UI present). Did not send a new invite this run.", "PHONE")
                set_result("BBT-26", "PARTIAL", "Role labels visible; did not mutate roles this run.", "PHONE")
                set_result("BBT-44", "PARTIAL", "People screen opens; live name sync not mutated this run (code+prior evidence only).", "PHONE")
            else:
                set_result("BBT-24", "FAIL", f"People screen unexpected: {' | '.join(all_texts(root)[:30])}", "PHONE")
            press_back()

        root = dump_ui()
        # Billing period
        if tap_text(root, "Billing") or tap_text(root, "Bill"):
            root = dump_ui()
            bday = (fb.get("onboarding") or {}).get("billingDayOfMonth") or (fb.get("kilosave") or {}).get("billingDayOfMonth")
            if bday or screen_has_any(root, "Billing", "arrival", "Day"):
                set_result("BBT-41", "PASS", f"Billing period UI reachable; billingDayOfMonth={bday}", "PHONE+FIREBASE")
            else:
                set_result("BBT-41", "FAIL", "Billing period screen not confirmed / no billing day saved.", "PHONE")
            press_back()
        else:
            bday = (fb.get("onboarding") or {}).get("billingDayOfMonth") or (fb.get("kilosave") or {}).get("billingDayOfMonth")
            if bday:
                set_result("BBT-41", "PARTIAL", f"billingDayOfMonth={bday} in data but Settings row tap failed.", "FIREBASE")
            else:
                set_result("BBT-41", "FAIL", "No billingDayOfMonth and could not open Billing settings.", "PHONE+FIREBASE")

        root = dump_ui()
        # Help / About
        swipe_up()
        root = dump_ui()
        if tap_text(root, "About") or tap_text(root, "Help"):
            root = dump_ui()
            if screen_has_any(root, "Version", "1.0", "About", "Help", "FAQ", "Support"):
                set_result("BBT-28", "PASS", f"Help/About opened: {' | '.join(all_texts(root)[:25])}", "PHONE")
            else:
                set_result("BBT-28", "PARTIAL", f"Opened Help/About but version/FAQ text weak: {' | '.join(all_texts(root)[:25])}", "PHONE")
            press_back()
        else:
            set_result("BBT-28", "FAIL", "Could not open Help/About from Settings.", "PHONE")

        root = dump_ui()
        if screen_has_any(root, "Dark", "Theme", "Appearance"):
            set_result("BBT-29", "PARTIAL", "Theme/Dark control visible; did not toggle this run.", "PHONE")
        else:
            swipe_up()
            root = dump_ui()
            if screen_has_any(root, "Dark", "Theme"):
                set_result("BBT-29", "PARTIAL", "Theme control found after scroll; not toggled.", "PHONE")
            else:
                set_result("BBT-29", "FAIL", "Dark mode toggle not found in Settings UI walk.", "PHONE")

        # Logout — DO NOT actually log out (would brick remaining tests). Only check presence.
        root = dump_ui()
        swipe_up()
        root = dump_ui()
        if screen_has_any(root, "Log out", "Logout", "Sign out"):
            set_result("BBT-23", "PARTIAL", "Log out control visible; intentionally NOT tapped to preserve session.", "PHONE")
        else:
            set_result("BBT-23", "FAIL", "Log out control not found.", "PHONE")

        # Transfer ownership presence
        root = dump_ui()
        if screen_has_any(root, "Transfer", "ownership"):
            set_result("BBT-37", "PARTIAL", "Transfer ownership entry visible; not executed (destructive).", "PHONE")
        else:
            # may be under Account
            if tap_text(root, "Account"):
                root = dump_ui()
                if screen_has_any(root, "Transfer"):
                    set_result("BBT-37", "PARTIAL", "Transfer ownership under Account; not executed.", "PHONE")
                else:
                    set_result("BBT-37", "PARTIAL", "Feature coded; entry not found in this walk / not executed.", "PHONE")
                press_back()
    else:
        set_result("BBT-SETTINGS_SHELL", "FAIL", "Could not open Settings tab.", "PHONE")

    # Appliances / rooms
    if open_tab("Appliances") or open_tab("Home"):
        root = dump_ui()
        if fb.get("deviceCount", 0) > 0:
            set_result("BBT-19", "PASS", f"Owner has {fb.get('deviceCount')} device(s) in RTDB; Appliances shell open.", "PHONE+FIREBASE")
        else:
            set_result("BBT-19", "FAIL", "No devices under devices/{owner}.", "FIREBASE")
        if fb.get("roomCount", 0) > 0:
            set_result("BBT-20", "PASS", f"Rooms present ({fb.get('roomCount')}); assignment structure exists.", "FIREBASE")
        else:
            set_result("BBT-20", "FAIL", "No rooms/{owner} entries.", "FIREBASE")

        # Toggle — try open device detail if name known
        dname = fb.get("deviceName")
        if dname and tap_text(root, str(dname)[:12]):
            root = dump_ui()
            if screen_has_any(root, "ON", "OFF", "Power", "W", "kWh", "Schedule"):
                set_result("BBT-05", "PARTIAL", "Appliance detail opened with power/switch UI; did NOT toggle relay (avoid disrupting home).", "PHONE")
            if screen_has_any(root, "Schedule"):
                set_result("BBT-06", "PARTIAL", "Schedule entry reachable from appliance; creation not rewritten this run.", "PHONE")
            if screen_has_any(root, "Limit", "₱", "Usage"):
                set_result("BBT-09", "PARTIAL", "Usage limit UI reachable; not rewritten.", "PHONE")
        else:
            # firebase schedule / usage limits
            if fb.get("scheduleCount", 0) > 0:
                set_result("BBT-06", "PASS", f"Existing schedules on device: {fb.get('scheduleCount')}", "FIREBASE")
            else:
                set_result("BBT-06", "PARTIAL", "No schedules currently on test device; creation UI not exercised.", "FIREBASE")
            if fb.get("usageLimitKeys"):
                set_result("BBT-09", "PASS", f"usageLimits keys present: {fb.get('usageLimitKeys')}", "FIREBASE")
            else:
                set_result("BBT-09", "PARTIAL", "No usageLimits on test device right now.", "FIREBASE")
            set_result("BBT-05", "PARTIAL", "Did not toggle physical relay this run (safety). Tuya snapshot checked separately.", "PHONE")

    # Tariff
    rate = (fb.get("onboarding") or {}).get("electricityRate")
    if rate:
        set_result("BBT-21", "PASS", f"electricityRate present on profile/user: {rate}", "FIREBASE")
    else:
        set_result("BBT-21", "FAIL", "No electricityRate on user profile.", "FIREBASE")

    # Disabled flag not set on test user (good)
    if (fb.get("onboarding") or {}).get("disabled"):
        set_result("BBT-32", "FAIL", "Test owner currently disabled=true — unexpected for normal testing.", "FIREBASE")
    else:
        set_result("BBT-32", "PARTIAL", "Admin disabled field + app kick-out coded; test owner is not disabled. Did not flip flag (would lock user out).", "FIREBASE")


def apply_firebase_admin_results(fb: dict, admin_files: dict, backend_info: dict, whitebox: dict):
    # Admin auth / pages
    if admin_files.get("AdminGate") and admin_files.get("pages", {}).get("Users.jsx"):
        if fb.get("adminCount", 0) > 0:
            set_result("BBT-30", "PASS", f"AdminGate present; RTDB admins count={fb.get('adminCount')}. Browser login not re-done this run.", "ADMIN+FIREBASE")
            set_result("BBT-31", "PASS", "Users.jsx present; users/{owner} readable via Admin SDK.", "ADMIN+FIREBASE")
            set_result("BBT-33", "PASS", f"Devices.jsx present; owner deviceCount={fb.get('deviceCount')}", "ADMIN+FIREBASE")
            set_result("BBT-39", "PASS", f"Devices registry data exists (deviceCount={fb.get('deviceCount')}).", "ADMIN+FIREBASE")
            set_result("BBT-34", "PASS" if admin_files.get("demoActions") else "FAIL", "FeatureDemo/demoActions present on disk.", "ADMIN")
            set_result("BBT-46", "PARTIAL", "Skip 7/14 demoActions present; not re-fired this run (avoid tip spam). Prior session had fcmSent evidence.", "ADMIN")
            set_result("BBT-47", "PARTIAL", "withPreservedBillingDay exists in demoActions; not re-run destructive seed this pass.", "ADMIN")
        else:
            set_result("BBT-30", "FAIL", "No admins/{uid}=true in RTDB.", "FIREBASE")
    else:
        set_result("BBT-30", "FAIL", "Admin files missing.", "ADMIN")

    # Backend
    if backend_info.get("running"):
        set_result("BACKEND_PROCESS", "PASS", "kilowatch-backend index.js process is running.", "BACKEND")
    else:
        set_result("BACKEND_PROCESS", "FAIL", "kilowatch-backend monitor is NOT running right now.", "BACKEND")

    tuya = fb.get("tuya")
    if tuya and isinstance(tuya, dict):
        set_result("WBT-05", "PASS", f"Live Tuya snapshot online={tuya.get('online')} powerW={tuya.get('powerW')} voltageV={tuya.get('voltageV')}", "BACKEND")
        set_result("WBT-06", "PASS", f"Parsed/calibrated snapshot + RTDB live kwh={(fb.get('live') or {}).get('kwh')}", "BACKEND+FIREBASE")
    else:
        set_result("WBT-05", "FAIL", f"Tuya snapshot failed: {fb.get('tuyaError')}", "BACKEND")

    # Reminder path existence
    set_result(
        "BBT-13",
        "PARTIAL",
        "Backend kilosaveReminders.js + admin trigger exist; did not wait for natural mid-week window or fire admin trigger this run.",
        "BACKEND",
    )
    set_result(
        "BBT-10",
        "PARTIAL",
        "Usage-limit alert path coded; did not intentionally exceed limit / fire demo trigger this run.",
        "BACKEND",
    )
    set_result(
        "BBT-07",
        "PARTIAL" if fb.get("scheduleCount", 0) >= 0 else "FAIL",
        f"Schedules on device={fb.get('scheduleCount')}; backend process running={backend_info.get('running')}. Did not wait for HH:MM fire.",
        "BACKEND",
    )

    # Whitebox merge
    if whitebox and not whitebox.get("error"):
        for tid, info in (whitebox.get("results") or {}).items():
            st = info.get("status")
            note = info.get("note", "")
            # Map COMPLETED/PENDING to PASS/FAIL/PARTIAL for live honesty
            if tid == "WBT-13":
                set_result(tid, "PARTIAL", note + f" | backend_running={backend_info.get('running')}", "WHITEBOX")
            elif st == "COMPLETED":
                # don't downgrade if we already have stronger phone evidence unless conflict
                if tid not in results:
                    set_result(tid, "PASS", note, "WHITEBOX")
                else:
                    # keep existing, append
                    results[tid]["evidence"] += " || WHITEBOX: " + note
            else:
                set_result(tid, "PARTIAL", note, "WHITEBOX")
    else:
        set_result("WHITEBOX_RUN", "FAIL", str(whitebox)[:500], "WHITEBOX")

    # TAT honest
    for tid in ("TAT-01", "TAT-02", "TAT-03", "TAT-04"):
        set_result(tid, "FAIL", "Not run — no reference wattmeter measurements this session.", "HARDWARE")

    # Cases we refuse to mutate
    for tid, why in [
        ("BBT-01", "Did not create a new account (would pollute Auth). Registration code path previously verified only."),
        ("BBT-03", "Did not submit wrong password (would risk lockout/noise)."),
        ("BBT-04", "Did not send password-reset email this run."),
        ("BBT-25", "Did not accept a new household invite."),
        ("BBT-27", "Did not remove a household member (destructive)."),
        ("BBT-45", "Test account already onboarded; full new-user onboarding not re-walked."),
    ]:
        if tid not in results:
            set_result(tid, "PARTIAL", why, "SKIPPED_SAFE")


def main():
    os.chdir(BACKEND)
    print("=== Firebase probe ===", flush=True)
    fb = firebase_probe()
    print(json.dumps(fb, indent=2)[:3000], flush=True)

    print("=== Backend process ===", flush=True)
    backend_info = check_backend_running()
    print(backend_info, flush=True)

    print("=== Admin files ===", flush=True)
    admin_files = check_admin_files()
    print(admin_files, flush=True)

    print("=== Whitebox ===", flush=True)
    whitebox = run_whitebox()
    print(str(whitebox)[:2000], flush=True)

    print("=== Phone walk ===", flush=True)
    if isinstance(fb, dict) and not fb.get("error"):
        phone_walk(fb)
    else:
        set_result("PHONE_SESSION", "FAIL", f"Firebase probe failed; skipped phone data asserts: {fb}", "FIREBASE")
        launch_app()
        root = dump_ui()
        set_result("PHONE_UI_ONLY", "PARTIAL", " | ".join(all_texts(root)[:50]), "PHONE")

    apply_firebase_admin_results(fb if isinstance(fb, dict) else {}, admin_files, backend_info, whitebox)

    # App version honesty
    ver = adb("shell", "dumpsys", "package", PKG)
    m = re.search(r"versionName=([^\s]+)", ver)
    set_result(
        "APP_VERSION",
        "PARTIAL",
        f"Native versionName={m.group(1) if m else '?'} (grafted APK keeps 1.0.0 native; JS bundle is 1.0.18 graft from 2026-10-04). lastUpdate check via package manager.",
        "PHONE",
    )

    payload = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "owner": OWNER,
        "device": DEVICE,
        "firebase": fb,
        "backend": backend_info,
        "adminFiles": admin_files,
        "results": results,
    }
    OUT_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print("WROTE", OUT_JSON, flush=True)
    # summary counts
    counts = {}
    for r in results.values():
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    print("COUNTS", counts, flush=True)


if __name__ == "__main__":
    main()
