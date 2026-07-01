// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/UmbraOTC.sol";

contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public decimals = 6;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        return true;
    }
}

contract UmbraOTCTest is Test {
    UmbraOTC public otc;
    MockERC20 public usdc;
    MockERC20 public eurc;

    address maker = address(0x1);
    address taker = address(0x2);
    address auditor = address(0x3);
    address stranger = address(0x4);

    // $1M USDC (6 decimals)
    uint256 constant MAKER_AMOUNT = 1_000_000e6;
    // €920k EURC — ~1.087 implied rate
    uint256 constant TAKER_AMOUNT = 920_000e6;

    bytes32 makerSalt = bytes32(uint256(0xABCD));
    bytes32 takerSalt = bytes32(uint256(0xDEAD));
    bytes32 viewKey = bytes32(uint256(0xBEEF));

    bytes32 makerCommitment;
    bytes32 takerCommitment;
    bytes32 viewKeyHash;

    bytes constant MAKER_ENCRYPTED = hex"deadbeef01";
    bytes constant TAKER_ENCRYPTED = hex"deadbeef02";

    uint64 expiry;

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC");
        eurc = new MockERC20("Euro Coin", "EURC");
        otc = new UmbraOTC(address(usdc), address(eurc));

        makerCommitment = keccak256(abi.encodePacked(MAKER_AMOUNT, makerSalt));
        takerCommitment = keccak256(abi.encodePacked(TAKER_AMOUNT, takerSalt));
        viewKeyHash = keccak256(abi.encodePacked(viewKey));

        expiry = uint64(block.timestamp + 4 hours);

        usdc.mint(maker, 2_000_000e6);
        eurc.mint(taker, 2_000_000e6);

        vm.prank(maker);
        usdc.approve(address(otc), type(uint256).max);

        vm.prank(taker);
        eurc.approve(address(otc), type(uint256).max);
    }

    // ─── createRFQ ───────────────────────────────────────────────────────────

    function test_CreateRFQ() public {
        vm.prank(maker);
        uint256 id = otc.createRFQ(
            UmbraOTC.TokenPair.USDC_EURC,
            makerCommitment,
            MAKER_ENCRYPTED,
            viewKeyHash,
            address(0),
            expiry,
            "RFQ-001"
        );

        assertEq(id, 0);
        assertEq(otc.openCount(), 1);

        UmbraOTC.Trade memory t = otc.getTrade(0);
        assertEq(t.maker, maker);
        assertEq(t.makerCommitment, makerCommitment);
        assertEq(t.viewKeyHash, viewKeyHash);
        assertEq(uint8(t.status), uint8(UmbraOTC.TradeStatus.OPEN));
        assertEq(t.rfqRef, "RFQ-001");
    }

    function test_CreateRFQ_ExpiredReverts() public {
        vm.prank(maker);
        vm.expectRevert(UmbraOTC.InvalidExpiry.selector);
        otc.createRFQ(
            UmbraOTC.TokenPair.USDC_EURC,
            makerCommitment,
            MAKER_ENCRYPTED,
            viewKeyHash,
            address(0),
            uint64(block.timestamp), // already expired
            "RFQ-001"
        );
    }

    // ─── matchRFQ ────────────────────────────────────────────────────────────

    function test_MatchRFQ() public {
        _createDefaultRFQ();

        vm.prank(taker);
        otc.matchRFQ(0, takerCommitment, TAKER_ENCRYPTED);

        UmbraOTC.Trade memory t = otc.getTrade(0);
        assertEq(t.taker, taker);
        assertEq(t.takerCommitment, takerCommitment);
        assertEq(uint8(t.status), uint8(UmbraOTC.TradeStatus.MATCHED));
        assertEq(otc.openCount(), 0); // removed from open list
    }

    function test_MatchRFQ_SelfTradeReverts() public {
        _createDefaultRFQ();

        vm.prank(maker);
        vm.expectRevert(UmbraOTC.SelfTrade.selector);
        otc.matchRFQ(0, takerCommitment, TAKER_ENCRYPTED);
    }

    function test_MatchRFQ_PreferredTakerEnforced() public {
        vm.prank(maker);
        otc.createRFQ(
            UmbraOTC.TokenPair.USDC_EURC,
            makerCommitment,
            MAKER_ENCRYPTED,
            viewKeyHash,
            taker, // preferred taker
            expiry,
            "RFQ-002"
        );

        vm.prank(stranger);
        vm.expectRevert(UmbraOTC.WrongTaker.selector);
        otc.matchRFQ(0, takerCommitment, TAKER_ENCRYPTED);
    }

    // ─── settle ──────────────────────────────────────────────────────────────

    function test_SettleUSDCToEURC() public {
        _createAndMatchRFQ();

        uint256 makerUsdcBefore = usdc.balanceOf(maker);
        uint256 takerEurcBefore = eurc.balanceOf(taker);

        vm.prank(maker);
        otc.settle(0, MAKER_AMOUNT, makerSalt, TAKER_AMOUNT, takerSalt);

        UmbraOTC.Trade memory t = otc.getTrade(0);
        assertEq(uint8(t.status), uint8(UmbraOTC.TradeStatus.SETTLED));
        assertEq(t.makerAmount, MAKER_AMOUNT);
        assertEq(t.takerAmount, TAKER_AMOUNT);

        // Maker sent USDC, received EURC
        assertEq(usdc.balanceOf(maker), makerUsdcBefore - MAKER_AMOUNT);
        assertEq(eurc.balanceOf(maker), TAKER_AMOUNT);

        // Taker sent EURC, received USDC
        assertEq(eurc.balanceOf(taker), takerEurcBefore - TAKER_AMOUNT);
        assertEq(usdc.balanceOf(taker), MAKER_AMOUNT);
    }

    function test_SettleBadMakerCommitmentReverts() public {
        _createAndMatchRFQ();

        vm.prank(maker);
        vm.expectRevert(UmbraOTC.BadCommitment.selector);
        // wrong amount — commitment check fails
        otc.settle(0, MAKER_AMOUNT + 1, makerSalt, TAKER_AMOUNT, takerSalt);
    }

    function test_SettleBadTakerCommitmentReverts() public {
        _createAndMatchRFQ();

        vm.prank(maker);
        vm.expectRevert(UmbraOTC.BadCommitment.selector);
        otc.settle(0, MAKER_AMOUNT, makerSalt, TAKER_AMOUNT + 1, takerSalt);
    }

    function test_SettleByEitherParty() public {
        _createAndMatchRFQ();

        // Taker can also trigger settlement
        vm.prank(taker);
        otc.settle(0, MAKER_AMOUNT, makerSalt, TAKER_AMOUNT, takerSalt);

        assertEq(uint8(otc.getTrade(0).status), uint8(UmbraOTC.TradeStatus.SETTLED));
    }

    // ─── cancel ──────────────────────────────────────────────────────────────

    function test_CancelOpen() public {
        _createDefaultRFQ();

        vm.prank(maker);
        otc.cancel(0);

        assertEq(uint8(otc.getTrade(0).status), uint8(UmbraOTC.TradeStatus.CANCELLED));
        assertEq(otc.openCount(), 0);
    }

    function test_CancelMatched_ByEitherParty() public {
        _createAndMatchRFQ();

        vm.prank(taker);
        otc.cancel(0);

        assertEq(uint8(otc.getTrade(0).status), uint8(UmbraOTC.TradeStatus.CANCELLED));
    }

    function test_CancelByStrangerReverts() public {
        _createDefaultRFQ();

        vm.prank(stranger);
        vm.expectRevert(UmbraOTC.NotParty.selector);
        otc.cancel(0);
    }

    // ─── expire ──────────────────────────────────────────────────────────────

    function test_MarkExpired() public {
        _createDefaultRFQ();

        vm.warp(expiry + 1);
        otc.markExpired(0);

        assertEq(uint8(otc.getTrade(0).status), uint8(UmbraOTC.TradeStatus.EXPIRED));
        assertEq(otc.openCount(), 0);
    }

    function test_MarkExpiredTooEarlyReverts() public {
        _createDefaultRFQ();

        vm.expectRevert(UmbraOTC.NotExpired.selector);
        otc.markExpired(0);
    }

    // ─── auditor ─────────────────────────────────────────────────────────────

    function test_VerifyViewKey() public {
        _createDefaultRFQ();

        assertTrue(otc.verifyViewKey(0, viewKey));
        assertFalse(otc.verifyViewKey(0, bytes32(uint256(0x1234))));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    function _createDefaultRFQ() internal {
        vm.prank(maker);
        otc.createRFQ(
            UmbraOTC.TokenPair.USDC_EURC,
            makerCommitment,
            MAKER_ENCRYPTED,
            viewKeyHash,
            address(0),
            expiry,
            "RFQ-001"
        );
    }

    function _createAndMatchRFQ() internal {
        _createDefaultRFQ();

        vm.prank(taker);
        otc.matchRFQ(0, takerCommitment, TAKER_ENCRYPTED);
    }
}
