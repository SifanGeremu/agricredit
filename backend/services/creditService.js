import { LoanStatus } from '../lib/db.js';

/**
 * Credit rules at loan request time:
 * - < 50  → rejected
 * - 50–70 → pending (needs admin)
 * - > 70  → approved (pre-approved by score; admin still disburses funds)
 */
export function loanStatusFromCreditScore(score) {
  if (score < 50) return LoanStatus.rejected;
  if (score <= 70) return LoanStatus.pending;
  return LoanStatus.approved;
}

export function rejectionReasonForLowScore(score) {
  if (score < 50) {
    return 'Credit score below minimum threshold (50).';
  }
  return null;
}

/** +20 after successful full repayment (call from repayment flow) */
export async function increaseCreditAfterRepayment(prisma, userId, increment = 20) {
  await prisma.user.update({
    where: { id: userId },
    data: { creditScore: { increment } },
  });
}
