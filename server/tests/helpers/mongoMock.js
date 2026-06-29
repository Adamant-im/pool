function matchesQuery(document, query = {}) {
  return Object.entries(query).every(([key, value]) => document[key] === value);
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
      return {
        toArray: async () => this.data.filter((document) => matchesQuery(document, query)),
      };
    },

    async insertOne(document) {
      this.data.push({ ...document });

      return { acknowledged: true, insertedId: document.id ?? document.address };
    },

    async updateOne(query, update) {
      const document = await this.findOne(query);

      if (!document) {
        return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
      }

      Object.assign(document, update.$set ?? {});

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
