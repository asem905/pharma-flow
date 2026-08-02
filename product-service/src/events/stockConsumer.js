import { getChannel, EXCHANGE } from "../config/rabbitmq.js";
import { prisma } from "../config/db.js";
import cacheService from "../service/cacheService.js";

const QUEUES = {
    stockRestore: "stock.restore",
    stockAdjust: "stock.adjust",
};

// Invalidate product cache after stock changes so reads reflect new values.
// Collects all affected keys + the list key and deletes in a SINGLE Redis call.
const invalidateProductCache = (productIds) => {
    const keys = [
        ...productIds.map((id) => `products:${id}`), // individual product caches
        "products:all",                               // list cache — deleted once
    ];
    cacheService.del(...keys)
        .catch((err) => console.error("[Consumer] Cache invalidation failed:", err));
};

export async function startStockConsumer() {
    const channel = getChannel();

    // Declare durable queues — survive broker restart
    await channel.assertQueue(QUEUES.stockRestore, { durable: true });
    await channel.assertQueue(QUEUES.stockAdjust, { durable: true });

    // Bind queues to exchange with routing key patterns
    // Both order.cancelled and order.deleted trigger a stock restore
    await channel.bindQueue(QUEUES.stockRestore, EXCHANGE, "order.cancelled");
    await channel.bindQueue(QUEUES.stockRestore, EXCHANGE, "order.deleted");
    await channel.bindQueue(QUEUES.stockAdjust, EXCHANGE, "order.item.updated");

    // Process one message at a time — prevents DB overload under high traffic
    channel.prefetch(1);

    //  Consumer: stock.restore
    // Triggered by: order.cancelled, order.deleted
    channel.consume(QUEUES.stockRestore, async (msg) => {
        if (!msg) return;
        try {
            const { orderItems, orderId } = JSON.parse(msg.content.toString());

            if (orderItems.length === 0) {
                channel.ack(msg);
                return;
            }

            // 1. Format your data into a string of values: (id1, qty1), (id2, qty2)
            const valuesString = orderItems
                .map(item => `('${item.productId}', ${item.quantity})`)
                .join(', ');

            // 2. Execute a single RAW SQL query
            await prisma.$executeRawUnsafe(`
                UPDATE "products" AS p
                SET stock = p.stock + v.quantity
                FROM (VALUES ${valuesString}) AS v(id, quantity)
                WHERE p.id = CAST(v.id AS text); 
            `);

            invalidateProductCache(orderItems.map((i) => i.productId));
            channel.ack(msg); // ✅ message processed — remove from queue
            console.log(`[Consumer] Stock restored for order ${orderId} (${orderItems.length} products)`);
        } catch (err) {
            console.error("[Consumer] stock.restore failed:", err.message, "— nacking message");
            // requeue=false: don't loop infinitely on a broken message
            // configure a dead-letter queue (DLQ) in production to catch these
            channel.nack(msg, false, false);
        }
    });

    //  Consumer: stock.adjust 
    // Triggered by: order.item.updated (qty decreased → return excess stock)
    channel.consume(QUEUES.stockAdjust, async (msg) => {
        if (!msg) return;
        try {
            const { stockAdjustments, orderId } = JSON.parse(msg.content.toString());

            if (stockAdjustments.length === 0) {
                channel.ack(msg);
                return;
            }
            console.log("==============1stockAdjustments", stockAdjustments.length);

            // 1. Format into VALUES clause for raw SQL
            const valuesString = stockAdjustments
                .map(item => `('${item.productId}', ${item.delta})`)
                .join(', ');
            console.log("==============2stockAdjustments", valuesString);
            // console.time("===================test raw query")
            // 2. Single atomic UPDATE with VALUES subquery causes to decrease latency much more
            await prisma.$executeRawUnsafe(`
                UPDATE "products" AS p
                SET stock = p.stock + v.delta
                FROM (VALUES ${valuesString}) AS v(id, delta)
                WHERE p.id = CAST(v.id AS text); 
            `);
            // await prisma.$transaction(async (tx) => {
            //     for (const { productId, delta } of stockAdjustments) {
            //         // delta is always positive here (qty returned to stock)
            //         await tx.product.update({
            //             where: { id: productId },
            //             data: { stock: { increment: delta } },
            //         });
            //     }
            // });
            // console.timeEnd("===================test raw query")

            invalidateProductCache(stockAdjustments.map((i) => i.productId));
            channel.ack(msg);
            console.log(`[Consumer] Stock adjusted for order ${orderId} (${stockAdjustments.length} products)`);
        } catch (err) {
            console.error("[Consumer] stock.adjust failed:", err.message, "— nacking message");
            channel.nack(msg, false, false);
        }
    });

    console.log("[RabbitMQ] Stock consumers ready on queues:", Object.values(QUEUES).join(", "));
}
