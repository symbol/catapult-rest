
class MockSocket {
	authorized = false
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
