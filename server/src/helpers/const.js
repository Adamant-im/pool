export const UPDATE_BLOCKS_INTERVAL = 60 * 1000; // get new blocks every minute
export const UPDATE_DELEGATE_INTERVAL = 3 * 60 * 1000; // update delegate info; balance and voters every 3 minutes
export const RETRY_WHEN_UPDATING_VOTERS_TIMEOUT = 10 * 1000; // if a pool is updating voters; postpone distributing rewards for 10 seconds
export const RETRY_PAYOUTS_TIMEOUT = 10 * 60 * 1000; // if not all of payouts processed; re-try in 10 minutes. Next re-try it will be RETRY_PAYOUTS_TIMEOUT * retryNo
export const RETRY_PAYOUTS_COUNT = 3; // re-tries for payouts. Total tries RETRY_PAYOUTS_COUNT + 1;
export const UPDATE_AFTER_PAYMENT_DELAY = 60 * 1000; // Wait 1 minute to update pool's balance and notify
export const SAT = 100000000; // 1 ADM = 100000000
export const DEVIATION = 100000; // consider balance is zero when it is lower; then 0.001 ADM
export const FEE = 0.5; // Transfer (Type 0) Tx fee;
export const MIN_PAYOUT = 0.51; // check minpayout in config to be not less; than 0.51 ADM;
export const EPOCH = Date.UTC(2017, 8, 2, 17, 0, 0, 0); // ADAMANT's epoch time
export const FORMAT_PAYOUT ='yyyy-MM-dd';
