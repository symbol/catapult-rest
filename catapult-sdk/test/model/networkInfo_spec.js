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

const networkInfo = require('../../src/model/networkInfo');
const { expect } = require('chai');

describe('network info', () => {
	describe('networks', () => {
		it('defines all known networks', () => {
			// Act:
			const knownNetworks = Object.keys(networkInfo.networks);

			// Assert:
			expect(knownNetworks).to.deep.equal([
				'mainnet',
				'testnet'
			]);
		});

		it('defines the mainnet network', () => {
			// Assert:
			expect(networkInfo.networks.mainnet).to.deep.equal({ id: 0x68, bytePrefix: '68', charPrefix: 'N' });
		});

		it('defines the testnet network', () => {
			// Assert:
			expect(networkInfo.networks.testnet).to.deep.equal({ id: 0x98, bytePrefix: '98', charPrefix: 'T' });
		});
	});

	describe('find by id', () => {
		it('can find all known networks', () => {
			// Arrange:
			Object.keys(networkInfo.networks).forEach(networkName => {
				// Act:
				const network = networkInfo.findById(networkInfo.networks[networkName].id);

				// Assert:
				expect(network).to.equal(networkInfo.networks[networkName]);
			});
		});

		it('returns undefined for unknown network', () => {
			// Act:
			const network = networkInfo.findById(0x25);

			// Assert:
			expect(network).to.equal(undefined);
		});
	});

	describe('find by char prefix', () => {
		it('can find all known networks', () => {
			// Arrange:
			Object.keys(networkInfo.networks).forEach(networkName => {
				// Act:
				const network = networkInfo.findByCharPrefix(networkInfo.networks[networkName].charPrefix);

				// Assert:
				expect(network).to.equal(networkInfo.networks[networkName]);
			});
		});

		it('returns undefined for unknown network', () => {
			// Act:
			const network = networkInfo.findByCharPrefix('J');

			// Assert:
			expect(network).to.equal(undefined);
		});
	});
});
