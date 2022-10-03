const amqp = require('amqplib');
const apiv1 = require('express').Router();
const { initializeTwilioClient } = require('../utility');

apiv1.post('/create', async (req, res) => {
	const { roomSid } = req.body;
	console.log(`\nCreating Composition for ${roomSid}`);
	const client = initializeTwilioClient();

	const composition = await client.video.v1.compositions.create({
		audioSources: ['*'],
		videoLayout: {
			grid: {
				video_sources: ['*'],
			},
		},
		format: 'mp4',
		roomSid: roomSid,
		statusCallback: 'https://composition-callback-fn-4192-dev.twil.io/composition/status-callback',
		statusCallbackMethod: 'POST',
	});

	res.json({ compositionSid: composition.sid, status: composition.status });
});

apiv1.post('/process', async (req, res) => {
	const { compositionSid } = req.body;
	let channel, connection;

	try {
		connection = await amqp.connect(process.env.AMQP_URL + '?heartbeat=60');
		channel = await connection.createChannel();

		await channel.assertQueue('decryptionQueue');
	} catch (error) {
		console.error(error);
	}
	channel.sendToQueue('decryptionQueue', Buffer.from(JSON.stringify({ compositionSid })));
	await channel.close();
	await connection.close();
	res.json({ compositionSid, status: `processing` });
});

module.exports = apiv1;
