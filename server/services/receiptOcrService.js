export async function parseReceiptImage(file) {
  return {
    fileName: file?.originalname || null,
    items: [],
    total: null
  };
}
