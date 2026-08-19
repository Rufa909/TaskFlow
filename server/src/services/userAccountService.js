const pool = require('../config/db');

let deletedAtColumnReady;
let lockedAtColumnReady;

const ensureUserDeletedAtColumn = async () => {
  if (!deletedAtColumnReady) {
    deletedAtColumnReady = (async () => {
      const connection = await pool.getConnection();
      try {
        await connection.query("SELECT GET_LOCK('taskflow_users_deleted_at_column', 10)");
        const [columns] = await connection.query("SHOW COLUMNS FROM users WHERE Field = 'deleted_at'");
        if (columns.length === 0) {
          try {
            await connection.query('ALTER TABLE users ADD COLUMN deleted_at DATETIME NULL');
          } catch (err) {
            if (err.code !== 'ER_DUP_FIELDNAME' && err.errno !== 1060) throw err;
          }
        }
      } finally {
        await connection.query("SELECT RELEASE_LOCK('taskflow_users_deleted_at_column')").catch(() => {});
        connection.release();
      }
    })().catch((err) => {
      deletedAtColumnReady = null;
      throw err;
    });
  }

  return deletedAtColumnReady;
};

const ensureUserLockedAtColumn = async () => {
  if (!lockedAtColumnReady) {
    lockedAtColumnReady = (async () => {
      const connection = await pool.getConnection();
      try {
        await connection.query("SELECT GET_LOCK('taskflow_users_locked_at_column', 10)");
        const [columns] = await connection.query("SHOW COLUMNS FROM users WHERE Field = 'locked_at'");
        if (columns.length === 0) {
          try {
            await connection.query('ALTER TABLE users ADD COLUMN locked_at DATETIME NULL');
          } catch (err) {
            if (err.code !== 'ER_DUP_FIELDNAME' && err.errno !== 1060) throw err;
          }
        }
      } finally {
        await connection.query("SELECT RELEASE_LOCK('taskflow_users_locked_at_column')").catch(() => {});
        connection.release();
      }
    })().catch((err) => {
      lockedAtColumnReady = null;
      throw err;
    });
  }

  return lockedAtColumnReady;
};

module.exports = { ensureUserDeletedAtColumn, ensureUserLockedAtColumn };
