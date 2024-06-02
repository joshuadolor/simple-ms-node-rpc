const express = require('express');
const jwt = require('jsonwebtoken');
const amqp = require('amqplib');

const app = express();
const port = 3001;
const secretKey = 'your_secret_key';

const mqConfig = {
    protocol: 'amqp',
    hostname: 'localhost',
    username: 'admin',
    password: 'admin',
    port: 5672,
    vhost: '/mycustomvhost',
}
let channel;

const users = [
    { id: 1, email: 'user@example.com', password: 'password123', name: 'User 1' },
    { id: 2, email: 'admin@example.com', password: 'admin123', name: 'Admin' }
];

amqp.connect(mqConfig)
    .then(conn => conn.createChannel())
    .then(ch => {
        channel = ch;
        console.log('Connected to RabbitMQ');


        channel.assertQueue('is_logged_in_queue');
        channel.consume('is_logged_in_queue', msg => {
            const { token } = JSON.parse(msg.content.toString());
            let response;

            try {
                const decoded = jwt.verify(token, secretKey);
                response = { valid: true, user: decoded };
            } catch (error) {
                response = { valid: false };
            }

            channel.sendToQueue(msg.properties.replyTo, Buffer.from(JSON.stringify(response)), {
                correlationId: msg.properties.correlationId
            });
            console.log('is_logged_in_queue')
            channel.ack(msg);
        });

        channel.assertQueue('auth_service_login_queue');
        channel.consume('auth_service_login_queue', msg => {
            const { email, password } = JSON.parse(msg.content.toString());

            // Find user by email
            const user = users.find(user => user.email === email);

            // Check if user exists and password matches
            if (!user || user.password !== password) {
                // If authentication fails, send back a response with token=null
                channel.sendToQueue(msg.properties.replyTo, Buffer.from(JSON.stringify({ token: null })), {
                    correlationId: msg.properties.correlationId
                });
            } else {
                // If authentication succeeds, generate JWT token
                const token = jwt.sign({ userId: user.id, email: user.email }, secretKey);

                // Send back the token in the response
                channel.sendToQueue(msg.properties.replyTo, Buffer.from(JSON.stringify({ token })), {
                    correlationId: msg.properties.correlationId
                });
            }

            console.log('xx')
            channel.ack(msg);
        });

    })
    .catch(error => console.error('Failed to connect to RabbitMQ:', error));

app.listen(port, () => {
    console.log(`Auth Server listening at http://localhost:${port}`);
});
