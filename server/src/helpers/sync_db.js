const getFilter = (query = {}) => {
  const queryType = typeof query;

  if (queryType === 'function') {
    return query;
  } else if (queryType === 'object') {
    const filter = (val) => {
      for (const property in query) {
        if (Object.hasOwnProperty.call(query, property)) {
          if (val[property] !== query[property]) {
            return false;
          }
        }
      }
      return true;
    };

    return filter;
  } else {
    throw new Error(`query should be a function or object, but got a ${queryType}`);
  }
};

export default (db, updateInterval) => {
  db.read();

  db.insert = async function(data) {
    try {
      if (!db.data?.values) {
        db.data = {values: []};
      }

      db.data.values.push(data);

      await db.write();

      return data;
    } catch (error) {
      return false;
    }
  };

  db.find = async function(query) {
    try {
      const filter = getFilter(query);

      if (!db.data) {
        return [];
      }

      const value = db.data.values.filter(filter);

      return value;
    } catch (error) {
      return false;
    }
  };

  db.findOne = async function(query) {
    try {
      const filter = getFilter(query);

      if (!db.data) {
        return;
      }

      const value = db.data.values.find(filter);

      return value;
    } catch (error) {
      return false;
    }
  };

  db.update = async function(query, data) {
    try {
      const filter = getFilter(query);

      if (!db.data) {
        return;
      }

      const {values} = db.data;

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
      return false;
    }
  };

  if (updateInterval && process.env.NODE_ENV !== 'test') {
    setInterval(() => db.write(), updateInterval);
  }

  return db;
};
