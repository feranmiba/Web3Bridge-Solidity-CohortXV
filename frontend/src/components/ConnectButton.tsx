"use client";

import { useAccount, useBalance, useConnect, useDisconnect } from "wagmi";
import { motion } from "framer-motion";
import { Wallet, LogOut, ChevronDown } from "lucide-react";
import { useState } from "react";

import { formatUnits } from "viem";

export function ConnectButton() {
  const { address, isConnected, chain } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [showMenu, setShowMenu] = useState(false);

  // Fetch native balance (ETH) for connected account
  const { data: balance, isLoading: isBalanceLoading } = useBalance({
    address,
  });

  if (isConnected && address) {
    const formattedBalance = balance
      ? `${parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(4)} ${balance.symbol}`
      : isBalanceLoading
      ? "Loading..."
      : "0 ETH";

    const shortenedAddress = `${address.slice(0, 6)}…${address.slice(-4)}`;

    return (
      <div className="relative inline-block text-left">
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center rounded-xl border border-neutral-200 bg-white shadow-xs transition hover:border-neutral-300"
        >
          {/* Balance Pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 border-r border-neutral-100">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{formattedBalance}</span>
          </div>

          {/* Account Button */}
          <button
            type="button"
            onClick={() => setShowMenu((prev) => !prev)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-neutral-800 focus:outline-none"
          >
            <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] font-mono text-neutral-600">
              {chain?.name ?? "Sepolia"}
            </span>
            <span className="font-mono font-medium">{shortenedAddress}</span>
            <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
          </button>
        </motion.div>

        {/* Dropdown Menu */}
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              className="absolute right-0 z-50 mt-2 w-52 origin-top-right rounded-xl border border-neutral-100 bg-white p-2 shadow-lg"
            >
              <div className="px-3 py-2 border-b border-neutral-100">
                <p className="text-[11px] text-neutral-400">Balance</p>
                <p className="text-sm font-semibold text-neutral-800">
                  {formattedBalance}
                </p>
              </div>

              <div className="px-3 py-2">
                <p className="text-[11px] text-neutral-400">Network</p>
                <p className="text-xs font-medium text-neutral-700">
                  {chain?.name ?? "Unknown Network"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  disconnect();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                Disconnect
              </button>
            </motion.div>
          </>
        )}
      </div>
    );
  }

  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className="flex items-center gap-2 rounded-xl bg-neutral-900 px-3.5 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-neutral-800 disabled:opacity-50"
      disabled={isPending}
      onClick={() => connect({ connector: connectors[0] })}
    >
      <Wallet className="h-3.5 w-3.5" />
      {isPending ? "Connecting…" : "Connect Wallet"}
    </motion.button>
  );
}
