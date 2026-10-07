/**
 * Kilowatch APK download landing.
 * Paste your Google Drive direct-download URL into APK_HREF below.
 */
import { useTheme } from "./theme.jsx";

/**
 * Google Drive direct download:
 * 1. Upload APK → Share → Anyone with the link
 * 2. Copy link: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * 3. Use: https://drive.google.com/uc?export=download&id=FILE_ID
 */
const APK_HREF =
  "https://drive.google.com/uc?export=download&id=1gbdBHfIRB15J0mmLYXB053r5X5Y2Af4t";
const APP_VERSION = "1.0.0";

const NAV_LINKS = [
  { href: "#features", label: "Core features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#about", label: "About Us" },
  { href: "#how-to-install", label: "Install" },
  { href: "#faq", label: "FAQ" },
];

const FEATURES = [
  {
    title: "Appliances & rooms",
    body: "Pair smart plugs, group them by room, and see which spaces are online and using power today.",
  },
  {
    title: "Analytics",
    body: "Day, week, month, and year views — plus a comparison trend so you can see if usage is up or down.",
  },
  {
    title: "KiloSave",
    body: "Set a bill-period budget, log your electric bill, and track set-asides against your goal.",
  },
  {
    title: "Tips & news",
    body: "Get practical energy tips based on your home’s usage, plus saving news you can open in the app.",
  },
];

const HOW_IT_WORKS = [
  {
    title: "Install the APK",
    body: "Download from this page and allow install from your browser or Files app.",
  },
  {
    title: "Create your account",
    body: "Sign up, set your electricity rate, and finish the short onboarding flow.",
  },
  {
    title: "Pair a smart plug",
    body: "Add an appliance, connect your plug to Wi‑Fi, and assign it to a room.",
  },
  {
    title: "Watch your energy",
    body: "Check live usage, analytics, KiloSave goals, and tips as your home data builds.",
  },
];

const INSTALL_STEPS = [
  {
    title: "Download the APK",
    body: "Tap Download APK on this page. Your phone saves the Kilowatch installer.",
  },
  {
    title: "Open the file",
    body: "From notifications or Files → Downloads, tap the APK to install.",
  },
  {
    title: "Allow unknown apps",
    body: "If Android blocks it, allow installs from your browser or Files, then retry.",
  },
  {
    title: "Install & open",
    body: "Tap Install, then Open. Sign in and add your smart plug.",
  },
];

const FAQS = [
  {
    q: "Is Kilowatch on the Play Store?",
    a: "Not for this demo build. You install the APK from this page (sideload). Android will ask you to allow installs from your browser or Files.",
  },
  {
    q: "What do I need to use the app?",
    a: "An Android phone, Wi‑Fi, and at least one supported smart plug you can pair during onboarding. An electricity rate helps Php estimates look realistic.",
  },
  {
    q: "Are the Php totals my real bill?",
    a: "No. Kilowatch estimates cost from tracked plugs and your rate. It excludes taxes and utility fees, so treat it as a guide — not your Meralco (or other) bill.",
  },
  {
    q: "Can household members share one home?",
    a: "Yes. The home owner can invite members. KiloSave budget tools stay with the owner; others can still view usage depending on their role.",
  },
];

const TEAM = [
  {
    name: "Michael John Almazol",
    role: "Quality Assurance & Researcher",
    photo:
      "https://placehold.co/320x320/FE6023/FFFFFF/png?text=MJA",
  },
  {
    name: "Charles Gabriel Garcia",
    role: "UI/UX & Capstone Leader",
    photo:
      "https://placehold.co/320x320/E04E14/FFFFFF/png?text=CGG",
  },
  {
    name: "Karol Joseph Faeldin",
    role: "Developer",
    photo:
      "https://placehold.co/320x320/FE6023/FFFFFF/png?text=KJF",
  },
  {
    name: "Juan Carlos Gabriel Pollicar",
    role: "Developer",
    photo:
      "https://placehold.co/320x320/E04E14/FFFFFF/png?text=JCG",
  },
  {
    name: "Matthew Pasacay",
    role: "Quality Assurance & Researcher",
    photo:
      "https://placehold.co/320x320/FE6023/FFFFFF/png?text=MP",
  },
];

