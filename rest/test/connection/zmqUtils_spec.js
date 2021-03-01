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

const zmqUtils = require('../../src/connection/zmqUtils');
const test = require('../testUtils');
const { expect } = require('chai');
const { EventEmitter } = require('ws');

describe('zmqUtils', () => {
	const createMockZsocket = () => {
		const zsocket = {
			monitorParamGroups: [],
			numUnmonitorCalls: 0,
			numCloseCalls: 0,
			emittedEventNames: [],
			eventHandlers: {}
		};

		zsocket.monitor = (interval, numEvents) => { zsocket.monitorParamGroups.push({ interval, numEvents }); };
		zsocket.unmonitor = () => { ++zsocket.numUnmonitorCalls; };
		zsocket.close = () => { ++zsocket.numCloseCalls; };

		zsocket.emit = eventName => { zsocket.emittedEventNames.push(eventName); };

		// treat on and once similarly
		zsocket.on = (eventName, eventHandler) => {
			if (!(eventName in zsocket.eventHandlers))
				zsocket.eventHandlers[eventName] = [];

			zsocket.eventHandlers[eventName].push(eventHandler);
		};
		zsocket.once = zsocket.on;
		return zsocket;
	};

	describe('prepareZsocket', () => {
		const zmqConfig = { connectTimeout: 10000, monitorInterval: 150 };

		const prepareDefaultZsocket = zsocket => {
			zmqUtils.prepareZsocket(zsocket, zmqConfig, test.createMockLogger());
		};

		const cancelConnectTimer = zsocket => {
			zsocket.eventHandlers.connect[1](); // cancel the timer
		};

		const assertZsocketIsOpen = zsocket => {
			expect(zsocket.monitorParamGroups).to.deep.equal([{ interval: 150, numEvents: 0 }]);
			expect(zsocket.numUnmonitorCalls).to.equal(0);
			expect(zsocket.numCloseCalls).to.equal(0);
			expect(zsocket.emittedEventNames).to.deep.equal([]);
		};

		const assertZsocketIsClosed = zsocket => {
			expect(zsocket.numUnmonitorCalls).to.equal(1);
			expect(zsocket.numCloseCalls).to.equal(1);
			expect(zsocket.emittedEventNames).to.deep.equal(['zsocket_close']);
		};

		it('enables socket event monitoring', () => {
			// Arrange:
			const zsocket = createMockZsocket();

			// Act:
			prepareDefaultZsocket(zsocket);
			cancelConnectTimer(zsocket);

			// Assert:
			assertZsocketIsOpen(zsocket);
		});

		describe('monitor event logging handlers ', () => {
			const runMonitorLoggingTest = (options, createLogPromise) => {
				// Arrange:
				const zsocket = createMockZsocket();
				const logger = test.createMockLogger();
				const monitorEventNames = [
					'connect', 'connect_delay', 'connect_retry',
					'listen', 'bind_error',
					'accept', 'accept_error',
					'close', 'close_error',
					'disconnect',
					'monitor_error'
				];

				// Act:
				zmqUtils.prepareZsocket(zsocket, Object.assign({ monitorLoggingThrottle: options.throttle }, zmqConfig), logger);
				cancelConnectTimer(zsocket);

				// - all events have a (presumably logging) handler registered
				const promises = [];
				monitorEventNames.forEach((eventName, index) => {
					const handler = zsocket.eventHandlers[eventName][0];
					expect(handler, eventName).to.be.a('function');

					// - invoke the handler
					promises.push(createLogPromise(handler));

					// Assert: the expected number of logs were made synchronously
					expect(logger.numLogs, `${eventName} at ${index}`).to.equal((index + 1) * options.numLogsPerInvokeSync);
				});

				return Promise.all(promises).then(() => {
					// Assert: the expected number of total logs were made
					expect(logger.numLogs).to.equal(monitorEventNames.length * options.numLogsPerInvokeTotal);

					// - there are no side-effects
					assertZsocketIsOpen(zsocket);
				});
			};

			it('are registered for all zmq events', () =>
				// Arrange:
				runMonitorLoggingTest({ throttle: 0, numLogsPerInvokeSync: 1, numLogsPerInvokeTotal: 1 }, handler => {
					// Act: invoke the handler immediately
					handler();
					return Promise.resolve();
				}));

			it('throttle noisy logs', () =>
				// Arrange: successive logs for same zsocket and event should be throttled
				runMonitorLoggingTest({ throttle: 50, numLogsPerInvokeSync: 1, numLogsPerInvokeTotal: 1 }, handler => {
					// Act: invoke the handler immediately multiple times
					handler();
					handler();
					handler();
					return Promise.resolve();
				}));

			it('allow additional logs outside of throttle period', () =>
				// Arrange: delayed logs for same zsocket and event should be allowed
				runMonitorLoggingTest({ throttle: 50, numLogsPerInvokeSync: 1, numLogsPerInvokeTotal: 2 }, handler =>
					// Act: invoke the handler immediately
					new Promise(resolve => {
						handler();
						handler();
						handler();

						// - invoke the handler after the throttle period
						setTimeout(() => {
							handler();
							handler();
							handler();
							resolve();
						}, 100);
					})));
		});

		it('customizes close behavior', () => {
			// Arrange:
			const zsocket = createMockZsocket();

			// - override emit in order to be able to verify ordering
			const emitCaptures = [];
			const originalEmit = zsocket.emit;
			zsocket.emit = eventName => {
				emitCaptures.push({ eventName, numCloseCalls: zsocket.numCloseCalls });
				originalEmit.call(zsocket, eventName);
			};

			prepareDefaultZsocket(zsocket);
			cancelConnectTimer(zsocket);

			// Act:
			zsocket.close();

			// Assert:
			assertZsocketIsClosed(zsocket);

			// - close event was raised after socket was closed
			expect(emitCaptures).to.deep.equal([{ eventName: 'zsocket_close', numCloseCalls: 1 }]);
		});

		it('closes socket on error', () => {
			// Arrange:
			const zsocket = createMockZsocket();
			prepareDefaultZsocket(zsocket);
			cancelConnectTimer(zsocket);

			// Act:
			zsocket.eventHandlers.error[0](new Error());

			// Assert:
			assertZsocketIsClosed(zsocket);
		});

		it('closes socket on connect timeout', () => {
			// Arrange:
			const zsocket = createMockZsocket();
			zmqUtils.prepareZsocket(zsocket, { connectTimeout: 0, monitorInterval: 150 }, test.createMockLogger());

			// Act: wait for the timeout
			return new Promise(resolve => {
				setTimeout(() => {
					// Assert:
					assertZsocketIsClosed(zsocket);
					resolve();
				}, 1);
			});
		});

		it('only calls close once when explicit close is followed by timeout', () => {
			// Arrange:
			const zsocket = createMockZsocket();
			zmqUtils.prepareZsocket(zsocket, { connectTimeout: 0, monitorInterval: 150 }, test.createMockLogger());

			// Act: explicitly close the socket
			zsocket.close();

			// - let the timer fire and attempt to close the socket again
			return new Promise(resolve => {
				setTimeout(() => {
					// Assert: close was only called once on the underlying socket
					assertZsocketIsClosed(zsocket);
					resolve();
				}, 1);
			});
		});

		it('clears connect timer on successful connect', () => {
			// Arrange:
			const zsocket = createMockZsocket();
			zmqUtils.prepareZsocket(zsocket, { connectTimeout: 0, monitorInterval: 150 }, test.createMockLogger());

			// Act: simulate a connect
			cancelConnectTimer(zsocket);

			// - give the timer a chance to fire (it will not because it is cancelled)
			return new Promise(resolve => {
				setTimeout(() => {
					// Assert: close was not called because the timer was cancelled
					assertZsocketIsOpen(zsocket);
					resolve();
				}, 1);
			});
		});
	});

	describe('createMultisocketEmitter', () => {
		describe('on', () => {
			it('creates socket when new channel is subscribed', () => {
				// Arrange:
				const subscription = {};
				const emit = new EventEmitter();
				const emitter = zmqUtils.createMultisocketEmitter(createMockZsocket);

				// Act:
				emitter.on('block', () => {}, emit, subscription);

				// Assert:
				expect(emitter.listenerCount('block', emit)).to.equal(1);

				// Sanity: no other listeners are set up
				expect(emitter.listenerCount('block.close', emit)).to.equal(0);
				expect(emitter.listenerCount('confirmedAdded', emit)).to.equal(0);
			});

			it('creates socket per channel', () => {
				// Arrange:
				const subscription = {};
				const emit = new EventEmitter();
				const emitter = zmqUtils.createMultisocketEmitter(createMockZsocket);

				// Act:
				emitter.on('block', () => {}, emit, subscription);
				emitter.on('confirmedAdded', () => {}, emit, subscription);
				emitter.on('partialAdded', () => {}, emit, subscription);

				// Assert:
				expect(emitter.listenerCount('block', emit)).to.equal(1);
				expect(emitter.listenerCount('confirmedAdded', emit)).to.equal(1);
				expect(emitter.listenerCount('partialAdded', emit)).to.equal(1);
			});

			it('reuses socket when existing channel is subscribed', () => {
				// Arrange:
				const subscription = {};
				const emit = new EventEmitter();
				const emitter = zmqUtils.createMultisocketEmitter(createMockZsocket);

				// Act:
				emitter.on('block', () => {}, emit, subscription);
				emitter.on('block', () => {}, emit, subscription);
				emitter.on('block', () => {}, emit, subscription);

				// Assert:
				expect(emitter.listenerCount('block', emit)).to.equal(3);
			});

			it('bypasses socket creation when supported subevent is subscribed', () => {
				// Arrange:
				const subscription = {};
				const emit = new EventEmitter();
				const emitter = zmqUtils.createMultisocketEmitter(createMockZsocket);

				// Act:
				emitter.on('block.close', () => {}, emit, subscription);

				// Assert:
				expect(emitter.listenerCount('block.close', emit)).to.equal(1);
			});

			it('fails when unsupported subevent is subscribed', () => {
				// Arrange:
				const subscription = {};
				const emit = new EventEmitter();
				const emitter = zmqUtils.createMultisocketEmitter(createMockZsocket);

				// Act + Assert:
				expect(() => emitter.on('block.foo', () => {}, emit, subscription).to.throw('block.foo indicates an unsupported subevent'));
			});

			it('registers handler for propagating channel close event', () => {
				// Arrange:
				const subscription = {};
				const emit = new EventEmitter();
				const emitter = zmqUtils.createMultisocketEmitter(createMockZsocket);

				// - set up subscriptions to two channels and one subevent
				emitter.on('block', () => {}, emit, subscription);
				emitter.on('confirmedAdded/TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A', () => {}, emit, subscription);
				emitter.on('block', () => {}, emit, subscription);
				emitter.on('block.close', () => {}, emit, subscription);
				emitter.on('confirmedAdded/TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A', () => {}, emit, subscription);

				// - register close events
				const captures = {};
				emitter.on('block.close', () => { captures.block = true; }, emit, subscription);
				emitter.on('confirmedAdded/TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A.close',
					() => { captures.confirmedAdded = true; }, emit, subscription);

				// - close has also removed related socket reference and listeners
				expect(emitter.listenerCount('block', emit)).to.equal(2);
				expect(emitter.listenerCount('block.close', emit)).to.equal(2);
				expect(emitter.listenerCount('confirmedAdded/TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A', emit)).to.equal(2);
			});
		});

		describe('removeAllListeners', () => {
			it('has no effect when no matching subscribers are present', () => {
				// Arrange:
				const subscription = {};
				const emit = new EventEmitter();
				const emitter = zmqUtils.createMultisocketEmitter(createMockZsocket);
				emitter.on('block', () => {}, emit, subscription);
				emitter.on('confirmedAdded/TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A', () => {}, emit, subscription);
				emitter.on('block', () => {}, emit, subscription);
				emitter.on('confirmedAdded/TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A', () => {}, emit, subscription);

				// Act:
				emitter.removeAllListeners('unconfirmedAdded/TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A', emit);

				// Assert:
				expect(emitter.listenerCount('block', emit)).to.equal(2);
				expect(emitter.listenerCount('confirmedAdded/TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A', emit)).to.equal(2);
			});

			it('removes all matching channel subscribers', () => {
				// Arrange:
				const subscription = {};
				const emit = new EventEmitter();
				const emitter = zmqUtils.createMultisocketEmitter(createMockZsocket);
				emitter.on('block', () => {}, emit, subscription);
				emitter.on('confirmedAdded/TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A', () => {}, emit, subscription);
				emitter.on('block', () => {}, emit, subscription);
				emitter.on('confirmedAdded/TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A', () => {}, emit, subscription);

				// Act:
				emitter.removeAllListeners('block', emit);

				// Assert:
				expect(emitter.listenerCount('block', emit)).to.equal(0);
				expect(emitter.listenerCount('confirmedAdded/TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A', emit)).to.equal(2);
			});

			it('removes all matching and subevent subscribers', () => {
				// Arrange:
				const subscription = {};
				const emit = new EventEmitter();
				const emitter = zmqUtils.createMultisocketEmitter(createMockZsocket);
				emitter.on('block', () => {}, emit, subscription);
				emitter.on('block.close', () => {}, emit, subscription);
				emitter.on('confirmedAdded/TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A', () => {}, emit, subscription);
				emitter.on('block', () => {}, emit, subscription);
				emitter.on('block.close', () => {}, emit, subscription);
				emitter.on('confirmedAdded/TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A', () => {}, emit, subscription);

				// Act:
				emitter.removeAllListeners('block', emit);

				// Assert:
				expect(emitter.listenerCount('block', emit)).to.equal(0);
				expect(emitter.listenerCount('block.close', emit)).to.equal(0);
				expect(emitter.listenerCount('confirmedAdded/TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A', emit)).to.equal(2);
			});

			it('fails when attempting to remove listeners for any subevent', () => {
				// Arrange:
				const subscription = {};
				const emit = new EventEmitter();
				const emitter = zmqUtils.createMultisocketEmitter(createMockZsocket);
				emitter.on('block', () => {}, emit, subscription);
				emitter.on('block.close', () => {}, emit, subscription);
				emitter.on('confirmedAdded/TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A', () => {}, emit, subscription);

				// Act + Assert: removal attempts for both supported and unsupported subevents should fail because there is no reason
				//               to remove subevent subscriptions while remaining subscribed to the associated channel
				expect(() => emitter.removeAllListeners('block.close', emit).to.throw('block.close must be a channel'));
				expect(() => emitter.removeAllListeners('block.foo', emit).to.throw('block.foo must be a channel'));
			});

			it('allows new subscriptions for removed channels', () => {
				// Arrange:
				const subscription = {};
				const emit = new EventEmitter();
				const emitter = zmqUtils.createMultisocketEmitter(createMockZsocket);
				emitter.on('block', () => {}, emit, subscription);
				emitter.on('confirmedAdded/TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A', () => {}, emit, subscription);
				emitter.on('block', () => {}, emit, subscription);
				emitter.on('block.close', () => {}, emit, subscription);
				emitter.on('confirmedAdded/TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A', () => {}, emit, subscription);

				// Act:
				emitter.removeAllListeners('block', emit);
				emitter.on('block', () => {}, emit, subscription);

				// Assert:
				expect(emitter.listenerCount('block', emit)).to.equal(1);
				expect(emitter.listenerCount('block.close', emit)).to.equal(0);
				expect(emitter.listenerCount('confirmedAdded/TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A', emit)).to.equal(2);
			});
		});

		describe('close', () => {
			it('removes all channel and subevent subscribers', () => {
				// Arrange:
				const subscription = {};
				const emit = new EventEmitter();
				const emitter = zmqUtils.createMultisocketEmitter(createMockZsocket);
				emitter.on('block', () => {}, emit, subscription);
				emitter.on('block.close', () => {}, emit, subscription);
				emitter.on('confirmedAdded/TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A', () => {}, emit, subscription);
				emitter.on('block', () => {}, emit, subscription);
				emitter.on('block.close', () => {}, emit, subscription);
				emitter.on('confirmedAdded/TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A', () => {}, emit, subscription);

				// Act:
				emitter.close(['block', 'confirmedAdded/TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A'], emit);

				// Assert:
				expect(emitter.listenerCount('block', emit)).to.equal(0);
				expect(emitter.listenerCount('block.close', emit)).to.equal(0);
				expect(emitter.listenerCount('confirmedAdded/TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A', emit)).to.equal(0);
			});
		});
	});
});
