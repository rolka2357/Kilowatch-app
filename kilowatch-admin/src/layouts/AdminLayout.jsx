/**
 * Shell layout for authenticated admin pages.
 * Renders mobile top bar, collapsible sidebar nav, theme toggle, sign-out,
 * and an Outlet for nested routes.
 */
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAdminAuth } from "../auth/AdminGate";
import { useTheme } from "../theme";

const LINKS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/users", label: "Users" },
  { to: "/devices", label: "Devices" },
  { to: "/providers", label: "Providers" },
  { to: "/onboarding", label: "Onboarding" },
  { to: "/news", label: "News" },
  { to: "/demo", label: "Feature demo" },
  { to: "/support", label: "Support" },
];

export default function AdminLayout() {
  const { user, signOut } = useAdminAuth();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  // Close drawer when the route changes
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  // Lock body scroll while the mobile nav is open
  useEffect(() => {
    document.body.style.overflow = navOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  function closeNav() {
    setNavOpen(false);
  }

  return (
    <div className={`shell ${navOpen ? "nav-open" : ""}`}>
      {/* Mobile header: menu, brand, theme */}
      <header className="mobile-topbar">
        <button
          type="button"
          className="menu-btn"
          aria-label={navOpen ? "Close menu" : "Open menu"}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((open) => !open)}
        >
          <span className="menu-icon" aria-hidden />
        </button>
        <div className="mobile-brand">
          <img
            className="brand-mark"
            src="/kilowatch_mark.svg"
            alt=""
            width={28}
            height={28}
          />
          <img
            className="brand-wordmark"
            src="/kilowatch_logo_wordmark.svg"
            alt="Kilowatch"
          />
        </div>
        <button
          type="button"
          className="theme-toggle mobile-theme-toggle"
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Light mode" : "Dark mode"}
        >
          {isDark ? "Light" : "Dark"}
        </button>
      </header>

      {/* Tap-outside backdrop for mobile drawer */}
      <button
        type="button"
        className="sidebar-backdrop"
        aria-label="Close menu"
        onClick={closeNav}
        tabIndex={navOpen ? 0 : -1}
      />

      {/* Desktop + drawer sidebar */}
      <aside className="sidebar">
        <div className="sidebar-head">
          <div className="brand">
            <img
              className="brand-mark"
              src="/kilowatch_mark.svg"
              alt=""
              width={32}
              height={32}
            />
            <div className="brand-text">
              <img
                className="brand-wordmark"
                src="/kilowatch_logo_wordmark.svg"
                alt="Kilowatch"
              />
              <span>Admin</span>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-close"
            aria-label="Close menu"
            onClick={closeNav}
          >
            ×
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Admin">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
              onClick={closeNav}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-pressed={isDark}
          >
            {isDark ? "Light mode" : "Dark mode"}
          </button>
          <p className="sidebar-email">{user?.email}</p>
          <button
            type="button"
            className="sidebar-signout"
            onClick={() => {
              closeNav();
              signOut();
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Nested page content */}
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
