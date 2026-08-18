
import amqp from 'amqplib';
async function test() {
    const conn = await amqp.connect('amqp://localhost');
    const ch = await conn.createChannel();
    await ch.assertExchange('pharmaflow.logs', 'fanout', { durable: true });
    for (let i=0; i<10; i++) {
        ch.publish('pharmaflow.logs', '', Buffer.from(JSON.stringify({ message: 'Hello from scratch ' + i, service: 'scratch' })));
    }
    console.log('Published 10 messages!');
    setTimeout(() => process.exit(0), 500);
}
test();

