import { listRows } from '../services/coreDataService.js';

export async function getCategories(req, res, next) {
  try {
    const categories = await listRows('categories', req.userId);
    res.json(categories);
  } catch (error) {
    next(error);
  }
}
