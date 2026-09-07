import { ConstantBackoff } from './backoff/ConstantBackoff.js';
import { neverAbortedSignal } from './common/abort.js';
import { EventEmitter } from './common/Event.js';
const delay = (duration, unref) => new Promise(resolve => {
    const timer = setTimeout(resolve, duration);
    if (unref) {
        timer.unref();
    }
});
export class RetryPolicy {
    options;
    executor;
    onGiveUpEmitter = new EventEmitter();
    onRetryEmitter = new EventEmitter();
    /**
     * @inheritdoc
     */
    get onSuccess() {
        return this.executor.onSuccess;
    }
    /**
     * @inheritdoc
     */
    get onFailure() {
        return this.executor.onFailure;
    }
    /**
     * Emitter that fires when we retry a call, before any backoff.
     *
     */
    onRetry = this.onRetryEmitter.addListener;
    /**
     * Emitter that fires when we're no longer retrying a call and are giving up.
     */
    onGiveUp = this.onGiveUpEmitter.addListener;
    constructor(options, executor) {
        this.options = options;
        this.executor = executor;
    }
    /**
     * When retrying, a referenced timer is created. This means the Node.js event
     * loop is kept active while we're delaying a retried call. Calling this
     * method on the retry builder will unreference the timer, allowing the
     * process to exit even if a retry might still be pending.
     */
    dangerouslyUnref() {
        return new RetryPolicy({ ...this.options, unref: true }, this.executor.clone());
    }
    /**
     * Executes the given function with retries.
     * @param fn Function to run
     * @returns a Promise that resolves or rejects with the function results.
     */
    async execute(fn, signal = neverAbortedSignal) {
        const factory = this.options.backoff || new ConstantBackoff(0);
        let backoff;
        for (let retries = 0;; retries++) {
            const result = await this.executor.invoke(fn, { attempt: retries, signal });
            if ('success' in result) {
                return result.success;
            }
            if (!signal.aborted && retries < this.options.maxAttempts) {
                const context = { attempt: retries + 1, signal, result };
                backoff = backoff ? backoff.next(context) : factory.next(context);
                const delayDuration = backoff.duration;
                const delayPromise = delay(delayDuration, !!this.options.unref);
                // A little sneaky reordering here lets us use Sinon's fake timers
                // when we get an emission in our tests.
                this.onRetryEmitter.emit({ ...result, delay: delayDuration, attempt: retries + 1 });
                await delayPromise;
                continue;
            }
            this.onGiveUpEmitter.emit(result);
            if ('error' in result) {
                throw result.error;
            }
            return result.value;
        }
    }
}
//# sourceMappingURL=RetryPolicy.js.map