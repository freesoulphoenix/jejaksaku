import { Router } from 'express';
import { createUpcomingDue, deleteUpcomingDue, getUpcomingDue, updateUpcomingDue } from '../controllers/upcomingDueController.js';

const router = Router();

router.get('/', getUpcomingDue);
router.post('/', createUpcomingDue);
router.put('/:id', updateUpcomingDue);
router.delete('/:id', deleteUpcomingDue);

export default router;
