export const UMBRA_OTC_ADDRESS = (process.env.NEXT_PUBLIC_UMBRA_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const USDC_ADDRESS =
  "0x3600000000000000000000000000000000000000" as `0x${string}`;
export const EURC_ADDRESS =
  "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as `0x${string}`;

export const UMBRA_OTC_ABI = [
  // State
  {
    inputs: [],
    name: "nextTradeId",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "openCount",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "address", name: "" }],
    name: "auditors",
    outputs: [{ type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  // Reads
  {
    inputs: [{ type: "uint256", name: "id" }],
    name: "getTrade",
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "maker", type: "address" },
          { name: "taker", type: "address" },
          { name: "pair", type: "uint8" },
          { name: "status", type: "uint8" },
          { name: "expiresAt", type: "uint64" },
          { name: "createdAt", type: "uint64" },
          { name: "makerCommitment", type: "bytes32" },
          { name: "takerCommitment", type: "bytes32" },
          { name: "makerEncrypted", type: "bytes" },
          { name: "takerEncrypted", type: "bytes" },
          { name: "viewKeyHash", type: "bytes32" },
          { name: "makerAmount", type: "uint256" },
          { name: "takerAmount", type: "uint256" },
          { name: "rfqRef", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "address", name: "maker" }],
    name: "getMakerTrades",
    outputs: [{ type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "address", name: "taker" }],
    name: "getTakerTrades",
    outputs: [{ type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getOpenIds",
    outputs: [{ type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "id", type: "uint256" },
      { name: "viewKey", type: "bytes32" },
    ],
    name: "verifyViewKey",
    outputs: [{ type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  // Writes
  {
    inputs: [
      { name: "pair", type: "uint8" },
      { name: "commitment", type: "bytes32" },
      { name: "encrypted", type: "bytes" },
      { name: "viewKeyHash", type: "bytes32" },
      { name: "preferredTaker", type: "address" },
      { name: "expiresAt", type: "uint64" },
      { name: "rfqRef", type: "string" },
    ],
    name: "createRFQ",
    outputs: [{ name: "id", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "id", type: "uint256" },
      { name: "takerCommitment", type: "bytes32" },
      { name: "takerEncrypted", type: "bytes" },
    ],
    name: "matchRFQ",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "id", type: "uint256" },
      { name: "makerAmount", type: "uint256" },
      { name: "makerSalt", type: "bytes32" },
      { name: "takerAmount", type: "uint256" },
      { name: "takerSalt", type: "bytes32" },
    ],
    name: "settle",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "id", type: "uint256" }],
    name: "cancel",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "id", type: "uint256" }],
    name: "markExpired",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "auditor", type: "address" },
      { name: "active", type: "bool" },
    ],
    name: "setAuditor",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "id", type: "uint256" },
      { indexed: true, name: "maker", type: "address" },
      { indexed: false, name: "pair", type: "uint8" },
      { indexed: false, name: "expiresAt", type: "uint64" },
      { indexed: false, name: "rfqRef", type: "string" },
    ],
    name: "TradeCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "id", type: "uint256" },
      { indexed: true, name: "taker", type: "address" },
    ],
    name: "TradeMatched",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "id", type: "uint256" },
      { indexed: false, name: "makerAmount", type: "uint256" },
      { indexed: false, name: "takerAmount", type: "uint256" },
    ],
    name: "TradeSettled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: "id", type: "uint256" }],
    name: "TradeCancelled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: "id", type: "uint256" }],
    name: "TradeExpired",
    type: "event",
  },
] as const;

export const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
