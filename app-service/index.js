const express = require('express');
const amqp = require('amqplib');
const { sendRpcMessage, generateUuid } = require('../rabbitmqUtils');

const app = express();
const port = 3002;


const mqConfig = {
    protocol: 'amqp',
    hostname: 'localhost',
    username: 'admin',
    password: 'admin',
    port: 5672,
    vhost: '/mycustomvhost',
}
let channel;

// Connect to RabbitMQ
amqp.connect(mqConfig)
    .then(conn => conn.createChannel())
    .then(ch => {
        channel = ch;
        console.log('Connected to RabbitMQ');
        channel.assertQueue('account_service_queue');
        channel.consume('account_service_queue', async msg => {
            const { userId, action } = JSON.parse(msg.content.toString());
            let response;

            // Example action: GET_ACCOUNTS
            if (action === 'GET_ACCOUNTS') {
                // Simulate fetching account details
                // Replace this with actual logic to fetch account details from database or external service
                const accounts = [{ id: 1, name: 'Account 1' }, { id: 2, name: 'Account 2' }];

                // Simulate processing time
                await new Promise(resolve => setTimeout(resolve, 1000));

                response = accounts.filter(account => account.userId === userId);
            } else {
                response = { error: 'Invalid action' };
            }

            channel.sendToQueue(msg.properties.replyTo, Buffer.from(JSON.stringify(response)), {
                correlationId: msg.properties.correlationId
            });

            channel.ack(msg);
        });
    })
    .catch(error => console.error('Failed to connect to RabbitMQ:', error));

app.listen(port, () => {
    console.log(`Account Service listening at http://localhost:${port}`);
});
