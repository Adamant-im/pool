const baseURL = import.meta.env.VITE_BASE_URL;

export const request = (methodName) => {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const response = fetch(`${baseURL}/${methodName}`, {
    signal: controller.signal,
  }).then((res) => res.json());

  clearTimeout(timeoutId);

  return response;
};

export function getAll() {
  return Promise.all([
    request('get-voters'),
    request('get-transactions'),
    request('get-delegate'),
    request('get-config'),
  ]);
}
