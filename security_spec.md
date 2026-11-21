# MoneyCircle Security Specification (Phase 0)

## 1. Data Invariants
1. **Identity Integrity**: Every user-owned document (`users`, `wallets`, `deposits`, `withdrawals`, `transactions`, `planEnrollments`, `notifications`, `supportTickets`) must strictly bind `userId` / `uid` to `request.auth.uid` on creation and preserve ownership immutably on update.
2. **Privilege Isolation**: Standard users cannot create or modify documents in `admins`, `plans`, `coinPackages`, `settings`, or `auditLogs`. Users cannot set `role: "ADMIN"` or `isBlocked: false` changes on their own `users` profile.
3. **Zero Self-Minting Wallet Law**: A user may initialize their own `wallets/{userId}` document only with `availableCoins == 0`, `lockedCoins == 0`, `totalPurchased == 0`, `totalWithdrawn == 0`, and `hasPendingWithdrawal == false`. Non-admin updates to `wallets/{userId}` can never increase `availableCoins + lockedCoins`.
4. **Duplicate Withdrawal Lock**: A user can only submit a `PENDING` withdrawal when `existing().hasPendingWithdrawal == false` and must atomically transition `availableCoins -> lockedCoins` and `hasPendingWithdrawal -> true`. Only an admin can settle (`APPROVED`, `PAID`, `REJECTED`) or unlock `hasPendingWithdrawal`.
5. **Payment Verification Integrity**: Users can only create `deposits` in `GATEWAY_PENDING` state and can never set `status: "VERIFIED"` or `webhookVerified: true` on their own. Coins are credited strictly after verified payment confirmation by authorized admin/server verification.
6. **PII & Support Thread Isolation**: `users`, `wallets`, `deposits`, `withdrawals`, `transactions`, `notifications`, `supportTickets`, and `supportMessages` are readable only by the owning user or verified admins.

## 2. The "Dirty Dozen" Attack Payloads
1. **Privilege Escalation on Signup**: `users/{uid}` created with `{ role: "ADMIN", isBlocked: false }` -> `PERMISSION_DENIED`.
2. **Self-Unblock Attack**: Blocked user updates `users/{uid}` with `{ isBlocked: false }` -> `PERMISSION_DENIED`.
3. **Free Coin Mint on Wallet Init**: User creates `wallets/{uid}` with `{ availableCoins: 10000 }` -> `PERMISSION_DENIED`.
4. **Wallet Balance Inflation**: User updates `wallets/{uid}` increasing `availableCoins` from `100` to `5000` -> `PERMISSION_DENIED`.
5. **Negative Withdrawal Exploit**: User creates `withdrawals/{id}` with `{ amountCoins: -500 }` -> `PERMISSION_DENIED`.
6. **Self-Approve Deposit**: User creates or updates `deposits/{id}` with `{ status: "VERIFIED", webhookVerified: true }` -> `PERMISSION_DENIED`.
7. **Self-Mark Withdrawal Paid**: User updates `withdrawals/{id}` from `PENDING` to `PAID` -> `PERMISSION_DENIED`.
8. **Duplicate Pending Withdrawal**: User creates second withdrawal while `hasPendingWithdrawal == true` -> `PERMISSION_DENIED`.
9. **Ghost Field Shadow Write**: User creates `users/{uid}` with extra field `{ vipBypass: true }` -> `PERMISSION_DENIED`.
10. **ID Poisoning**: User writes document with 500-char or symbol-injected ID `../admin` -> `PERMISSION_DENIED`.
11. **Cross-User PII Scrape**: User A queries `list` on `users`, `wallets`, or `withdrawals` without `userId == request.auth.uid` -> `PERMISSION_DENIED`.
12. **Unverified Email Spoof**: User with `email: "saini.lalit278@gmail.com"` and `email_verified: false` attempts admin write -> `PERMISSION_DENIED`.
