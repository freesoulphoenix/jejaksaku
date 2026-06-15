import { Router } from 'express';
import { getProjectTags } from '../controllers/projectTagsController.js';

const router = Router();

router.get('/', getProjectTags);

export default router;
