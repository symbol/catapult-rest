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

const ModelType = require('../../src/model/ModelType');
const { expect } = require('chai');

describe('model type enumeration', () => {
	it('exposes expected types', () => {
		// Assert:
		expect(ModelType).to.deep.equal({
			none: 0,
			array: 1,
			dictionary: 2,
			object: 3,
			binary: 4,
			objectId: 5,
			statusCode: 6,
			string: 7,
			uint8: 8,
			uint16: 9,
			uint32: 10,
			uint64: 11,
			uint64HexIdentifier: 12,
			int: 13,
			boolean: 14,
			encodedAddress: 15,
			max: 15
		});
	});
});
