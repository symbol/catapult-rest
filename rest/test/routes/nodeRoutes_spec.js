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

const { MockServer, test } = require('./utils/routeTestUtils');
const nodeRoutes = require('../../src/routes/nodeRoutes');
const errors = require('../../src/server/errors');
const convert = require('catapult-sdk/_build/utils/convert');
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

// ATM, both rest and rest sdk share the same version. In the future,
// we will have an open api and sdk dependencies with their given versions.
const restVersion = fs
	.readFileSync(path.resolve(__dirname, '../../../version.txt'), 'UTF-8')
	.trim();
const sdkVersion = restVersion;

describe('node routes', () => {
	describe('get', () => {
		const serviceCreator = packet => ({
			connections: {
				singleUse: () =>
					new Promise(resolve => {
						resolve({
							pushPull: () =>
								new Promise(innerResolve => innerResolve(packet))
						});
					}),
				nodeKeyPem: Buffer.from(
					convert.hexToUint8(
						'2D2D2D2D2D424547494E2050524956415445204B45592D2D2D2D2D0A4D43344'
              + '341514177425159444B3256774243494549443474466858327A726B69737673747138495936397566626773545'
              + '0564C7753675A7148546F314579634E0A2D2D2D2D2D454E442050524956415445204B45592D2D2D2D2D0A'
					)
				)
			},
			config: {
				apiNode: { timeout: 1000 }
			}
		});

		describe('node health', () => {
			const publicKeyBuffer = Buffer.from([
				0xe3,
				0x27,
				0xc0,
				0xf1,
				0xc9,
				0x97,
				0x5c,
				0x3a,
				0xa5,
				0x1b,
				0x2a,
				0x41,
				0x76,
				0x81,
				0x58,
				0xc1,
				0x07,
				0x7d,
				0x16,
				0xb4,
				0x60,
				0x99,
				0x9a,
				0xab,
				0xe7,
				0xad,
				0xb5,
				0x26,
				0x2b,
				0xe2,
				0x9a,
				0x68
			]);
			const networkGenerationHashSeedBuffer = Buffer.from([
				0xa3,
				0x00,
				0xea,
				0xfe,
				0xda,
				0xbd,
				0x5c,
				0xfa,
				0x0d,
				0x4b,
				0x94,
				0x1d,
				0x15,
				0xbb,
				0x51,
				0xb1,
				0xb4,
				0x64,
				0x72,
				0x42,
				0xf1,
				0xff,
				0x11,
				0x00,
				0x9f,
				0xd0,
				0x9a,
				0x8f,
				0x3d,
				0x35,
				0x87,
				0xf8
			]);
			const packet = {
				type: 601,
				size: 57,
				payload: Buffer.concat([
					Buffer.from([0x31, 0x00, 0x00, 0x00]), // size
					Buffer.from([0x17, 0x00, 0x00, 0x00]), // version
					publicKeyBuffer,
					networkGenerationHashSeedBuffer,
					Buffer.from([0x02, 0x00, 0x00, 0x00]), // roles
					Buffer.from([0xdc, 0x1e]), // port
					Buffer.from([0x90]), // network identifier
					Buffer.from([0x00]), // host size
					Buffer.from([0x00]) // friendly name size
				])
			};

			const createMockDb = status => ({
				database: {
					serverConfig: {
						isConnected: () => status
					}
				}
			});

			it('can check node health', () => {
				// Arrange:
				const services = serviceCreator(packet);
				const mockServer = new MockServer();
				nodeRoutes.register(mockServer.server, createMockDb(true), services);
				const route = mockServer.getRoute('/node/health').get();

				// Act
				return mockServer.callRoute(route, {}).then(() => {
					// Assert
					expect(mockServer.send.firstCall.args[0]).to.deep.equal({
						payload: {
							status: {
								apiNode: 'up',
								db: 'up'
							}
						},
						type: 'nodeHealth'
					});
					expect(mockServer.next.calledOnce).to.equal(true);
				});
			});

			it('returns status code 200 when all services are up', () => {
				// Arrange:
				const services = serviceCreator(packet);
				const mockServer = new MockServer();
				nodeRoutes.register(mockServer.server, createMockDb(true), services);
				const route = mockServer.getRoute('/node/health').get();

				// Act
				return mockServer.callRoute(route, {}).then(() => {
					// Assert
					expect(mockServer.status.firstCall.args[0]).to.equal(200);
					expect(mockServer.next.calledOnce).to.equal(true);
				});
			});

			it('returns status code 503 when any service is down', () => {
				// Arrange:
				const services = serviceCreator(packet);
				const mockServer = new MockServer();
				nodeRoutes.register(mockServer.server, createMockDb(false), services);
				const route = mockServer.getRoute('/node/health').get();

				// Act
				return mockServer.callRoute(route, {}).then(() => {
					// Assert
					expect(mockServer.status.firstCall.args[0]).to.equal(503);
					expect(mockServer.next.calledOnce).to.equal(true);
				});
			});

			it('returns down when apiNode service fails partially', () => {
				// Arrange:
				const badPacket = {
					type: 601,
					size: 57,
					payload: Buffer.concat([
						Buffer.from([0x31, 0x00, 0x00, 0x00]), // size
						Buffer.from([0x17, 0x00, 0x00, 0x00]) // version
						// missing fields make it a packet that can not be parsed correctly
					])
				};
				const services = serviceCreator(badPacket);
				const mockServer = new MockServer();
				nodeRoutes.register(mockServer.server, createMockDb(true), services);
				const route = mockServer.getRoute('/node/health').get();

				// Act
				return mockServer.callRoute(route, {}).then(() => {
					// Assert
					expect(mockServer.status.firstCall.args[0]).to.equal(503);
					expect(mockServer.send.firstCall.args[0]).to.deep.equal({
						payload: {
							status: {
								apiNode: 'down',
								db: 'up'
							}
						},
						type: 'nodeHealth'
					});
					expect(mockServer.next.calledOnce).to.equal(true);
				});
			});

			it('returns down when apiNode service fails completely', () => {
				// Arrange:
				const failingService = {
					connections: {
						singleUse: () =>
							new Promise(resolve => {
								resolve({
									pushPull: () =>
										Promise.reject(
											errors.createServiceUnavailableError('connection failed')
										)
								});
							})
					},
					config: {
						apiNode: { timeout: 1000 }
					}
				};

				const mockServer = new MockServer();
				nodeRoutes.register(
					mockServer.server,
					createMockDb(true),
					failingService
				);
				const route = mockServer.getRoute('/node/health').get();

				// Act
				return mockServer.callRoute(route, {}).then(() => {
					// Assert
					expect(mockServer.status.firstCall.args[0]).to.equal(503);
					expect(mockServer.send.firstCall.args[0]).to.deep.equal({
						payload: {
							status: {
								apiNode: 'down',
								db: 'up'
							}
						},
						type: 'nodeHealth'
					});
					expect(mockServer.next.calledOnce).to.equal(true);
				});
			});
		});

		describe('node information', () => {
			it('can retrieve node information', () => {
				// Arrange:
				const publicKeyBuffer = Buffer.from([
					0xe3,
					0x27,
					0xc0,
					0xf1,
					0xc9,
					0x97,
					0x5c,
					0x3a,
					0xa5,
					0x1b,
					0x2a,
					0x41,
					0x76,
					0x81,
					0x58,
					0xc1,
					0x07,
					0x7d,
					0x16,
					0xb4,
					0x60,
					0x99,
					0x9a,
					0xab,
					0xe7,
					0xad,
					0xb5,
					0x26,
					0x2b,
					0xe2,
					0x9a,
					0x68
				]);
				const networkGenerationHashSeedBuffer = Buffer.from([
					0xa3,
					0x00,
					0xea,
					0xfe,
					0xda,
					0xbd,
					0x5c,
					0xfa,
					0x0d,
					0x4b,
					0x94,
					0x1d,
					0x15,
					0xbb,
					0x51,
					0xb1,
					0xb4,
					0x64,
					0x72,
					0x42,
					0xf1,
					0xff,
					0x11,
					0x00,
					0x9f,
					0xd0,
					0x9a,
					0x8f,
					0x3d,
					0x35,
					0x87,
					0xf8
				]);

				const packet = {
					type: 601,
					size: 57,
					payload: Buffer.concat([
						Buffer.from([0x31, 0x00, 0x00, 0x00]), // size
						Buffer.from([0x17, 0x00, 0x00, 0x00]), // version
						publicKeyBuffer,
						networkGenerationHashSeedBuffer,
						Buffer.from([0x02, 0x00, 0x00, 0x00]), // roles
						Buffer.from([0xdc, 0x1e]), // port
						Buffer.from([0x90]), // network identifier
						Buffer.from([0x00]), // host size
						Buffer.from([0x00]) // friendly name size
					])
				};
				const services = serviceCreator(packet);

				// Act:
				return test.route.prepareExecuteRoute(
					nodeRoutes.register,
					'/node/info',
					'get',
					{},
					{},
					services,
					routeContext =>
						routeContext.routeInvoker().then(() => {
							// Assert:
							expect(routeContext.numNextCalls).to.equal(1);
							expect(routeContext.responses.length).to.equal(1);
							expect(routeContext.redirects.length).to.equal(0);
							expect(routeContext.responses[0]).to.deep.equal({
								formatter: 'ws',
								payload: {
									friendlyName: Buffer.alloc(0),
									host: Buffer.alloc(0),
									networkIdentifier: 144,
									port: 7900,
									publicKey: publicKeyBuffer,
									networkGenerationHashSeed: networkGenerationHashSeedBuffer,
									roles: 2,
									version: 23
								},
								type: 'nodeInfo'
							});
						})
				);
			});
		});

		describe('node peers', () => {
			it('can retrieve node peers', () => {
				// Arrange:
				const publicKeyBuffer = Buffer.from([
					0xe3,
					0x27,
					0xc0,
					0xf1,
					0xc9,
					0x97,
					0x5c,
					0x3a,
					0xa5,
					0x1b,
					0x2a,
					0x41,
					0x76,
					0x81,
					0x58,
					0xc1,
					0x07,
					0x7d,
					0x16,
					0xb4,
					0x60,
					0x99,
					0x9a,
					0xab,
					0xe7,
					0xad,
					0xb5,
					0x26,
					0x2b,
					0xe2,
					0x9a,
					0x68
				]);
				const networkGenerationHashSeedBuffer = Buffer.from([
					0xa3,
					0x00,
					0xea,
					0xfe,
					0xda,
					0xbd,
					0x5c,
					0xfa,
					0x0d,
					0x4b,
					0x94,
					0x1d,
					0x15,
					0xbb,
					0x51,
					0xb1,
					0xb4,
					0x64,
					0x72,
					0x42,
					0xf1,
					0xff,
					0x11,
					0x00,
					0x9f,
					0xd0,
					0x9a,
					0x8f,
					0x3d,
					0x35,
					0x87,
					0xf8
				]);

				const packet = {
					type: 603,
					size: 114,
					payload: Buffer.concat([
						// First peer
						Buffer.from([0x31, 0x00, 0x00, 0x00]), // size
						Buffer.from([0x17, 0x00, 0x00, 0x00]), // version
						publicKeyBuffer,
						networkGenerationHashSeedBuffer,
						Buffer.from([0x02, 0x00, 0x00, 0x00]), // roles
						Buffer.from([0xdc, 0x1e]), // port
						Buffer.from([0x90]), // network identifier
						Buffer.from([0x00]), // host size
						Buffer.from([0x00]), // friendly name size

						// Second peer
						Buffer.from([0x31, 0x00, 0x00, 0x00]), // size
						Buffer.from([0x18, 0x00, 0x00, 0x00]), // version
						publicKeyBuffer,
						networkGenerationHashSeedBuffer,
						Buffer.from([0x03, 0x00, 0x00, 0x00]), // roles
						Buffer.from([0xdc, 0x1e]), // port
						Buffer.from([0x90]), // network identifier
						Buffer.from([0x00]), // host size
						Buffer.from([0x00]) // friendly name size
					])
				};

				const services = serviceCreator(packet);

				// Act:
				return test.route.prepareExecuteRoute(
					nodeRoutes.register,
					'/node/peers',
					'get',
					{},
					{},
					services,
					routeContext =>
						routeContext.routeInvoker().then(() => {
							// Assert:
							expect(routeContext.numNextCalls).to.equal(1);
							expect(routeContext.responses.length).to.equal(1);
							expect(routeContext.redirects.length).to.equal(0);
							expect(routeContext.responses[0]).to.deep.equal({
								formatter: 'ws',
								payload: [
									{
										friendlyName: Buffer.alloc(0),
										host: Buffer.alloc(0),
										networkIdentifier: 144,
										port: 7900,
										publicKey: publicKeyBuffer,
										networkGenerationHashSeed: networkGenerationHashSeedBuffer,
										roles: 2,
										version: 23
									},
									{
										friendlyName: Buffer.alloc(0),
										host: Buffer.alloc(0),
										networkIdentifier: 144,
										port: 7900,
										publicKey: publicKeyBuffer,
										networkGenerationHashSeed: networkGenerationHashSeedBuffer,
										roles: 3,
										version: 24
									}
								],
								type: 'nodeInfo'
							});
						})
				);
			});
		});

		describe('node server', () => {
			it('can retrieve server info', () => {
				// Arrange:
				const endpointUnderTest = '/node/server';
				const mockServer = new MockServer();
				nodeRoutes.register(mockServer.server, {}, serviceCreator({}));

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

		describe('node storage', () => {
			const executeRoute = (routeName, db, assertResponse) =>
				test.route.executeSingle(
					nodeRoutes.register,
					routeName,
					'get',
					{},
					db,
					serviceCreator({}).config,
					assertResponse
				);

			const createMockStorageInfoDb = (
				numBlocks,
				numTransactions,
				numAccounts
			) => ({
				storageInfo: () =>
					Promise.resolve({ numBlocks, numTransactions, numAccounts })
			});

			it('can retrieve node storage', () => {
				// Arrange:
				const db = createMockStorageInfoDb(2, 64, 9);

				// Act:
				return executeRoute('/node/storage', db, response => {
					// Assert:
					expect(response).to.deep.equal({
						payload: { numBlocks: 2, numTransactions: 64, numAccounts: 9 },
						type: 'storageInfo'
					});
				});
			});
		});

		describe('node time', () => {
			it('can retrieve node time', () => {
				// Arrange:
				const packet = {
					type: 700,
					size: 24,
					payload: Buffer.from([
						0x90,
						0xf8,
						0x6d,
						0x06,
						0x01,
						0x00,
						0x00,
						0x00,
						0x90,
						0xf8,
						0x6d,
						0x06,
						0x10,
						0x00,
						0x00,
						0x00
					])
				};
				const services = serviceCreator(packet);

				// Act:
				return test.route.prepareExecuteRoute(
					nodeRoutes.register,
					'/node/time',
					'get',
					{},
					{},
					services,
					routeContext =>
						routeContext.routeInvoker().then(() => {
							// Assert:
							expect(routeContext.numNextCalls).to.equal(1);
							expect(routeContext.responses.length).to.equal(1);
							expect(routeContext.redirects.length).to.equal(0);
							expect(routeContext.responses[0]).to.deep.equal({
								formatter: 'ws',
								payload: {
									communicationTimestamps: {
										receiveTimestamp: [107870352, 16],
										sendTimestamp: [107870352, 1]
									}
								},
								type: 'nodeTime'
							});
						})
				);
			});
		});

		describe('unlocked account', () => {
			it('can retrieve unlocked account', () => {
				// Arrange:
				const packet = {
					type: 772,
					size: 40,
					payload: Buffer.from([
						0x9b,
						0x4e,
						0xf2,
						0x78,
						0x9b,
						0x4e,
						0xf2,
						0x78,
						0x9b,
						0x4e,
						0xf2,
						0x78,
						0x9b,
						0x4e,
						0xf2,
						0x78,
						0x9b,
						0x4e,
						0xf2,
						0x78,
						0x9b,
						0x4e,
						0xf2,
						0x78,
						0x9b,
						0x4e,
						0xf2,
						0x78,
						0x9b,
						0x4e,
						0xf2,
						0x78
					])
				};
				const services = serviceCreator(packet);

				// Act:
				return test.route.prepareExecuteRoute(
					nodeRoutes.register,
					'/node/unlockedaccount',
					'get',
					{},
					{},
					services,
					routeContext =>
						routeContext.routeInvoker().then(() => {
							// Assert:
							expect(routeContext.numNextCalls).to.equal(1);
							expect(routeContext.responses.length).to.equal(1);
							expect(routeContext.redirects.length).to.equal(0);
							expect(routeContext.responses[0]).to.deep.equal({
								unlockedAccount: [
									'9B4EF2789B4EF2789B4EF2789B4EF2789B4EF2789B4EF2789B4EF2789B4EF278'
								]
							});
						})
				);
			});
			describe('node public key', () => {
				it('can retrieve node public key', () => {
					// Arrange:

					const services = serviceCreator({});

					// Act:
					return test.route.prepareExecuteRoute(
						nodeRoutes.register,
						'/node/publicKey',
						'get',
						{},
						{},
						services,
						routeContext =>
							routeContext.routeInvoker().then(() => {
								// Assert:
								expect(routeContext.numNextCalls).to.equal(1);
								expect(routeContext.responses.length).to.equal(1);
								expect(routeContext.redirects.length).to.equal(0);
								expect(routeContext.responses[0]).to.deep.equal({
									nodePublicKey: [
										'D10DD5FD380B86363F7C1812DFABC9CBC7D1036286E2024415519D84AF6D4B42'
									]
								});
							})
					);
				});
			});
		});
	});
});
