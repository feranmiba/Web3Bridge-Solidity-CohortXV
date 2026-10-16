"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEther, parseEventLogs } from "viem";
import { normalize } from "viem/ens";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
  useEnsAddress,
  useEnsAvatar,
  useEnsName,
  useEnsText,
} from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { NFT_ADDRESS, nftAbi, ipfsImageUrl } from "@/contracts/nft";
import { uploadNft } from "@/lib/ipfs";
import { useEthPrice } from "@/hooks/useEthPrice";
import {
  Coins,
  Clock,
  CheckCircle2,
  ExternalLink,
  Search,
  Sparkles,
  UserCheck,
  AlertCircle,
  FileCheck2,
} from "lucide-react";
import { createPublicClient, encodeFunctionData, http } from "viem";
import { entryPoint07Address } from "viem/account-abstraction";
import { createSmartAccountClient } from "permissionless";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { getWalletClient } from "wagmi/actions";
import { config } from "@/lib/wagmi";

const entryPoint = { address: entryPoint07Address, version: "0.7" } as const;

const pimlicoPublicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
});

async function getSmartAccount() {
  const walletClient = await getWalletClient(config, { chainId: sepolia.id });
  return toSimpleSmartAccount({
    client: pimlicoPublicClient,
    owner: walletClient,
    entryPoint,
  });
}

type Metadata = { name: string; description: string; image: string };

type MintResult = {
  tokenId: string;
  uri: string;
  hash: string;
  recipient: `0x${string}`;
  ensName?: string;
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  feeEth: string;
  feeUsd: string;
};

