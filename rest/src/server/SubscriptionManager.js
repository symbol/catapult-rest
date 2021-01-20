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

const MultisigDb = require('../plugins/multisig/MultisigDb');
const catapult = require('catapult-sdk');
const winston = require('winston');

const { address } = catapult.model;

/**
 * Manages client subscriptions.
 */
class SubscriptionManager {
	/**
	 * Creates a subscription manager.
	 * @param {object} subscriptionCallbacks Callbacks to invoke in response to subscription changes.
	 * @param {object} db Catapult DB.
	 */
	constructor(subscriptionCallbacks, db) {
		this.subscriptions = {};
		this.callbacks = Object.assign({ newClient: () => {} }, subscriptionCallbacks);
		this.catapultDb = db;
	}

	/**
	 * Subscribes a client to a channel.
	 * @param {string} channel Channel to subscribe.
	 * @param {object} client Client.
	 */
	add(channel, client) {
		// Get the address from incoming subscription,
		// Check and subscribe the multisig account if current subscriber is cosigner.
		const currentSubscriber = channel.split('/')[1];
		if (currentSubscriber)
			this.subscribeMultisigAccount(currentSubscriber, channel, client);

		if (!(channel in this.subscriptions)) {
			this.subscriptions[channel] = new Set();
			try {
				this.callbacks.newChannel(channel, this.subscriptions[channel]);
			} catch (err) {
				delete this.subscriptions[channel];
				throw err;
			}
		}

		if (this.subscriptions[channel].has(client))
			return;

		this.subscriptions[channel].add(client);
		this.callbacks.newClient(channel, client);
	}

	/**
	 * Unsubscribes a client from a channel.
	 * @param {string} channel Channel to unsubscribe.
	 * @param {object} client Client.
	 */
	delete(channel, client) {
		const subscriptions = this.subscriptions[channel];
		if (!subscriptions)
			return;

		subscriptions.delete(client);
		if (!subscriptions.size) {
			delete this.subscriptions[channel];
			winston.debug(`all subscriptions to channel '${channel}' have been removed`);
			this.callbacks.removeChannel(channel);
		}
	}

	/**
	 * Gets all active subscriptions for a client.
	 * @param {object} client Client.
	 * @returns {array<string>} Client's subscribed channels.
	 */
	clientSubscriptions(client) {
		return Object.keys(this.subscriptions).filter(channel => this.subscriptions[channel].has(client));
	}

	/**
	 * Unsubscribes a client from all channels.
	 * @param {object} client Client.
	 */
	deleteClient(client) {
		Object.keys(this.subscriptions).forEach(channel => {
			this.delete(channel, client);
		});
	}

	/**
	 * Check if the current subscriber is a cosigner of a multisig account.
	 * Then subscribe the multisig account for cosigning notification
	 * @param {string} encodedAddress encloded address of the current subscriber
	 * @param {object} channel current subscribing channel
	 * @param {object} client current subscribeing client
	 */
	subscribeMultisigAccount(encodedAddress, channel, client) {
		const decodedAddress = address.stringToAddress(encodedAddress);
		new MultisigDb(this.catapultDb).multisigsByAddresses([decodedAddress])
			.then(multisigEntries => {
				if (multisigEntries.length) {
					multisigEntries[0].multisig.multisigAddresses.map(m => {
						const multisigAddress = address.addressToString(m.buffer);
						return this.add(channel.replace(encodedAddress, multisigAddress), client);
					});
				}
			});
	}
}

module.exports = SubscriptionManager;
