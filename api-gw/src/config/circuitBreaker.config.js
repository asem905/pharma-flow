export const circuitBreakerOptions = {
    timeout: Number(process.env.CB_TIMEOUT),
    errorThresholdPercentage: Number(process.env.CB_ERROR_THRESHOLD),
    resetTimeout: Number(process.env.CB_RESET_TIMEOUT),

    // errorFilter: if this returns TRUE the error is IGNORED by the breaker (not counted as a failure).
    // 4xx responses = valid business errors (conflict, not found, bad request) — the service IS healthy.
    // Network errors or 5xx = infrastructure failure → return false → count as failure → open circuit.
    errorFilter: (err) => Boolean(err.response && err.response.status < 500),
};
