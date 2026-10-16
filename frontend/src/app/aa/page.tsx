"use client";

import { useState } from "react";
import { createPublicClient, encodeFunctionData, http } from "viem";
import { sepolia } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";
import { createSmartAccountClient } from "permissionless";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { useAccount, useSwitchChain } from "wagmi";
import { getWalletClient } from "wagmi/actions";
import { config } from "@/lib/wagmi";
import { NFT_ADDRESS, nftAbi } from "@/contracts/nft";
import {
  Zap,
  Wallet,
  ExternalLink,
  CheckCircle2,
  Copy,
  Layers,
  AlertCircle,
  Sparkles,
} from "lucide-react";

// 1. The EntryPoint: the one contract that checks and runs every UserOperation (version 0.7)
const entryPoint = { address: entryPoint07Address, version: "0.7" } as const;

// 2. A client that only READS Sepolia
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
});

// 3. The smart account, owned by the wallet you connected. Your wallet only SIGNS.
async function getSmartAccount() {
  const walletClient = await getWalletClient(config, { chainId: sepolia.id });
  return toSimpleSmartAccount({ client: publicClient, owner: walletClient, entryPoint });
}

export default function SmartAccountPage() {
  const { isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const [accountAddress, setAccountAddress] = useState("");
  const [deployed, setDeployed] = useState<boolean | null>(null);
  const [uri, setUri] = useState("");
  const [two, setTwo] = useState(false);
  const [status, setStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [copied, setCopied] = useState(false);
  const [isLoadingAccount, setIsLoadingAccount] = useState(false);
  const [isMinting, setIsMinting] = useState(false);

  async function showAccount() {
    try {
      setIsLoadingAccount(true);
      await switchChainAsync({ chainId: sepolia.id });
      const account = await getSmartAccount();
      const code = await publicClient.getCode({ address: account.address });
      setAccountAddress(account.address);
      setDeployed(Boolean(code));
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`);
    } finally {
      setIsLoadingAccount(false);
    }
  }

  async function copyAddress() {
    if (!accountAddress) return;
    await navigator.clipboard.writeText(accountAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Step 2: one UserOperation that mints from the smart account. The paymaster pays the gas.
  async function mintFromSmartAccount() {
    try {
      setIsMinting(true);
      setStatus("Switching to Sepolia…");
      await switchChainAsync({ chainId: sepolia.id });

      const account = await getSmartAccount();
      if (!accountAddress) {
        setAccountAddress(account.address);
        const code = await publicClient.getCode({ address: account.address });
        setDeployed(Boolean(code));
      }

      setStatus("Building smart account client via Pimlico…");
      const bundlerUrl = `${window.location.origin}/api/bundler`;
      const pimlico = createPimlicoClient({ transport: http(bundlerUrl), entryPoint });

      const smartAccountClient = createSmartAccountClient({
        account,
        chain: sepolia,
        bundlerTransport: http(bundlerUrl),
        paymaster: pimlico,
        userOperation: {
          estimateFeesPerGas: async () => (await pimlico.getUserOperationGasPrice()).fast,
        },
      });

      const mintCall = {
        to: NFT_ADDRESS,
        data: encodeFunctionData({ abi: nftAbi, functionName: "mint", args: [account.address, uri] }),
      };
      const calls = two ? [mintCall, mintCall] : [mintCall];

      setStatus("Sign the UserOperation in your wallet (0 gas cost for you)…");
      const userOpHash = await smartAccountClient.sendUserOperation({ calls });

      setStatus(`UserOp sent! Hash: ${userOpHash.slice(0, 18)}… Waiting for block…`);
      const receipt = await smartAccountClient.waitForUserOperationReceipt({ hash: userOpHash });

      setTxHash(receipt.receipt.transactionHash);
      setDeployed(true);
      setStatus(receipt.success ? "Minted successfully! ✅" : "UserOperation included but failed ❌");
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`);
    } finally {
      setIsMinting(false);
    }
  }

  const isValidUri = uri.startsWith("ipfs://");

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
          <Zap className="h-6 w-6 text-blue-600" />
          Smart Account · Gasless Mint
        </h1>
        <p className="text-sm text-neutral-600">
          Your EOA wallet only <strong>signs</strong> — Pimlico&apos;s paymaster pays all gas fees. The NFT is minted from your counterfactual ERC-4337 smart account, routed through the Diamond proxy.
        </p>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-white p-4 flex items-start gap-3 shadow-xs">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="text-xs text-neutral-700 space-y-0.5">
          <p className="font-semibold text-blue-900">How gasless minting works</p>
          <p>1. Your wallet generates a <strong>counterfactual smart account address</strong> — it exists before being deployed.</p>
          <p>2. You sign a <strong>UserOperation</strong> (not a regular transaction). Your signature proves you authorise the mint.</p>
          <p>3. Pimlico&apos;s <strong>bundler</strong> batches it on-chain. The <strong>paymaster</strong> sponsors 100% of the gas.</p>
        </div>
      </div>

      {/* Step 1 */}
      <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">1</div>
          <h2 className="font-semibold text-neutral-900">Derive Your Smart Account Address</h2>
        </div>
        <p className="text-xs text-neutral-500">
          Click below to see where your ERC-4337 smart account lives. This address is deterministic — it&apos;s computed from your wallet&apos;s public key.
        </p>

        <button
          className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-100 disabled:opacity-50"
          disabled={!isConnected || isLoadingAccount}
          onClick={showAccount}
        >
          <Wallet className="h-4 w-4" />
          {isLoadingAccount ? "Computing…" : "Show my smart account"}
        </button>

        {!isConnected && (
          <p className="flex items-center gap-1.5 text-xs text-amber-600">
            <AlertCircle className="h-3.5 w-3.5" />
            Connect your wallet first.
          </p>
        )}

        {accountAddress && (
          <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="text-xs font-medium text-neutral-500">Smart Account Address</p>
                <p className="font-mono text-sm font-semibold text-neutral-900 break-all">{accountAddress}</p>
              </div>
              <button
                onClick={copyAddress}
                className="shrink-0 flex items-center gap-1 rounded-md bg-neutral-100 px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-200"
              >
                <Copy className="h-3 w-3" />
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span
                className={`rounded-full px-2.5 py-0.5 font-medium ${
                  deployed
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {deployed ? "✓ Deployed on Sepolia" : "⏳ Not yet deployed (counterfactual)"}
              </span>
              <a
                href={`https://sepolia.etherscan.io/address/${accountAddress}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 font-medium text-blue-700 hover:bg-blue-100 transition"
              >
                Etherscan <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>

            {!deployed && (
              <p className="text-[11px] text-neutral-500">
                The account will be <strong>automatically deployed</strong> on its first UserOperation — no extra step needed.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Step 2 */}
      <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">2</div>
          <h2 className="font-semibold text-neutral-900">Gasless Mint via Diamond Proxy</h2>
        </div>

        <p className="text-xs text-neutral-500">
          Paste the IPFS URI from the NFT page. The call goes to the Diamond proxy at{" "}
          <span className="font-mono text-neutral-700">
            {NFT_ADDRESS ? `${NFT_ADDRESS.slice(0, 8)}…${NFT_ADDRESS.slice(-6)}` : "Not configured"}
          </span>
          , which delegates to <code>ClassNFTFacet.mint()</code>.
        </p>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Token URI (ipfs://…)
            </label>
            <input
              className="w-full rounded-lg border border-neutral-300 bg-neutral-50/50 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="ipfs://Qm… (copy from the NFT page after uploading)"
              value={uri}
              onChange={(e) => setUri(e.target.value)}
            />
            {uri && !isValidUri && (
              <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                <AlertCircle className="h-3 w-3" />
                Must start with <code>ipfs://</code>
              </p>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm transition hover:bg-neutral-100">
            <input
              type="checkbox"
              className="h-4 w-4 accent-neutral-900"
              checked={two}
              onChange={(e) => setTwo(e.target.checked)}
            />
            <div>
              <span className="font-medium text-neutral-800 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-blue-600" />
                Batch mint ×2 in one UserOperation
              </span>
              <p className="text-xs text-neutral-500 mt-0.5">
                Two mints, one signature, one gas sponsorship — that&apos;s ERC-4337 call batching.
              </p>
            </div>
          </label>

          <button
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!isConnected || !isValidUri || isMinting}
            onClick={mintFromSmartAccount}
          >
            <Zap className="h-4 w-4" />
            {isMinting ? "Processing Gasless UserOp…" : "⚡ Mint from Smart Account (Free Gas)"}
          </button>

          {!isConnected && (
            <p className="text-center text-xs text-neutral-500">Connect your wallet to mint.</p>
          )}
        </div>

        {status && (
          <div className={`rounded-lg p-3 text-xs font-medium ${
            status.startsWith("Error")
              ? "border border-red-200 bg-red-50 text-red-700"
              : "border border-neutral-200 bg-neutral-50 text-neutral-700"
          }`}>
            {status}
          </div>
        )}

        {txHash && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-emerald-900 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Transaction confirmed on Sepolia!
            </div>
            <p className="text-xs text-neutral-600 break-all">
              <span className="font-semibold">Tx Hash:</span> {txHash}
            </p>
            <a
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
            >
              View on Etherscan <ExternalLink className="h-3 w-3" />
            </a>
            <p className="text-[11px] text-neutral-500">
              Notice: the <em>sender</em> is the Pimlico bundler, not your wallet — that&apos;s how ERC-4337 works.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
