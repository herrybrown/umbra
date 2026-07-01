-include .env

# ─── Contracts ───────────────────────────────────────────────────────────────

build:
	cd contracts && forge build

test:
	cd contracts && forge test -vv

test-verbose:
	cd contracts && forge test -vvvv

fmt:
	cd contracts && forge fmt

clean:
	cd contracts && forge clean

# ─── Deployment ──────────────────────────────────────────────────────────────

deploy-dry:
	cd contracts && PRIVATE_KEY=$(PRIVATE_KEY) forge script script/Deploy.s.sol \
		--rpc-url $(ARC_RPC_URL) -vvvv

deploy:
	cd contracts && PRIVATE_KEY=$(PRIVATE_KEY) forge script script/Deploy.s.sol \
		--rpc-url $(ARC_RPC_URL) --broadcast -vvvv

# ─── Frontend ────────────────────────────────────────────────────────────────

install:
	npm install

dev:
	npm run dev

build-frontend:
	npm run build

# ─── Utilities ───────────────────────────────────────────────────────────────

usdc-balance:
	@cast call $(USDC_ADDRESS) "balanceOf(address)(uint256)" \
		$(DEPLOYER_ADDRESS) --rpc-url $(ARC_RPC_URL)

eurc-balance:
	@cast call $(EURC_ADDRESS) "balanceOf(address)(uint256)" \
		$(DEPLOYER_ADDRESS) --rpc-url $(ARC_RPC_URL)

block:
	@cast block-number --rpc-url $(ARC_RPC_URL)

open-count:
	@cast call $(UMBRA_ADDRESS) "openCount()(uint256)" --rpc-url $(ARC_RPC_URL)

.PHONY: build test test-verbose fmt clean deploy-dry deploy install dev build-frontend \
        usdc-balance eurc-balance block open-count
