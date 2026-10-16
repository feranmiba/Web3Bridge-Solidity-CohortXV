import { useReadContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import { formatUnits } from "viem";

// Chainlink ETH / USD Price Feed on Sepolia
export const CHAINLINK_ETH_USD_SEPOLIA = "0x694AA1769357215DE4FAC081bf1f309aDC325306" as const;

export const aggregatorV3Abi = [
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "description",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "latestRoundData",
    outputs: [
      { internalType: "uint80", name: "roundId", type: "uint80" },
      { internalType: "int256", name: "answer", type: "int256" },
      { internalType: "uint256", name: "startedAt", type: "uint256" },
      { internalType: "uint256", name: "updatedAt", type: "uint256" },
      { internalType: "uint80", name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export function useEthPrice() {
  const {
    data: roundData,
    isLoading: isRoundLoading,
    isError: isRoundError,
    refetch,
  } = useReadContract({
    address: CHAINLINK_ETH_USD_SEPOLIA,
    abi: aggregatorV3Abi,
    functionName: "latestRoundData",
    chainId: sepolia.id,
    query: {
      refetchInterval: 10_000, // refresh every 10 seconds
      staleTime: 5_000,
    },
  });

  const { data: decimalsData, isLoading: isDecimalsLoading } = useReadContract({
    address: CHAINLINK_ETH_USD_SEPOLIA,
    abi: aggregatorV3Abi,
    functionName: "decimals",
    chainId: sepolia.id,
    query: {
      staleTime: Infinity,
    },
  });

  const decimals = decimalsData ?? 8;
  const rawPrice = roundData ? roundData[1] : undefined;
  const updatedAt = roundData ? roundData[3] : undefined;

  let price: number | null = null;
  let formattedPrice = "—";

  if (rawPrice !== undefined) {
    const floatVal = parseFloat(formatUnits(rawPrice, decimals));
    price = floatVal;
    formattedPrice = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(floatVal);
  }

  const lastUpdatedDate = updatedAt ? new Date(Number(updatedAt) * 1000) : null;

  return {
    price,
    rawPrice,
    decimals,
    updatedAt,
    lastUpdatedDate,
    formattedPrice,
    isLoading: isRoundLoading || isDecimalsLoading,
    isError: isRoundError,
    refetch,
  };
}
