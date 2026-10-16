"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "./ConnectButton";

const links = [
  { href: "/", label: "Home" },
  { href: "/ens", label: "ENS" },
  { href: "/nft", label: "NFT" },
  { href: "/aa", label: "Smart Account" },
  { href: "/notifications", label: "Notification"}
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <span className="mr-2 font-bold text-neutral-900 tracking-tight">
            Web3Bridge<span className="text-blue-600">·</span>XV
          </span>
          {links.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  active
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <ConnectButton />
      </div>
    </header>
  );
}
