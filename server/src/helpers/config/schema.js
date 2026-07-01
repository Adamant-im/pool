export default {
  passPhrase: {
    type: String,
    isRequired: true,
  },
  node_ADM: {
    type: Array,
    isRequired: true,
  },
  reward_percentage: {
    type: Number,
    default: 80,
  },
  donate_percentage: {
    type: Number,
    default: 0,
  },
  minpayout: {
    type: Number,
    default: 10,
  },
  port: {
    type: Number,
    default: 36667,
  },
  payoutperiod: {
    type: String,
    default: '10d',
  },
  maintenancewallet: {
    type: String,
    default: '',
  },
  donatewallet: {
    type: String,
    default: '',
  },
  considerownvote: {
    type: Boolean,
    default: false,
  },
  adamant_notify: {
    type: String,
    default: null,
  },
  slack: {
    type: String,
    default: null,
  },
  log_level: {
    type: String,
    default: 'log',
    allowedValues: ['none', 'error', 'warn', 'info', 'log', 'debug'],
  },
  controlSocket: {
    type: String,
    default: null,
  },
  silent_mode: {
    type: Boolean,
    default: false,
  },
  cors: {
    type: Object,
    default: {
      origin: '*',
      // The API is public, read-only, and uses no cookies or auth, so credentialed
      // CORS is unnecessary. A wildcard origin combined with credentials is also an
      // invalid combination browsers refuse. Operators who need credentialed access
      // must set a specific origin together with credentials: true.
      credentials: false,
    },
  },
  mongodb: {
    type: Object,
    default: {
      uri: 'mongodb://localhost:27017',
      dbName: 'adamant-pool',
    },
  },
};
