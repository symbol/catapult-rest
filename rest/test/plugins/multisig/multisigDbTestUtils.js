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

const MultisigDb = require('../../../src/plugins/multisig/MultisigDb');
const dbTestUtils = require('../../db/utils/dbTestUtils');
const test = require('../../testUtils');
const { expect } = require('chai');
const MongoDb = require('mongodb');

const { Binary } = MongoDb;
const { createObjectId } = dbTestUtils.db;

const createMultisigEntry = (id, account, cosignatoryAddresses, multisigAddresses) => ({
	// simulated account is multisig with two cosigners and cosigns one multisig account
	_id: dbTestUtils.db.createObjectId(id),
	multisig: {
		accountAddress: new Binary(account.address || account),
		cosignatoryAddresses: (cosignatoryAddresses || []).map(a => new Binary(a)),
		multisigAddresses: (multisigAddresses || []).map(a => new Binary(a))
	}
});

const multisigDbTestUtils = {
	db: {
		createMultisigEntry,
		runDbTest: (dbEntities, issueDbCommand, assertDbCommandResult) =>
			dbTestUtils.db.runDbTest(dbEntities, 'multisigs', db => new MultisigDb(db), issueDbCommand, assertDbCommandResult)
	}
};

describe('multisigs db', () => {
	const ownerAddressTest1 = test.random.address();
	const ownerAddressTest2 = test.random.address();
	const ownerAddressTest3 = test.random.address();
	const ownerAddressTest4 = test.random.address();

	it('returns with no params', () => {
		// Arrange:
		const paginationOptions = {
			pageSize: 10,
			pageNumber: 1,
			sortField: 'id',
			sortDirection: -1
		};

		const dbMultisigs = [
			createMultisigEntry(10, ownerAddressTest1, [ownerAddressTest3], [ownerAddressTest3]),
			createMultisigEntry(20, ownerAddressTest2, [ownerAddressTest3], [ownerAddressTest3]),
			createMultisigEntry(30, ownerAddressTest3, [ownerAddressTest3], [ownerAddressTest3]),
			createMultisigEntry(40, ownerAddressTest3, [ownerAddressTest3, ownerAddressTest2], []),
			createMultisigEntry(50, ownerAddressTest1, [ownerAddressTest3], [ownerAddressTest3, ownerAddressTest2]),
			createMultisigEntry(60, ownerAddressTest1, [ownerAddressTest3], [ownerAddressTest4])
		];

		return multisigDbTestUtils.db.runDbTest(
			dbMultisigs,
			db => db.multisigs(undefined, paginationOptions),
			page => {
				expect(page.data.length).to.equal(6);
				expect(page.data[0].id).to.deep.equal(createObjectId(60));
				expect(page.data[1].id).to.deep.equal(createObjectId(50));
				expect(page.data[2].id).to.deep.equal(createObjectId(40));
				expect(page.data[3].id).to.deep.equal(createObjectId(30));
				expect(page.data[4].id).to.deep.equal(createObjectId(20));
				expect(page.data[5].id).to.deep.equal(createObjectId(10));
			}
		);
	});

	it('returns with address param', () => {
		// Arrange:
		const paginationOptions = {
			pageSize: 10,
			pageNumber: 1,
			sortField: 'id',
			sortDirection: 1
		};

		const dbMultisigs = [
			createMultisigEntry(10, ownerAddressTest1, [ownerAddressTest3], [ownerAddressTest3]),
			createMultisigEntry(20, ownerAddressTest2, [ownerAddressTest3], [ownerAddressTest3]),
			createMultisigEntry(30, ownerAddressTest3, [ownerAddressTest3], [ownerAddressTest3]),
			createMultisigEntry(40, ownerAddressTest3, [ownerAddressTest3, ownerAddressTest2], []),
			createMultisigEntry(50, ownerAddressTest1, [ownerAddressTest3], [ownerAddressTest3, ownerAddressTest2]),
			createMultisigEntry(60, ownerAddressTest1, [ownerAddressTest3], [ownerAddressTest4])
		];
		return multisigDbTestUtils.db.runDbTest(
			dbMultisigs,
			db => db.multisigs(ownerAddressTest2, paginationOptions),
			page => {
				expect(page.data.length).to.deep.equal(3);
				expect(page.data[0].id).to.deep.equal(createObjectId(20));
				expect(page.data[1].id).to.deep.equal(createObjectId(40));
				expect(page.data[2].id).to.deep.equal(createObjectId(50));
			}
		);
	});
});

Object.assign(multisigDbTestUtils, test);

module.exports = multisigDbTestUtils;
