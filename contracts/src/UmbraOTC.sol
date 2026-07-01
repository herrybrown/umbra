// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
import {IERC20} from "./interfaces/IERC20.sol";

/**
 * @title UmbraOTC
 * @notice Confidential OTC trading desk on Arc Testnet.
 *
 * Trade lifecycle:
 *   OPEN     → maker creates an RFQ with a cryptographic commitment to amount
 *   MATCHED  → taker commits to their counter-amount; actual amounts stay hidden
 *   SETTLED  → either party reveals both amounts; contract validates commitments
 *              and executes an atomic FX swap (USDC ↔ EURC)
 *   CANCELLED / EXPIRED → trade ends without settlement
 *
 * Privacy model (TEE-simulation):
 *   - Amounts hidden pre-settlement via keccak256(amount ‖ salt) commitments
 *   - AES-GCM encrypted trade details stored onchain, keyed by viewKey
 *   - Auditors receive viewKey offchain; keccak256(viewKey) is stored for verification
 *   - Settlement atomically reveals amounts and executes the token swap
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
        // Confidential commitments — amounts hidden until settlement
        bytes32 makerCommitment; // keccak256(abi.encodePacked(makerAmount, makerSalt))
        bytes32 takerCommitment; // set on matchRFQ
        // Encrypted trade details (AES-GCM with viewKey)
        bytes makerEncrypted;
        bytes takerEncrypted;    // set on matchRFQ
        // Auditor access
        bytes32 viewKeyHash;     // keccak256(abi.encodePacked(viewKey))
        // Settlement result — 0 until settled, then publicly visible
        uint256 makerAmount;
        uint256 takerAmount;
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
    error NotParty();
    error InvalidExpiry();
    error TradeNotOpen();
    error TradeNotMatched();
    error AlreadyFinalized();
    error Expired();
    error NotExpired();
    error BadCommitment();
    error SelfTrade();
    error WrongTaker();

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
     * @notice Create a new RFQ. Amount is hidden via commitment; encrypted details
     *         are stored for auditor access. No tokens are transferred at this stage.
     * @param pair          USDC_EURC or EURC_USDC (from maker's perspective)
     * @param commitment    keccak256(abi.encodePacked(makerAmount, makerSalt))
     * @param encrypted     AES-GCM encrypted {amount, institution, ref} blob
     * @param viewKeyHash   keccak256(abi.encodePacked(viewKey)) for auditor verification
     * @param preferredTaker address(0) = open market, else restricted to that address
     * @param expiresAt     Unix timestamp; must be within 7 days
     * @param rfqRef        Offchain reference identifier (e.g. "RFQ-2024-001")
     */
    function createRFQ(
        TokenPair pair,
        bytes32 commitment,
        bytes calldata encrypted,
        bytes32 viewKeyHash,
        address preferredTaker,
        uint64 expiresAt,
        string calldata rfqRef
    ) external returns (uint256 id) {
        if (expiresAt <= block.timestamp) revert InvalidExpiry();
        if (expiresAt > block.timestamp + 7 days) revert InvalidExpiry();

        id = nextTradeId++;

        Trade storage t = trades[id];
        t.id = id;
        t.maker = msg.sender;
        t.taker = preferredTaker;
        t.pair = pair;
        t.status = TradeStatus.OPEN;
        t.expiresAt = expiresAt;
        t.createdAt = uint64(block.timestamp);
        t.makerCommitment = commitment;
        t.makerEncrypted = encrypted;
        t.viewKeyHash = viewKeyHash;
        t.rfqRef = rfqRef;

        makerTrades[msg.sender].push(id);
        _openIds.push(id);

        emit TradeCreated(id, msg.sender, pair, expiresAt, rfqRef);
    }

    // ─── Taker ───────────────────────────────────────────────────────────────

    /**
     * @notice Match an open RFQ as the taker. Commits to counter-amount without
     *         revealing it. No tokens transferred yet.
     */
    function matchRFQ(
        uint256 id,
        bytes32 takerCommitment,
        bytes calldata takerEncrypted
    ) external {
        Trade storage t = trades[id];
        if (t.status != TradeStatus.OPEN) revert TradeNotOpen();
        if (block.timestamp >= t.expiresAt) revert Expired();
        if (t.maker == msg.sender) revert SelfTrade();
        if (t.taker != address(0) && t.taker != msg.sender) revert WrongTaker();

        t.taker = msg.sender;
        t.takerCommitment = takerCommitment;
        t.takerEncrypted = takerEncrypted;
        t.status = TradeStatus.MATCHED;

        takerTrades[msg.sender].push(id);
        _removeOpenId(id);

        emit TradeMatched(id, msg.sender);
    }

    // ─── Settlement ──────────────────────────────────────────────────────────

    /**
     * @notice Settle a matched trade. Both parties exchange salts offchain, then
     *         either party calls settle with the full revelation data.
     *         Validates commitments and atomically swaps tokens.
     * @dev Both maker and taker must have approved this contract before calling.
     *      Maker approves their send token (USDC or EURC), taker approves theirs.
     */
    function settle(
        uint256 id,
        uint256 makerAmount,
        bytes32 makerSalt,
        uint256 takerAmount,
        bytes32 takerSalt
    ) external nonReentrant {
        Trade storage t = trades[id];
        if (t.status != TradeStatus.MATCHED) revert TradeNotMatched();
        if (block.timestamp >= t.expiresAt) revert Expired();
        if (msg.sender != t.maker && msg.sender != t.taker) revert NotParty();

        // Validate confidential commitments (the TEE reveal step)
        if (keccak256(abi.encodePacked(makerAmount, makerSalt)) != t.makerCommitment) {
            revert BadCommitment();
        }
        if (keccak256(abi.encodePacked(takerAmount, takerSalt)) != t.takerCommitment) {
            revert BadCommitment();
        }

        t.status = TradeStatus.SETTLED;
        t.makerAmount = makerAmount;
        t.takerAmount = takerAmount;

        (address fromToken, address toToken) = _tokens(t.pair);

        // Atomic swap: maker sends fromToken to taker, taker sends toToken to maker
        require(IERC20(fromToken).transferFrom(t.maker, t.taker, makerAmount), "USDC transfer failed");
        require(IERC20(toToken).transferFrom(t.taker, t.maker, takerAmount), "EURC transfer failed");

        emit TradeSettled(id, makerAmount, takerAmount);
    }

    // ─── Cancellation ────────────────────────────────────────────────────────

    /**
     * @notice Cancel an OPEN or MATCHED trade. Maker can cancel OPEN; either party
     *         can cancel MATCHED (before settlement).
     */
    function cancel(uint256 id) external {
        Trade storage t = trades[id];
        TradeStatus s = t.status;

        if (s != TradeStatus.OPEN && s != TradeStatus.MATCHED) revert AlreadyFinalized();
        if (msg.sender != t.maker && msg.sender != t.taker) revert NotParty();

        t.status = TradeStatus.CANCELLED;
        if (s == TradeStatus.OPEN) _removeOpenId(id);

        emit TradeCancelled(id);
    }

    /**
     * @notice Mark an OPEN or MATCHED trade as expired. Anyone can call after expiry.
     */
    function markExpired(uint256 id) external {
        Trade storage t = trades[id];
        TradeStatus s = t.status;

        if (s != TradeStatus.OPEN && s != TradeStatus.MATCHED) revert AlreadyFinalized();
        if (block.timestamp < t.expiresAt) revert NotExpired();

        t.status = TradeStatus.EXPIRED;
        if (s == TradeStatus.OPEN) _removeOpenId(id);

        emit TradeExpired(id);
    }

    // ─── Auditor ─────────────────────────────────────────────────────────────

    function setAuditor(address auditor, bool active) external onlyOwner {
        auditors[auditor] = active;
        emit AuditorUpdated(auditor, active);
    }

    /**
     * @notice Verify a view key against the stored hash without revealing the key.
     *         Off-chain: auditor decrypts makerEncrypted / takerEncrypted with viewKey.
     */
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
