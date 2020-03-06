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
const networkRoutes = require('../../src/routes/networkRoutes');
const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs');

describe('network routes', () => {
	describe('get', () => {
		describe('network', () => {
			it('can retrieve network info', () => {
				// Act:
				const services = { config: { network: { name: 'foo', description: 'bar' } } };
				return test.route.prepareExecuteRoute(networkRoutes.register, '/network', 'get', {}, {}, services, routeContext => {
					// - invoke route synchronously
					routeContext.routeInvoker();

					// Assert:
					expect(routeContext.numNextCalls, 'next should be called once').to.equal(1);
					expect(routeContext.responses.length, 'single response is expected').to.equal(1);
					expect(routeContext.redirects.length, 'no redirects are expected').to.equal(0);

					// - no type information because formatting is completely bypassed
					const response = routeContext.responses[0];
					expect(response).to.deep.equal({
						name: services.config.network.name,
						description: services.config.network.description
					});
				});
			});

			it('skips network info not explicitly included', () => {
				// Act:
				const services = { config: { network: { name: 'foo', description: 'bar', head: 'fuu' } } };
				return test.route.prepareExecuteRoute(networkRoutes.register, '/network', 'get', {}, {}, services, routeContext => {
					// - invoke route synchronously
					routeContext.routeInvoker();

					const response = routeContext.responses[0];
					expect(response).to.deep.equal({
						name: services.config.network.name,
						description: services.config.network.description
					});
				});
			});
		});

		describe('network properties', () => {
			it('can retrieve network properties', () => {
				const readFileStub = sinon.stub(fs, 'readFile').callsFake((path, data, callback) =>
					callback(null, '[network]\n'
						+ 'identifier = mijin-test\n'
						+ '[chain]\n'
						+ 'enableVerifiableState = true\n'
						+ '[plugin:catapult.plugins.aggregate]\n'
						+ 'maxTransactionsPerAggregate = 1\'000'));

				const services = { config: { network: { propertiesFilePath: 'wouldBeValidFilePath' } } };
				const mockServer = new MockServer();

				networkRoutes.register(mockServer.server, {}, services);

				const route = mockServer.getRoute('/network/properties').get();
				return mockServer.callRoute(route).then(() => {
					expect(mockServer.next.calledOnce).to.equal(true);
					expect(mockServer.send.firstCall.args[0]).to.deep.equal({
						network: { identifier: 'mijin-test' },
						chain: { enableVerifiableState: true },
						plugins: { aggregate: { maxTransactionsPerAggregate: '1\'000' } }
					});
					readFileStub.restore();
				});
			});

			it('skips non-explicit properties', () => {
				const readFileStub = sinon.stub(fs, 'readFile').callsFake((path, data, callback) =>
					callback(null, '[network]\n'
						+ 'identifier = mijin-test\n'
						+ '[chain]\n'
						+ 'enableVerifiableState = true\n'
						+ '[private]\n'
						+ 'secretCode = 42\n'
						+ '[plugin:catapult.plugins.aggregate]\n'
						+ 'maxTransactionsPerAggregate = 1\'000'));

				const services = { config: { network: { propertiesFilePath: 'wouldBeValidFilePath' } } };
				const mockServer = new MockServer();

				networkRoutes.register(mockServer.server, {}, services);

				const route = mockServer.getRoute('/network/properties').get();
				return mockServer.callRoute(route).then(() => {
					expect(mockServer.next.calledOnce).to.equal(true);
					expect(mockServer.send.firstCall.args[0]).to.deep.equal({
						network: { identifier: 'mijin-test' },
						chain: { enableVerifiableState: true },
						plugins: { aggregate: { maxTransactionsPerAggregate: '1\'000' } }
					});
					readFileStub.restore();
				});
			});

			it('errors if no file path specified', () => {
				const mockServer = new MockServer();
				networkRoutes.register(mockServer.server, {}, { config: { network: {} } });

				const route = mockServer.getRoute('/network/properties').get();
				return mockServer.callRoute(route).then(() => {
					expect(mockServer.send.firstCall.args[0].statusCode).to.equal(409);
					expect(mockServer.send.firstCall.args[0].message).to.equal('there was an error reading the network properties file');
				});
			});

			it('errors when the file has an invalid format', () => {
				const readFileStub = sinon.stub(fs, 'readFile').callsFake((path, data, callback) =>
					callback(null, '{ "not": "iniFormat" }'));

				const services = { config: { network: {} } };
				const mockServer = new MockServer();

				networkRoutes.register(mockServer.server, {}, services);

				const route = mockServer.getRoute('/network/properties').get();
				return mockServer.callRoute(route).then(() => {
					expect(mockServer.send.firstCall.args[0].statusCode).to.equal(409);
					expect(mockServer.send.firstCall.args[0].message).to.equal('there was an error reading the network properties file');
					readFileStub.restore();
				});
			});

			it('errors if the file does not exist', () => {
				const mockServer = new MockServer();
				networkRoutes.register(mockServer.server, {}, { config: { network: { propertiesFilePath: 'nowaythispath€xists' } } });

				const route = mockServer.getRoute('/network/properties').get();
				return mockServer.callRoute(route).then(() => {
					expect(mockServer.send.firstCall.args[0].statusCode).to.equal(409);
					expect(mockServer.send.firstCall.args[0].message).to.equal('there was an error reading the network properties file');
				});
			});
		});

		describe('network fees transaction', () => {
			const runNetworkFeesTest = (testName, feeMultipliers, average, median, max, min) => {
				const services = {
					config: {
						numBlocksTransactionFeeStats: feeMultipliers.length
					}
				};

				const dbLatestBlocksFeeMultiplierFake = sinon.fake.resolves(feeMultipliers);
				const db = {
					latestBlocksFeeMultiplier: dbLatestBlocksFeeMultiplierFake
				};

				it(`${testName}: [${feeMultipliers}] average:${average}, median:${median}, max:${max}, min:${min}`, () => {
					// Arrange:
					const mockServer = new MockServer();
					networkRoutes.register(mockServer.server, db, services);
					const route = mockServer.getRoute('/network/fees/transaction').get();

					// Act
					return mockServer.callRoute(route, {}).then(() => {
						// Assert
						expect(dbLatestBlocksFeeMultiplierFake.calledOnce).to.equal(true);
						expect(dbLatestBlocksFeeMultiplierFake.firstCall.args[0]).to.equal(feeMultipliers.length);

						expect(mockServer.send.firstCall.args[0]).to.deep.equal({
							averageFeeMultiplier: average,
							medianFeeMultiplier: median,
							highestFeeMultiplier: max,
							lowestFeeMultiplier: min
						});
						expect(mockServer.next.calledOnce).to.equal(true);
					});
				});
			};

			describe('network fees are computed correctly for the following values', () => {
				runNetworkFeesTest('One block', [0], 0, 0, 0, 0);
				runNetworkFeesTest('All 0s', [0, 0, 0, 0, 0], 0, 0, 0, 0);
				runNetworkFeesTest('Big values', [999999999, 999999999, 999999999, 999999999], 999999999, 999999999, 999999999, 999999999);
				runNetworkFeesTest('Correct average', [1, 1, 1, 1], 1, 1, 1, 1);
				runNetworkFeesTest('Correct median', [90, 92, 93, 88, 95, 88, 97, 87, 98], 92, 92, 98, 87);
				runNetworkFeesTest('Correct median even number', [35, 27, 31, 32, 30, 40, 29, 43], 33, 31, 43, 27);
				runNetworkFeesTest('Correct decimals floor', [10, 11, 12, 13], 11, 11, 13, 10);
				runNetworkFeesTest('Correct decimals floor', [23, 29, 31, 27], 27, 28, 31, 23);
			});
		});
	});
});
