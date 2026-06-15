export function getHealth(req, res) {
  res.json({
    name: 'Dompet Daily API',
    status: 'ok',
    timestamp: new Date().toISOString()
  });
}
