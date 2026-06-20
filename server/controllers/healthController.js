export function getHealth(req, res) {
  res.json({
    name: 'Jejak Dana API',
    status: 'ok',
    timestamp: new Date().toISOString()
  });
}
