export async function parseStatement(file) {
  return {
    fileName: file?.originalname || null,
    rows: []
  };
}
