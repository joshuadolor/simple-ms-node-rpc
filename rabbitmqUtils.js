// api-gateway/rabbitmqUtils.js
const amqp = require('amqplib');

async function sendRpcMessage(queue, message, correlationId, replyQueue, channel) {
    return new Promise((resolve, reject) => {
        channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
            correlationId: correlationId,
            replyTo: replyQueue
        });

        channel.consume(replyQueue, msg => {
            if (msg.properties.correlationId === correlationId) {
                console.log(msg.content.toString());
                resolve(JSON.parse(msg.content.toString()));
                channel.ack(msg);
            }
        }, { noAck: false });
    });
}

function generateUuid() {
    return Math.random().toString() + Math.random().toString() + Math.random().toString();
}

module.exports = { sendRpcMessage, generateUuid };
