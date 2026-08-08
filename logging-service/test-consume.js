
import amqp from 'amqplib';
async function test() {
    const conn = await amqp.connect('amqp://localhost');
    const ch = await conn.createChannel();
    console.log('Checking queue...');
    const q = await ch.checkQueue('logs');
    console.log('Queue stats:', q);
    process.exit(0);
}
test();

