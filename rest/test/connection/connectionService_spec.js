/*
 * Copyright (c) 2016-present,
 * Jaguar0625, gimre, BloodyRookie, Tech Bureau, Corp. All rights reserved.
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

const { createConnectionService } = require('../../src/connection/connectionService');
const { MockSocket } = require('./MockSocket');
const catapult = require('catapult-sdk');
const { expect } = require('chai');
const sinon = require('sinon');
const tls = require('tls');

const { convert } = catapult.utils;

describe('connection service', () => {
	const sockets = [];
	let tlsConnectStub = undefined;
	const testConfig = {
		apiNode: {
			host: 'test hostname',
			port: 12345,
			key: '',
			certificate: '',
			caCertificate: ''
		}
	};
	let connectionService = undefined;


	const Test_Config = {
		apiNode: {
			host: 'test hostname',
			port: 12345
		}
	};

	const createTestContext = () => {
		const routeContext = {
			onCalls: {},
			mockSockets: [], // stores all mock sockets created by factory
			lastSocket: () => routeContext.mockSockets[routeContext.mockSockets.length - 1],
			numConnectionFactoryCalls: 0,
			mockConnectionFactory: (port, host) => {
				++routeContext.numConnectionFactoryCalls;
				routeContext.host = host;
				routeContext.port = port;

				const mockSocket = {
					numWrites: 0,
					on: (eventName, eventHandler) => {
						routeContext.onCalls[eventName] = eventHandler;
						return mockSocket;
					},
					once: () => {
					},
					write: () => {
						++mockSocket.numWrites;
					}
				};

				routeContext.mockSockets.push(mockSocket);
				return routeContext.lastSocket();
			},
			auth: {},
			createAuthPromise: promiseFactory =>
				(serverSocket, clientKeyPair, apiNodePublicKey) => {
					routeContext.auth.serverSocket = serverSocket;
					routeContext.auth.clientKeyPair = clientKeyPair;
					routeContext.auth.apiNodePublicKey = apiNodePublicKey;
					return promiseFactory();
				},
			createSuccessAuthPromise: () => routeContext.createAuthPromise(() => Promise.resolve()),
			createFailureAuthPromise: () => routeContext.createAuthPromise(() => Promise.reject(Error('failure auth promise')))
		};
		return routeContext;
	};

	const assertData = context => {
		expect(context.host).to.equal(Test_Config.apiNode.host);
		expect(context.port).to.equal(Test_Config.apiNode.port);
		expect(context.numConnectionFactoryCalls).to.equal(1);

		// note: this is not deep equal on purpose
		expect(context.auth.serverSocket).to.equal(context.lastSocket());

		expect(context.onCalls).to.have.all.keys(['close', 'error']);
	};

		// it('authentication success is forwarded', () => {
		// 	// Arrange:
		// 	const context = createTestContext();
		// 	const connectionService = createConnectionService(Test_Config, context.mockConnectionFactory, context.createSuccessAuthPromise());

		// 	// Act:
		// 	return connectionService.lease().then(connection => {
		// 		// Assert:
		// 		assertData(context);

		// 		// - the connection sends to the last socket
		// 		connection.send();
		// 		expect(context.lastSocket().numWrites).to.equal(1);
		// 	});
		// });

		// it('authentication failure is forwarded', () => {
		// 	// Arrange:
		// 	const context = createTestContext();
		// 	const connectionService = createConnectionService(Test_Config, context.mockConnectionFactory, context.createFailureAuthPromise());

		// 	// Act:
		// 	const promise = connectionService.lease();
		// 	return promise.catch(err => {
		// 		// Assert:
		// 		assertData(context);
		// 		expect(err.message).to.equal('failure auth promise');
		// 	});
		// });

		// it('connection failure is forwarded', () => {
		// 	// Arrange:
		// 	const context = createTestContext();
		// 	const promiseInterruptedByDisconnect = context.createAuthPromise(() => {
		// 		// note: assumption is that connection() registers 'close' event and
		// 		// that it rejects promise if close occurred
		// 		context.onCalls.close();
		// 		return Promise.resolve();
		// 	});
		// 	const connectionService = createConnectionService(Test_Config, context.mockConnectionFactory, promiseInterruptedByDisconnect);

		// 	// Act:
		// 	return connectionService.lease()
		// 		.then(() => {
		// 			throw new Error('promise resolved');
		// 		})
		// 		.catch(err => {
		// 			// Assert:
		// 			assertData(context);
		// 			expect(err.statusCode).to.equal(503);
		// 			expect(err.message).to.equal('connection failed');
		// 		});
		// });

		// const assertAfterFirstConnectionSucceeded = (name, method, followingActions) => {
		// 	it(`first connection succeeded, ${name}`, () => {
		// 		// Arrange:
		// 		const context = createTestContext();
		// 		const connectionService = createConnectionService(
		// 			Test_Config,
		// 			context.mockConnectionFactory,
		// 			context.createSuccessAuthPromise()
		// 		);

		// 		// Act:
		// 		return connectionService[method]().then(firstConnection => {
		// 			assertData(context);

		// 			return followingActions(context, connectionService, firstConnection);
		// 		});
		// 	});
		// };

		// assertAfterFirstConnectionSucceeded('connection is cached using lease', 'lease', (context, connectionService, firstConnection) =>
		// 	// Act: connection succeeded, let's try to make another one, and check that they match:
		// 	connectionService.lease().then(secondConnection => {
		// 		// Assert: connection was created only once
		// 		expect(context.numConnectionFactoryCalls).to.equal(1);
		// 		expect(secondConnection).to.equal(firstConnection);
		// 	}));

		// assertAfterFirstConnectionSucceeded(
		// 	'connection will be restored after close using lease',
		// 	'lease',
		// 	(context, connectionService, firstConnection) => {
		// 		// Act: break the connection
		// 		context.onCalls.close();

		// 		return connectionService.lease().then(secondConnection => {
		// 			// Assert:
		// 			expect(context.numConnectionFactoryCalls).to.equal(2);
		// 			expect(secondConnection).to.not.equal(firstConnection);

		// 			// - the first connection sends to the first socket
		// 			firstConnection.send();
		// 			expect(context.mockSockets[0].numWrites).to.equal(1);

		// 			// - the second connection sends to the second socket
		// 			secondConnection.send();
		// 			expect(context.mockSockets[1].numWrites).to.equal(1);
		// 		});
		// 	}
		// );

		// assertAfterFirstConnectionSucceeded(
		// 	'error alone does not affect connection using lease',
		// 	'lease',
		// 	(context, connectionService, firstConnection) => {
		// 		// Act: emit an error
		// 		context.onCalls.error(new Error());

		// 		return connectionService.lease().then(secondConnection => {
		// 			// Assert: connection was created only once
		// 			expect(context.numConnectionFactoryCalls).to.equal(1);
		// 			expect(secondConnection).to.equal(firstConnection);
		// 		});
		// 	}
		// );

		// assertAfterFirstConnectionSucceeded(
		// 	'connection is not cached using singleUse',
		// 	'singleUse',
		// 	(context, connectionService, firstConnection) =>
		// 		// Act: connection succeeded, let's try to make another one, and check that they do not match:
		// 		connectionService.lease().then(secondConnection => {
		// 			// Assert: connection was created twice
		// 			expect(context.numConnectionFactoryCalls).to.equal(2);
		// 			expect(secondConnection).to.not.equal(firstConnection);
		// 		})
		// );

		// assertAfterFirstConnectionSucceeded(
		// 	'connection will be restored after close using singleUse',
		// 	'singleUse',
		// 	(context, connectionService, firstConnection) => {
		// 		// Act: break the connection
		// 		context.onCalls.close();

		// 		return connectionService.lease().then(secondConnection => {
		// 			// Assert:
		// 			expect(context.numConnectionFactoryCalls).to.equal(2);
		// 			expect(secondConnection).to.not.equal(firstConnection);

		// 			// - the first connection sends to the first socket
		// 			firstConnection.send();
		// 			expect(context.mockSockets[0].numWrites).to.equal(1);

		// 			// - the second connection sends to the second socket
		// 			secondConnection.send();
		// 			expect(context.mockSockets[1].numWrites).to.equal(1);
		// 		});
		// 	}
		// );

		// assertAfterFirstConnectionSucceeded(
		// 	'error alone does not affect connection using singleUse',
		// 	'singleUse',
		// 	(context, connectionService, firstConnection) => {
		// 		// Act: emit an error
		// 		context.onCalls.error(new Error());

		// 		return connectionService.lease().then(secondConnection => {
		// 			// Assert: connection was created twice
		// 			expect(context.numConnectionFactoryCalls).to.equal(2);
		// 			expect(secondConnection).to.not.equal(firstConnection);
		// 		});
		// 	}
		// );
	beforeEach(() => {
		tlsConnectStub = sinon.stub(tls, 'connect').callsFake(options => {
			const fakeSocket = new MockSocket();
			sockets.push(fakeSocket);
			return fakeSocket;
		});
		connectionService = createConnectionService(testConfig);
	});

	afterEach(() => {
		tlsConnectStub.restore();
		tlsConnectStub = undefined;
		sockets.splice(0, sockets.length);
		connectionService = undefined;
	});

	describe('handles first simultaneous connections correctly when authorization is delayed', () => {
		it('on successful authorization both parties should lease the same connection', () => {
			// Act:
			let firstConn;
			let secondConn;
			const leasePromises = Promise.all([
				connectionService.lease().then(firstConnection => {
					firstConn = firstConnection;
				}),
				connectionService.lease().then(secondConnection => {
					secondConn = secondConnection;
				})
			]).then(() => {
				// Assert:
				expect(secondConn).to.equal(firstConn);
			});

			// unblocks the first promise (simulates delayed acceptance of authorization)
			sockets[0].authorized = true;
			sockets[0].fireEvent('secureConnect');

			return leasePromises;
		});

		it('on failed authorization both parties should fail on the same pending authorization promise', () => {
			// Act:
			const leasePromises = Promise.all([
				connectionService.lease(),
				connectionService.lease()
			]).catch(err => {
				// Assert:
				expect(err.message).to.equal('connection failed');
			});

			// unblocks the first promise (simulates delayed authorization failure)
			sockets[0].fireEvent('close');

			return leasePromises;
		});
	});
});
