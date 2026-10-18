export function detectStatementDateColumns(headers) {
  const values = headers.map((value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, ''));
  const find = (names) => {
    const exact = values.findIndex((value) => names.includes(value));
    return exact >= 0 ? exact : values.findIndex((value) => names.some((name) => value.startsWith(name)));
  };
  const purchase = find(['transactiondate', 'purchasedate', 'tanggaltransaksi', 'tgltransaksi']);
  const generic = find(['date', 'tanggal', 'tgl', 'waktu']);
  const posting = find(['postingdate', 'posteddate', 'valuedate', 'tanggalposting', 'tanggalpembukuan']);
  return { date: purchase >= 0 ? purchase : generic >= 0 ? generic : posting, posting };
}