export default function NftPage() {
  const { address: userAddress, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: sepolia.id });

  // ---------- Chainlink ETH/USD Hook ----------
  const {
    price: ethPrice,
    formattedPrice: formattedEthPrice,
    lastUpdatedDate,
    isLoading: isPriceLoading,
  } = useEthPrice();

  // ---------- ENS lookup state ----------
  const [ensInput, setEnsInput] = useState("");

  // Safely normalize the ENS input
  const normalizedEnsName = useMemo(() => {
    const trimmed = ensInput.trim();
    if (!trimmed || !trimmed.includes(".")) return undefined;
    try {
      return normalize(trimmed);
    } catch {
      return undefined;
    }
  }, [ensInput]);

  // Read data from Ethereum Mainnet where ENS registries exist
  const { data: resolvedAddress, isLoading: isResolvingEns } = useEnsAddress({
    name: normalizedEnsName,
    chainId: mainnet.id,
    query: { enabled: !!normalizedEnsName },
  });

  const { data: avatar } = useEnsAvatar({
    name: normalizedEnsName,
    chainId: mainnet.id,
    query: { enabled: !!normalizedEnsName },
  });

  const { data: ensDescription } = useEnsText({
    name: normalizedEnsName,
    key: "description",
    chainId: mainnet.id,
    query: { enabled: !!normalizedEnsName },
  });

  const { data: twitter } = useEnsText({
    name: normalizedEnsName,
    key: "com.twitter",
    chainId: mainnet.id,
    query: { enabled: !!normalizedEnsName },
  });

  const { data: primaryOfResolved } = useEnsName({
    address: resolvedAddress ?? undefined,
    chainId: mainnet.id,
    query: { enabled: !!resolvedAddress },
  });

  const { data: myOwnEns } = useEnsName({
    address: userAddress,
    chainId: mainnet.id,
    query: { enabled: !!userAddress },
  });

  // ---------- Certificate Mint Form ----------
  const [certName, setCertName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [isMinting, setIsMinting] = useState(false);
  const [mintResult, setMintResult] = useState<MintResult | null>(null);

  async function handleMint() {
    if (!image || !certName) return;

    if (!resolvedAddress) {
      setStatus("Error: Please provide a valid ENS name that resolves to an Ethereum address.");
      return;
    }

    try {
      setIsMinting(true);
      setStatus("1/3 Uploading certificate image and metadata to IPFS…");
      const uri = await uploadNft(image, certName, description);

      setStatus("2/3 Please sign the gasless UserOperation in your wallet (0 ETH cost)…");
      await switchChainAsync({ chainId: sepolia.id });

      const account = await getSmartAccount();

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
        data: encodeFunctionData({
          abi: nftAbi,
          functionName: "mint",
          args: [resolvedAddress, uri],
        }),
      };

      const userOpHash = await smartAccountClient.sendUserOperation({ calls: [mintCall] });

      setStatus(`3/3 Sent to Pimlico bundler! Waiting for Sepolia block inclusion…`);
      const userOpReceipt = await smartAccountClient.waitForUserOperationReceipt({ hash: userOpHash });
      const receipt = userOpReceipt.receipt;

      // Calculate actual transaction fee sponsored by Paymaster
      const gasUsed = receipt.gasUsed;
      const effectiveGasPrice = receipt.effectiveGasPrice;
      const txFeeWei = gasUsed * effectiveGasPrice;
      const feeEth = formatEther(txFeeWei);

      const feeUsd =
        ethPrice !== null
          ? (parseFloat(feeEth) * ethPrice).toFixed(4)
          : "N/A";

      // Parse Minted(address indexed to, uint256 indexed tokenId, string uri)
      const logs = parseEventLogs({
        abi: nftAbi,
        logs: receipt.logs,
        eventName: "Minted",
      });

      const tokenId = logs[0]?.args?.tokenId?.toString() ?? "0";

      setMintResult({
        tokenId,
        uri,
        hash: receipt.transactionHash,
        recipient: resolvedAddress,
        ensName: normalizedEnsName,
        gasUsed,
        effectiveGasPrice,
        feeEth,
        feeUsd,
      });

      setViewId(tokenId);
      refetchTotalMinted();
      refetchTokenUri();
      refetchOwner();
      setStatus("Certificate Minted Gaslessly! ✅");
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${(err as Error).message}`);
    } finally {
      setIsMinting(false);
    }
  }

  // ---------- View Token (Inspector) ----------
  const [viewId, setViewId] = useState("0");
  const [meta, setMeta] = useState<Metadata | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [inspectStatus, setInspectStatus] = useState<string | null>(null);

  const parsedTokenId = useMemo(() => {
    const trimmed = viewId.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) return undefined;
    try {
      return BigInt(trimmed);
    } catch {
      return undefined;
    }
  }, [viewId]);

  const { data: totalMinted, refetch: refetchTotalMinted } = useReadContract({
    address: NFT_ADDRESS,
    abi: nftAbi,
    functionName: "totalMinted",
    chainId: sepolia.id,
    query: { enabled: !!NFT_ADDRESS },
  });

  const {
    data: tokenUri,
    refetch: refetchTokenUri,
    isError: isTokenUriError,
  } = useReadContract({
    address: NFT_ADDRESS,
    abi: nftAbi,
    functionName: "tokenURI",
    args: parsedTokenId !== undefined ? [parsedTokenId] : undefined,
    chainId: sepolia.id,
    query: {
      enabled: !!NFT_ADDRESS && parsedTokenId !== undefined,
      retry: false,
    },
  });

  const {
    data: tokenOwner,
    refetch: refetchOwner,
    isError: isOwnerError,
  } = useReadContract({
    address: NFT_ADDRESS,
    abi: nftAbi,
    functionName: "ownerOf",
    args: parsedTokenId !== undefined ? [parsedTokenId] : undefined,
    chainId: sepolia.id,
    query: {
      enabled: !!NFT_ADDRESS && parsedTokenId !== undefined,
      retry: false,
    },
  });



async function fetchIpfsMetadata(uri: string) {
  const cid = uri
    .replace(/^ipfs:\/\//, "")
    .replace(/^\/ipfs\//, "");

  const res = await fetch(
    `/api/upload?cid=${encodeURIComponent(cid)}`
  );

  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(
      error?.error ?? `Metadata request failed: ${res.status}`
    );
  }

  return res.json();
}


  // Automatically fetch metadata when tokenUri becomes available

useEffect(() => {
  if (!tokenUri) {
    setMeta(null);
    setIsLoadingMeta(false);
    return;
  }

  let isCancelled = false;

  setIsLoadingMeta(true);
  setInspectStatus(null);

  fetchIpfsMetadata(tokenUri)
    .then((data) => {
      if (!isCancelled) {
        setMeta(data);
        setInspectStatus(null);
      }
    })
    .catch((err) => {
      if (!isCancelled) {
        console.error("Failed to load metadata:", err);
        setInspectStatus(
          `Failed to load metadata: ${(err as Error).message}`
        );
      }
    })
    .finally(() => {
      if (!isCancelled) {
        setIsLoadingMeta(false);
      }
    });

  return () => {
    isCancelled = true;
  };
}, [tokenUri]);


  // Clear previous meta & status when user changes the input ID
  useEffect(() => {
    setMeta(null);
    setInspectStatus(null);
  }, [viewId]);

 
async function loadMetadata() {
  if (parsedTokenId === undefined) {
    setInspectStatus("Please enter a valid numeric Token ID.");
    setMeta(null);
    return;
  }

  setIsLoadingMeta(true);
  setInspectStatus(null);

  try {
    const [uriRes, ownerRes, totalRes] = await Promise.all([
      refetchTokenUri(),
      refetchOwner(),
      refetchTotalMinted(),
    ]);

    const uri = uriRes.data;

    if (uriRes.error || !uri) {
      setMeta(null);

      if (ownerRes.error) {
        setInspectStatus(
          `Token #${viewId} does not exist or could not be verified.`
        );
      } else {
        setInspectStatus(
          `No metadata URI found for Token #${viewId}.`
        );
      }

      return;
    }

    const data = await fetchIpfsMetadata(uri);

    setMeta(data);
    console.log(data)
    setInspectStatus(null);

    console.log("Loaded certificate metadata:", data);
    console.log("Total minted:", totalRes.data?.toString());
  } catch (err) {
    console.error("Failed to load metadata:", err);
    setMeta(null);
    setInspectStatus(`Error: ${(err as Error).message}`);
  } finally {
    setIsLoadingMeta(false);
  }
}


  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner: Chainlink Sepolia Price Feed */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-white p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-900">
                Chainlink Oracle (Sepolia)
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" />
                Live Feed
              </span>
            </div>
            <div className="text-xl font-bold tracking-tight text-neutral-900">
              {isPriceLoading ? "Fetching..." : `1 ETH = ${formattedEthPrice}`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-neutral-600">
          <Clock className="h-3.5 w-3.5" />
          <span>
            Last updated:{" "}
            {lastUpdatedDate
              ? lastUpdatedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
              : "—"}
          </span>
        </div>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-neutral-900">
          Issue Certificate NFT via ENS
        </h1>
        <p className="text-sm text-neutral-600">
          Specify recipient&apos;s ENS name. The certificate image and metadata will be permanently stored on IPFS and minted directly to their resolved Ethereum address.
        </p>
      </div>

      {/* Step 1: ENS Recipient Lookup */}
      <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-neutral-900">
            <Search className="h-4 w-4 text-blue-600" />
            1. Recipient ENS Lookup
          </h2>
          {myOwnEns && (
            <span className="text-xs text-neutral-500">
              Connected as: <b className="text-neutral-700">{myOwnEns}</b>
            </span>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            Enter recipient ENS name (.eth)
          </label>
          <div className="relative">
            <input
              type="text"
              className="w-full rounded-lg border border-neutral-300 bg-neutral-50/50 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              value={ensInput}
              onChange={(e) => setEnsInput(e.target.value)}
              placeholder="e.g. vitalik.eth"
            />
            {isResolvingEns && (
              <span className="absolute right-3 top-2.5 text-xs text-neutral-400">
                Resolving…
              </span>
            )}
          </div>
        </div>

        {/* ENS Validation feedback */}
        {ensInput && !normalizedEnsName && (
          <p className="flex items-center gap-1.5 text-xs text-amber-600">
            <AlertCircle className="h-3.5 w-3.5" />
            Please provide a valid ENS name ending in .eth
          </p>
        )}

        {normalizedEnsName && !isResolvingEns && !resolvedAddress && (
          <p className="flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle className="h-3.5 w-3.5" />
            No Ethereum address is set for &ldquo;{normalizedEnsName}&rdquo;.
          </p>
        )}

        {/* Resolved ENS Card */}
        {resolvedAddress && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 text-sm">
            <div className="flex items-start gap-3">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatar}
                  alt={normalizedEnsName ?? "ENS Avatar"}
                  className="h-12 w-12 rounded-full border border-emerald-300 object-cover shadow-xs"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-200/80 text-emerald-800">
                  <UserCheck className="h-6 w-6" />
                </div>
              )}

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-emerald-950">
                    {normalizedEnsName}
                  </span>
                  <span className="rounded bg-emerald-200/60 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                    Resolved
                  </span>
                </div>

                <p className="font-mono text-xs text-emerald-900 break-all">
                  <b>Address:</b> {resolvedAddress}
                </p>

                {primaryOfResolved && primaryOfResolved !== normalizedEnsName && (
                  <p className="text-xs text-emerald-800">
                    <b>Primary Name:</b> {primaryOfResolved}
                  </p>
                )}

                {ensDescription && (
                  <p className="text-xs text-neutral-700 italic">
                    &ldquo;{ensDescription}&rdquo;
                  </p>
                )}

                {twitter && (
                  <p className="text-xs text-blue-700">
                    Twitter: @{twitter}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Step 2: Certificate details & Minting */}
      <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
        <h2 className="flex items-center gap-2 font-semibold text-neutral-900">
          <FileCheck2 className="h-4 w-4 text-blue-600" />
          2. Certificate Details &amp; Issue
        </h2>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Certificate Title
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="e.g. Solidity Developer Certification - Cohort XV"
              value={certName}
              onChange={(e) => setCertName(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Description / Achievement Details
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="e.g. Successfully completed the advanced smart contract development program"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Certificate Image
            </label>
            <input
              type="file"
              accept="image/*"
              className="block w-full text-xs text-neutral-600 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-neutral-700 hover:file:bg-neutral-200"
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="pt-2">
            <button
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                !isConnected ||
                !image ||
                !certName ||
                !resolvedAddress ||
                isMinting
              }
              onClick={handleMint}
            >
              <Sparkles className="h-4 w-4" />
              {isMinting
                ? "Processing Gasless Mint..."
                : resolvedAddress
                ? `⚡ Gasless Mint to ${normalizedEnsName ?? resolvedAddress.slice(0, 8)}`
                : "Resolve Valid ENS Name Above"}
            </button>
          </div>

          {!isConnected && (
            <p className="text-center text-xs text-neutral-500">
              Please connect your wallet first.
            </p>
          )}

          {status && (
            <p className="rounded-lg bg-neutral-50 p-2 text-center text-xs font-medium text-neutral-700">
              {status}
            </p>
          )}

          {/* Mint Result & Fee Calculation in USD */}
          {mintResult && (
            <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 text-sm">
              <div className="flex items-center gap-2 text-emerald-900 font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Certificate Successfully Minted Gaslessly!
              </div>

              <div className="space-y-1.5 text-xs text-neutral-700">
                <p>
                  <b>Token ID:</b> #{mintResult.tokenId}
                </p>
                <p>
                  <b>Issued to:</b> {mintResult.ensName ? `${mintResult.ensName} (${mintResult.recipient})` : mintResult.recipient}
                </p>
                <p className="break-all">
                  <b>IPFS Metadata URI:</b> {mintResult.uri}
                </p>

                {/* Actual Transaction Fee Calculation with Chainlink USD Price */}
                <div className="mt-3 rounded-md border border-emerald-200 bg-white p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-900">
                      Gas Paid By You:
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                      0.00 ETH ($0.00) · FREE ⚡
                    </span>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-2 pt-0.5 text-xs text-neutral-600">
                    <span>Paymaster Sponsored Cost:</span>
                    <span className="font-mono font-medium text-neutral-900">
                      {parseFloat(mintResult.feeEth).toFixed(6)} ETH
                    </span>
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                      ≈ ${mintResult.feeUsd} USD
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    100% sponsored via Pimlico Paymaster ({mintResult.gasUsed.toString()} gas units with Chainlink rate: ${ethPrice?.toFixed(2)}/ETH).
                  </p>
                </div>

                <div className="pt-1">
                  <a
                    className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
                    href={`https://sepolia.etherscan.io/tx/${mintResult.hash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View Transaction on Etherscan <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Step 3: Token Inspector */}
      <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-neutral-900">
              Certificate Explorer
            </h2>
            <p className="text-xs text-neutral-500">
              Enter any Token ID on the contract to inspect its ownership and metadata:
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-md bg-neutral-100 px-2 py-1 font-mono text-neutral-600">
              Contract: {NFT_ADDRESS ? `${NFT_ADDRESS.slice(0, 6)}…${NFT_ADDRESS.slice(-4)}` : "Not Configured"}
            </span>
            {totalMinted !== undefined && (
              <span className="rounded-md bg-blue-50 px-2 py-1 font-medium text-blue-700">
                Total Minted: {totalMinted.toString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <input
            className="w-32 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-mono focus:border-blue-500 focus:outline-hidden"
            value={viewId}
            onChange={(e) => setViewId(e.target.value)}
            placeholder="Token ID (e.g. 0)"
          />
          <button
            className="rounded-lg border border-neutral-300 bg-neutral-100 px-4 py-1.5 text-xs font-medium text-neutral-800 transition hover:bg-neutral-200 disabled:opacity-50"
            onClick={loadMetadata}
            disabled={isLoadingMeta}
          >
            {isLoadingMeta ? "Loading…" : "Inspect Token"}
          </button>
        </div>

        {inspectStatus && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            {inspectStatus}
          </div>
        )}

        <div className="text-xs text-neutral-600 break-all space-y-1 rounded-lg border border-neutral-100 bg-neutral-50 p-3 font-mono">
          <p>
            <b className="font-sans font-semibold text-neutral-800">Owner:</b>{" "}
            {tokenOwner ?? (isOwnerError ? "Nonexistent (unminted)" : "—")}
          </p>
          <p>
            <b className="font-sans font-semibold text-neutral-800">tokenURI:</b>{" "}
            {tokenUri ?? (isTokenUriError ? "Nonexistent (unminted)" : "—")}
          </p>

        </div>

        {meta && (
          <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <h3 className="font-semibold text-neutral-900">{meta.name}</h3>
            <p className="text-xs text-neutral-600 mt-1">{meta.description}</p>
            {meta.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                 src={ipfsImageUrl(meta.image)}
                alt={meta.name}
                className="mt-3 max-w-xs rounded-lg border border-neutral-200 shadow-xs"
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}
