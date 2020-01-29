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

const { MockServer, test } = require('./utils/routeTestUtils');
const { version: sdkVersion } = require('../../../catapult-sdk/package.json');
const { version: restVersion } = require('../../package.json');
const diagnosticRoutes = require('../../src/routes/diagnosticRoutes');
const { expect } = require('chai');

describe('diagnostic routes', () => {
	describe('blocks', () => {
		const builder = test.route.document.prepareGetDocumentsRouteTests(diagnosticRoutes.register, {
			route: '/diagnostic/blocks/:height/limit/:limit',
			dbApiName: 'blocksFrom',
			type: 'blockHeaderWithMetadata'
		});

		builder.addValidInputTest({ object: { height: '1234', limit: '4321' }, parsed: [1234, 4321] });
		builder.addEmptyArrayTest({ object: { height: '1234', limit: '4321' }, parsed: [1234, 4321] });

		// notice that this expands to four tests { 'height', 'limit'} x { '10A', '-4321' }
		['height', 'limit'].forEach(property => ['10A', '-4321'].forEach(value => {
			const object = Object.assign({ height: '1234', limit: '4321' }, { [property]: value });
			const errorMessage = `${property} has an invalid format`;
			builder.addInvalidKeyTest({ object, error: errorMessage }, `(${property} with value ${value})`);
		}));
	});

	describe('server info', () => {
		it('can retrieve info', () => {
			// Arrange:
			const endpointUnderTest = '/diagnostic/server';
			const mockServer = new MockServer();
			diagnosticRoutes.register(mockServer.server, {});

			// Act:
			const route = mockServer.getRoute(endpointUnderTest).get();
			mockServer.callRoute(route, {});

			// Assert:
			expect(mockServer.send.firstCall.args[0]).to.deep.equal({
				payload: {
					serverInfo: {
						restVersion,
						sdkVersion
					}
				},
				type: 'serverInfo'
			});
		});
	});

	describe('storage', () => {
		const executeRoute = (routeName, db, assertResponse) =>
			test.route.executeSingle(diagnosticRoutes.register, routeName, 'get', {}, db, undefined, assertResponse);

		const createMockStorageInfoDb = (numBlocks, numTransactions, numAccounts) => ({
			storageInfo: () => Promise.resolve({ numBlocks, numTransactions, numAccounts })
		});

		it('can retrieve info', () => {
			// Arrange:
			const db = createMockStorageInfoDb(2, 64, 9);

			// Act:
			return executeRoute('/diagnostic/storage', db, response => {
				// Assert:
				expect(response).to.deep.equal({
					payload: { numBlocks: 2, numTransactions: 64, numAccounts: 9 },
					type: 'storageInfo'
				});
			});
		});
	});

	describe('status', () => {
		it('can check status', () => {
			// Arrange:
			const db = {
				database: {
					serverConfig: {
						isConnected: () => true
					}
				}
			};
			const publicKeyBuffer = Buffer.from([
				0xE3, 0x27, 0xC0, 0xF1, 0xC9, 0x97, 0x5C, 0x3A, 0xA5, 0x1B, 0x2A, 0x41, 0x76, 0x81, 0x58, 0xC1,
				0x07, 0x7D, 0x16, 0xB4, 0x60, 0x99, 0x9A, 0xAB, 0xE7, 0xAD, 0xB5, 0x26, 0x2B, 0xE2, 0x9A, 0x68
			]);
			const packet = {
				type: 601,
				size: 57,
				payload: Buffer.concat([
					Buffer.from([0x31, 0x00, 0x00, 0x00]), // size
					Buffer.from([0x17, 0x00, 0x00, 0x00]), // version
					publicKeyBuffer,
					Buffer.from([0x02, 0x00, 0x00, 0x00]), // roles
					Buffer.from([0xDC, 0x1E]), // port
					Buffer.from([0x90]), // network identifier
					Buffer.from([0x00]), // host size
					Buffer.from([0x00]) // friendly name size
				])
			};
			const services = {
				connections: {
					singleUse: () => new Promise(resolve => {
						resolve({
							pushPull: () => new Promise(innerResolve => innerResolve(packet))
						});
					})
				},
				config: {
					apiNode: { timeout: 1000 }
				}
			};

			const mockServer = new MockServer();
			diagnosticRoutes.register(mockServer.server, db, services);
			const route = mockServer.getRoute('/diagnostic/status').get();

			// Act
			return mockServer.callRoute(route, {}).then(() => {
				// Assert
				expect(mockServer.send.firstCall.args[0]).to.deep.equal({
					payload: {
						statusInfo: {
							apiNode: 'OK',
							db: 'OK'
						}
					},
					type: 'statusInfo'
				});
				expect(mockServer.next.calledOnce).to.equal(true);
			});
		});
	});
});
