
import amqp from 'amqplib';
async function test() {
    const conn = await amqp.connect('amqp://localhost');
    const ch = await conn.createChannel();
    await ch.assertExchange('pharmaflow.logs', 'fanout', { durable: true });
    ch.publish('pharmaflow.logs', '', Buffer.from(JSON.stringify({ message: 'Hello from scratch', service: 'scratch' })));
    console.log('Published!');
    setTimeout(() => process.exit(0), 500);
}
test();

