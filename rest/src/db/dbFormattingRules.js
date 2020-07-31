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

const { longToUint64 } = require('./dbUtils');
const catapult = require('catapult-sdk');

const { ModelType, status } = catapult.model;
const { convert, uint64 } = catapult.utils;

module.exports = {
	[ModelType.none]: value => value,
	// `binary` should support both mongo binary buffers and intermediate js buffers
	[ModelType.binary]: value => (convert.uint8ToHex(value.buffer instanceof ArrayBuffer ? value : value.buffer)),
	[ModelType.objectId]: value => (undefined === value ? '' : value.toHexString().toUpperCase()),
	[ModelType.statusCode]: value => status.toString(value >>> 0),
	[ModelType.string]: value => value.toString(),
	// `uint` and `int` formatters
	[ModelType.uint]: value => convert.int32ToUint32(value),
	[ModelType.uint64]: value => uint64.toString(longToUint64(value)),
	[ModelType.uint64HexIdentifier]: value => uint64.toHex(longToUint64(value)),
	[ModelType.int]: value => value.valueOf()
};
