// api-gateway/index.js
const express = require('express');
const amqp = require('amqplib');
const NodeCache = require('node-cache');
const { sendRpcMessage, generateUuid } = require('../rabbitmqUtils');

const app = express();
const port = 3000;
app.use(express.json())

let channel;
const authCache = new NodeCache({ stdTTL: 60 }); // Cache for 60 seconds

const mqConfig = {
    protocol: 'amqp',
    hostname: 'localhost',
    username: 'admin',
    password: 'admin',
    port: 5672,
    vhost: '/mycustomvhost',
}

// Connect to RabbitMQ
amqp.connect(mqConfig)
    .then(conn => conn.createChannel())
    .then(ch => {
        channel = ch;
        console.log('Connected to RabbitMQ');
    })
    .catch(error => console.error('Failed to connect to RabbitMQ:', error));

// Route to account service
app.use('/accounts', async (req, res) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const corr = generateUuid();
        const q = await channel.assertQueue('', { exclusive: true });

        // Validate token with Auth Server
        let authResponse = await sendRpcMessage(
            'is_logged_in_queue',
            { token, action: 'GET_ACCOUNTS' },
            corr,
            q.queue,
            channel
        );

        if (authResponse.valid) {
            authCache.set(token, authResponse);
        }

        if (!authResponse.valid) {
            return res.status(401).json(authResponse);
        }

        // Proceed to Account Service
        const corrs = generateUuid();
        const qs = await channel.assertQueue('', { exclusive: true });
        const accountResponse = await sendRpcMessage(
            'account_service_queue',
            { userId: authResponse.user.id, action: 'GET_ACCOUNTS' },
            corrs,
            qs.queue,
            channel
        );

        res.json(accountResponse);
    } catch (error) {
        res.status(500).json({ message: 'Error communicating with services', error: error.message });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const corr = generateUuid();
    const q = await channel.assertQueue('', { exclusive: true });
    const authResponse = await sendRpcMessage(
        'auth_service_login_queue',
        { email, password, action: 'LOGIN_ACCOUNTS' },
        corr,
        q.queue,
        channel
    );
    console.log('response', authResponse)
    res.json(authResponse);
});

app.listen(port, () => {
    console.log(`API Gateway listening at http://localhost:${port}`);
});
