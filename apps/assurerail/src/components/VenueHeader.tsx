"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { guidedJourneyEnabled, hostedAlphaEnabled, institutionalProductEnabled, type HostedAlphaTask, type HostedAlphaTaskResponse } from "@/lib/customer-workspace";
import { vget, shortDid } from "@/lib/venue";
import { Logo } from "./Logo";

type ActivityRow = { id: string; event: string; actor: string; createdAt: string };

const Bell = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" strokeLinecap="round" strokeLinejoin="round" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" /></svg>);
const Hamburger = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" /></svg>);
const Gear = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.6 15a1.65 1.65 0 0 0-1.51-1H2a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 3.6 8.4l.06-.06A2 2 0 1 1 6.49 5.5l.06.06A1.65 1.65 0 0 0 9 5.6h.09A1.65 1.65 0 0 0 10.6 4.09V4a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 2.82 1.17l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 20.4 9v.09A1.65 1.65 0 0 0 22 10.6h.09a2 2 0 1 1 0 4H22a1.65 1.65 0 0 0-1.6 1.4z" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const Out = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" /></svg>);

export function VenueHeader() {
  const { venueUser, firebaseUser, activeInstitutionId, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [notifs, setNotifs] = useState<ActivityRow[]>([]);
  const [tasks, setTasks] = useState<HostedAlphaTask[]>([]);
  const [notificationMode, setNotificationMode] = useState<"TASKS" | "ACTIVITY" | "NONE">("NONE");
  const [hasStaffWorkspace, setHasStaffWorkspace] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const isAdmin = !!venueUser?.isAdmin;

  useEffect(() => {
    if (!notifOpen) return;
    if (activeInstitutionId && hostedAlphaEnabled()) {
      setNotificationMode("TASKS");
      setNotifs([]);
      vget<HostedAlphaTaskResponse>(`/v1/rail/institutions/${encodeURIComponent(activeInstitutionId)}/hosted-alpha/tasks`)
        .then((result) => setTasks(result.tasks.filter((task) => task.dueState !== "WATCH").slice(0, 6)))
        .catch(() => setTasks([]));
    } else if (isAdmin && !activeInstitutionId) {
      setNotificationMode("ACTIVITY");
      setTasks([]);
      vget<{ rows: ActivityRow[] }>("/venue/activity?limit=6").then((r) => setNotifs(r.rows)).catch(() => {});
    } else {
      setNotificationMode("NONE");
      setTasks([]);
      setNotifs([]);
    }
  }, [notifOpen, activeInstitutionId, isAdmin]);

  useEffect(() => {
    if (!venueUser || activeInstitutionId) {
      setHasStaffWorkspace(false);
      return;
    }
    vget<{ workspaces: unknown[] }>("/v1/rail/internal-access/workspaces", { institutionId: null })
      .then((result) => setHasStaffWorkspace(result.workspaces.length > 0))
      .catch(() => setHasStaffWorkspace(false));
  }, [venueUser, activeInstitutionId]);

  useEffect(() => {
    if (!notifOpen && !menuOpen) return;
    const h = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [notifOpen, menuOpen]);

  const email = venueUser?.email ?? firebaseUser?.email ?? "";
  const initial = (email[0] ?? "?").toUpperCase();
  const nav = [
    ...(activeInstitutionId && process.env.NEXT_PUBLIC_ASSURERAIL_CUSTOMER_WORKSPACE_V1 === "shadow" ? [{ href: "/workspace", label: "Workspace" }] : []),
    ...(activeInstitutionId && guidedJourneyEnabled() ? [{ href: "/workspace/start", label: "Get started" }] : []),
    ...(activeInstitutionId && hostedAlphaEnabled() ? [{ href: "/workspace/tasks", label: "Actions" }] : []),
    ...(activeInstitutionId && institutionalProductEnabled() ? [{ href: "/workspace/institution", label: "Institution" }] : []),
    { href: "/institutions", label: "Institutions" },
    { href: "/cases", label: "Cases" },
    { href: "/console", label: "Legacy console" },
    { href: "/activity", label: "Activity" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
    ...(isAdmin ? [{ href: "/admin/institutions", label: "Approvals" }] : []),
    ...(venueUser?.platformRole === "SUPERADMIN" ? [{ href: "/admin/access", label: "Access" }] : []),
    ...(hasStaffWorkspace ? [{ href: "/internal", label: "Staff" }] : []),
  ];
  const closeAll = () => { setNotifOpen(false); setMenuOpen(false); setNavOpen(false); };

  return (
    <header className="appbar">
      <div className="wrap appbar-row">
        <button className="icon-btn hamburger" aria-label="Menu" onClick={() => setNavOpen(!navOpen)}><Hamburger /></button>
        <Link href="/console" className="appbar-brand" onClick={closeAll} aria-label="AssureRail home"><Logo /></Link>
        <nav className={`appbar-nav ${navOpen ? "mobile-open" : ""}`}>
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={pathname === n.href || pathname.startsWith(`${n.href}/`) ? "active" : ""} onClick={closeAll}>{n.label}</Link>
          ))}
        </nav>
        <div className="appbar-spacer" />
        <div className="appbar-actions" ref={actionsRef}>
          <button className="icon-btn" aria-label="Notifications" onClick={() => { setNotifOpen(!notifOpen); setMenuOpen(false); }}>
            <Bell />
            {(tasks.length > 0 || notifs.length > 0) && <span className="badge-dot" />}
          </button>
          {notifOpen && (
            <div className="notif">
              <h4>{notificationMode === "TASKS" ? "Action centre" : notificationMode === "ACTIVITY" ? "Recent platform activity" : "Notifications"}</h4>
              {notificationMode === "TASKS" && tasks.map((task) => (
                <Link className="n-item notification-task" href={task.href} key={task.id} onClick={closeAll}>
                  <div className="n-ev">{task.title}</div>
                  <div className="n-t">{task.priority} · {task.dueState} · {task.category}</div>
                </Link>
              ))}
              {notificationMode === "ACTIVITY" && notifs.map((n) => (
                  <div className="n-item" key={n.id}>
                    <div className="n-ev">{n.event}</div>
                    <div className="n-t">{new Date(n.createdAt).toLocaleString("en-IN")}</div>
                  </div>
                ))}
              {((notificationMode === "TASKS" && tasks.length === 0) || (notificationMode === "ACTIVITY" && notifs.length === 0) || notificationMode === "NONE") && <div className="n-empty">{notificationMode === "NONE" ? "Select an institution to see scoped actions." : "Nothing requires attention in this view."}</div>}
              {notificationMode === "TASKS" && <Link href="/workspace/tasks" className="menu-item" style={{ borderTop: "1px solid var(--arail-border-subtle)", justifyContent: "center", color: "var(--arail-accent-text)" }} onClick={closeAll}>View all actions →</Link>}
              {notificationMode === "ACTIVITY" && <Link href="/activity" className="menu-item" style={{ borderTop: "1px solid var(--arail-border-subtle)", justifyContent: "center", color: "var(--arail-accent-text)" }} onClick={closeAll}>View all activity →</Link>}
            </div>
          )}
          <button className="profile-btn" aria-label="Profile" onClick={() => { setMenuOpen(!menuOpen); setNotifOpen(false); }}>
            <span className="avatar">{initial}</span>
            <span className="who">{email}</span>
          </button>
          {menuOpen && (
            <div className="menu">
              <div className="menu-head">
                <div className="m-email">{email}</div>
                <div className="m-meta">{venueUser?.role ?? "—"}{venueUser?.isAdmin ? " · admin" : ""}</div>
                {venueUser?.did && <div className="m-meta">{shortDid(venueUser.did)}</div>}
                <div className="m-meta">institution: {activeInstitutionId ?? "none selected"}</div>
              </div>
              <Link href="/settings" className="menu-item" onClick={closeAll}><Gear /> Settings</Link>
              <button className="menu-item" onClick={() => { closeAll(); void logout(); router.replace("/login"); }}><Out /> Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
