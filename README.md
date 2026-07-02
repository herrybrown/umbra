# Umbra

Private OTC trading for USDC and EURC on Arc Testnet.

Umbra lets institutions trade in size without showing their position to the market. Amounts stay hidden until both sides are locked in and the trade executes. Once settled, your auditor can read the full record using a view key you share with them.

---

## How it works

### 1. Post a quote

Connect your wallet and go to the Trading Desk. Click **New Quote** to set your direction (USDC to EURC or the other way), the amount you want to trade, your firm name, and an optional reference.

When you post, your amount is sealed. The actual number never appears publicly. Your firm name and reference are encrypted and only readable with your view key.

You get an audit key. Save it. It lets your auditor decrypt your side of the trade.

### 2. A counterparty takes your quote

Anyone browsing the Open Market tab can take your quote. They enter the amount they are sending and their firm name, lock in their side, and get their own settlement kit.

Both amounts are now sealed and invisible to anyone else on the network.

### 3. Exchange settlement details

Once matched, both sides remain private onchain. Each participant keeps their own audit key for later disclosure.

### 4. Settle

The maker opens the trade and clicks **Settle Trade**. The contract atomically swaps the escrowed balances already locked by maker and taker. Nothing moves unless both sides were successfully escrowed.

---

## Auditor access

Every trade stores encrypted details: firm names, amounts, timestamps. Only a view key can unlock them.

To give your auditor access:

1. Share the relevant participant **view key** with them.
2. They open the **Audit** panel, enter the trade ID and the participant view key.
3. Everything decrypts locally in their browser. Nothing is sent to a server.

---

## Getting started

You need a wallet connected to Arc Testnet (chain ID 5042002) with some USDC or EURC. Get test tokens at [faucet.circle.com](https://faucet.circle.com/).

Add Arc Testnet to your wallet:

- Network name: Arc Testnet
- RPC URL: `https://rpc.testnet.arc.network`
- Chain ID: `5042002`
- Currency: USDC (gas is paid in USDC, no ETH needed)

---

## Running locally

```bash
git clone https://github.com/herrybrown/umbra.git
cd umbra
npm install
npm run dev
```

The app runs at `http://localhost:3000`.

---

## Contracts

The trading contract is deployed on Arc Testnet. A trade moves through four states: open, matched, settled, and cancelled or expired.

Addresses on Arc Testnet:

- USDC: `0x3600000000000000000000000000000000000000`
- EURC: `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`
- UmbraOTC: `0xbe4Fd7e990F7eab9023192a1ABf0568478dEFb2c` (override with `NEXT_PUBLIC_UMBRA_ADDRESS` if you redeploy)

To deploy the contract yourself:

```bash
cd contracts
forge build
forge script script/Deploy.s.sol --rpc-url $ARC_RPC_URL --private-key $PRIVATE_KEY --broadcast
```
