/**
 * The connectivity lifecycle. `starting` means the listener is attached and no
 * value has arrived yet, so an event that lands during the first read is newer
 * than that read and wins. `online` is kept through a stop.
 */
export type ConnectivityState = {
	kind: 'stopped' | 'starting' | 'listening';
	online: boolean;
};

export type ConnectivityEvent =
	| { type: 'start_requested' }
	| { type: 'event_received'; online: boolean }
	| { type: 'initial_read'; online: boolean }
	| { type: 'stop_requested' };

/** Unknown counts as online (see `isOnlineFrom`). */
export const initialConnectivityState: ConnectivityState = {
	kind: 'stopped',
	online: true,
};

export const connectivityTransition = (
	state: ConnectivityState,
	event: ConnectivityEvent,
): ConnectivityState => {
	switch (event.type) {
		case 'start_requested':
			return state.kind === 'stopped'
				? { kind: 'starting', online: state.online }
				: state;
		case 'event_received':
			return state.kind === 'stopped'
				? state
				: { kind: 'listening', online: event.online };
		case 'initial_read':
			return state.kind === 'starting'
				? { kind: 'listening', online: event.online }
				: state;
		case 'stop_requested':
			return state.kind === 'stopped'
				? state
				: { kind: 'stopped', online: state.online };
		default:
			return event satisfies never;
	}
};
