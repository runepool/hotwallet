# Rune-Pool Matching Engine

Runepool’s matching engine is a purpose-built settlement layer that unlocks decentralized spot trading for Bitcoin Rune assets while preserving the security of on-chain UTXOs. Below is a succinct overview suitable for non-technical stakeholders.

---

## 1. What Problem Does It Solve?

**Liquidity Fragmentation:** Aggregates maker liquidity so takers always see a single consolidated order book.

**Trustless Settlement:** Uses Bitcoin-native PSBTs—trades settle directly on-chain without custodial risk.

**Capital Efficiency:** Makers can market-make from their own wallets; idle capital is minimized.

---

## 2. How It Works (30-Second Flow)
1. **Quote Request** – A trader submits a buy/sell intent via REST or WebSocket.
2. **Order Selection** – The engine auto-selects the optimal set of maker orders (best price & depth).
3. **Asset Reservation** – Makers temporarily lock the necessary UTXOs through a lightweight handshake.
4. **Atomic Swap Build** – The engine constructs a Partially-Signed Bitcoin Transaction (PSBT) that encodes the swap.
5. **Co-Signing** – Makers sign their inputs; the taker signs theirs.
6. **Broadcast & Settlement** – Once fully signed, the transaction is broadcast; assets settle on-chain in a single Bitcoin transaction.

Total time: **~2–3 seconds** from quote to signed PSBT; settlement finality after 1 block confirmation.

---

## 3. Key Architectural Highlights
**Stateless Core:** All heavy state (orders, trades) lives in a Postgres cluster; the engine itself is horizontally scalable.

**Asynchronous Messaging:** Utilises Websockets for real-time, censorship-resistant maker communication.

**Automated Risk Controls:** Built-in slippage caps, maker heartbeat monitoring, and instant cancellation of stale reservations.

---

## 4. Competitive Advantages
1. **On-Chain Finality** – Unlike central-limit order books that rely on intermediaries, trades complete on Bitcoin L1.
2. **Maker UX** – Makers keep custody, earn fees, and can market-make with standard Bitcoin tooling.
3. **Low Overhead** – Message bus is WebSocket-based; no custom sidechains or smart-contract VMs required.
4. **Regulatory Clarity** – Pure P2P swap mechanism; no pooled customer funds.

---

## 5. Security & Reliability
• **PSBT Validation** – Every input/output validated against expected amounts; protocol fees enforced.
• **Heartbeat Cron** – Non-responsive makers are automatically pruned, ensuring stale liquidity never hits takers.
• **Crash Recovery** – Pending swaps persisted; idempotent reconnection logic guarantees no orphaned state.

---

## 6. PSBT Structure

### Buy PSBT
| Output Index | Purpose |
|--------------|---------|
| **0** | Taker receives purchased Rune amount |
| **1 … n** | Maker Rune change (unused Rune returned to each maker) |
| **n + 1** | Protocol Rune fee |
| **n + 2** | *Edict* inscription committing swap metadata |
| **n + 3 … m** | Makers receive BTC (sats) payment |
| **m + 1** | Protocol BTC fee |

### Sell PSBT
| Output Index | Purpose |
|--------------|---------|
| **0** | Taker Rune change (unused Rune returned to taker) |
| **1 … n** | Makers receive Rune amounts sold by taker |
| **n + 1** | *Edict* inscription committing swap metadata |
| **n + 2 … m** | Taker receives BTC proceeds |
| **m + 1** | Protocol BTC fee |

