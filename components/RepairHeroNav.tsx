import Link from "next/link";
import { LogoutButton } from "./LogoutButton";

export function RepairHeroNav({ active }: { active: "list" | "reports" }) {
  return (
    <div className="hero-actions repair-hero-nav">
      <Link className={`button secondary${active === "list" ? " nav-current" : ""}`} href="/repairs">
        Repairs
      </Link>
      <Link className={`button secondary${active === "reports" ? " nav-current" : ""}`} href="/repairs/reports">
        Reports
      </Link>
      <Link className="button" href="/repairs/new">
        New Repair
      </Link>
      <LogoutButton />
    </div>
  );
}
