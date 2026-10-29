"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileSearch, FolderOpen, Library, ListChecks } from "lucide-react";

const LINKS = [
  { href: "/", label: "Review", icon: FileSearch, match: (p: string) => p === "/" || p.startsWith("/review") },
  { href: "/repository", label: "Repository", icon: FolderOpen, match: (p: string) => p.startsWith("/repository") },
  { href: "/library", label: "Clause library", icon: Library, match: (p: string) => p.startsWith("/library") },
  { href: "/rules", label: "Rules", icon: ListChecks, match: (p: string) => p.startsWith("/rules") },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="nav__links" aria-label="Main">
      {LINKS.map(({ href, label, icon: Icon, match }) => (
        <Link key={href} href={href} className={`nav__link${match(pathname) ? " nav__link--active" : ""}`} aria-current={match(pathname) ? "page" : undefined}>
          <Icon size={16} strokeWidth={1.75} aria-hidden />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
