import { Router } from 'express';
import { createTransaction, deleteTransaction, getTransactions, updateTransaction } from '../controllers/transactionsController.js';

const router = Router();

router.get('/', getTransactions);
router.post('/', createTransaction);
router.put('/:id', updateTransaction);
router.delete('/:id', deleteTransaction);

export default router;
