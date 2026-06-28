// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
import {IERC20} from "./interfaces/IERC20.sol";

/**
 * @title UmbraOTC
 * @notice Dark-pool OTC desk on Arc Testnet.
 *
 * Trade lifecycle:
 *   OPEN     → maker locks their tokens in escrow; amounts never stored in public state
 *   MATCHED  → taker locks their tokens; bid commitment verified if set by maker
 *   SETTLED  → maker triggers atomic swap of escrowed tokens
 *   CANCELLED / EXPIRED → escrowed tokens returned to their owners
 *
 * Privacy model:
 *   - Token amounts are stored in private contract mappings; getTrade() exposes none
 *   - Only the encrypted blob (keyed by viewKey) reveals amounts to auditors
 *   - bidCommitment lets maker enforce an exact taker bid for open-market quotes,
 *     with the expected amount shared off-chain via the RFQ process
 */
contract UmbraOTC is ReentrancyGuard {
    address public immutable USDC;
    address public immutable EURC;

    enum TokenPair {
        USDC_EURC, // maker sends USDC, receives EURC
        EURC_USDC  // maker sends EURC, receives USDC
    }

    enum TradeStatus {
        OPEN,
        MATCHED,
        SETTLED,
        CANCELLED,
        EXPIRED
    }

    struct Trade {
        uint256 id;
        address maker;
        address taker;           // address(0) = open to any counterparty
        TokenPair pair;
        TradeStatus status;
        uint64 expiresAt;
        uint64 createdAt;
        // Optional bid criteria: keccak256(abi.encodePacked(expectedTakerAmount))
        // bytes32(0) = accept any amount
        bytes32 bidCommitment;
        // Encrypted trade details (AES-GCM with viewKey) — for auditor
        bytes makerEncrypted;
        bytes takerEncrypted;    // set on matchRFQ
        // Auditor access
        bytes32 viewKeyHash;     // keccak256(abi.encodePacked(viewKey))
        // Off-chain reference
        string rfqRef;
    }

    // Private escrow ledger — amounts never exposed via ABI
    mapping(uint256 => uint256) private _makerLocked;
    mapping(uint256 => uint256) private _takerLocked;

    uint256 public nextTradeId;
    mapping(uint256 => Trade) public trades;
    mapping(address => uint256[]) public makerTrades;
    mapping(address => uint256[]) public takerTrades;
    uint256[] private _openIds;

    address public owner;
    mapping(address => bool) public auditors;

    event TradeCreated(uint256 indexed id, address indexed maker, TokenPair pair, uint64 expiresAt, string rfqRef);
    event TradeMatched(uint256 indexed id, address indexed taker);
    event TradeSettled(uint256 indexed id);
    event TradeCancelled(uint256 indexed id);
    event TradeExpired(uint256 indexed id);
    event AuditorUpdated(address indexed auditor, bool active);

    error NotOwner();
    error NotMaker();
    error InvalidExpiry();
    error TradeNotOpen();
    error TradeNotMatched();
    error AlreadyFinalized();
    error Expired();
    error NotExpired();
    error SelfTrade();
    error WrongTaker();
    error BidMismatch();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _usdc, address _eurc) {
        USDC = _usdc;
        EURC = _eurc;
        owner = msg.sender;
        auditors[msg.sender] = true;
    }

    // ─── Maker ───────────────────────────────────────────────────────────────

    /**
     * @notice Create a new RFQ and lock the maker's tokens in escrow.
     *         The locked amount is never stored in public state.
     * @param pair           USDC_EURC or EURC_USDC (from maker's perspective)
     * @param makerAmount    Amount to lock (approved beforehand)
     * @param bidCommitment  keccak256(abi.encodePacked(expectedTakerAmount)), or bytes32(0) for any amount
     * @param encrypted      AES-GCM encrypted trade details for auditor
     * @param viewKeyHash    keccak256(abi.encodePacked(viewKey))
     * @param preferredTaker address(0) = open market, else restricted to that address
     * @param expiresAt      Unix timestamp; must be within 7 days
     * @param rfqRef         Off-chain reference (e.g. "RFQ-2024-001")
     */
    function createRFQ(
        TokenPair pair,
        uint256 makerAmount,
        bytes32 bidCommitment,
        bytes calldata encrypted,
        bytes32 viewKeyHash,
        address preferredTaker,
        uint64 expiresAt,
        string calldata rfqRef
    ) external returns (uint256 id) {
        if (expiresAt <= block.timestamp) revert InvalidExpiry();
        if (expiresAt > block.timestamp + 7 days) revert InvalidExpiry();

        (address fromToken,) = _tokens(pair);
        if (!IERC20(fromToken).transferFrom(msg.sender, address(this), makerAmount)) revert TransferFailed();

        id = nextTradeId++;

        Trade storage t = trades[id];
        t.id = id;
        t.maker = msg.sender;
        t.taker = preferredTaker;
        t.pair = pair;
        t.status = TradeStatus.OPEN;
        t.expiresAt = expiresAt;
        t.createdAt = uint64(block.timestamp);
        t.bidCommitment = bidCommitment;
        t.makerEncrypted = encrypted;
        t.viewKeyHash = viewKeyHash;
        t.rfqRef = rfqRef;

        _makerLocked[id] = makerAmount;

        makerTrades[msg.sender].push(id);
        _openIds.push(id);

        emit TradeCreated(id, msg.sender, pair, expiresAt, rfqRef);
    }

    // ─── Taker ───────────────────────────────────────────────────────────────

    /**
     * @notice Match an open RFQ and lock the taker's tokens in escrow.
     *         If the maker set a bidCommitment, the taker's amount must match exactly.
     * @param id             Trade to match
     * @param takerAmount    Amount the taker is locking
     * @param takerEncrypted AES-GCM encrypted taker details for auditor
     */
    function matchRFQ(
        uint256 id,
        uint256 takerAmount,
        bytes calldata takerEncrypted
    ) external {
        Trade storage t = trades[id];
        if (t.status != TradeStatus.OPEN) revert TradeNotOpen();
        if (block.timestamp >= t.expiresAt) revert Expired();
        if (t.maker == msg.sender) revert SelfTrade();
        if (t.taker != address(0) && t.taker != msg.sender) revert WrongTaker();

        // Enforce bid criteria if maker set one
        if (t.bidCommitment != bytes32(0)) {
            if (keccak256(abi.encodePacked(takerAmount)) != t.bidCommitment) revert BidMismatch();
        }

        (, address toToken) = _tokens(t.pair);
        if (!IERC20(toToken).transferFrom(msg.sender, address(this), takerAmount)) revert TransferFailed();

        t.taker = msg.sender;
        t.takerEncrypted = takerEncrypted;
        t.status = TradeStatus.MATCHED;

        _takerLocked[id] = takerAmount;

        takerTrades[msg.sender].push(id);
        _removeOpenId(id);

        emit TradeMatched(id, msg.sender);
    }

    // ─── Settlement ──────────────────────────────────────────────────────────

    /**
     * @notice Settle a matched trade. Only the maker may call.
     *         Atomically swaps escrowed tokens without revealing amounts.
     */
    function settle(uint256 id) external nonReentrant {
        Trade storage t = trades[id];
        if (t.status != TradeStatus.MATCHED) revert TradeNotMatched();
        if (msg.sender != t.maker) revert NotMaker();

        uint256 makerAmt = _makerLocked[id];
        uint256 takerAmt = _takerLocked[id];

        t.status = TradeStatus.SETTLED;
        _makerLocked[id] = 0;
        _takerLocked[id] = 0;

        (address fromToken, address toToken) = _tokens(t.pair);

        if (!IERC20(fromToken).transfer(t.taker, makerAmt)) revert TransferFailed();
        if (!IERC20(toToken).transfer(t.maker, takerAmt)) revert TransferFailed();

        emit TradeSettled(id);
    }

    // ─── Cancellation ────────────────────────────────────────────────────────

    /**
     * @notice Cancel a trade. Only the maker may cancel.
     *         Returns escrowed tokens to their owners.
     */
    function cancel(uint256 id) external nonReentrant {
        Trade storage t = trades[id];
        TradeStatus s = t.status;

        if (s != TradeStatus.OPEN && s != TradeStatus.MATCHED) revert AlreadyFinalized();
        if (msg.sender != t.maker) revert NotMaker();

        uint256 makerAmt = _makerLocked[id];
        uint256 takerAmt = _takerLocked[id];

        t.status = TradeStatus.CANCELLED;
        _makerLocked[id] = 0;
        _takerLocked[id] = 0;

        (address fromToken, address toToken) = _tokens(t.pair);

        if (!IERC20(fromToken).transfer(t.maker, makerAmt)) revert TransferFailed();
        if (s == TradeStatus.MATCHED) {
            if (!IERC20(toToken).transfer(t.taker, takerAmt)) revert TransferFailed();
        }

        if (s == TradeStatus.OPEN) _removeOpenId(id);

        emit TradeCancelled(id);
    }

    /**
     * @notice Mark an OPEN or MATCHED trade as expired. Anyone may call after expiry.
     *         Returns escrowed tokens to their owners.
     */
    function markExpired(uint256 id) external nonReentrant {
        Trade storage t = trades[id];
        TradeStatus s = t.status;

        if (s != TradeStatus.OPEN && s != TradeStatus.MATCHED) revert AlreadyFinalized();
        if (block.timestamp < t.expiresAt) revert NotExpired();

        uint256 makerAmt = _makerLocked[id];
        uint256 takerAmt = _takerLocked[id];

        t.status = TradeStatus.EXPIRED;
        _makerLocked[id] = 0;
        _takerLocked[id] = 0;

        (address fromToken, address toToken) = _tokens(t.pair);

        if (!IERC20(fromToken).transfer(t.maker, makerAmt)) revert TransferFailed();
        if (s == TradeStatus.MATCHED) {
            if (!IERC20(toToken).transfer(t.taker, takerAmt)) revert TransferFailed();
        }

        if (s == TradeStatus.OPEN) _removeOpenId(id);

        emit TradeExpired(id);
    }

    // ─── Auditor ─────────────────────────────────────────────────────────────

    function setAuditor(address auditor, bool active) external onlyOwner {
        auditors[auditor] = active;
        emit AuditorUpdated(auditor, active);
    }

    function verifyViewKey(uint256 id, bytes32 viewKey) external view returns (bool) {
        return keccak256(abi.encodePacked(viewKey)) == trades[id].viewKeyHash;
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    function getTrade(uint256 id) external view returns (Trade memory) {
        return trades[id];
    }

    function getMakerTrades(address maker) external view returns (uint256[] memory) {
        return makerTrades[maker];
    }

    function getTakerTrades(address taker) external view returns (uint256[] memory) {
        return takerTrades[taker];
    }

    function getOpenIds() external view returns (uint256[] memory) {
        return _openIds;
    }

    function openCount() external view returns (uint256) {
        return _openIds.length;
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    function _tokens(TokenPair pair) internal view returns (address from, address to) {
        return pair == TokenPair.USDC_EURC ? (USDC, EURC) : (EURC, USDC);
    }

    function _removeOpenId(uint256 id) internal {
        uint256 n = _openIds.length;
        for (uint256 i; i < n; ++i) {
            if (_openIds[i] == id) {
                _openIds[i] = _openIds[n - 1];
                _openIds.pop();
                return;
            }
        }
    }
}
