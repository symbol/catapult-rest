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

const zmqUtils = require('./zmqUtils');

const findSubscriptionfilter = (key, channelDescriptors) => {
	const [topicCategory, topicParam] = key.split('/');
	if (!(topicCategory in channelDescriptors))
		throw new Error(`unknown topic category ${topicCategory}`);

	const descriptor = channelDescriptors[topicCategory];
	const filter = descriptor.filter(topicParam);
	return filter;
};

/**
 * Service for creating channel-specific zmq sockets.
 * @param {object} zsocket server zeroMQ socket.
 * @param {object} subscriptions server subscriptions
 * @param {object} channelDescriptors Registered message channel descriptors.
 * @param {object} logger Level-based logger object.
 * @returns {object} zmq connection service that is a stripped down EventEmitter.
 */
module.exports.createZmqConnectionService = (zsocket, subscriptions, channelDescriptors, logger) =>
	zmqUtils.createMultisocketEmitter((key) => {
		logger.info(`subscribing to ${key}`);
		const filter = findSubscriptionfilter(key, channelDescriptors);
		if (!(key in subscriptions)) {
			zsocket.subscribe(filter);
			subscriptions[key] = {filter, key};
		}
		return zsocket;
	});
