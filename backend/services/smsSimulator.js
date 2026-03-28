/**
 * Console-based SMS simulation for hackathon demos (no real SMS).
 */
export function smsLoanApproved(farmerPhone, amount) {
  console.log(
    `[SMS → ${farmerPhone}] AgriCredit: Your loan of KES ${amount} has been approved. Select a vendor to proceed.`,
  );
}

export function smsLoanDisbursed(vendorPhone, amount, farmerName) {
  console.log(
    `[SMS → ${vendorPhone}] AgriCredit: KES ${amount} sent for inputs to fulfill loan for farmer ${farmerName}.`,
  );
}

export function smsLoanRepaid(farmerPhone, amount) {
  console.log(
    `[SMS → ${farmerPhone}] AgriCredit: Thank you! Repayment of KES ${amount} received. Your credit score has improved.`,
  );
}
