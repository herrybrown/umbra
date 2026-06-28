// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
import {IERC20} from "./interfaces/IERC20.sol";

/**
 * @title UmbraOTC
 * @notice Confidential OTC trading desk on Arc Testnet.
 *
 * Trade lifecycle:
 *   OPEN     → maker creates RFQ and locks their tokens in this contract
 *   MATCHED  → taker locks their tokens; both sides are now fully escrowed
 *   SETTLED  → maker calls settle(); contract atomically swaps escrowed tokens
 *   CANCELLED / EXPIRED → locked tokens returned to their respective owners
 *
 * Privacy model:
 *   - Amounts are stored on-chain (visible) once locked
 *   - Institution name and trade reference are AES-GCM encrypted,
 *     keyed by a viewKey known only to the maker and their auditor
 *   - keccak256(viewKey) is stored for auditor verification
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
        // Escrowed amounts — set when each side locks tokens
        uint256 makerAmount;     // set at createRFQ, locked in contract
        uint256 takerAmount;     // set at matchRFQ, locked in contract
        // Encrypted trade details (AES-GCM with viewKey) — for auditor
        bytes makerEncrypted;
        bytes takerEncrypted;    // set on matchRFQ
        // Auditor access
        bytes32 viewKeyHash;     // keccak256(abi.encodePacked(viewKey))
        // Off-chain reference
        string rfqRef;
    }

    uint256 public nextTradeId;
    mapping(uint256 => Trade) public trades;
    mapping(address => uint256[]) public makerTrades;
    mapping(address => uint256[]) public takerTrades;
    uint256[] private _openIds;

    address public owner;
    mapping(address => bool) public auditors;

    event TradeCreated(uint256 indexed id, address indexed maker, TokenPair pair, uint64 expiresAt, string rfqRef);
    event TradeMatched(uint256 indexed id, address indexed taker);
    event TradeSettled(uint256 indexed id, uint256 makerAmount, uint256 takerAmount);
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
     *         Caller must have approved this contract for at least `makerAmount`
     *         of the send token before calling.
     * @param pair           USDC_EURC or EURC_USDC (from maker's perspective)
     * @param makerAmount    Amount the maker is locking (in token's native decimals)
     * @param encrypted      AES-GCM encrypted {institution, ref, …} blob
     * @param viewKeyHash    keccak256(abi.encodePacked(viewKey)) for auditor verification
     * @param preferredTaker address(0) = open market, else restricted to that address
     * @param expiresAt      Unix timestamp; must be within 7 days
     * @param rfqRef         Offchain reference identifier (e.g. "RFQ-2024-001")
     */
    function createRFQ(
        TokenPair pair,
        uint256 makerAmount,
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
        t.makerAmount = makerAmount;
        t.makerEncrypted = encrypted;
        t.viewKeyHash = viewKeyHash;
        t.rfqRef = rfqRef;

        makerTrades[msg.sender].push(id);
        _openIds.push(id);

        emit TradeCreated(id, msg.sender, pair, expiresAt, rfqRef);
    }

    // ─── Taker ───────────────────────────────────────────────────────────────

    /**
     * @notice Match an open RFQ and lock the taker's tokens in escrow.
     *         Caller must have approved this contract for at least `takerAmount`
     *         of their send token before calling.
     * @param id             Trade ID to match
     * @param takerAmount    Amount the taker is locking
     * @param takerEncrypted AES-GCM encrypted taker details blob
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

        (, address toToken) = _tokens(t.pair);
        if (!IERC20(toToken).transferFrom(msg.sender, address(this), takerAmount)) revert TransferFailed();

        t.taker = msg.sender;
        t.takerAmount = takerAmount;
        t.takerEncrypted = takerEncrypted;
        t.status = TradeStatus.MATCHED;

        takerTrades[msg.sender].push(id);
        _removeOpenId(id);

        emit TradeMatched(id, msg.sender);
    }

    // ─── Settlement ──────────────────────────────────────────────────────────

    /**
     * @notice Settle a matched trade. Only the maker may call.
     *         Atomically swaps the escrowed tokens: taker's tokens go to maker,
     *         maker's tokens go to taker.
     */
    function settle(uint256 id) external nonReentrant {
        Trade storage t = trades[id];
        if (t.status != TradeStatus.MATCHED) revert TradeNotMatched();
        if (msg.sender != t.maker) revert NotMaker();

        t.status = TradeStatus.SETTLED;

        (address fromToken, address toToken) = _tokens(t.pair);

        // Maker's locked tokens → taker
        if (!IERC20(fromToken).transfer(t.taker, t.makerAmount)) revert TransferFailed();
        // Taker's locked tokens → maker
        if (!IERC20(toToken).transfer(t.maker, t.takerAmount)) revert TransferFailed();

        emit TradeSettled(id, t.makerAmount, t.takerAmount);
    }

    // ─── Cancellation ────────────────────────────────────────────────────────

    /**
     * @notice Cancel a trade. Only the maker may cancel.
     *         Returns escrowed tokens to their owners.
     *         - OPEN: returns maker's tokens
     *         - MATCHED: returns maker's tokens AND taker's tokens
     */
    function cancel(uint256 id) external nonReentrant {
        Trade storage t = trades[id];
        TradeStatus s = t.status;

        if (s != TradeStatus.OPEN && s != TradeStatus.MATCHED) revert AlreadyFinalized();
        if (msg.sender != t.maker) revert NotMaker();

        t.status = TradeStatus.CANCELLED;

        (address fromToken, address toToken) = _tokens(t.pair);

        if (!IERC20(fromToken).transfer(t.maker, t.makerAmount)) revert TransferFailed();
        if (s == TradeStatus.MATCHED) {
            if (!IERC20(toToken).transfer(t.taker, t.takerAmount)) revert TransferFailed();
        }

        if (s == TradeStatus.OPEN) _removeOpenId(id);

        emit TradeCancelled(id);
    }

    /**
     * @notice Mark an OPEN or MATCHED trade as expired. Anyone can call after expiry.
     *         Returns escrowed tokens to their owners.
     */
    function markExpired(uint256 id) external nonReentrant {
        Trade storage t = trades[id];
        TradeStatus s = t.status;

        if (s != TradeStatus.OPEN && s != TradeStatus.MATCHED) revert AlreadyFinalized();
        if (block.timestamp < t.expiresAt) revert NotExpired();

        t.status = TradeStatus.EXPIRED;

        (address fromToken, address toToken) = _tokens(t.pair);

        if (!IERC20(fromToken).transfer(t.maker, t.makerAmount)) revert TransferFailed();
        if (s == TradeStatus.MATCHED) {
            if (!IERC20(toToken).transfer(t.taker, t.takerAmount)) revert TransferFailed();
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
