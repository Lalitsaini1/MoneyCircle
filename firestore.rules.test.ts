/**
 * MoneyCircle Firestore Security Rules Verification Specification
 * Covers the "Dirty Dozen" adversarial payloads against firestore.rules invariants.
 */

export interface DirtyDozenCase {
  id: string;
  name: string;
  collection: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  expected: 'PERMISSION_DENIED';
  rationale: string;
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 'DD-01',
    name: 'Privilege Escalation on User Create',
    collection: 'users',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'isValidUserCreate enforces role == "USER" and isBlocked == false.',
  },
  {
    id: 'DD-02',
    name: 'Blocked User Self-Unblock',
    collection: 'users',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    rationale: 'User update affectedKeys allowlist excludes isBlocked and role.',
  },
  {
    id: 'DD-03',
    name: 'Free Coin Mint on Wallet Initialization',
    collection: 'wallets',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'Wallet creation by user enforces availableCoins == 0 && lockedCoins == 0.',
  },
  {
    id: 'DD-04',
    name: 'Direct Wallet Balance Inflation',
    collection: 'wallets',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    rationale: 'Non-admin wallet updates cannot increase availableCoins + lockedCoins.',
  },
  {
    id: 'DD-05',
    name: 'Negative Withdrawal Amount Exploit',
    collection: 'withdrawals',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'isValidWithdrawal requires amountCoins > 0 and amountInr > 0.',
  },
  {
    id: 'DD-06',
    name: 'Self-Verified UPI Deposit Bypass',
    collection: 'deposits',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'User deposit creation enforces status == "GATEWAY_PENDING" and webhookVerified == false.',
  },
  {
    id: 'DD-07',
    name: 'Self-Paid Withdrawal Status Jump',
    collection: 'withdrawals',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    rationale: 'Only isAdmin() can update withdrawal status.',
  },
  {
    id: 'DD-08',
    name: 'Duplicate Withdrawal Bypass',
    collection: 'wallets',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    rationale: 'User lock action requires existing().hasPendingWithdrawal == false.',
  },
  {
    id: 'DD-09',
    name: 'Shadow Ghost Field Injection',
    collection: 'users',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'All validation helpers enforce keys().hasOnly(...) strict allowlists.',
  },
  {
    id: 'DD-10',
    name: 'Document ID Poisoning',
    collection: 'supportTickets',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'isValidId enforces ^[a-zA-Z0-9_-]+$ and <= 128 chars on every doc path.',
  },
  {
    id: 'DD-11',
    name: 'Cross-User PII List Scrape',
    collection: 'users',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    rationale: 'allow list requires resource.data.uid == request.auth.uid or isAdmin().',
  },
  {
    id: 'DD-12',
    name: 'Unverified Email Admin Spoof',
    collection: 'plans',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'isBootstrapAdmin requires request.auth.token.email_verified == true.',
  },
];
