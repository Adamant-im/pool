function matchesField(actual, condition) {
  if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
    return Object.entries(condition).every(([operator, value]) => {
      switch (operator) {
        case '$gte': return actual >= value;
        case '$gt': return actual > value;
        case '$lte': return actual <= value;
        case '$lt': return actual < value;
        case '$ne': return actual !== value;
        default: return actual === value;
      }
    });
  }

  return actual === condition;
}

function matchesQuery(document, query = {}) {
  return Object.entries(query).every(([key, condition]) => matchesField(document[key], condition));
}

function createCursor(documents) {
  let result = documents;

  const cursor = {
    sort(spec) {
      const [field, direction] = Object.entries(spec)[0];

      result = [...result].sort((a, b) => (a[field] - b[field]) * direction);

      return cursor;
    },
    limit(count) {
      result = result.slice(0, count);

      return cursor;
    },
    async toArray() {
      return result;
    },
  };

  return cursor;
}

function createCollection() {
  const collection = {
    data: [],

    reset() {
      this.data = [];
    },

    async createIndex() {},

    async findOne(query) {
      return this.data.find((document) => matchesQuery(document, query));
    },

    find(query = {}) {
      return createCursor(this.data.filter((document) => matchesQuery(document, query)));
    },

    async insertOne(document) {
      this.data.push({ ...document });

      return { acknowledged: true, insertedId: document.id ?? document.address };
    },

    async updateOne(query, update, options = {}) {
      let document = await this.findOne(query);

      if (!document) {
        if (options.upsert) {
          document = {
            ...query,
            ...(update.$setOnInsert ?? {}),
            ...(update.$set ?? {}),
          };

          this.data.push(document);

          return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
        }

        return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
      }

      Object.assign(document, update.$set ?? {});

      for (const [key, value] of Object.entries(update.$inc ?? {})) {
        document[key] = (document[key] ?? 0) + value;
      }

      for (const [key, value] of Object.entries(update.$addToSet ?? {})) {
        if (!Array.isArray(document[key])) {
          document[key] = [];
        }
        if (!document[key].includes(value)) {
          document[key].push(value);
        }
      }

      return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
    },
  };

  return collection;
}

const mongoMock = {
  blocksCollection: createCollection(),
  transactionsCollection: createCollection(),
  votersCollection: createCollection(),

  resetAll() {
    this.blocksCollection.reset();
    this.transactionsCollection.reset();
    this.votersCollection.reset();
  },
};

export default mongoMock;
