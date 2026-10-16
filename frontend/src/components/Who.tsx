"use client";

import { useEnsName } from "wagmi";
import { mainnet } from "wagmi/chains";

// Shows an address as its ENS name when it has one, otherwise as 0x1234…abcd
export function Who({ address }: { address: `0x${string}` }) {
  const { data: name } = useEnsName({ address, chainId: mainnet.id });
  return <span title={address}>{name ?? `${address.slice(0, 6)}…${address.slice(-4)}`} </span>;
}