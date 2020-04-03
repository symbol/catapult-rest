
class MockSocket {
	constructor() {
		this.authorized = false;
		this.numWrites = 0;
		this.onceEventHandlers = {};
		this.onEventHandlers = {};
	}

	once(event, handler) {
		this.onceEventHandlers[event] = handler;
		return this;
	}

	on(event, handler) {
		this.onEventHandlers[event] = handler;
		return this;
	}

	write() {
		this.numWrites++;
	}

	fireEvent(event) {
		const onceEvent = this.onceEventHandlers[event];
		if (onceEvent) {
			delete this.onceEventHandlers[event];
			onceEvent();
		} else if (this.onEventHandlers[event]) {
			this.onEventHandlers[event]();
		}
	}
}

module.exports = {
	MockSocket
};
