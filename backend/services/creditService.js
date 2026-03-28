import { LoanStatus } from '../lib/db.js';

/**
 * New loan requests always start as pending until an admin approves.
 * Only critically low scores are auto-rejected.
 */
export function loanStatusFromCreditScore(score) {
  const s = Number(score) || 0;
  if (s < 38) return LoanStatus.rejected;
  return LoanStatus.pending;
}

export function rejectionReasonForLowScore(score) {
  const s = Number(score) || 0;
  if (s < 38) {
    return 'Credit score below minimum threshold (38).';
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
