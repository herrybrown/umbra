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
    address stranger = address(0x4);

    uint256 constant MAKER_AMOUNT = 1_000_000e6;
    uint256 constant TAKER_AMOUNT = 920_000e6;

    bytes32 makerViewKey = bytes32(uint256(0xBEEF));
    bytes32 takerViewKey = bytes32(uint256(0xCAFE));
    bytes32 makerViewKeyHash;
    bytes32 takerViewKeyHash;

    bytes constant MAKER_ENCRYPTED = hex"deadbeef01";
    bytes constant TAKER_ENCRYPTED = hex"deadbeef02";

    uint64 expiry;

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC");
        eurc = new MockERC20("Euro Coin", "EURC");
        otc = new UmbraOTC(address(usdc), address(eurc));

        makerViewKeyHash = keccak256(abi.encodePacked(makerViewKey));
        takerViewKeyHash = keccak256(abi.encodePacked(takerViewKey));

        expiry = uint64(block.timestamp + 4 hours);

        usdc.mint(maker, 2_000_000e6);
        eurc.mint(taker, 2_000_000e6);

        vm.prank(maker);
        usdc.approve(address(otc), type(uint256).max);

        vm.prank(taker);
        eurc.approve(address(otc), type(uint256).max);
    }

    function test_CreateRFQ() public {
        vm.prank(maker);
        uint256 id = otc.createRFQ(
            UmbraOTC.TokenPair.USDC_EURC,
            MAKER_AMOUNT,
            bytes32(0),
            MAKER_ENCRYPTED,
            makerViewKeyHash,
            address(0),
            expiry,
            "RFQ-001"
        );

        assertEq(id, 0);
        assertEq(otc.openCount(), 1);

        UmbraOTC.Trade memory t = otc.getTrade(0);
        assertEq(t.maker, maker);
        assertEq(t.makerViewKeyHash, makerViewKeyHash);
        assertEq(t.takerViewKeyHash, bytes32(0));
        assertEq(uint8(t.status), uint8(UmbraOTC.TradeStatus.OPEN));
        assertEq(t.rfqRef, "RFQ-001");
    }

    function test_CreateRFQ_ExpiredReverts() public {
        vm.prank(maker);
        vm.expectRevert(UmbraOTC.InvalidExpiry.selector);
        otc.createRFQ(
            UmbraOTC.TokenPair.USDC_EURC,
            MAKER_AMOUNT,
            bytes32(0),
            MAKER_ENCRYPTED,
            makerViewKeyHash,
            address(0),
            uint64(block.timestamp),
            "RFQ-001"
        );
    }

    function test_MatchRFQ() public {
        _createDefaultRFQ();

        vm.prank(taker);
        otc.matchRFQ(0, TAKER_AMOUNT, TAKER_ENCRYPTED, takerViewKeyHash);

        UmbraOTC.Trade memory t = otc.getTrade(0);
        assertEq(t.taker, taker);
        assertEq(t.takerViewKeyHash, takerViewKeyHash);
        assertEq(uint8(t.status), uint8(UmbraOTC.TradeStatus.MATCHED));
        assertEq(otc.openCount(), 0);
    }

    function test_MatchRFQ_BidCommitmentEnforced() public {
        vm.prank(maker);
        otc.createRFQ(
            UmbraOTC.TokenPair.USDC_EURC,
            MAKER_AMOUNT,
            keccak256(abi.encodePacked(TAKER_AMOUNT)),
            MAKER_ENCRYPTED,
            makerViewKeyHash,
            address(0),
            expiry,
            "RFQ-001"
        );

        vm.prank(taker);
        vm.expectRevert(UmbraOTC.BidMismatch.selector);
        otc.matchRFQ(0, TAKER_AMOUNT + 1, TAKER_ENCRYPTED, takerViewKeyHash);
    }

    function test_MatchRFQ_SelfTradeReverts() public {
        _createDefaultRFQ();

        vm.prank(maker);
        vm.expectRevert(UmbraOTC.SelfTrade.selector);
        otc.matchRFQ(0, TAKER_AMOUNT, TAKER_ENCRYPTED, takerViewKeyHash);
    }

    function test_MatchRFQ_PreferredTakerEnforced() public {
        vm.prank(maker);
        otc.createRFQ(
            UmbraOTC.TokenPair.USDC_EURC,
            MAKER_AMOUNT,
            bytes32(0),
            MAKER_ENCRYPTED,
            makerViewKeyHash,
            taker,
            expiry,
            "RFQ-002"
        );

        vm.prank(stranger);
        vm.expectRevert(UmbraOTC.WrongTaker.selector);
        otc.matchRFQ(0, TAKER_AMOUNT, TAKER_ENCRYPTED, takerViewKeyHash);
    }

    function test_SettleUSDCToEURC() public {
        _createAndMatchRFQ();

        uint256 makerUsdcBefore = usdc.balanceOf(maker);
        uint256 makerEurcBefore = eurc.balanceOf(maker);
        uint256 takerUsdcBefore = usdc.balanceOf(taker);
        uint256 takerEurcBefore = eurc.balanceOf(taker);
        uint256 contractUsdcBefore = usdc.balanceOf(address(otc));
        uint256 contractEurcBefore = eurc.balanceOf(address(otc));

        vm.prank(maker);
        otc.settle(0);

        UmbraOTC.Trade memory t = otc.getTrade(0);
        assertEq(uint8(t.status), uint8(UmbraOTC.TradeStatus.SETTLED));

        assertEq(usdc.balanceOf(maker), makerUsdcBefore);
        assertEq(eurc.balanceOf(maker), makerEurcBefore + TAKER_AMOUNT);
        assertEq(eurc.balanceOf(taker), takerEurcBefore);
        assertEq(usdc.balanceOf(taker), takerUsdcBefore + MAKER_AMOUNT);
        assertEq(usdc.balanceOf(address(otc)), contractUsdcBefore - MAKER_AMOUNT);
        assertEq(eurc.balanceOf(address(otc)), contractEurcBefore - TAKER_AMOUNT);
    }

    function test_SettleOnlyMaker() public {
        _createAndMatchRFQ();

        vm.prank(taker);
        vm.expectRevert(UmbraOTC.NotMaker.selector);
        otc.settle(0);
    }

    function test_CancelOpen() public {
        _createDefaultRFQ();

        vm.prank(maker);
        otc.cancel(0);

        assertEq(uint8(otc.getTrade(0).status), uint8(UmbraOTC.TradeStatus.CANCELLED));
        assertEq(otc.openCount(), 0);
        assertEq(usdc.balanceOf(maker), 2_000_000e6);
    }

    function test_CancelMatchedReturnsBothSides() public {
        _createAndMatchRFQ();

        vm.prank(maker);
        otc.cancel(0);

        assertEq(uint8(otc.getTrade(0).status), uint8(UmbraOTC.TradeStatus.CANCELLED));
        assertEq(usdc.balanceOf(maker), 2_000_000e6);
        assertEq(eurc.balanceOf(taker), 2_000_000e6);
    }

    function test_CancelByStrangerReverts() public {
        _createDefaultRFQ();

        vm.prank(stranger);
        vm.expectRevert(UmbraOTC.NotMaker.selector);
        otc.cancel(0);
    }

    function test_MarkExpired() public {
        _createDefaultRFQ();

        vm.warp(expiry + 1);
        vm.prank(maker);
        otc.markExpired(0);

        assertEq(uint8(otc.getTrade(0).status), uint8(UmbraOTC.TradeStatus.EXPIRED));
        assertEq(otc.openCount(), 0);
    }

    function test_MarkExpiredByStrangerReverts() public {
        _createDefaultRFQ();

        vm.warp(expiry + 1);
        vm.prank(stranger);
        vm.expectRevert(UmbraOTC.NotMaker.selector);
        otc.markExpired(0);
    }

    function test_MarkExpiredTooEarlyReverts() public {
        _createDefaultRFQ();

        vm.prank(maker);
        vm.expectRevert(UmbraOTC.NotExpired.selector);
        otc.markExpired(0);
    }

    function test_VerifyViewKeyForMakerAndTaker() public {
        _createAndMatchRFQ();

        assertTrue(otc.verifyViewKey(0, makerViewKey));
        assertTrue(otc.verifyViewKey(0, takerViewKey));
        assertFalse(otc.verifyViewKey(0, bytes32(uint256(0x1234))));
    }

    function _createDefaultRFQ() internal {
        vm.prank(maker);
        otc.createRFQ(
            UmbraOTC.TokenPair.USDC_EURC,
            MAKER_AMOUNT,
            bytes32(0),
            MAKER_ENCRYPTED,
            makerViewKeyHash,
            address(0),
            expiry,
            "RFQ-001"
        );
    }

    function _createAndMatchRFQ() internal {
        _createDefaultRFQ();

        vm.prank(taker);
        otc.matchRFQ(0, TAKER_AMOUNT, TAKER_ENCRYPTED, takerViewKeyHash);
    }
}
