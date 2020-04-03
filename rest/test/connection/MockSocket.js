
class MockSocket {
	authorized = false;
	numWrites = 0;
	onceEventHandlers = {};
	onEventHandlers = {};

	once = (event, handler) => {
		this.onceEventHandlers[event] = handler;
		return this;
	}

	on = (event, handler) => {
		this.onEventHandlers[event] = handler;
		return this;
	}

	write = (event, handler) => {
		this.numWrites++;
	}
	
	fireEvent = (event) => {
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