function DownloadLink({ className, children }) {
  return (
    <a
      className={className}
      href={APK_HREF}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}

export default function App() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="page">
      <header className="header">
        <div className="header-inner">
          <a className="brand" href="#hero">
            <img
              className="brand-mark"
              src="/kilowatch_mark.svg"
              alt=""
              width={26}
              height={26}
            />
            <span className="brand-name">Kilowatch</span>
          </a>

          <nav className="nav" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <a key={link.href} className="nav-link" href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>

          <div className="header-actions">
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={
                isDark ? "Switch to light mode" : "Switch to dark mode"
              }
            >
              {isDark ? (
                <svg
                  className="theme-toggle-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
                  <path
                    d="M12 3.5v1.7M12 18.8v1.7M4.93 4.93l1.2 1.2M17.87 17.87l1.2 1.2M3.5 12h1.7M18.8 12h1.7M4.93 19.07l1.2-1.2M17.87 6.13l1.2-1.2"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg
                  className="theme-toggle-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M20.2 13.4A7.6 7.6 0 0 1 10.6 3.8 7.8 7.8 0 1 0 20.2 13.4Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              <span>{isDark ? "Light" : "Dark"}</span>
            </button>
            <DownloadLink className="btn header-download">
              Download
            </DownloadLink>
          </div>
        </div>
      </header>

      <main>
        <section className="hero" id="hero" aria-labelledby="hero-title">
          <div className="hero-inner">
            <div className="hero-copy">
              <p className="eyebrow">Android APK · v{APP_VERSION}</p>
              <h1 id="hero-title">
                Home electricity monitoring
                <span className="hero-break"> for every plug.</span>
              </h1>
              <p className="lede">
                Kilowatch shows usage from your smart plugs, helps you set
                KiloSave goals, and keeps bill estimates grounded — for Filipino
                homes, not a pitch deck.
              </p>

              <div className="hero-cta">
                <DownloadLink className="btn primary">Download APK</DownloadLink>
                <a className="btn ghost" href="#features">
                  See core features
                </a>
              </div>
            </div>

            <aside className="hero-aside" aria-hidden="true">
              <div className="phone">
                <div className="phone-bezel">
                  <div className="phone-notch" />
                  <div className="phone-ui">
                    <header className="mock-header">
                      <span className="mock-icon-btn">
                        <img src="/mock/home_icon.svg" alt="" />
                      </span>
                      <img
                        className="mock-logo"
                        src="/mock/kilowatch_logo_no_icon.svg"
                        alt=""
                      />
                      <span className="mock-icon-btn">
                        <img src="/mock/bell_icon.svg" alt="" />
                      </span>
                    </header>

                    <div className="mock-scroll">
                      <p className="mock-greeting">Good Day, User 👋</p>

                      <div className="mock-dashboard">
                        <img
                          className="mock-dashboard-bg"
                          src="/mock/morning_dashboard.png"
                          alt=""
                        />
                        <div className="mock-dashboard-overlay">
                          <div className="mock-dash-top">
                            <div>
                              <p>How much you&apos;ve used today</p>
                              <p className="mock-dash-rate">Rate: ₱12.50/kWh</p>
                            </div>
                            <p>3 Oct 2026</p>
                          </div>
                          <div className="mock-dash-bottom">
                            <p className="mock-dash-php">₱18.40</p>
                            <p className="mock-dash-kwh">1.47 kWh used today</p>
                          </div>
                        </div>
                      </div>

                      <div className="mock-add">
                        <div>
                          <p className="mock-add-title">Add an Appliance</p>
                          <p className="mock-add-sub">
                            Start your energy saving journey
                          </p>
                        </div>
                        <span className="mock-add-btn">
                          <img src="/mock/add_icon.svg" alt="" />
                        </span>
                      </div>

                      <div className="mock-rooms">
                        <article className="mock-room">
                          <div>
                            <p className="mock-room-name">Living Room</p>
                            <p className="mock-room-online">2 Online</p>
                          </div>
                          <div>
                            <p className="mock-room-kwh">0.84 kWh</p>
                            <p className="mock-room-php">₱10.50 TODAY</p>
                          </div>
                        </article>
                        <article className="mock-room">
                          <div>
                            <p className="mock-room-name">Kitchen</p>
                            <p className="mock-room-online">1 Online</p>
                          </div>
                          <div>
                            <p className="mock-room-kwh">0.63 kWh</p>
                            <p className="mock-room-php">₱7.90 TODAY</p>
                          </div>
                        </article>
                      </div>
                    </div>

                    <nav className="mock-tabs">
                      <span className="mock-tab active">
                        <img src="/mock/appliances_icon.svg" alt="" />
                        <small>Appliances</small>
                      </span>
                      <span className="mock-tab">
                        <img src="/mock/analytics_icon.svg" alt="" />
                        <small>Analytics</small>
                      </span>
                      <span className="mock-tab">
                        <img src="/mock/kilosave_icon.svg" alt="" />
                        <small>KiloSave</small>
                      </span>
                      <span className="mock-tab">
                        <img src="/mock/tips_icon.svg" alt="" />
                        <small>Tips</small>
                      </span>
                      <span className="mock-tab">
                        <img src="/mock/settings_icon.svg" alt="" />
                        <small>Settings</small>
                      </span>
                    </nav>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="band band-alt" id="features">
          <div className="band-inner">
            <div className="section-head">
              <h2>Core features</h2>
              <p>
                Everything in the app is built around plugs you actually own —
                rooms, trends, budgets, and tips in one place.
              </p>
            </div>
            <div className="feature-list">
              {FEATURES.map((item, index) => (
                <article key={item.title} className="feature-row">
                  <span className="feature-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="feature-copy">
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="band" id="how-it-works">
          <div className="band-inner">
            <div className="section-head">
              <h2>How it works</h2>
              <p>From APK install to your first usable reading in four steps.</p>
            </div>
            <ol className="flow-rail">
              {HOW_IT_WORKS.map((item, index) => (
                <li key={item.title} className="flow-item">
                  <span className="flow-dot">{index + 1}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="band band-alt" id="about">
          <div className="band-inner">
            <div className="section-head about-intro">
              <h2>About Us</h2>
              <p>
                Kilowatch is a student-built energy monitoring app for Filipino
                households. We focus on clear kWh and Php estimates from
                registered smart plugs — so you can see where power goes and
                practice better spending habits with KiloSave.
              </p>
            </div>

            <div className="team-grid">
              {TEAM.map((member) => (
                <article key={member.name} className="team-card">
                  <img
                    className="team-photo"
                    src={member.photo}
                    alt={member.name}
                    width={320}
                    height={320}
                    loading="lazy"
                  />
                  <h3>{member.name}</h3>
                  <p>{member.role}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="band" id="how-to-install">
          <div className="band-inner">
            <div className="section-head">
              <h2>How to install</h2>
              <p>
                This build is not on the Play Store. Android will ask you to
                allow installs from the browser or Files app.
              </p>
            </div>

            <ol className="install-rail">
              {INSTALL_STEPS.map((step, index) => (
                <li key={step.title} className="install-item">
                  <span className="install-index">{index + 1}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="tips">
              <h3>Blocked install?</h3>
              <ul>
                <li>
                  Settings → Apps → Special app access → Install unknown apps →
                  allow your browser / Files.
                </li>
                <li>
                  Chrome warning: choose Download anyway for this private demo
                  build.
                </li>
                <li>
                  Uninstall an older Kilowatch build if you get a package
                  conflict.
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="band band-alt" id="faq">
          <div className="band-inner">
            <div className="section-head">
              <h2>FAQ</h2>
              <p>Quick answers before you install.</p>
            </div>
            <div className="faq-list">
              {FAQS.map((item) => (
                <details key={item.q} className="faq-item">
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="band cta-band" id="get-app">
          <div className="band-inner cta-inner">
            <div>
              <h2>Get the app</h2>
              <p>
                Download the Android APK, follow the install steps, then pair
                your first plug.
              </p>
            </div>
            <div className="cta-actions">
              <DownloadLink className="btn primary">Download APK</DownloadLink>
              <a className="btn ghost" href="#how-to-install">
                Install guide
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-inner footer-row">
          <span>© {new Date().getFullYear()} Kilowatch</span>
          <nav className="footer-nav" aria-label="Footer">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
