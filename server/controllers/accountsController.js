import { createRow, deleteRow, listRows, updateRow } from '../services/coreDataService.js';

const tableName = 'accounts';

export async function getAccounts(req, res, next) {
  try {
    const accounts = await listRows(tableName, req.userId);
    res.json(accounts);
  } catch (error) {
    next(error);
  }
}

export async function createAccount(req, res, next) {
  try {
    const account = await createRow(tableName, req.userId, req.body);
    res.status(201).json(account);
  } catch (error) {
    next(error);
  }
}

export async function updateAccount(req, res, next) {
  try {
    const account = await updateRow(tableName, req.userId, req.params.id, req.body);
    res.json(account);
  } catch (error) {
    next(error);
  }
}

export async function deleteAccount(req, res, next) {
  try {
    await deleteRow(tableName, req.userId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
