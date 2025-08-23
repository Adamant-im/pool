/**
 * Unused due to migration from LowDB to MongoDB
 */

import * as process from 'node:process';
import log from '../../helpers/log.js';

const getFilter = (query = {}) => {
  const queryType = typeof query;

  if (queryType === 'function') {
    return query;
  } else if (queryType === 'object') {
    return (val) => {
      for (const property in query) {
        if (Object.hasOwnProperty.call(query, property)) {
          if (val[property] !== query[property]) {
            return false;
          }
        }
      }
      return true;
    };
  } else {
    throw new Error(`query should be a function or object, but got a ${queryType}`);
  }
};

export default async (db, updateInterval) => {
  await db.read();

  db.insert = async function(data) {
    try {
      if (!db.data?.values) {
        db.data = { values: [] };
      }

      db.data.values.push(data);

      await db.write();

      return data;
    } catch (error) {
      log.warn(error);

      return false;
    }
  };

  db.find = async function(query) {
    try {
      await db.read();
      const filter = getFilter(query);

      if (!db.data) {
        return [];
      }

      return db.data.values.filter(filter);
    } catch (error) {
      log.warn(error);

      return false;
    }
  };

  db.findOne = async function(query) {
    try {
      const filter = getFilter(query);

      if (!db.data) {
        return;
      }

      return db.data.values.find(filter);
    } catch (error) {
      log.warn(error);

      return false;
    }
  };

  db.update = async function(query, data) {
    try {
      const filter = getFilter(query);

      if (!db.data) {
        return;
      }

      const { values } = db.data;

      const index = values.findIndex(filter);

      if (index === -1) {
        return false;
      }

      values[index] = {
        ...values[index],
        ...data,
      };

      await db.write();

      return values[index];
    } catch (error) {
      log.warn(error);

      return false;
    }
  };

  if (updateInterval && process.env.NODE_ENV !== 'test') {
    setInterval(async () => await db.write(), updateInterval);
  }

  return db;
};
