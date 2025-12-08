import React, { useMemo, useState } from "react";

type NavSection = "settings" | "dashboard";

export interface SidebarNavigationProps {
  active: NavSection;
  onNavigate?: (section: NavSection) => void;
  className?: string;
}

const NAV_ITEMS: Array<{ key: NavSection; label: string }> = [
  { key: "settings", label: "User Settings" },
  { key: "dashboard", label: "Dashboard" },
];

export const SidebarNavigation: React.FC<SidebarNavigationProps> = ({
  active,
  onNavigate,
  className = "",
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const containerClasses = useMemo(
    () =>
      [
        "bg-gradient-to-b from-[#1E1E1E] to-[#2C2C2C] text-white",
        "md:min-h-screen md:w-64",
        "w-full shadow-xl shadow-black/30",
        className,
      ]
        .join(" ")
        .trim(),
    [className]
  );

  const handleNavigate = (section: NavSection) => {
    onNavigate?.(section);
    setMobileOpen(false);
  };

  const renderNavItems = (layout: "vertical" | "horizontal") => (
    <ul
      className={
        layout === "vertical"
          ? "space-y-2"
          : "flex gap-3 overflow-x-auto text-sm"
      }
    >
      {NAV_ITEMS.map((item) => (
        <li key={item.key}>
          <button
            type="button"
            onClick={() => handleNavigate(item.key)}
            className={[
              "w-full rounded-2xl px-4 py-3 text-left font-medium transition",
              layout === "horizontal" ? "min-w-[140px]" : "",
              active === item.key
                ? "bg-white/15 text-white"
                : "text-white/70 hover:bg-white/10",
            ]
              .join(" ")
              .trim()}
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <nav className={containerClasses}>
      <div className="hidden h-full flex-col px-6 py-10 md:flex">
        <p className="text-lg uppercase tracking-[0.3em] text-white/70">
          Profile
        </p>
        <h2 className="mt-2 text-3xl font-semibold">Control Center</h2>
        <div className="mt-8 flex-1">{renderNavItems("vertical")}</div>
      </div>

      <div className="md:hidden">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">
              Profile
            </p>
            <h2 className="text-xl font-semibold">Control Center</h2>
          </div>
          <button
            type="button"
            className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium"
            onClick={() => setMobileOpen((prev) => !prev)}
          >
            {mobileOpen ? "Close" : "Menu"}
          </button>
        </div>
        {mobileOpen && (
          <div className="border-t border-white/10 px-4 py-4">
            {renderNavItems("horizontal")}
          </div>
        )}
      </div>
    </nav>
  );
};

export default SidebarNavigation;
