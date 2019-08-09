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

/** @module plugins/mosaicRestrictions */
const EntityType = require('../model/EntityType');
const ModelType = require('../model/ModelType');
const sizes = require('../modelBinary/sizes');

const constants = { sizes };

/**
 * Creates a mosaic restrictions plugin.
 * @type {module:plugins/CatapultPlugin}
 */
const mosaicRestrictionsPlugin = {

	registerSchema: builder => {
		builder.addSchema('mosaicRestrictions.restriction.mosaic.rule', {
			referenceMosaicId: ModelType.uint64,
			restrictionValue: ModelType.uint64
		})

		builder.addSchema('mosaicRestrictions.restriction.address', {
			key: ModelType.uint64,
			value: ModelType.uint64
		});

		builder.addSchema('mosaicRestrictions.restriction.mosaic', {
			key: ModelType.uint64,
			rule: { type: ModelType.object, schemaName: 'mosaicRestrictions.restriction.mosaic.rule' }
		});

		builder.addSchema('mosaicRestriction.addressModificationType', {
			compositeHash: ModelType.binary,
			mosaicId: ModelType.uint64,
			address: ModelType.binary,
			restrictions: { type: ModelType.array, schemaName: 'mosaicRestrictions.restriction.address' }
		});

		builder.addSchema('mosaicRestriction.globalModificationType', {
			compositeHash: ModelType.binary,
			mosaicId: ModelType.uint64,
			restrictions: { type: ModelType.array, schemaName: 'mosaicRestrictions.restriction.mosaic' }
		});

	},

	registerCodecs: codecBuilder => {
		codecBuilder.addTransactionSupport(EntityType.mosaicRestrictionAddress, {
			deserialize: parser => {
				const transaction = {};
				transaction.mosaicId = parser.uint64();
				transaction.restrictionKey = parser.uint64();
				transaction.targetAddress = parser.buffer(constants.sizes.addressDecoded);
				transaction.previousRestrictionValue = parser.uint64();
				transaction.newRestrictionValue = parser.uint64();
				return transaction;
			},

			serialize: (transaction, serializer) => {
				serializer.writeUint64(transaction.mosaicId);
				serializer.writeUint64(transaction.restrictionKey);
				serializer.writeBuffer(transaction.targetAddress);
				serializer.writeUint64(transaction.previousRestrictionValue);
				serializer.writeUint64(transaction.newRestrictionValue);
			}
		});

		codecBuilder.addTransactionSupport(EntityType.mosaicRestrictionGlobal, {
			deserialize: parser => {
				const transaction = {};
				transaction.mosaicId = parser.uint64();
				transaction.referenceMosaicId = parser.uint64();
				transaction.restrictionKey = parser.uint64();
				transaction.previousRestrictionValue = parser.uint64();
				transaction.previousRestrictionType = parser.uint8();
				transaction.newRestrictionValue = parser.uint64();
				transaction.newRestrictionType = parser.uint8();
				return transaction;
			},

			serialize: (transaction, serializer) => {
				serializer.writeUint64(transaction.mosaicId);
				serializer.writeUint64(transaction.referenceMosaicId);
				serializer.writeUint64(transaction.restrictionKey);
				serializer.writeUint64(transaction.previousRestrictionValue);
				serializer.writeUint8(transaction.previousRestrictionType);
				serializer.writeUint64(transaction.newRestrictionValue);
				serializer.writeUint8(transaction.newRestrictionType);
			}
		});
	}
};

module.exports = mosaicRestrictionsPlugin;
