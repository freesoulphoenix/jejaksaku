import { createRow, deleteRow, listRows, updateRow } from '../services/coreDataService.js';

const tableName = 'upcoming_due';

export async function getUpcomingDue(req, res, next) {
  try {
    const upcomingDue = await listRows(tableName, req.userId);
    res.json(upcomingDue);
  } catch (error) {
    next(error);
  }
}

export async function createUpcomingDue(req, res, next) {
  try {
    const dueItem = await createRow(tableName, req.userId, req.body);
    res.status(201).json(dueItem);
  } catch (error) {
    next(error);
  }
}

export async function updateUpcomingDue(req, res, next) {
  try {
    const dueItem = await updateRow(tableName, req.userId, req.params.id, req.body);
    res.json(dueItem);
  } catch (error) {
    next(error);
  }
}

export async function deleteUpcomingDue(req, res, next) {
  try {
    await deleteRow(tableName, req.userId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
