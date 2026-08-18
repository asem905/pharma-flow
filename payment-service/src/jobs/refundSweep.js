import cron from "node-cron";
import paymentModel from "../model/paymentModel.js";
import { reverseBudget } from "../grpc/authGrpcClient.js";

// Cron expression: every 5 minutes at wall-clock boundaries (0, 5, 10 ... minutes past the hour)
const CRON_EXPRESSION = "*/5 * * * *";
const OLDER_THAN_MINUTES = 5;
const MAX_ATTEMPTS = 5;

// Guard against overlapping runs — if the previous sweep is still in-flight
// when the next tick fires, skip rather than pile up concurrent DB+RPC calls.
let sweepRunning = false;

async function retryPendingRefunds() {
    if (sweepRunning) {
        console.warn("[RefundSweep] Previous run still in-flight — skipping this tick");
        return;
    }

    sweepRunning = true;

    try {
        // getPendingRefunds returns PaymentFailure rows with their parent Payment included
        const stale = await paymentModel.getPendingRefunds({
            olderThanMinutes: OLDER_THAN_MINUTES,
            maxAttempts: MAX_ATTEMPTS,
        });

        if (stale.length === 0) return;

        console.log(`[RefundSweep] Found ${stale.length} pending refund(s) to retry`);

        for (const failure of stale) {
            const { payment } = failure;
            const refund_key = `refund:${payment.orderId}:${payment.userId}:${failure.originalIdempotencyKey}`;

            try {
                const refund = await reverseBudget({
                    user_id: payment.userId,
                    amount: parseFloat(failure.refundAmount),
                    refund_key,
                });
                console.log("refund========", refund);
                if (refund.success) {
                    await paymentModel.markRefundResolved(failure.id);
                    console.log(`[RefundSweep] ✔ Resolved | failureId=${failure.id} | userId=${payment.userId}`);
                } else {
                    await paymentModel.incrementRefundAttempt(failure.id);
                    console.warn(`[RefundSweep] ✖ RPC returned failure | failureId=${failure.id}`);
                }
            } catch (err) {
                await paymentModel.incrementRefundAttempt(failure.id);
                console.error(`[RefundSweep] ✖ RPC threw | failureId=${failure.id}:`, err.message);
            }
        }

        // Alert on rows that hit the cap — these need human intervention.
        const exhausted = await paymentModel.getPendingRefunds({
            olderThanMinutes: 0,
            maxAttempts: MAX_ATTEMPTS + 1,
        });
        if (exhausted.length > 0) {
            console.error(
                `[RefundSweep] ⚠ ${exhausted.length} refund(s) exhausted retry limit — manual intervention required:`,
                exhausted.map(f => f.id)
            );
        }
    } finally {
        sweepRunning = false;
    }
}

export function startRefundSweep() {
    cron.schedule(CRON_EXPRESSION, () => {
        retryPendingRefunds().catch(err =>
            console.error("[RefundSweep] Unhandled error during sweep:", err.message)
        );
    });

    console.log(`[RefundSweep] Scheduled — cron: "${CRON_EXPRESSION}" (every 5 min, wall-clock aligned)`);
}
