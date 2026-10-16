import Link from "next/link";
import { Search, Image, Zap, ArrowRight } from "lucide-react";

const features = [
  {
    href: "/ens",
    icon: Search,
    label: "ENS Lookup",
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-100",
    desc: "Resolve any .eth name to its Ethereum address, avatar, social links and reverse-lookup — all from Ethereum Mainnet in real time.",
    badge: "Ethereum Name Service",
  },
  {
    href: "/nft",
    icon: Image,
    label: "Issue Certificate NFT",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-100",
    desc: "Upload a certificate image to IPFS via Pinata, mint it as an ERC-721 NFT to any ENS address — completely gasless via Pimlico paymaster.",
    badge: "IPFS · Chainlink · Gasless",
  },
  {
    href: "/aa",
    icon: Zap,
    label: "Smart Account Mint",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    desc: "Your EOA only signs. A counterfactual ERC-4337 smart account does the minting — with call batching and zero gas cost to you.",
    badge: "ERC-4337 · Account Abstraction",
  },
];

export default function Home() {
  return (
    <div className="space-y-10 pb-12">
      {/* Hero */}
      <div className="space-y-3 pt-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
          Web3Bridge Cohort XV — Day 3 dApp
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          Three pillars of a real dApp
        </h1>
        <p className="text-neutral-600 text-sm leading-relaxed max-w-lg">
          ENS names, on-chain NFT certificates stored on IPFS, and gas-free transactions via ERC-4337 Account Abstraction — all in one app, on Sepolia.
        </p>
      </div>

      {/* Feature cards */}
      <div className="grid gap-4">
        {features.map(({ href, icon: Icon, label, color, bg, border, desc, badge }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-start gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs transition hover:border-neutral-300 hover:shadow-sm"
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${bg} ${border}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-neutral-900 text-sm">{label}</span>
                <ArrowRight className="h-4 w-4 text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-neutral-600" />
              </div>
              <span className={`inline-block rounded-full ${bg} border ${border} px-2 py-0.5 text-[10px] font-semibold ${color}`}>
                {badge}
              </span>
              <p className="text-xs text-neutral-500 leading-relaxed">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Contract info */}
      <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4 text-xs text-neutral-600 space-y-1">
        <p className="font-semibold text-neutral-800">Diamond Proxy (Sepolia)</p>
        <p className="font-mono break-all">
          {process.env.NEXT_PUBLIC_PROXY_DIAMOND ?? "0x723F6CC3f09c68FE2Af0767610fADB4990B488FA"}
        </p>
        <p className="text-[11px] text-neutral-400">
          All NFT calls are routed through the EIP-2535 Diamond proxy → ClassNFTFacet
        </p>
      </div>
    </div>
  );
}
