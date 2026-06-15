export function attachUserScope(req, res, next) {
  req.userId = req.header('x-user-id') || null;
  next();
}
