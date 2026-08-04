import amqplib from "amqplib";

let connection = null;
let channel = null;

export const EXCHANGE = "pharmaflow.events";

export async function connectRabbitMQ() {
    connection = await amqplib.connect(process.env.RABBITMQ_URL);

    process.on("SIGINT",  () => connection.close());
    process.on("SIGTERM", () => connection.close());

    channel = await connection.createChannel();

    // Declare same exchange — idempotent, both sides must agree on the config
    await channel.assertExchange(EXCHANGE, "topic", { durable: true });

    console.log("[RabbitMQ] Connected and exchange declared:", EXCHANGE);
    return channel;
}

export function getChannel() {
    if (!channel) throw new Error("[RabbitMQ] Channel not initialized — call connectRabbitMQ() first");
    return channel;
}
