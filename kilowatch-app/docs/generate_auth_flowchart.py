"""Generate separate Kilowatch auth flowcharts: login, register, forgot_password."""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

BG = (255, 255, 255)
STROKE = (0, 0, 0)
TEXT = (0, 0, 0)
FILL = (255, 255, 255)
PAD = 36
BOX_W = 260
GAP_Y = 32
SIDE_GAP = 160

OUT_DIR = Path(__file__).resolve().parent

try:
    FONT = ImageFont.truetype("arial.ttf", 17)
    FONT_S = ImageFont.truetype("arial.ttf", 15)
    FONT_LABEL = ImageFont.truetype("arial.ttf", 14)
except OSError:
    FONT = ImageFont.load_default()
    FONT_S = FONT
    FONT_LABEL = FONT


def text_size(draw, text, font):
    b = draw.textbbox((0, 0), text, font=font)
    return b[2] - b[0], b[3] - b[1]


def wrap_text(draw, text, font, max_w):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if text_size(draw, trial, font)[0] <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines or [text]


class Canvas:
    def __init__(self, w, h):
        self.img = Image.new("RGB", (w, h), BG)
        self.draw = ImageDraw.Draw(self.img)
        self.min_x = w
        self.min_y = h
        self.max_x = 0
        self.max_y = 0

    def track(self, x0, y0, x1, y1):
        self.min_x = min(self.min_x, x0)
        self.min_y = min(self.min_y, y0)
        self.max_x = max(self.max_x, x1)
        self.max_y = max(self.max_y, y1)

    def box(self, cx, cy, text, box_w=BOX_W, font=FONT):
        lines = []
        for part in text.split("\n"):
            lines.extend(wrap_text(self.draw, part, font, box_w - 28))
        line_h = text_size(self.draw, "Ag", font)[1] + 4
        box_h = max(48, 24 + line_h * len(lines))
        x0, y0 = cx - box_w // 2, cy - box_h // 2
        x1, y1 = x0 + box_w, y0 + box_h
        self.draw.rounded_rectangle(
            [x0, y0, x1, y1], radius=8, outline=STROKE, width=2, fill=FILL
        )
        ty = cy - (line_h * len(lines)) // 2
        for line in lines:
            tw, _ = text_size(self.draw, line, font)
            self.draw.text((cx - tw // 2, ty), line, fill=TEXT, font=font)
            ty += line_h
        self.track(x0, y0, x1, y1)
        return {"cx": cx, "cy": cy, "top": y0, "bot": y1, "left": x0, "right": x1, "w": box_w, "h": box_h}

    def diamond(self, cx, cy, text, size=130):
        half = size // 2
        pts = [(cx, cy - half), (cx + half, cy), (cx, cy + half), (cx - half, cy)]
        self.draw.polygon(pts, outline=STROKE, fill=FILL)
        self.draw.line(pts + [pts[0]], fill=STROKE, width=2)
        lines = wrap_text(self.draw, text, FONT_S, size - 46)
        line_h = text_size(self.draw, "Ag", FONT_S)[1] + 2
        ty = cy - (line_h * len(lines)) // 2
        for line in lines:
            tw, _ = text_size(self.draw, line, FONT_S)
            self.draw.text((cx - tw // 2, ty), line, fill=TEXT, font=FONT_S)
            ty += line_h
        self.track(cx - half, cy - half, cx + half, cy + half)
        return {"cx": cx, "cy": cy, "top": cy - half, "bot": cy + half, "left": cx - half, "right": cx + half, "w": size, "h": size}

    def arrow_v(self, x, y1, y2):
        if y2 <= y1:
            return
        self.draw.line([(x, y1), (x, y2)], fill=STROKE, width=2)
        self._head(x, y2, math.pi / 2)
        self.track(x - 6, y1, x + 6, y2)

    def arrow_h(self, x1, y, x2):
        self.draw.line([(x1, y), (x2, y)], fill=STROKE, width=2)
        angle = 0 if x2 > x1 else math.pi
        self._head(x2, y, angle)
        self.track(min(x1, x2), y - 6, max(x1, x2), y + 6)

    def _head(self, x, y, angle):
        size = 9
        a1 = (x - size * math.cos(angle - 0.45), y - size * math.sin(angle - 0.45))
        a2 = (x - size * math.cos(angle + 0.45), y - size * math.sin(angle + 0.45))
        self.draw.polygon([(x, y), a1, a2], fill=STROKE)

    def label(self, x, y, text):
        tw, th = text_size(self.draw, text, FONT_LABEL)
        self.draw.text((x - tw // 2, y - th // 2), text, fill=TEXT, font=FONT_LABEL)
        self.track(x - tw // 2, y - th // 2, x + tw // 2, y + th // 2)

    def save(self, path: Path):
        # Tight crop with padding only — no frame
        x0 = max(0, self.min_x - PAD)
        y0 = max(0, self.min_y - PAD)
        x1 = min(self.img.width, self.max_x + PAD)
        y1 = min(self.img.height, self.max_y + PAD)
        cropped = self.img.crop((x0, y0, x1, y1))
        cropped.save(path, "PNG")
        print(f"Saved: {path}")


def next_y(node, extra=GAP_Y):
    return node["bot"] + extra + 24


def connect_down(c: Canvas, node, y_target_top):
    c.arrow_v(node["cx"], node["bot"], y_target_top)


def build_login():
    c = Canvas(1000, 1500)
    cx = 480
    left_x = 260
    right_x = 720
    left_err = 80
    mid_err = 480
    right_err = 910

    y = 40
    n = c.box(cx, y, "App starts\nonAuthStateChanged")
    y = next_y(n, 28)
    connect_down(c, n, y - 65)
    d = c.diamond(cx, y, "User signed in?", 136)

    c.arrow_h(d["right"], y, cx + 175)
    c.label(d["right"] + 42, y - 16, "Yes")
    c.box(cx + 250, y, "MainTabs", box_w=130, font=FONT_S)

    y = next_y(d, 28)
    connect_down(c, d, y - 28)
    c.label(cx + 26, d["bot"] + 12, "No")
    n = c.box(cx, y, "Login Screen\nEmail + Password")

    # Screen links from Login (side branches)
    link_y = n["cy"]
    c.arrow_h(n["left"], link_y - 18, cx - 200)
    c.box(cx - 250, link_y - 18, "→ Register", box_w=140, font=FONT_S)
    c.arrow_h(n["left"], link_y + 22, cx - 200)
    c.box(cx - 250, link_y + 36, "→ Forgot Password", box_w=150, font=FONT_S)

    y = next_y(n, 28)
    connect_down(c, n, y - 28)
    n = c.box(cx, y, "Choose sign-in method")
    branch_y = n["bot"]

    col_top = branch_y + GAP_Y + 44
    c.draw.line([(cx, branch_y), (cx, branch_y + 18)], fill=STROKE, width=2)
    c.draw.line([(left_x, branch_y + 18), (right_x, branch_y + 18)], fill=STROKE, width=2)
    c.arrow_v(left_x, branch_y + 18, col_top - 28)
    c.arrow_v(right_x, branch_y + 18, col_top - 28)
    c.label(left_x, branch_y + 4, "Email")
    c.label(right_x, branch_y + 4, "Google")

    # Email column
    n = c.box(left_x, col_top, "Validate fields\n(required)", box_w=210, font=FONT_S)
    y = next_y(n, 30)
    connect_down(c, n, y - 60)
    d = c.diamond(left_x, y, "Valid?", 118)

    c.arrow_h(d["left"], y, left_err + 50)
    c.label(d["left"] - 26, y - 16, "No")
    c.box(left_err, y, "Show field\nerrors", box_w=100, font=FONT_S)

    y = next_y(d, 30)
    connect_down(c, d, y - 28)
    c.label(left_x + 24, d["bot"] + 12, "Yes")
    n = c.box(left_x, y, "signInWithEmail\nAndPassword", box_w=210, font=FONT_S)

    y = next_y(n, 30)
    connect_down(c, n, y - 60)
    d_email_ok = c.diamond(left_x, y, "Success?", 118)
    email_success_y = y

    c.arrow_h(d_email_ok["right"], y, mid_err - 60)
    c.label(d_email_ok["right"] + 28, y - 16, "No")
    c.box(mid_err, y, "Show Firebase\nerror", box_w=120, font=FONT_S)

    y = next_y(d_email_ok, 30)
    connect_down(c, d_email_ok, y - 28)
    c.label(left_x + 24, d_email_ok["bot"] + 12, "Yes")
    c.box(left_x, y, "Auth listener\n→ MainTabs", box_w=190, font=FONT_S)

    # Google column — Success? aligned with email
    n = c.box(right_x, col_top, "signInWithGoogle()", box_w=210, font=FONT_S)
    connect_down(c, n, email_success_y - 60)
    d_g = c.diamond(right_x, email_success_y, "Success?", 118)

    c.arrow_h(d_g["right"], email_success_y, right_err - 50)
    c.label(d_g["right"] + 26, email_success_y - 16, "No")
    c.box(right_err, email_success_y, "Show Google\nerror", box_w=110, font=FONT_S)

    y_g = next_y(d_g, 30)
    connect_down(c, d_g, y_g - 28)
    c.label(right_x + 24, d_g["bot"] + 12, "Yes")
    c.box(right_x, y_g, "Auth listener\n→ MainTabs", box_w=190, font=FONT_S)

    c.save(OUT_DIR / "login.png")


def build_register():
    c = Canvas(900, 1500)
    cx = 450
    err_x = 120

    y = 50
    n = c.box(cx, y, "Register Screen\nName, Email, Password,\nConfirm, Terms")
    y = next_y(n)
    connect_down(c, n, y - 28)
    n = c.box(
        cx,
        y,
        "Validate:\nname ≥ 3, email format,\npassword ≥ 8 + upper + symbol,\nmatch + terms accepted",
        box_w=300,
        font=FONT_S,
    )
    y = next_y(n, 32)
    connect_down(c, n, y - 65)
    d = c.diamond(cx, y, "All valid?", 140)

    c.arrow_h(d["left"], y, err_x + 70)
    c.label(d["left"] - 30, y - 16, "No")
    c.box(err_x, y, "Show field /\nterms errors", box_w=150, font=FONT_S)

    y = next_y(d)
    connect_down(c, d, y - 28)
    c.label(cx + 28, d["bot"] + 14, "Yes")
    n = c.box(cx, y, "createUserWithEmail\nAndPassword")

    y = next_y(n, 32)
    connect_down(c, n, y - 65)
    d = c.diamond(cx, y, "Auth OK?", 130)

    fail_x = cx + 250
    c.arrow_h(d["right"], y, fail_x - 70)
    c.label(d["right"] + 40, y - 16, "No")
    c.box(fail_x, y, "Show Firebase error\n(email in use, weak,\nnetwork…)", box_w=180, font=FONT_S)

    y = next_y(d)
    connect_down(c, d, y - 28)
    c.label(cx + 28, d["bot"] + 14, "Yes")
    n = c.box(cx, y, "Write RTDB\nusers/{uid}\nemailIndex/{emailKey}")

    y = next_y(n)
    connect_down(c, n, y - 28)
    c.box(cx, y, "Registration successful\nAuth listener → MainTabs")

    # Screen link (always available) — not part of success path
    link_y = y + 100
    c.box(cx, link_y, "← Back to Log In", box_w=180, font=FONT_S)

    c.save(OUT_DIR / "register.png")


def build_forgot():
    c = Canvas(900, 1400)
    cx = 450
    err_x = 120

    y = 50
    n = c.box(cx, y, "Forgot Password Screen\n(email from Login optional)")
    y = next_y(n)
    connect_down(c, n, y - 28)
    n = c.box(cx, y, "Validate email\n(required + format)")

    y = next_y(n, 32)
    connect_down(c, n, y - 65)
    d = c.diamond(cx, y, "Valid?", 130)

    c.arrow_h(d["left"], y, err_x + 65)
    c.label(d["left"] - 28, y - 16, "No")
    c.box(err_x, y, "Show email\nerror", box_w=130, font=FONT_S)

    y = next_y(d)
    connect_down(c, d, y - 28)
    c.label(cx + 28, d["bot"] + 14, "Yes")
    n = c.box(cx, y, "sendPasswordResetEmail\n(Firebase Auth)")

    y = next_y(n, 32)
    connect_down(c, n, y - 65)
    d = c.diamond(cx, y, "Handled OK?", 140)

    fail_x = cx + 260
    c.arrow_h(d["right"], y, fail_x - 75)
    c.label(d["right"] + 40, y - 16, "No")
    c.box(
        fail_x,
        y,
        "Show error\n(invalid, rate limit,\nnetwork)",
        box_w=170,
        font=FONT_S,
    )

    y = next_y(d)
    connect_down(c, d, y - 28)
    c.label(cx + 36, d["bot"] + 14, "Yes*")
    n = c.box(
        cx,
        y,
        "Alert: Check your email\n(same message if user-not-found)\nButton → Resend Reset Link",
        box_w=300,
        font=FONT_S,
    )

    note_y = n["bot"] + 55
    c.box(
        cx,
        note_y,
        "* user-not-found uses same\nsuccess alert (no email leak)",
        box_w=280,
        font=FONT_S,
    )

    link_y = note_y + 95
    c.box(cx, link_y, "← Back to Log In", box_w=180, font=FONT_S)

    c.save(OUT_DIR / "forgot_password.png")


if __name__ == "__main__":
    build_login()
    build_register()
    build_forgot()
    # Remove old combined file if present
    old = OUT_DIR / "kilowatch_auth_flowchart.png"
    if old.exists():
        old.unlink()
        print(f"Removed: {old}")
