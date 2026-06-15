import { Router } from 'express';
import { createAccount, deleteAccount, getAccounts, updateAccount } from '../controllers/accountsController.js';

const router = Router();

router.get('/', getAccounts);
router.post('/', createAccount);
router.put('/:id', updateAccount);
router.delete('/:id', deleteAccount);

export default router;
