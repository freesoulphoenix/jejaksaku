import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import accountsRoutes from './accountsRoutes.js';
import categoriesRoutes from './categoriesRoutes.js';
import projectTagsRoutes from './projectTagsRoutes.js';
import transactionsRoutes from './transactionsRoutes.js';
import upcomingDueRoutes from './upcomingDueRoutes.js';
import { attachUserScope } from '../middleware/userScopeMiddleware.js';

const router = Router();

router.use('/health', healthRoutes);
router.use(attachUserScope);
router.use('/accounts', accountsRoutes);
router.use('/categories', categoriesRoutes);
router.use('/project-tags', projectTagsRoutes);
router.use('/transactions', transactionsRoutes);
router.use('/upcoming-due', upcomingDueRoutes);

export default router;
