/*
 * Copyright (c) 2016-2019, Jaguar0625, gimre, BloodyRookie, Tech Bureau, Corp.
 * Copyright (c) 2020-present, Jaguar0625, gimre, BloodyRookie.
 * All rights reserved.
 *
 * This file is part of Catapult.
 *
 * Catapult is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Catapult is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Catapult.  If not, see <http://www.gnu.org/licenses/>.
 */

const MessageChannelBuilder = require('../../src/connection/MessageChannelBuilder');
const { createZmqConnectionService } = require('../../src/connection/zmqService');
const test = require('../testUtils');
const catapult = require('catapult-sdk');
const { expect } = require('chai');
const { EventEmitter } = require('ws');
const zmq = require('zeromq');

const emitter = new EventEmitter();

describe('zmq service', () => {
	const cleanupActions = [];
	let subscriptions = {};
	afterEach(() => {
		// close zmq sockets used during the previous test
		while (0 < cleanupActions.length) {
			const action = cleanupActions.pop();
			action();
		}
	});

	const createDefaultZmqConnectionService = keys => {
		const zmqConfig = {
			host: '127.0.0.1', port: '3333', connectTimeout: 10, monitorInterval: 50
		};
		const zsocket = zmq.socket('sub');
		zsocket.connect(`tcp://${zmqConfig.host}:${zmqConfig.port}`);

		const channelDescriptors = new MessageChannelBuilder().build();
		const service = createZmqConnectionService(zsocket, subscriptions, channelDescriptors, test.createMockLogger());
		cleanupActions.push(() => {
			service.close(keys, emitter);
			subscriptions = {};
			zsocket.close();
		});
		return service;
	};

	const createRandomAddressString = () => catapult.model.address.addressToString(test.random.address());

	describe('invalid subscription', () => {
		const assertInvalidSubscription = (channel, error) => {
			// Arrange: notice that these tests should fail before creating a subscriber
			const service = createDefaultZmqConnectionService([channel]);

			// Assert:
			expect(() => service.on(channel, () => {}, emitter, subscriptions)).to.throw(error);
		};

		it('throws if category has no associated channel descriptor', () => {
			// Assert:
			assertInvalidSubscription('foo', 'unknown topic category foo');
		});

		it('throws if category filter cannot be created due to invalid param', () => {
			// Assert:
			assertInvalidSubscription('block/12345', 'unexpected param to block subscription');
		});
	});

	describe('valid subscriptions', () => {
		it('creates new socket for new topic', () => {
			// Arrange:
			const service = createDefaultZmqConnectionService(['block']);

			// Act:
			service.on('block', () => {}, emitter, subscriptions);

			// Assert:
			expect(service.listenerCount('block', emitter)).to.equal(1);
		});

		it('creates socket per topic', () => {
			// Arrange:
			const address = createRandomAddressString();
			const service = createDefaultZmqConnectionService(['block', `confirmedAdded/${address}`, `unconfirmedAdded/${address}`]);
			// Act:
			service.on('block', () => {}, emitter, subscriptions);
			service.on(`confirmedAdded/${address}`, () => {}, emitter, subscriptions);
			service.on(`unconfirmedAdded/${address}`, () => {}, emitter, subscriptions);

			// Assert:
			expect(service.listenerCount('block', emitter)).to.equal(1);
			expect(service.listenerCount(`confirmedAdded/${address}`, emitter)).to.equal(1);
			expect(service.listenerCount(`unconfirmedAdded/${address}`, emitter)).to.equal(1);
		});

		it('reuses socket for existing topic', () => {
			// Arrange:
			const service = createDefaultZmqConnectionService(['block']);

			// Act:
			for (let i = 0; 9 > i; ++i)
				service.on('block', () => {}, emitter, subscriptions);

			// Assert:
			expect(service.listenerCount('block', emitter)).to.equal(9);
		});
	});

	describe('remove all listeners', () => {
		it('removes all subscriptions for topic', () => {
			// Arrange:
			const address1 = createRandomAddressString();
			const address2 = createRandomAddressString();
			const service = createDefaultZmqConnectionService(['block', `confirmedAdded/${address1}`, `confirmedAdded/${address2}`]);
			// - add subscriptions
			service.on(`confirmedAdded/${address1}`, () => {}, emitter, subscriptions);
			service.on('block', () => {}, emitter, subscriptions);
			service.on(`confirmedAdded/${address1}.close`, () => {}, emitter, subscriptions);
			service.on(`confirmedAdded/${address1}`, () => {}, emitter, subscriptions);
			service.on(`confirmedAdded/${address2}`, () => {}, emitter, subscriptions);

			// Act:
			service.removeAllListeners(`confirmedAdded/${address1}`, emitter);

			// Assert:
			expect(service.listenerCount('block', emitter)).to.equal(1);
			expect(service.listenerCount(`confirmedAdded/${address1}`, emitter)).to.equal(0);
			expect(service.listenerCount(`confirmedAdded/${address1}.close`, emitter)).to.equal(0);
			expect(service.listenerCount(`confirmedAdded/${address2}`, emitter)).to.equal(1);
		});

		it('is idempotent', () => {
			// Arrange:
			const address = createRandomAddressString();
			const service = createDefaultZmqConnectionService(['block', `confirmedAdded/${address}`, `unconfirmedAdded/${address}`]);
			// - add subscriptions
			service.on(`confirmedAdded/${address}`, () => {}, emitter, subscriptions);
			service.on('block', () => {}, emitter, subscriptions);
			service.on(`confirmedAdded/${address}.close`, () => {}, emitter, subscriptions);
			service.on(`confirmedAdded/${address}`, () => {}, emitter, subscriptions);

			// Act:
			for (let i = 0; 9 > i; ++i)
				service.removeAllListeners(`confirmedAdded/${address}`, emitter);

			// Assert:
			expect(service.listenerCount('block', emitter)).to.equal(1);
			expect(service.listenerCount(`confirmedAdded/${address}`, emitter)).to.equal(0);
			expect(service.listenerCount(`confirmedAdded/${address}.close`, emitter)).to.equal(0);
		});

		it('allows new subscriptions to previously removed topics', () => {
			// Arrange:
			const address = createRandomAddressString();
			const service = createDefaultZmqConnectionService(['block', `confirmedAdded/${address}`, `unconfirmedAdded/${address}`]);
			// - add subscriptions
			service.on(`confirmedAdded/${address}`, () => {}, emitter, subscriptions);
			service.on('block', () => {}, emitter, subscriptions);
			service.on(`confirmedAdded/${address}.close`, () => {}, emitter, subscriptions);
			service.on(`confirmedAdded/${address}`, () => {}, emitter, subscriptions);

			// Act: remove listeners and then add one
			service.removeAllListeners(`confirmedAdded/${address}`, emitter);
			service.on(`confirmedAdded/${address}`, () => {}, emitter, subscriptions);

			// Assert:
			expect(service.listenerCount('block', emitter)).to.equal(1);
			expect(service.listenerCount(`confirmedAdded/${address}`, emitter)).to.equal(1);
			expect(service.listenerCount(`confirmedAdded/${address}.close`, emitter)).to.equal(0);
		});
	});
});
