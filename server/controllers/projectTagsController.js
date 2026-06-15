import { listRows } from '../services/coreDataService.js';

export async function getProjectTags(req, res, next) {
  try {
    const projectTags = await listRows('project_tags', req.userId);
    res.json(projectTags);
  } catch (error) {
    next(error);
  }
}
