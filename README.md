# Umbra

Private OTC trading for USDC and EURC on Arc Testnet.

Umbra lets institutions trade in size without showing their position in the app. Each participant's audit disclosure is encrypted under a separate view key. An auditor can review either side with that participant's key, or assemble the complete matched-trade record with both keys.

---

## How it works

### 1. Post a quote

Connect your wallet and go to the Trading Desk. Click **New Quote** to set your direction (USDC to EURC or the other way), the amount you want to trade, your firm name, and an optional reference.

When you post, the amount is omitted from the public market interface. Your firm name, reference, and amount are also stored as an encrypted audit disclosure readable with your view key.

You get a maker audit kit. Save it. It contains the trade ID and the key that decrypts your side of the trade.

### 2. A counterparty takes your quote

Anyone browsing the Open Market tab can take your quote. They enter the amount they are sending and their firm name, lock in their side, and get their own taker audit kit.

Both participant audit disclosures are now encrypted in contract storage.

### 3. Exchange settlement details

Once matched, each participant keeps their own audit key for later disclosure.

Arc is a public EVM network. Function arguments, including escrow amounts, remain
inspectable in transaction calldata even though `getTrade()` omits them and the
audit disclosure blobs are encrypted. Umbra currently provides application-level
selective disclosure, not protocol-level transaction privacy.

### 4. Settle

The maker opens the trade and clicks **Settle Trade**. The contract atomically swaps the escrowed balances already locked by maker and taker. Nothing moves unless both sides were successfully escrowed.

---

## Auditor access

Finalized trades with both participants store separate encrypted maker and taker disclosures: firm names, amounts, references, and timestamps. Open trades, matched trades awaiting finalization, and trades finalized without a taker are not auditable.

The maker view key is generated when the quote is posted. The taker view key is generated when the quote is taken. Each key is saved in that participant's browser and offered as an audit-kit download at that time. The keys are not stored onchain and cannot be recovered if both the browser copy and downloaded kit are lost.

To give your auditor access:

1. Each participant opens their trade card and shares the trade-specific audit link and their audit-kit file with the auditor. The private key is stored in the kit, not in the URL.
2. The auditor opens the link and imports the maker kit, taker kit, or both. An auditor does not need to connect a wallet.
3. Current participant keys are checked against their onchain fingerprints before local decryption. For legacy trades, the contract stored only the maker fingerprint, so a taker key is authenticated by successful AES-GCM decryption.
4. The auditor can download a JSON record containing the public trade metadata and every disclosure provided. Secret view keys are not included in that report.

A single key produces a valid partial audit for that participant's side. A complete matched-trade audit requires both the maker and taker keys.

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
- UmbraOTC: `0xbe4Fd7e990F7eab9023192a1ABf0568478dEFb2c`

If you redeploy, set both `NEXT_PUBLIC_UMBRA_ADDRESS` and
`NEXT_PUBLIC_UMBRA_DEPLOYMENT_BLOCK`. The audit timeline uses the deployment
block when querying ArcScan for contract events.

To deploy the contract yourself:

```bash
cd contracts
forge build
forge script script/Deploy.s.sol --rpc-url $ARC_RPC_URL --private-key $PRIVATE_KEY --broadcast
```
