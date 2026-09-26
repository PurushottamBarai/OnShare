export async function setupWorkerContext({ browser, context, request }, testInfo) {
  const workerIndex = testInfo != null ? String(testInfo.workerIndex) : (process.env.TEST_WORKER_INDEX || '0');
  process.env.TEST_WORKER_INDEX = workerIndex;

  if (context) {
    try {
      await context.addInitScript((idx) => {
        window.__TEST_WORKER_INDEX__ = idx;
        try {
          localStorage.setItem('onshare-consent', 'accepted');
        } catch {
          // Ignore localStorage access errors
        }
      }, workerIndex);
    } catch {
      // Ignore init script failure
    }
  }
  if (browser && !browser.__workerWrapped) {
    browser.__workerWrapped = true;
    const originalNewContext = browser.newContext.bind(browser);
    browser.newContext = async (options = {}) => {
      const currentWorkerIndex = process.env.TEST_WORKER_INDEX || '0';
      const merged = {
        ...options,
        extraHTTPHeaders: {
          ...options.extraHTTPHeaders,
          'x-test-worker-index': currentWorkerIndex,
        },
      };
      const ctx = await originalNewContext(merged);
      await ctx.addInitScript((idx) => {
        window.__TEST_WORKER_INDEX__ = idx;
        try {
          localStorage.setItem('onshare-consent', 'accepted');
        } catch {
          // Ignore localStorage access errors
        }
      }, currentWorkerIndex);
      return ctx;
    };
  }
  if (request) {
    try {
      await request.get(`http://127.0.0.1:8787/test/reset-limiter?workerIndex=${workerIndex}`);
    } catch {
      // Ignore network failure when resetting limiter
    }
  }
}
