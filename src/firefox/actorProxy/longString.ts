import { Log } from '../../util/log';
import { EventEmitter } from 'events';
import { DebugConnection } from '../connection';
import { PendingRequests } from './pendingRequests';
import { ActorProxy } from './interface';

let log = Log.create('LongStringGripActorProxy');

export class LongStringGripActorProxy extends EventEmitter implements ActorProxy {
	
	private pendingSubstringRequests = new PendingRequests<string>();

	constructor(private grip: FirefoxDebugProtocol.LongStringGrip, private connection: DebugConnection) {
		super();
		this.connection.register(this);
	}

	public get name() {
		return this.grip.actor;
	}

	public extendLifetime() {
		this.connection.sendRequest({ to: this.name, type: 'threadGrip' });
	}
	
	public fetchContent(): Promise<string> {
		
		log.debug(`Fetching content from long string ${this.name}`);

		return new Promise<string>((resolve, reject) => {
			this.pendingSubstringRequests.enqueue({ resolve, reject });
			this.connection.sendRequest({ to: this.name, type: 'substring', start: 0, end: this.grip.length });
		});
	}
	
	public receiveResponse(response: FirefoxDebugProtocol.Response): void {

		if (response['substring'] !== undefined) {
		
			log.debug(`Content fetched from ${this.name}`);
			this.pendingSubstringRequests.resolveOne(response['substring']);
			
		} else if (response['error'] === 'noSuchActor') {
			
			log.error(`No such actor ${JSON.stringify(this.grip)}`);
			this.pendingSubstringRequests.rejectAll('No such actor');

		} else if (Object.keys(response).length === 1) {
			
			log.debug('Received response to threadGrip or release request');
			
		} else {
			
			log.warn("Unknown message from LongStringActor: " + JSON.stringify(response));
			
		}
	}
}
