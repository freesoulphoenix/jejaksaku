import { createRow, deleteRow, listRows, updateRow } from '../services/coreDataService.js';

const tableName = 'transactions';

export async function getTransactions(req, res, next) {
  try {
    const transactions = await listRows(tableName, req.userId);
    res.json(transactions);
  } catch (error) {
    next(error);
  }
}

export async function createTransaction(req, res, next) {
  try {
    const transaction = await createRow(tableName, req.userId, req.body);
    res.status(201).json(transaction);
  } catch (error) {
    next(error);
  }
}

export async function updateTransaction(req, res, next) {
  try {
    const transaction = await updateRow(tableName, req.userId, req.params.id, req.body);
    res.json(transaction);
  } catch (error) {
    next(error);
  }
}

export async function deleteTransaction(req, res, next) {
  try {
    await deleteRow(tableName, req.userId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
