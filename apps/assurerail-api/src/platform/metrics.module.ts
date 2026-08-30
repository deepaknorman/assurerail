import { Module } from "@nestjs/common";
import { StoreModule } from "../store/store.module";
import { MetricsController } from "./metrics.controller";
import { HealthController } from "./health.controller";

// Always-on Prometheus scrape endpoint (/metrics, @Public) + liveness/readiness (/healthz, /readyz).
// Reads only MintRepository, so it works in both DB and in-memory modes — Grafana/alerting on the box
// scrapes /metrics; uptime checks + the LivenessSentinel hit /healthz + /readyz.
@Module({
  imports: [StoreModule],
  controllers: [MetricsController, HealthController],
})
export class MetricsModule {}
