import {dbTrans as db} from '../../src/helpers/DB.js';

const accounts = [
  {
    id: 1,
    balance: 100,
  }, {
    id: 2,
    balance: 200,
  }, {
    id: 3,
    balance: 300,
  }, {
    id: 4,
    balance: 100,
  }, {
    id: 5,
    balance: 1000,
  },
];

const insertAccounts = () => {
  const promises = [];

  for (const account of accounts) {
    promises.push(db.insert(account));
  }

  return Promise.all(promises);
};

const clearDB = () => {
  db.data = {values: []};
  return db.write();
};

describe('db.insert', () => {
  beforeEach(clearDB);

  test('db.insert should insert one object', async () => {
    await db.insert({});

    expect(db.data.values.length).toBe(1);
  });

  test(`db.insert should insert ${accounts.length} objects`, async () => {
    await insertAccounts();

    expect(db.data.values.length).toBe(accounts.length);
  });

  test('db.insert should create data object if it doesn\' exist', async () => {
    db.data = undefined; // no data
    await db.write();

    await db.insert({});

    expect(db.data.values.length).toBe(1);
  });

  test('db.insert should create values array if it doesn\' exist', async () => {
    db.data = {}; // no values
    await db.write();

    await db.insert({});

    expect(db.data.values.length).toBe(1);
  });
});

describe('db.find', () => {
  beforeEach(clearDB);

  test('db.find on empty database should return []', async () => {
    const results = await db.find();

    expect(Array.isArray(results)).toBeTruthy();
    expect(results.length).toBe(0);
  });

  test('db.find called with function should find all objects', async () => {
    await insertAccounts();
    const results = await db.find((obj) => obj.balance >= 200);

    expect(Array.isArray(results)).toBeTruthy();
    expect(results.length).toBe(3);
    expect(results).toContainEqual({balance: 200, id: 2});
    expect(results).toContainEqual({balance: 300, id: 3});
    expect(results).toContainEqual({balance: 1000, id: 5});
  });

  test('db.find called with query object should find all objects', async () => {
    await insertAccounts();
    const results = await db.find({balance: 100});

    expect(Array.isArray(results)).toBeTruthy();
    expect(results.length).toBe(2);
    expect(results).toContainEqual({balance: 100, id: 1});
    expect(results).toContainEqual({balance: 100, id: 4});
  });

  test('db.find called with a string should throw error', () => {
    return expect(db.find('a string')).resolves.toBe(false);
  });

  test('db.find called with a number should throw error', () => {
    return expect(db.find(69)).resolves.toBe(false);
  });
});

describe('db.findOne', () => {
  beforeEach(clearDB);

  test('db.findOne on empty database should return undefined', async () => {
    const result = await db.findOne();

    expect(result).toBeFalsy();
  });

  test('db.findOne called with function should find first object', async () => {
    await insertAccounts();
    const result = await db.findOne((obj) => obj.balance >= 200);

    expect(result).toEqual({balance: 200, id: 2});
  });

  test('db.findOne called with query object should find first object', async () => {
    await insertAccounts();
    const result = await db.findOne({balance: 100});

    expect(result).toEqual({balance: 100, id: 1});
  });

  test('db.findOne called with a string should return false', () => {
    return expect(db.findOne('a string')).resolves.toBe(false);
  });

  test('db.findOne called with a number should return false', () => {
    return expect(db.findOne(69)).resolves.toBe(false);
  });
});

describe('db.update', () => {
  beforeEach(clearDB);

  test('db.update on empty database should return undefined', async () => {
    const result = await db.update({}, {});

    expect(result).toBeFalsy();
  });

  test('db.update called with function should update first object', async () => {
    await insertAccounts();
    const result = await db.update((obj) => obj.id === 2, {balance: 100});
    const dbItem = await db.findOne({id: 2});

    expect(result).toEqual({balance: 100, id: 2});
    expect(dbItem).toEqual({balance: 100, id: 2});
  });

  test('db.update called with query object should update first object', async () => {
    await insertAccounts();
    const result = await db.update({id: 1}, {balance: 400});
    const dbItem = await db.findOne({id: 1});

    expect(result).toEqual({balance: 400, id: 1});
    expect(dbItem).toEqual({balance: 400, id: 1});
  });
});
