module.exports = function(RED) {

    function PublishNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
		this.server = RED.nodes.getNode(config.server)

		function setStatus(type) {
			switch(type) {
			case 'connected':
				node.status({
					fill: 'green',
					shape: 'dot',
					text: 'connected'
				});
				break;
			case 'connecting':
				node.status({
					fill: 'yellow',
					shape: 'ring',
					text: 'connecting'
				});
				break;
			case 'disconnected':
				node.status({
					fill: 'red',
					shape: 'ring',
					text: 'disconnected'
				});
				break;
			}
		}

		setStatus('disconnected');

		// Initializing NATS JetStream client
		let nats = require('nats');
		let Client = require('./client');

		(async () => {

			if (!this.server) {
				setStatus('disconnected');
				return;
			}

			let client = new Client(this.server.getOpts());

			try {
				setStatus('connecting');

				node.log('Connecting to JetStream server:' + this.server.getOpts().server)

				// Connect to JetStream Cluster
				await client.connect()

				client.on('disconnect', () => {
					setStatus('disconnected');
				});

				client.on('reconnect', () => {
					setStatus('connecting');
				});
			} catch(e) {
				node.error(e);
				return;
			}

			setStatus('connected');

			node.on('input', async (msg, send, done) => {

				let subject = msg.subject || config.subject;
				if (!subject) {
					return done();
				}

				try {

					switch(config.payloadType) {
					case 'json':
						await client.publishJSON(subject, msg.payload);
						break;
					case 'string':
						await client.publishString(subject, msg.payload);
						break;
					default:
						await client.publish(subject, msg.payload);
					}

					done();
				} catch(e) {
					node.error(e);
				}
			});

			node.on('close', () => {
				client.disconnect();
			});

		})();
    }

    RED.nodes.registerType('NATS JetStream Publish', PublishNode, {
		credentials: {
		}
	});
}
