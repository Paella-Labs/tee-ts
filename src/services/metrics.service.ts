import * as metrics from "datadog-metrics";
import type { EnvConfig } from "../config";

export class DatadogMetricsService {
	private static instance: DatadogMetricsService | null = null;
	private readonly sendMetrics: boolean;
	private static isInitialized = false;

	private constructor(
		private readonly config: EnvConfig,
		private readonly options: { logging: boolean } = { logging: true },
	) {
		this.sendMetrics = config.DATADOG_METRICS_ENABLED;

		if (this.sendMetrics) {
			this.initMetricsIdempotent();
		} else {
			console.log("[DatadogMetrics] Metrics disabled");
		}
	}

	public static getInstance(
		config: EnvConfig,
		options: { logging: boolean } = { logging: true },
	): DatadogMetricsService {
		if (!DatadogMetricsService.instance) {
			DatadogMetricsService.instance = new DatadogMetricsService(
				config,
				options,
			);
		}
		return DatadogMetricsService.instance;
	}

	private initMetricsIdempotent() {
		if (DatadogMetricsService.isInitialized) {
			return;
		}

		metrics.init({
			host: "tee-ts", // Service hostname
			prefix: "crossmint_tee.",
			apiKey: this.config.DATADOG_API_KEY,
			defaultTags: [
				`service:${this.config.DD_SERVICE}`,
				`environment:${this.config.DD_ENV}`,
				`version:${this.config.DD_VERSION}`,
			],
			flushIntervalSeconds: 10, // Flush every 10 seconds
		});

		console.log("[DatadogMetrics] Metrics service initialized");
		DatadogMetricsService.isInitialized = true;
	}

	gauge(name: string, value: number, tags: string[] = []) {
		if (!this.sendMetrics) {
			return;
		}

		this.log(`Logging gauge metric: ${name} ${value} ${tags.join(", ")}`);
		metrics.gauge(name, value, tags);
	}

	distribution(name: string, value: number, tags: string[] = []) {
		if (!this.sendMetrics) {
			return;
		}

		this.log(
			`Logging distribution metric: ${name} ${value} ${tags.join(", ")}`,
		);
		metrics.distribution(name, value, tags);
	}

	histogram(name: string, value: number, tags: string[] = []) {
		if (!this.sendMetrics) {
			return;
		}

		this.log(`Logging histogram metric: ${name} ${value} ${tags.join(", ")}`);
		metrics.histogram(name, value, tags);
	}

	increment(name: string, value = 1, tags: string[] = []) {
		if (!this.sendMetrics) {
			return;
		}

		this.log(`Logging increment metric: ${name} ${value} ${tags.join(", ")}`);
		metrics.increment(name, value, tags);
	}

	/**
	 * Flushes the metrics buffer. Calling this is unnecessary 99% of the time as
	 * the metrics are automatically flushed every 10 seconds.
	 */
	async flush() {
		if (!this.sendMetrics) {
			return;
		}

		const flushPromise = new Promise<void>((resolve, reject) => {
			metrics.flush(resolve, reject);
		});

		try {
			await flushPromise;
			this.log("Metrics flushed successfully");
		} catch (error) {
			console.error(
				`[DatadogMetrics] Error reporting metrics to datadog: ${error}`,
			);
		}
	}

	private log(message: string) {
		if (this.options.logging) {
			console.log(`[DatadogMetrics] ${message}`);
		}
	}
}
