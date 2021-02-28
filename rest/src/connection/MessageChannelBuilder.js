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

const catapult = require('catapult-sdk');

const createBlockDescriptor = (name, marker, handler) => ({
	filter: topicParam => {
		if (topicParam)
			throw new Error('unexpected param to block subscription');

		return marker;
	}
});

const { convert } = catapult.utils;
const { namespace, address } = catapult.model;

const createPolicyBasedAddressFilter = (markerByte, emptyAddressHandler, networkIdentifier) => topicParam => {
	if (!topicParam)
		return emptyAddressHandler(markerByte);

	// If the sent param is an namespace id hex like C0FB8AA409916260
	if (convert.isHexString(topicParam) && 16 === topicParam.length) {
		const addressByteArray = namespace.encodeNamespace(convert.hexToUint8(topicParam), networkIdentifier);
		return Buffer.concat([Buffer.of(markerByte), Buffer.from(addressByteArray)]);
	}
	// When it's a encoded address.
	// TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A
	const addressByteArray = address.stringToAddress(topicParam);
	return Buffer.concat([Buffer.of(markerByte), Buffer.from(addressByteArray)]);
};

/**
 * Builder for creating message channel information.
 */
class MessageChannelBuilder {
	/**
	 * Creates a builder.
	 * @param {object} config Message queue configuration.
	 * @param {number} networkIdentifier the network identifier
	 */
	constructor(config, networkIdentifier) {
		this.descriptors = {};
		this.channelMarkers = {};

		const emptyAddressHandler = config && config.allowOptionalAddress
			? markerByte => Buffer.of(markerByte)
			: () => { throw new Error('address param missing from address subscription'); };

		this.createAddressFilter = markerChar =>
			createPolicyBasedAddressFilter(markerChar.charCodeAt(0), emptyAddressHandler, networkIdentifier);

		// add basic descriptors
		this.descriptors.block = createBlockDescriptor(
			'block',
			Buffer.of(0x49, 0x6A, 0xCA, 0x80, 0xE4, 0xD8, 0xF2, 0x9F)
		);
		this.descriptors.finalizedBlock = createBlockDescriptor(
			'finalizedBlock',
			Buffer.of(0x54, 0x79, 0xCE, 0x31, 0xA0, 0x32, 0x48, 0x4D)
		);
		this.add('confirmedAdded', 'a');
		this.add('unconfirmedAdded', 'u');
		this.add('unconfirmedRemoved', 'r');
		this.descriptors.status = {
			filter: this.createAddressFilter('s')
		};
	}

	/**
	 * Adds support for a new channel.
	 * @param {string} name Channel name.
	 * @param {string} markerChar Channel marker character.
	 */
	add(name, markerChar) {
		if (name in this.descriptors)
			throw Error(`'${name}' channel has already been registered`);

		if (1 !== markerChar.length)
			throw Error('channel marker must be single character');

		if (markerChar in this.channelMarkers)
			throw Error(`'${markerChar}' channel marker has already been registered`);

		this.descriptors[name] = { filter: this.createAddressFilter(markerChar)};
		this.channelMarkers[markerChar] = 1;
	}

	/**
	 * Builds and returns an object composed of all configured channel information.
	 * @returns {object} An object composed of all configured channel information.
	 */
	build() {
		return this.descriptors;
	}
}

module.exports = MessageChannelBuilder;
