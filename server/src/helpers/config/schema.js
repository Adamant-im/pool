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
  },
  silent_mode: {
    type: Boolean,
    default: false,
  },
};
