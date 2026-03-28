import { LoanStatus } from '../lib/db.js';

/** User cannot take another loan while one of these is in progress */
export const BLOCKING_LOAN_STATUSES = [
  LoanStatus.pending,
  LoanStatus.approved,
  LoanStatus.disbursed,
  LoanStatus.delivered,
];

export async function hasBlockingLoan(prisma, userId) {
  const n = await prisma.loan.count({
    where: {
      userId,
      status: { in: BLOCKING_LOAN_STATUSES },
    },
  });
  return n > 0;
}

export function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}
