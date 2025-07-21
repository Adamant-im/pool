const baseURL = import.meta.env.VITE_BASE_URL;

export const request = async (methodName) => {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const response = await fetch(`${baseURL}/${methodName}`, { signal: controller.signal });

  const json = await response.json();

  clearTimeout(timeoutId);

  return json;
};

export function getAll() {
  return Promise.all([
    request('voters'),
    request('transactions'),
    request('delegate'),
    request('config'),
  ]);
}
