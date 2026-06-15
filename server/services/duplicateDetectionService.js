export function findPossibleDuplicates(transaction, existingTransactions = []) {
  return existingTransactions.filter((existingTransaction) => {
    return (
      existingTransaction.amount === transaction.amount &&
      existingTransaction.date === transaction.date
    );
  });
}
